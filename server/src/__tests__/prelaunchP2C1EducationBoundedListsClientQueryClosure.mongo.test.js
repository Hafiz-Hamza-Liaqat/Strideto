import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { AgentService } from '../models/agent/AgentService.js';
import { AgentLead } from '../models/agent/AgentLead.js';
import { Consultation } from '../models/consultation/Consultation.js';
import { ProfessionalCase } from '../models/case/ProfessionalCase.js';
import { getLeads, getServices, listClientsForAgent } from '../services/agentProfileService.js';
import { listAgentConsultations } from '../services/consultationService.js';
import { listCases } from '../services/caseManagementService.js';

const TEST_URI = process.env.STRIDETO_P2C1_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/strideto_p2c1_education_lists_run1';
if (!/\/strideto_p2c1_[a-z0-9_-]+(?:\?|$)/i.test(TEST_URI)) throw new Error('P2C-1 test requires a disposable strideto_p2c1_* database');

let provider;
let students;
let capturedPipeline;

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
  const account = await AgentAccount.create({ email: 'p2c1-provider@example.test', password: 'TestPass123!', accountStatus: 'active' });
  const organization = await Organization.create({ organizationType: 'agent', displayName: 'P2C1 Provider', status: 'active' });
  const profile = await AgentProfile.create({ agentAccountId: account._id, organizationId: organization._id, agentType: 'agent', professionalName: 'P2C1 Provider' });
  const membership = await AgentMembership.create({ organizationId: organization._id, agentAccountId: account._id, role: 'owner', active: true });
  provider = { account, organization, profile, membership };
  students = await User.insertMany(Array.from({ length: 65 }, (_, index) => ({ name: `Student ${String(index).padStart(2, '0')}`, email: `p2c1-student-${index}@example.test`, password: 'TestPass123!' })));
  const now = Date.now();
  await AgentService.insertMany(Array.from({ length: 55 }, (_, index) => ({ organizationId: organization._id, agentProfileId: profile._id, title: `Service ${index}`, category: 'career_guidance', description: 'Bounded service', pricingMode: 'free', deliveryMode: 'online', journeyType: 'other', status: 'draft', createdAt: new Date(now + index), updatedAt: new Date(now + index) })));
  await AgentLead.insertMany(students.map((student, index) => ({ organizationId: organization._id, userId: student._id, source: 'consultation_request', context: `Context ${index}`, status: index % 2 ? 'contacted' : 'new', createdAt: new Date(now + index), updatedAt: new Date(now + index) })));
  await Consultation.insertMany(students.map((student, index) => ({ studentUserId: student._id, organizationId: organization._id, assignedMembershipId: membership._id, agentServiceId: new mongoose.Types.ObjectId(), consultationType: 'initial', status: 'confirmed', requestedWindow: { start: new Date(now + index + 86400000), end: new Date(now + index + 90000000) }, durationMinutes: 60, timezone: 'UTC', meetingMode: 'video', purpose: `Purpose ${index}`, paymentState: 'free', createdAt: new Date(now + index), updatedAt: new Date(now + index) })));
  await ProfessionalCase.insertMany(students.map((student, index) => ({ studentUserId: student._id, organizationId: organization._id, assignedMembershipId: membership._id, authorizedMembershipIds: [membership._id], caseType: 'general_guidance', workflowId: 'general_guidance-case', workflowVersion: 1, lifecycle: index === 0 ? 'awaiting_student_acceptance' : 'active', currentStage: 'intake', title: `Case ${index}`, createdAt: new Date(now + index), updatedAt: new Date(now + index) })));
  await AgentLead.collection.createIndex({ organizationId: 1, userId: 1 }, { unique: true });
  await Consultation.collection.createIndex({ organizationId: 1 });
  await ProfessionalCase.collection.createIndex({ organizationId: 1 });
  mongoose.set('debug', (collection, method, query) => { if (collection === AgentLead.collection.name && method === 'aggregate') capturedPipeline = query; });
});

after(async () => {
  mongoose.set('debug', false);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('Services, Leads, Consultations, and Cases enforce bounds and stable pages', async () => {
  const services = await getServices(provider.account._id, { page: 2, limit: 999 });
  assert.equal(services.limit, 50); assert.equal(services.total, 55); assert.equal(services.services.length, 5);
  const leads = await getLeads(provider.account._id, { page: 2, limit: 20 });
  assert.equal(leads.total, 65); assert.equal(leads.leads.length, 20); assert.equal(leads.totalPages, 4);
  const consultations = await listAgentConsultations(provider.account._id, { page: 4, limit: 20 });
  assert.equal(consultations.total, 65); assert.equal(consultations.consultations.length, 5);
  const providerCases = await listCases('agent', provider.account._id, { page: 4, limit: 20 });
  assert.equal(providerCases.total, 65); assert.equal(providerCases.cases.length, 5);
  const studentCases = await listCases('student', students[0]._id, { page: -4, limit: 5000 });
  assert.equal(studentCases.page, 1); assert.equal(studentCases.limit, 50); assert.equal(studentCases.total, 1);
});

test('Client aggregation returns bounded unique stable pages without cross-provider records', async () => {
  const first = await listClientsForAgent(provider.account._id, { page: 1, limit: 20 });
  const second = await listClientsForAgent(provider.account._id, { page: 2, limit: 20 });
  assert.equal(first.total, 65); assert.equal(first.clients.length, 20); assert.equal(first.totalPages, 4);
  assert.equal(new Set([...first.clients, ...second.clients].map((row) => row.userId)).size, 40);
  assert.ok(first.clients.every((row) => row.consultationCount === 1 && row.caseCount === 1));
  const searched = await listClientsForAgent(provider.account._id, { q: 'Student 64', page: 1, limit: 20 });
  assert.equal(searched.total, 1); assert.equal(searched.clients[0].displayName, 'Student');
  assert.ok(Array.isArray(capturedPipeline));
});

test('exact Client aggregate uses indexed provider scopes and bounded output', async () => {
  const explain = await AgentLead.aggregate(capturedPipeline).explain('executionStats');
  const serialized = JSON.stringify(explain);
  assert.match(serialized, /IXSCAN/);
  assert.doesNotMatch(serialized, /COLLSCAN/);
  const response = await listClientsForAgent(provider.account._id, { page: 1, limit: 20 });
  const bytes = Buffer.byteLength(JSON.stringify(response));
  assert.ok(bytes < 50000, `one Client page is unexpectedly large: ${bytes} bytes`);
  const observations = [];
  const indexNames = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.indexName === 'string') indexNames.add(value.indexName);
    if ('totalDocsExamined' in value || 'totalKeysExamined' in value) observations.push({
      nReturned: value.nReturned,
      totalDocsExamined: value.totalDocsExamined,
      totalKeysExamined: value.totalKeysExamined,
      indexName: value.executionStages?.indexName || value.queryPlanner?.winningPlan?.inputStage?.indexName || null,
    });
    Object.values(value).forEach(visit);
  };
  visit(explain);
  console.log(`P2C1_EXECUTION_STATS ${JSON.stringify({ pageSize: response.clients.length, responseBytes: bytes, total: response.total, planContainsIxscan: serialized.includes('IXSCAN'), planContainsCollscan: serialized.includes('COLLSCAN'), indexNames: [...indexNames], observations })}`);
});
