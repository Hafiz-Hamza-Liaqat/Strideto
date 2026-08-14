/**
 * Phase 17D-3R — Mongo integrity: enrollment, legacy, team isolation.
 *
 *   STRIDETO_17D3R_TEST_MONGO_URI=mongodb://127.0.0.1:27018/strideto_17d3r_integrity_run1
 *   node src/__tests__/phase17d3rProviderDomains.mongo.test.js
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { AgentInvitation } from '../models/agent/AgentInvitation.js';
import { Organization } from '../models/Organization.js';
import { ProviderDomainEnrollment } from '../models/gbs/ProviderDomainEnrollment.js';
import { ProviderCapability } from '../models/gbs/ProviderCapability.js';
import { ORGANIZATION_TYPES, ORGANIZATION_STATUSES } from '../../../shared/international/organization.js';
import { AGENT_TYPES, AGENT_MEMBER_ROLES } from '../../../shared/agent/constants.js';
import { PROVIDER_SUBJECT_TYPES, PROVIDER_TRUST_STATUSES } from '../../../shared/gbs/constants.js';
import { PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import {
  addProviderDomain,
  assertProviderDomainAccess,
  completeProviderDomainOnboarding,
  enrollProviderDomains,
  markProviderDomainInitialization,
  resolveAccessibleWorkspaces,
} from '../services/gbs/providerDomainService.js';
import { createOrganizationInvite, acceptOrganizationInvite } from '../services/agentProfileService.js';

const TEST_URI = process.env.STRIDETO_17D3R_TEST_MONGO_URI || '';
if (!/\/strideto_17d3r_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D3R_TEST_MONGO_URI must name a disposable strideto_17d3r_* database');
}

before(async () => {
  process.env.BUSINESS_SERVICES_ENABLED = '1';
  process.env.BUSINESS_SERVICES_PROVIDER_ENABLED = '1';
  await mongoose.connect(TEST_URI, { autoIndex: true });
  await mongoose.connection.dropDatabase();
  await Promise.all([
    AgentAccount.init(),
    AgentProfile.init(),
    AgentMembership.init(),
    AgentInvitation.init(),
    Organization.init(),
    ProviderDomainEnrollment.init(),
    ProviderCapability.init(),
  ]);
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function makeLegacyAgent(email, name) {
  const account = await AgentAccount.create({ email, password: 'TestPass123!', accountStatus: 'active' });
  const home = await Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENT,
    displayName: `${name} Home`,
    status: ORGANIZATION_STATUSES.ACTIVE,
  });
  await AgentProfile.create({
    agentAccountId: account._id,
    organizationId: home._id,
    agentType: AGENT_TYPES.AGENT,
    professionalName: name,
  });
  await AgentMembership.create({
    organizationId: home._id,
    agentAccountId: account._id,
    role: AGENT_MEMBER_ROLES.OWNER,
    active: true,
  });
  return account;
}

test('legacy agent effective education only; no business auto-enroll', async () => {
  const account = await makeLegacyAgent('legacy@example.test', 'Legacy');
  const resolved = await resolveAccessibleWorkspaces(account._id);
  assert.equal(resolved.initializationState, 'legacy');
  assert.equal(resolved.needsOnboarding, false);
  assert.ok(resolved.workspaces.some((w) => w.domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY));
  assert.equal(
    resolved.workspaces.some((w) => w.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES),
    false
  );
  const count = await ProviderDomainEnrollment.countDocuments({ subjectId: String(account._id) });
  assert.equal(count, 0);
});

test('new accounts persist selected domains without professional verification', async () => {
  async function registerLike({ email, name, domainIds }) {
    const account = await AgentAccount.create({ email, password: 'TestPass123!', accountStatus: 'active' });
    const org = await Organization.create({
      organizationType: ORGANIZATION_TYPES.AGENT,
      displayName: name,
      status: ORGANIZATION_STATUSES.ACTIVE,
    });
    await AgentProfile.create({
      agentAccountId: account._id,
      organizationId: org._id,
      agentType: AGENT_TYPES.AGENT,
      professionalName: name,
      providerDomainInitializationState: 'pending',
    });
    await enrollProviderDomains({
      subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
      subjectId: account._id,
      domainIds,
      selectedBy: account._id,
    });
    await markProviderDomainInitialization({ agentAccountId: account._id, state: 'ready' });
    return account;
  }

  const edu = await registerLike({ email: 'eduonly@example.test', name: 'Edu Only', domainIds: ['education_mobility'] });
  const eduEnroll = await ProviderDomainEnrollment.find({ subjectId: String(edu._id) }).lean();
  assert.deepEqual(eduEnroll.map((e) => e.domainId).sort(), ['education_mobility']);
  assert.equal(await ProviderCapability.countDocuments({ subjectId: String(edu._id) }), 0);

  const both = await registerLike({
    email: 'both@example.test',
    name: 'Both Co',
    domainIds: ['education_mobility', 'business_services'],
  });
  const bothEnroll = await ProviderDomainEnrollment.find({ subjectId: String(both._id) }).lean();
  assert.equal(bothEnroll.length, 2);
  assert.equal(
    await ProviderCapability.countDocuments({
      subjectId: String(both._id),
      trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
    }),
    0
  );
});

test('add domain later is idempotent and does not verify; independent ≠ agency', async () => {
  const account = await makeLegacyAgent('ahmed@example.test', 'Ahmed');
  await AgentProfile.updateOne(
    { agentAccountId: account._id },
    { $set: { providerDomainInitializationState: 'ready' } }
  );
  await enrollProviderDomains({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: account._id,
    domainIds: [PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY],
    selectedBy: account._id,
  });
  const first = await addProviderDomain({
    agentAccountId: account._id,
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: String(account._id),
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  });
  const second = await addProviderDomain({
    agentAccountId: account._id,
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: String(account._id),
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  });
  assert.equal(second.alreadyActive, true);
  const n = await ProviderDomainEnrollment.countDocuments({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: String(account._id),
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  });
  assert.equal(n, 1);
  assert.equal(first.enrollment.status, 'setup');
});

test('agency business invite does not grant education or personal capability', async () => {
  const owner = await AgentAccount.create({ email: 'owner-abc@example.test', password: 'TestPass123!', accountStatus: 'active' });
  const agency = await Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENCY,
    displayName: 'ABC Professional Services',
    status: ORGANIZATION_STATUSES.ACTIVE,
  });
  await AgentProfile.create({
    agentAccountId: owner._id,
    organizationId: agency._id,
    agentType: AGENT_TYPES.AGENCY,
    professionalName: 'Ahmed',
    providerDomainInitializationState: 'ready',
  });
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: owner._id,
    role: AGENT_MEMBER_ROLES.OWNER,
    active: true,
    domainAccess: [{ domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY, permissions: Object.values(PROVIDER_DOMAIN_PERMISSIONS).filter((p) => p.startsWith('education')) }],
  });
  await enrollProviderDomains({
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: agency._id,
    domainIds: [PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY],
    selectedBy: owner._id,
  });

  await assert.rejects(
    () => createOrganizationInvite({
      agentAccountId: owner._id,
      email: 'usman@example.test',
      role: 'member',
      domainAccess: [{ domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES, permissions: ['business_services.view'] }],
    }),
    (err) => err.code === 'provider_domain_not_available'
  );

  await addProviderDomain({
    agentAccountId: owner._id,
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: String(agency._id),
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  });

  await assert.rejects(
    () => createOrganizationInvite({
      agentAccountId: owner._id,
      email: 'usman@example.test',
      role: 'member',
      domainAccess: [],
    }),
    (err) => err.code === 'provider_domain_selection_required'
  );

  const invite = await createOrganizationInvite({
    agentAccountId: owner._id,
    email: 'usman@example.test',
    role: 'member',
    domainAccess: [{ domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES, permissions: ['business_services.view'] }],
  });
  const usman = await AgentAccount.create({ email: 'usman@example.test', password: 'TestPass123!', accountStatus: 'active' });
  await AgentProfile.create({
    agentAccountId: usman._id,
    organizationId: agency._id,
    agentType: AGENT_TYPES.AGENCY,
    professionalName: 'Usman',
    providerDomainInitializationState: 'ready',
  });
  await acceptOrganizationInvite({
    token: invite.token,
    agentAccount: usman,
    acceptedDomainIds: [PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES],
  });

  const membership = await AgentMembership.findOne({ agentAccountId: usman._id, organizationId: agency._id }).lean();
  assert.equal(membership.active, true);
  assert.deepEqual(membership.domainAccess.map((d) => d.domainId), [PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES]);

  await assert.rejects(
    () => assertProviderDomainAccess({
      agentAccountId: usman._id,
      subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
      subjectId: String(agency._id),
      domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
      permissionId: PROVIDER_DOMAIN_PERMISSIONS.EDUCATION_VIEW,
    }),
    (err) => err.code === 'provider_domain_access_denied'
  );

  const personalCaps = await ProviderCapability.countDocuments({
    subjectType: PROVIDER_SUBJECT_TYPES.AGENT,
    subjectId: String(usman._id),
  });
  const agencyVerified = await ProviderCapability.countDocuments({
    subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
    subjectId: String(agency._id),
    trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
  });
  assert.equal(personalCaps, 0);
  assert.equal(agencyVerified, 0);

  await AgentMembership.updateOne({ _id: membership._id }, { $set: { active: false } });
  const resolved = await resolveAccessibleWorkspaces(usman._id);
  assert.equal(resolved.workspaces.some((w) => w.kind === 'agency'), false);
});

test('complete onboarding pending cannot stay empty; ready after persist', async () => {
  const account = await AgentAccount.create({ email: 'pending@example.test', password: 'TestPass123!', accountStatus: 'active' });
  const org = await Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENT,
    displayName: 'Pending Co',
    status: ORGANIZATION_STATUSES.ACTIVE,
  });
  await AgentProfile.create({
    agentAccountId: account._id,
    organizationId: org._id,
    agentType: AGENT_TYPES.AGENT,
    professionalName: 'Pending',
    providerDomainInitializationState: 'pending',
  });
  await assert.rejects(
    () => completeProviderDomainOnboarding({ agentAccountId: account._id, domainIds: [] }),
    (err) => err.code === 'provider_domain_selection_required'
  );
  const done = await completeProviderDomainOnboarding({
    agentAccountId: account._id,
    domainIds: ['education_mobility'],
  });
  assert.equal(done.initializationState, 'ready');
});
