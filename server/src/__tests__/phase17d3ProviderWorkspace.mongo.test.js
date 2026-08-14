/**
 * Phase 17D-3 — provider subject, capability claim, listing CAS/idempotency.
 *
 *   STRIDETO_17D3_TEST_MONGO_URI=mongodb://127.0.0.1:27018/strideto_17d3_integrity_run1
 *   node src/__tests__/phase17d3ProviderWorkspace.mongo.test.js
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { AgentAccount } from '../models/agent/AgentAccount.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { Organization } from '../models/Organization.js';
import { ProviderCapability } from '../models/gbs/ProviderCapability.js';
import { GbsServiceListing } from '../models/gbs/GbsServiceListing.js';
import { IdempotencyRecord } from '../models/platform/IdempotencyRecord.js';
import { AuditLog } from '../models/AuditLog.js';
import { ORGANIZATION_TYPES, ORGANIZATION_STATUSES } from '../../../shared/international/organization.js';
import { AGENT_TYPES, AGENT_MEMBER_ROLES } from '../../../shared/agent/constants.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_TRUST_STATUSES } from '../../../shared/gbs/constants.js';
import { OPTIMISTIC_CONCURRENCY_CODE } from '../../../shared/platform/optimisticConcurrency.js';
import {
  assertAuthorizedProviderSubject,
  resolveAuthorizedProviderSubjects,
} from '../services/gbs/providerSubjectContext.js';
import {
  claimProviderCapability,
  submitCapabilityEvidenceMetadata,
} from '../services/gbs/providerCapabilityClaimService.js';
import {
  createServiceListingDraft,
  submitServiceListingForReview,
  updateServiceListing,
} from '../services/gbs/serviceListingService.js';
import { getProviderWorkspaceSummary } from '../services/gbs/providerWorkspaceSummaryService.js';
import { GBS_AUTHORITY_DENY_REASONS } from '../../../shared/gbs/gbsProviderAuthority.js';

const TEST_URI = process.env.STRIDETO_17D3_TEST_MONGO_URI || '';
if (!/\/strideto_17d3_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D3_TEST_MONGO_URI must name a disposable strideto_17d3_* database');
}

before(async () => {
  await mongoose.connect(TEST_URI, { autoIndex: true });
  await mongoose.connection.dropDatabase();
  await Promise.all([
    AgentAccount.init(),
    AgentProfile.init(),
    AgentMembership.init(),
    Organization.init(),
    ProviderCapability.init(),
    GbsServiceListing.init(),
    IdempotencyRecord.init(),
    AuditLog.init(),
  ]);
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function makeAgent(email, name) {
  const account = await AgentAccount.create({
    email,
    password: 'TestPass123!',
    accountStatus: 'active',
  });
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
  return account;
}

async function makeAgency(name, status = ORGANIZATION_STATUSES.ACTIVE) {
  return Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENCY,
    displayName: name,
    legalName: name,
    status,
  });
}

const wyScope = {
  countryCodes: ['US'],
  jurisdictionIds: ['j:US-WY'],
  entityTypeIds: ['et:US-WY:LLC'],
};

test('independent Agent may select own subject; arbitrary Agent denied; agencies require membership', async () => {
  const ameer = await makeAgent('ameer-17d3@example.test', 'Ameer Hamza');
  const other = await makeAgent('other-17d3@example.test', 'Other Agent');
  const abc = await makeAgency('ABC Corporate Services');
  const xyz = await makeAgency('XYZ Filings');
  const suspended = await makeAgency('Suspended Agency', ORGANIZATION_STATUSES.SUSPENDED);
  await AgentMembership.create({
    organizationId: abc._id,
    agentAccountId: ameer._id,
    role: AGENT_MEMBER_ROLES.OWNER,
    active: true,
  });
  await AgentMembership.create({
    organizationId: xyz._id,
    agentAccountId: ameer._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
  });
  await AgentMembership.create({
    organizationId: suspended._id,
    agentAccountId: ameer._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: true,
  });

  const { subjects } = await resolveAuthorizedProviderSubjects(ameer._id);
  assert.equal(subjects[0].subjectType, 'agent');
  assert.equal(String(subjects[0].subjectId), String(ameer._id));
  const agencies = subjects.filter((s) => s.kind === 'agency');
  assert.equal(agencies.length, 2);
  assert.ok(agencies.some((s) => String(s.subjectId) === String(abc._id)));
  assert.ok(agencies.some((s) => String(s.subjectId) === String(xyz._id)));
  assert.ok(!agencies.some((s) => String(s.subjectId) === String(suspended._id)));
  assert.ok(!subjects.some((s) => String(s.subjectId) === String(other._id) && s.subjectType === 'agent' && String(s.subjectId) !== String(ameer._id)));

  await assert.rejects(
    () => assertAuthorizedProviderSubject({
      agentAccountId: ameer._id,
      subjectType: 'agent',
      subjectId: String(other._id),
    }),
    (err) => err.status === 404 && err.code === 'provider_subject_context_denied'
  );

  await assert.rejects(
    () => assertAuthorizedProviderSubject({
      agentAccountId: other._id,
      subjectType: 'organization',
      subjectId: String(abc._id),
    }),
    (err) => err.status === 404 && err.code === 'provider_subject_context_denied'
  );

  const stale = await makeAgency('Stale Membership Agency');
  await AgentMembership.create({
    organizationId: stale._id,
    agentAccountId: ameer._id,
    role: AGENT_MEMBER_ROLES.MEMBER,
    active: false,
  });
  await assert.rejects(
    () => assertAuthorizedProviderSubject({
      agentAccountId: ameer._id,
      subjectType: 'organization',
      subjectId: String(stale._id),
    }),
    (err) => err.status === 404
  );
});

test('suspended Agent cannot use GBS workspace', async () => {
  const agent = await makeAgent('suspended-17d3@example.test', 'Suspended');
  agent.accountStatus = 'suspended';
  await agent.save();
  await assert.rejects(() => resolveAuthorizedProviderSubjects(agent._id), (err) => err.status === 403);
});

test('capability claim, unknown reject, cannot self-verify, exact subject isolation', async () => {
  const agent = await makeAgent('claim-17d3@example.test', 'Claimant');
  const actor = { agentAccountId: String(agent._id), id: String(agent._id) };
  const subject = { subjectType: 'agent', subjectId: String(agent._id) };

  await assert.rejects(
    () => claimProviderCapability({ ...subject, capabilityId: 'wizard_formation', actor }),
    (err) => err.code === 'unknown_capability_id'
  );

  const { record, created } = await claimProviderCapability({
    ...subject,
    capabilityId: 'business_formation',
    scope: wyScope,
    actor,
    trustStatus: 'verified',
    reviewedBy: 'hacker',
  });
  assert.equal(created, true);
  assert.equal(record.trustStatus, PROVIDER_TRUST_STATUSES.CLAIMED);
  assert.equal(record.reviewedBy, undefined);

  const again = await claimProviderCapability({
    ...subject,
    capabilityId: 'business_formation',
    scope: wyScope,
    actor,
  });
  assert.equal(again.created, false);
  assert.equal(String(again.record._id), String(record._id));

  const org = await makeAgency('Agency For Isolation');
  await AgentMembership.create({
    organizationId: org._id,
    agentAccountId: agent._id,
    role: AGENT_MEMBER_ROLES.OWNER,
    active: true,
  });
  const orgClaim = await claimProviderCapability({
    subjectType: 'organization',
    subjectId: String(org._id),
    capabilityId: 'business_formation',
    scope: wyScope,
    actor,
  });
  assert.equal(orgClaim.record.subjectType, 'organization');

  const summaryAgent = await getProviderWorkspaceSummary(subject);
  const summaryOrg = await getProviderWorkspaceSummary({
    subjectType: 'organization',
    subjectId: String(org._id),
  });
  assert.equal(summaryAgent.counters.capabilityClaims, 1);
  assert.equal(summaryOrg.counters.capabilityClaims, 1);
});

test('listing create requires VERIFIED explicit capability; CAS; idempotency; no public publish', async () => {
  const agent = await makeAgent('listing-17d3@example.test', 'Lister');
  const actor = { agentAccountId: String(agent._id), id: String(agent._id) };
  const subject = { subjectType: 'agent', subjectId: String(agent._id) };
  const claimed = await claimProviderCapability({
    ...subject,
    capabilityId: 'business_formation',
    scope: wyScope,
    actor,
  });

  const draftInput = {
    ...subject,
    capabilityId: 'business_formation',
    countryCode: 'US',
    jurisdictionId: 'j:US-WY',
    entityTypeIds: ['et:US-WY:LLC'],
    title: 'Wyoming LLC formation support',
    pricingMode: 'fixed',
    providerFeeLines: [{ label: 'Provider formation service', amountMinor: 15000, currency: 'USD' }],
  };

  await assert.rejects(
    () => createServiceListingDraft({ input: draftInput, actor, commandId: 'cmd-unverified' }),
    (err) => err.code === GBS_AUTHORITY_DENY_REASONS.NOT_VERIFIED
  );

  claimed.record.trustStatus = PROVIDER_TRUST_STATUSES.VERIFIED;
  await claimed.record.save();

  const first = await createServiceListingDraft({ input: draftInput, actor, commandId: 'cmd-listing-1' });
  assert.equal(first.listing.publicationStatus, 'private');
  assert.equal(first.listing.moderationStatus, 'draft');

  const replay = await createServiceListingDraft({ input: draftInput, actor, commandId: 'cmd-listing-1' });
  assert.equal(replay.replay, true);
  assert.equal(String(replay.listing._id), String(first.listing._id));

  await assert.rejects(
    () => createServiceListingDraft({
      input: { ...draftInput, title: 'Different title' },
      actor,
      commandId: 'cmd-listing-1',
    }),
    (err) => err.status === 409 && err.code === 'idempotency_conflict'
  );

  await assert.rejects(
    () => createServiceListingDraft({
      input: { ...draftInput, jurisdictionId: 'j:US-DE', entityTypeIds: ['et:US-DE:LLC'] },
      actor,
      commandId: 'cmd-de-scope',
    }),
    (err) => err.code === GBS_AUTHORITY_DENY_REASONS.SCOPE_NOT_SUBSET
  );

  const raClaim = await claimProviderCapability({
    ...subject,
    capabilityId: 'registered_agent',
    scope: { countryCodes: ['US'], jurisdictionIds: ['j:US-WY'] },
    actor,
  });
  await assert.rejects(
    () => createServiceListingDraft({
      input: {
        ...draftInput,
        capabilityId: 'registered_agent',
        title: 'RA without verified RA capability',
      },
      actor,
      commandId: 'cmd-ra-unverified',
    }),
    (err) => err.code === GBS_AUTHORITY_DENY_REASONS.NOT_VERIFIED
  );
  assert.equal(raClaim.record.trustStatus, PROVIDER_TRUST_STATUSES.CLAIMED);

  const submitted = await submitServiceListingForReview({
    id: first.listing._id,
    ...subject,
    expectedVersion: first.listing.recordVersion,
    actor,
  });
  assert.equal(submitted.moderationStatus, 'under_review');
  assert.equal(submitted.publicationStatus, 'private');

  await assert.rejects(
    () => updateServiceListing({
      id: first.listing._id,
      ...subject,
      expectedVersion: 0,
      input: { title: 'stale' },
      actor,
    }),
    (err) => err.status === 409 && err.code === OPTIMISTIC_CONCURRENCY_CODE
  );

  const material = await updateServiceListing({
    id: first.listing._id,
    ...subject,
    expectedVersion: submitted.recordVersion,
    input: { title: 'Wyoming LLC formation support — revised pricing', pricingMode: 'starting_at', providerFeeLines: [{ label: 'Starting at', amountMinor: 20000, currency: 'USD' }] },
    actor,
  });
  assert.equal(material.moderationStatus, 'under_review');
  assert.ok(material.contentRevision >= submitted.contentRevision);

  await assert.rejects(
    () => updateServiceListing({
      id: first.listing._id,
      subjectType: 'agent',
      subjectId: 'missing-subject',
      expectedVersion: material.recordVersion,
      input: { title: 'leak' },
      actor,
    }),
    (err) => err.status === 404 && err.code === 'listing_not_found'
  );

  const evidence = await submitCapabilityEvidenceMetadata({
    id: claimed.record._id,
    ...subject,
    expectedVersion: claimed.record.recordVersion,
    evidence: {
      evidenceType: 'regulatory_registration',
      referenceNumber: 'WY-TEST-1',
      officialRegistryUrl: 'https://sos.wyo.gov/example',
      notes: 'metadata only',
    },
    actor,
  });
  assert.equal(evidence.trustStatus, PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED);
});
