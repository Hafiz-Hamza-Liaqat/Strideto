import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { AgentService } from '../models/agent/AgentService.js';
import { AgentMarketplacePost } from '../models/agent/AgentMarketplacePost.js';
import { Organization } from '../models/Organization.js';
import { OrganizationVerification } from '../models/OrganizationVerification.js';
import { ProviderDomainEnrollment } from '../models/gbs/ProviderDomainEnrollment.js';
import { Consultation } from '../models/consultation/Consultation.js';
import { ProfessionalCase } from '../models/case/ProfessionalCase.js';
import { AGENT_SERVICE_CATEGORIES } from '../../../shared/agent/constants.js';
import { createService, getPublicDirectory, getPublicProfileBySlug, updateService } from '../services/agentProfileService.js';

function disposableUri() {
  if (process.env.STRIDETO_P2A_TEST_MONGO_URI) return process.env.STRIDETO_P2A_TEST_MONGO_URI;
  if (process.env.STRIDETO_P2A_USE_RUNTIME_MONGO === '1' && process.env.MONGO_URI) {
    const value = new URL(process.env.MONGO_URI);
    value.pathname = '/strideto_p2a_education_services_run1';
    value.search = '';
    return value.toString();
  }
  return 'mongodb://127.0.0.1:27017/strideto_p2a_education_services_run1';
}

const TEST_URI = disposableUri();
if (!/\/strideto_p2a_[a-z0-9_-]+(?:\?|$)/i.test(TEST_URI)) throw new Error('P2A Mongo test requires a disposable strideto_p2a_* database');

async function makeProvider(suffix, { agency = false, initialization = 'legacy' } = {}) {
  const account = await AgentAccount.create({ email: `p2a-${suffix}@example.test`, password: 'TestPass123!', accountStatus: 'active' });
  const organization = await Organization.create({ organizationType: agency ? 'agency' : 'agent', displayName: `P2A ${suffix}`, status: 'active' });
  const profile = await AgentProfile.create({
    agentAccountId: account._id,
    organizationId: organization._id,
    agentType: agency ? 'agency' : 'agent',
    professionalName: `P2A ${suffix}`,
    slug: `p2a-${suffix}`,
    launchEligible: true,
    providerDomainInitializationState: initialization,
  });
  const membership = await AgentMembership.create({ organizationId: organization._id, agentAccountId: account._id, role: 'owner', active: true });
  return { account, organization, profile, membership };
}

let provider;
let agency;
let outsider;
let businessOnly;
let services;

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: false });
  await mongoose.connection.dropDatabase();
  provider = await makeProvider('independent');
  agency = await makeProvider('agency', { agency: true });
  outsider = await makeProvider('outsider');
  businessOnly = await makeProvider('business-only', { initialization: 'ready' });
  await ProviderDomainEnrollment.create({ subjectType: 'agent', subjectId: String(businessOnly.account._id), domainId: 'business_services', status: 'active', onboardingStatus: 'complete' });
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('all nine categories create and unknown categories fail closed', async () => {
  services = [];
  for (const [index, category] of Object.values(AGENT_SERVICE_CATEGORIES).entries()) {
    services.push(await createService(provider.account._id, {
      title: `Education Service ${index}`,
      category,
      description: 'Provider-maintained education guidance without outcome guarantees.',
      journeyType: 'other', deliveryMode: 'online', pricingMode: 'contact_for_details',
    }));
  }
  assert.equal(services.length, 9);
  assert.deepEqual(new Set(services.map((row) => row.category)), new Set(Object.values(AGENT_SERVICE_CATEGORIES)));
  await assert.rejects(() => createService(provider.account._id, { title: 'Bad', category: 'registered_agent' }), (err) => err.code === 'education_service_category_invalid');
});

test('edit, exact money, archive, exact-subject and domain authority', async () => {
  const target = services[0];
  const updated = await updateService(provider.account._id, target._id, {
    title: 'Updated Study Guidance', category: 'test_guidance', description: 'Updated truthful description.',
    eligibilityNotes: 'Students should confirm requirements with the relevant institution.',
    durationEstimate: 'About 2 weeks', pricingMode: 'fixed_price', price: { amountMinor: 15025, currency: 'USD' },
  });
  assert.equal(updated.price.amountMinor, 15025);
  assert.equal(updated.category, 'test_guidance');
  await assert.rejects(() => updateService(outsider.account._id, target._id, { title: 'Cross-subject rewrite' }), (err) => err.status === 404);
  await assert.rejects(() => updateService(businessOnly.account._id, target._id, { title: 'Business rewrite' }), (err) => err.code === 'provider_domain_access_denied');
  await assert.rejects(() => updateService(provider.account._id, target._id, { category: 'unknown_service' }), (err) => err.code === 'education_service_category_invalid');
  const archived = await updateService(provider.account._id, target._id, { status: 'archived' });
  assert.equal(archived.status, 'archived');
});

