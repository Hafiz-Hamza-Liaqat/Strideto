import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { AgentService } from '../models/agent/AgentService.js';
import { Consultation } from '../models/consultation/Consultation.js';
import { ProfessionalCase } from '../models/case/ProfessionalCase.js';
import { consultationInternals } from '../services/consultationService.js';
import { getCase } from '../services/caseManagementService.js';

function disposableUri() {
  if (process.env.STRIDETO_HISTORICAL_TRUTH_TEST_MONGO_URI) return process.env.STRIDETO_HISTORICAL_TRUTH_TEST_MONGO_URI;
  if (process.env.MONGO_URI) {
    const value = new URL(process.env.MONGO_URI);
    value.pathname = '/strideto_p2a_historical_truth_run1';
    value.search = '';
    return value.toString();
  }
  return 'mongodb://127.0.0.1:27017/strideto_p2a_historical_truth_run1';
}

const TEST_URI = disposableUri();
if (!/\/strideto_p2a_historical_truth_[a-z0-9_-]+(?:\?|$)/i.test(TEST_URI)) throw new Error('Historical truth test requires a disposable database');

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('old engagement remains A and a new engagement after edit uses B', async () => {
  const student = await User.create({ name: 'Historical Student', email: 'historical-student@example.test', password: 'TestPass123!' });
  const account = await AgentAccount.create({ email: 'historical-provider@example.test', password: 'TestPass123!', accountStatus: 'active' });
  const organization = await Organization.create({ organizationType: 'agent', displayName: 'Historical Provider', status: 'active' });
  const profile = await AgentProfile.create({ agentAccountId: account._id, organizationId: organization._id, agentType: 'agent', professionalName: 'Historical Provider' });
  const membership = await AgentMembership.create({ organizationId: organization._id, agentAccountId: account._id, role: 'owner', active: true });
  const service = await AgentService.create({
    organizationId: organization._id,
    agentProfileId: profile._id,
    title: 'Historical Service A',
    category: 'university_application_support',
    description: 'Original application preparation scope',
    pricingMode: 'fixed_price',
    price: { amountMinor: 15000, currency: 'USD' },
    deliveryMode: 'online',
    destinationCountries: ['US'],
    durationEstimate: 'Six weeks',
    eligibilityNotes: 'Original scope',
    status: 'active',
  });
  const originalSnapshot = consultationInternals.snapshotService(service.toObject());
  const consultation = await Consultation.create({
    studentUserId: student._id,
    organizationId: organization._id,
    assignedMembershipId: membership._id,
    agentServiceId: service._id,
    serviceSnapshot: originalSnapshot,
    status: 'completed',
    requestedWindow: { start: new Date('2026-08-01T10:00:00Z'), end: new Date('2026-08-01T11:00:00Z') },
    durationMinutes: 60,
    timezone: 'UTC',
    meetingMode: 'video',
    purpose: 'Historical truth proof',
    paymentState: 'payment_not_configured',
    completion: { completedAt: new Date('2026-08-01T11:00:00Z') },
  });
  const professionalCase = await ProfessionalCase.create({
    studentUserId: student._id,
    organizationId: organization._id,
    assignedMembershipId: membership._id,
    authorizedMembershipIds: [membership._id],
    consultationId: consultation._id,
    caseType: 'study',
    workflowId: 'study_v1',
    workflowVersion: 1,
    lifecycle: 'completed',
    currentStage: 'closed',
    title: 'Historical Case',
  });

  const beforeEdit = await getCase('student', student._id, professionalCase._id);
  assert.equal(beforeEdit.context.service.title, 'Historical Service A');
  assert.equal(beforeEdit.context.service.price.amountMinor, 15000);
  assert.equal(beforeEdit.context.service.price.currency, 'USD');

  service.title = 'Historical Service B';
  service.category = 'career_guidance';
  service.description = 'Updated career guidance scope';
  service.price = { amountMinor: 30000, currency: 'USD' };
  service.destinationCountries = ['CA'];
  await service.save();

  const afterEdit = await getCase('student', student._id, professionalCase._id);
  assert.equal(afterEdit.context.service.title, 'Historical Service A');
  assert.equal(afterEdit.context.service.category, 'university_application_support');
  assert.equal(afterEdit.context.service.description, 'Original application preparation scope');
  assert.equal(afterEdit.context.service.price.amountMinor, 15000);
  assert.deepEqual(afterEdit.context.service.destinationCountries, ['US']);
  assert.equal(afterEdit.context.service.source, 'engagement_snapshot');

  const updatedSnapshot = consultationInternals.snapshotService(service.toObject());
  assert.equal(updatedSnapshot.title, 'Historical Service B');
  assert.equal(updatedSnapshot.category, 'career_guidance');
  assert.equal(updatedSnapshot.description, 'Updated career guidance scope');
  assert.equal(updatedSnapshot.price.amountMinor, 30000);
  assert.deepEqual(updatedSnapshot.destinationCountries, ['CA']);
});