test('agency may manage its own Education service but Independent cannot inherit it', async () => {
  const agencyService = await createService(agency.account._id, {
    title: 'Agency Education Guidance', category: 'career_guidance', description: 'Agency-owned guidance.',
    journeyType: 'other', deliveryMode: 'online', pricingMode: 'free',
  });
  assert.equal(agencyService.organizationId.toString(), agency.organization._id.toString());
  await assert.rejects(() => updateService(provider.account._id, agencyService._id, { title: 'Independent inheritance' }), (err) => err.status === 404);
});

test('historical references and Marketplace records are not rewritten by service editing', async () => {
  const service = await AgentService.findById(services[1]._id);
  const consultation = await Consultation.create({
    studentUserId: new mongoose.Types.ObjectId(), organizationId: provider.organization._id, assignedMembershipId: provider.membership._id,
    agentServiceId: service._id, status: 'completed', requestedWindow: { start: new Date(), end: new Date(Date.now() + 3600000) },
    durationMinutes: 60, timezone: 'UTC', meetingMode: 'video', purpose: 'Historical consultation', paymentState: 'free',
    completion: { completedAt: new Date(), outcomeNote: 'Completed' },
  });
  const professionalCase = await ProfessionalCase.create({
    studentUserId: consultation.studentUserId, organizationId: provider.organization._id, assignedMembershipId: provider.membership._id,
    authorizedMembershipIds: [provider.membership._id], consultationId: consultation._id, caseType: 'study', workflowId: 'study_v1', workflowVersion: 1,
    lifecycle: 'active', currentStage: 'intake', title: 'Historical Case',
  });
  const post = await AgentMarketplacePost.create({
    organizationId: provider.organization._id, authorAgentAccountId: provider.account._id, postType: 'service_announcement', title: 'Independent Marketplace Title',
    slug: 'p2a-independent-marketplace-title', summary: 'Independent moderated summary.', agentStatement: 'Independent Provider statement.', relatedAgentServiceId: service._id,
  });
  await updateService(provider.account._id, service._id, { title: 'Future-facing Service Title', status: 'archived' });
  assert.equal(String((await Consultation.findById(consultation._id)).agentServiceId), String(service._id));
  assert.equal(String((await ProfessionalCase.findById(professionalCase._id)).consultationId), String(consultation._id));
  assert.equal((await AgentMarketplacePost.findById(post._id)).title, 'Independent Marketplace Title');
});

test('public projection includes safe price, duration and limitation details only for active services', async () => {
  await OrganizationVerification.create({ organizationId: provider.organization._id, status: 'approved' });
  await AgentProfile.updateOne({ _id: provider.profile._id }, { $set: { countryCode: 'PK', destinationCountries: ['GB'] } });
  const publicService = await AgentService.findById(services[2]._id);
  await updateService(provider.account._id, publicService._id, {
    status: 'active', pricingMode: 'starting_from', price: { amountMinor: 9950, currency: 'USD' },
    durationEstimate: 'Provider estimate: 3 sessions', eligibilityNotes: 'Subject to institution requirements.',
  });
  const projection = await getPublicProfileBySlug(provider.profile.slug);
  const projected = projection.services.find((row) => String(row._id) === String(publicService._id));
  assert.equal(projected.price.amountMinor, 9950);
  assert.equal(projected.durationEstimate, 'Provider estimate: 3 sessions');
  assert.equal(projected.eligibilityNotes, 'Subject to institution requirements.');
  assert.equal(projection.services.some((row) => String(row._id) === String(services[0]._id)), false, 'archived service is not publicly available');
});

test('directory category filtering composes with country, destination and Provider type', async () => {
  const category = services[2].category;
  for (const query of [
    { serviceCategory: category },
    { serviceCategory: category, countryCode: 'PK' },
    { serviceCategory: category, destinationCountry: 'GB' },
    { serviceCategory: category, agentType: 'agent' },
    { serviceCategory: category, countryCode: 'PK', destinationCountry: 'GB', agentType: 'agent' },
  ]) {
    const result = await getPublicDirectory(query);
    assert.equal(result.total, 1, `matching filter ${JSON.stringify(query)}`);
  }
  assert.equal((await getPublicDirectory({ serviceCategory: 'unknown_service' })).total, 0);
  assert.equal((await getPublicDirectory({ serviceCategory: services[0].category })).total, 0, 'archived service category does not match');
});
