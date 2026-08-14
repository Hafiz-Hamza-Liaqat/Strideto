/**
 * Phase 17D-4 — Admin capability/listing moderation Mongo integrity.
 *
 *   STRIDETO_17D4_TEST_MONGO_URI=mongodb://127.0.0.1:27018/strideto_17d4_integrity_run1
 *   node src/__tests__/phase17d4Moderation.mongo.test.js
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
import { PROVIDER_TRUST_STATUSES } from '../../../shared/gbs/constants.js';
import { OPTIMISTIC_CONCURRENCY_CODE } from '../../../shared/platform/optimisticConcurrency.js';
import { EVIDENCE_DECISIONS } from '../../../shared/gbs/providerEvidence.js';
import { GBS_AUDIT_EVENTS } from '../../../shared/security/gbsAuditEvents.js';
import { mutateProviderCapabilityRecord } from '../services/platform/optimisticConcurrency.js';
import {
  createProviderCapabilityReviewService,
} from '../services/gbs/providerCapabilityReviewService.js';
import { claimProviderCapability, submitCapabilityEvidenceMetadata } from '../services/gbs/providerCapabilityClaimService.js';
import {
  createServiceListingDraft,
  submitServiceListingForReview,
  updateServiceListing,
} from '../services/gbs/serviceListingService.js';
import {
  approveServiceListing,
  needsInformationServiceListing,
  rejectServiceListing,
} from '../services/gbs/serviceListingReviewService.js';
import {
  evaluateListingPublicationGate,
  LISTING_PUBLICATION_DENY_REASONS,
} from '../../../shared/gbs/listingPublicationGate.js';
import { logAudit } from '../services/auditService.js';

const TEST_URI = process.env.STRIDETO_17D4_TEST_MONGO_URI || '';
if (!/\/strideto_17d4_[a-z0-9_-]+$/i.test(TEST_URI)) {
  throw new Error('STRIDETO_17D4_TEST_MONGO_URI must name a disposable strideto_17d4_* database');
}

const wyScope = {
  countryCodes: ['US'],
  jurisdictionIds: ['j:US-WY'],
  entityTypeIds: ['et:US-WY:LLC'],
};

const staff = { isStaff: true, realm: 'staff', id: 'staff-17d4', userId: new mongoose.Types.ObjectId(), role: 'Admin' };

function reviewService() {
  return createProviderCapabilityReviewService({
    store: {
      async getById(id) {
        return ProviderCapability.findById(id).lean();
      },
    },
    mutateRecord: mutateProviderCapabilityRecord,
    audit: async (entry) => {
      await logAudit({
        actor: staff,
        action: entry.action,
        status: entry.status || 'success',
        targetType: 'ProviderCapability',
        metadata: entry.metadata,
      });
    },
  });
}

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

async function makeAgency(name) {
  return Organization.create({
    organizationType: ORGANIZATION_TYPES.AGENCY,
    displayName: name,
    legalName: name,
    status: ORGANIZATION_STATUSES.ACTIVE,
  });
}

async function staffAcceptEvidence(record) {
  let current = record;
  if (!(current.evidenceRefs || []).length) {
    current = await mutateProviderCapabilityRecord({
      id: record._id,
      expectedVersion: record.recordVersion,
      subjectType: record.subjectType,
      subjectId: record.subjectId,
      actor: staff,
      set: {
        evidenceRefs: [
          {
            evidenceType: 'authority_confirmation',
            decision: EVIDENCE_DECISIONS.PENDING,
            jurisdictionId: record.scope?.jurisdictionIds?.[0],
          },
        ],
        trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED,
      },
    });
  }
  const svc = reviewService();
  const reviewed = await svc.reviewEvidence({
    id: current._id,
    subjectType: current.subjectType,
    subjectId: current.subjectId,
    expectedVersion: current.recordVersion,
    actor: staff,
    evidenceIndex: 0,
    decision: EVIDENCE_DECISIONS.ACCEPTED,
  });
  return svc.markEvidenceBacked({
    id: reviewed._id || current._id,
    subjectType: reviewed.subjectType,
    subjectId: reviewed.subjectId,
    expectedVersion: reviewed.recordVersion,
    actor: staff,
  });
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

test('provider cannot self-verify; staff review is exact-subject; Agency stays isolated', async () => {
  const ameer = await makeAgent('ameer-17d4@example.test', 'Ameer Independent');
  const actor = { agentAccountId: String(ameer._id), id: String(ameer._id), isStaff: false };
  const claimed = await claimProviderCapability({
    subjectType: 'agent',
    subjectId: String(ameer._id),
    capabilityId: 'business_formation',
    scope: wyScope,
    actor,
  });
  assert.equal(claimed.record.trustStatus, PROVIDER_TRUST_STATUSES.CLAIMED);

  const svc = reviewService();
  await assert.rejects(
    () => svc.verify({
      id: claimed.record._id,
      subjectType: 'agent',
      subjectId: String(ameer._id),
      expectedVersion: claimed.record.recordVersion,
      actor,
    }),
    (err) => err.code === 'staff_review_required' || err.code === 'provider_self_verify_forbidden'
  );

  const agency = await makeAgency('17D4 Agency Isolation LLC');
  await AgentMembership.create({
    organizationId: agency._id,
    agentAccountId: ameer._id,
    role: AGENT_MEMBER_ROLES.OWNER,
    active: true,
  });
  const orgClaim = await claimProviderCapability({
    subjectType: 'organization',
    subjectId: String(agency._id),
    capabilityId: 'business_formation',
    scope: wyScope,
    actor,
  });

  const backed = await staffAcceptEvidence(claimed.record);
  const verified = await svc.verify({
    id: backed._id,
    subjectType: 'agent',
    subjectId: String(ameer._id),
    expectedVersion: backed.recordVersion,
    actor: staff,
  });
  assert.equal(verified.trustStatus, PROVIDER_TRUST_STATUSES.VERIFIED);

  const agencyFresh = await ProviderCapability.findById(orgClaim.record._id);
  assert.equal(agencyFresh.trustStatus, PROVIDER_TRUST_STATUSES.CLAIMED);
  assert.equal(agencyFresh.subjectType, 'organization');

  await assert.rejects(
    () => svc.verify({
      id: backed._id,
      subjectType: 'organization',
      subjectId: String(agency._id),
      expectedVersion: verified.recordVersion,
      actor: staff,
    }),
    (err) => err.status === 404
  );

  const replay = await svc.verify({
    id: verified._id || backed._id,
    subjectType: 'agent',
    subjectId: String(ameer._id),
    expectedVersion: verified.recordVersion,
    actor: staff,
  });
  assert.equal(replay.trustStatus, PROVIDER_TRUST_STATUSES.VERIFIED);

  const audits = await AuditLog.find({ action: GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_VERIFIED });
  assert.ok(audits.length >= 1);
});

test('listing admin approval stays private while marketplace is OFF; CAS; needs-information', async () => {
  process.env.BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED = '0';
  const lister = await makeAgent('lister-17d4@example.test', 'Lister Independent');
  const actor = { agentAccountId: String(lister._id), id: String(lister._id), isStaff: false };
  const subject = { subjectType: 'agent', subjectId: String(lister._id) };
  const claimed = await claimProviderCapability({
    ...subject,
    capabilityId: 'business_formation',
    scope: wyScope,
    actor,
  });
  const backed = await staffAcceptEvidence(claimed.record);
  const svc = reviewService();
  const verified = await svc.verify({
    id: backed._id,
    ...subject,
    expectedVersion: backed.recordVersion,
    actor: staff,
  });
  assert.equal(verified.trustStatus, PROVIDER_TRUST_STATUSES.VERIFIED);

  const draftInput = {
    ...subject,
    capabilityId: 'business_formation',
    countryCode: 'US',
    jurisdictionId: 'j:US-WY',
    entityTypeIds: ['et:US-WY:LLC'],
    title: 'Wyoming LLC formation support 17D4',
    pricingMode: 'fixed',
    providerFeeLines: [{ label: 'Provider formation service', amountMinor: 15000, currency: 'USD' }],
  };
  const created = await createServiceListingDraft({ input: draftInput, actor, commandId: 'cmd-17d4-listing-1' });
  assert.equal(created.listing.publicationStatus, 'private');
  assert.equal(created.listing.adminReviewStatus, 'pending');

  await assert.rejects(
    () => approveServiceListing({
      id: created.listing._id,
      ...subject,
      expectedVersion: created.listing.recordVersion,
      actor,
    }),
    (err) => err.code === 'staff_review_required'
  );

  const submitted = await submitServiceListingForReview({
    id: created.listing._id,
    ...subject,
    expectedVersion: created.listing.recordVersion,
    actor,
  });
  assert.equal(submitted.moderationStatus, 'under_review');
  assert.equal(submitted.adminReviewStatus, 'pending');
  assert.equal(submitted.publicationStatus, 'private');

  const info = await needsInformationServiceListing({
    id: submitted._id,
    ...subject,
    expectedVersion: submitted.recordVersion,
    actor: staff,
    reason: 'Need the operating agreement outline',
  });
  assert.equal(info.listing.adminReviewStatus, 'needs_information');
  assert.equal(info.listing.publicationStatus, 'private');

  const resubmitted = await submitServiceListingForReview({
    id: submitted._id,
    ...subject,
    expectedVersion: info.listing.recordVersion,
    actor,
  });

  await assert.rejects(
    () => approveServiceListing({
      id: resubmitted._id,
      ...subject,
      expectedVersion: submitted.recordVersion,
      actor: staff,
    }),
    (err) => err.code === OPTIMISTIC_CONCURRENCY_CODE && err.status === 409
  );

  const approved = await approveServiceListing({
    id: resubmitted._id,
    ...subject,
    expectedVersion: resubmitted.recordVersion,
    actor: staff,
    reason: 'Scope matches verified capability',
  });
  assert.equal(approved.listing.adminReviewStatus, 'approved');
  assert.equal(approved.listing.moderationStatus, 'approved');
  assert.equal(approved.listing.publicationStatus, 'private');
  assert.equal(approved.publication.allowed, false);
  assert.equal(approved.publication.reason, LISTING_PUBLICATION_DENY_REASONS.MARKETPLACE_DISABLED);

  const replay = await approveServiceListing({
    id: resubmitted._id,
    ...subject,
    expectedVersion: approved.listing.recordVersion,
    actor: staff,
  });
  assert.equal(replay.replay, true);
  const afterReplay = await GbsServiceListing.findById(resubmitted._id);
  assert.equal(afterReplay.recordVersion, approved.listing.recordVersion);
  assert.equal(afterReplay.publicationStatus, 'private');

  const sneaky = await updateServiceListing({
    id: resubmitted._id,
    ...subject,
    expectedVersion: afterReplay.recordVersion,
    actor,
    input: {
      title: 'Wyoming LLC formation support 17D4',
      adminReviewStatus: 'approved',
      publicationStatus: 'public',
      reviewedBy: String(lister._id),
    },
  });
  assert.equal(sneaky.publicationStatus, 'private');
  assert.notEqual(sneaky.publicationStatus, 'public');

  const cap = await ProviderCapability.findById(verified._id);
  const gate = evaluateListingPublicationGate({
    env: process.env,
    listing: sneaky.toObject ? sneaky.toObject() : sneaky,
    capability: cap,
  });
  assert.equal(gate.allowed, false);

  const listingAudits = await AuditLog.find({
    action: { $in: [GBS_AUDIT_EVENTS.GBS_LISTING_APPROVED, GBS_AUDIT_EVENTS.GBS_LISTING_NEEDS_INFORMATION] },
  });
  assert.ok(listingAudits.length >= 2);
});

test('reject does not publish; unknown education taxonomy cannot be approved', async () => {
  const agent = await makeAgent('reject-17d4@example.test', 'Reject Independent');
  const actor = { agentAccountId: String(agent._id), id: String(agent._id), isStaff: false };
  const subject = { subjectType: 'agent', subjectId: String(agent._id) };
  const claimed = await claimProviderCapability({
    ...subject,
    capabilityId: 'document_preparation',
    scope: wyScope,
    actor,
  });
  const backed = await staffAcceptEvidence(claimed.record);
  const svc = reviewService();
  await svc.verify({
    id: backed._id,
    ...subject,
    expectedVersion: backed.recordVersion,
    actor: staff,
  });
  const created = await createServiceListingDraft({
    input: {
      ...subject,
      capabilityId: 'document_preparation',
      countryCode: 'US',
      jurisdictionId: 'j:US-WY',
      entityTypeIds: ['et:US-WY:LLC'],
      title: 'Document pack 17D4',
      pricingMode: 'quote_required',
    },
    actor,
    commandId: 'cmd-17d4-listing-reject',
  });
  const submitted = await submitServiceListingForReview({
    id: created.listing._id,
    ...subject,
    expectedVersion: created.listing.recordVersion,
    actor,
  });
  const rejected = await rejectServiceListing({
    id: submitted._id,
    ...subject,
    expectedVersion: submitted.recordVersion,
    actor: staff,
    reason: 'Incomplete service description',
  });
  assert.equal(rejected.listing.adminReviewStatus, 'rejected');
  assert.equal(rejected.listing.publicationStatus, 'private');

  await GbsServiceListing.updateOne(
    { _id: submitted._id },
    {
      $set: {
        capabilityId: 'study_abroad_guidance',
        moderationStatus: 'under_review',
        adminReviewStatus: 'pending',
      },
    }
  );
  const tampered = await GbsServiceListing.findById(submitted._id);
  await assert.rejects(
    () => approveServiceListing({
      id: tampered._id,
      ...subject,
      expectedVersion: tampered.recordVersion,
      actor: staff,
      reason: 'should fail education taxonomy',
    }),
    (err) => err.code === 'gbs_listing_rejects_education_category' || err.code === 'unknown_capability_id' || err.code === 'invalid_listing_review_transition'
  );
});

test('staff evidence review is required before evidence-backed and verify; CAS and isolation hold', async () => {
  const ameer = await makeAgent('evidence-17d4@example.test', 'Evidence Independent');
  const actor = { agentAccountId: String(ameer._id), id: String(ameer._id), isStaff: false };
  const subject = { subjectType: 'agent', subjectId: String(ameer._id) };
  const claimed = await claimProviderCapability({
    ...subject,
    capabilityId: 'document_preparation',
    scope: wyScope,
    actor,
  });
  const submitted = await submitCapabilityEvidenceMetadata({
    id: claimed.record._id,
    ...subject,
    expectedVersion: claimed.record.recordVersion,
    evidence: {
      evidenceType: 'authority_confirmation',
      referenceNumber: 'WY-AUTH-17D4',
      officialRegistryUrl: 'https://sos.wyo.gov/Business/example',
      jurisdictionId: 'j:US-WY',
    },
    actor,
  });
  assert.equal(submitted.trustStatus, PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED);
  assert.equal(submitted.evidenceRefs[0].decision, EVIDENCE_DECISIONS.PENDING);

  const svc = reviewService();
  await assert.rejects(
    () => svc.verify({
      id: submitted._id,
      ...subject,
      expectedVersion: submitted.recordVersion,
      actor: staff,
    }),
    (err) => err.code === 'required_evidence_absent'
  );
  await assert.rejects(
    () => svc.markEvidenceBacked({
      id: submitted._id,
      ...subject,
      expectedVersion: submitted.recordVersion,
      actor: staff,
    }),
    (err) => err.code === 'required_evidence_absent'
  );
  await assert.rejects(
    () => svc.reviewEvidence({
      id: submitted._id,
      ...subject,
      expectedVersion: submitted.recordVersion,
      actor,
      evidenceIndex: 0,
      decision: EVIDENCE_DECISIONS.ACCEPTED,
    }),
    (err) => err.code === 'staff_review_required' || err.code === 'provider_self_review_forbidden'
  );

  const agency = await makeAgency('17D4 Evidence Isolation LLC');
  const orgClaim = await claimProviderCapability({
    subjectType: 'organization',
    subjectId: String(agency._id),
    capabilityId: 'document_preparation',
    scope: wyScope,
    actor,
  });

  const accepted = await svc.reviewEvidence({
    id: submitted._id,
    ...subject,
    expectedVersion: submitted.recordVersion,
    actor: staff,
    evidenceIndex: 0,
    decision: EVIDENCE_DECISIONS.ACCEPTED,
  });
  assert.equal(accepted.evidenceRefs[0].decision, EVIDENCE_DECISIONS.ACCEPTED);
  assert.equal(accepted.subjectType, 'agent');
  assert.equal(String(accepted.subjectId), String(ameer._id));
  assert.equal(accepted.capabilityId, 'document_preparation');
  assert.notEqual(accepted.trustStatus, PROVIDER_TRUST_STATUSES.VERIFIED);

  const replay = await svc.reviewEvidence({
    id: submitted._id,
    ...subject,
    expectedVersion: accepted.recordVersion,
    actor: staff,
    evidenceIndex: 0,
    decision: EVIDENCE_DECISIONS.ACCEPTED,
  });
  assert.equal(replay.recordVersion, accepted.recordVersion);

  await assert.rejects(
    () => svc.reviewEvidence({
      id: submitted._id,
      ...subject,
      expectedVersion: submitted.recordVersion,
      actor: staff,
      evidenceIndex: 0,
      decision: EVIDENCE_DECISIONS.ACCEPTED,
    }),
    (err) => err.code === OPTIMISTIC_CONCURRENCY_CODE && err.status === 409
  );

  const backed = await svc.markEvidenceBacked({
    id: submitted._id,
    ...subject,
    expectedVersion: accepted.recordVersion,
    actor: staff,
  });
  assert.equal(backed.trustStatus, PROVIDER_TRUST_STATUSES.EVIDENCE_BACKED);
  assert.notEqual(backed.trustStatus, PROVIDER_TRUST_STATUSES.VERIFIED);

  const verified = await svc.verify({
    id: submitted._id,
    ...subject,
    expectedVersion: backed.recordVersion,
    actor: staff,
  });
  assert.equal(verified.trustStatus, PROVIDER_TRUST_STATUSES.VERIFIED);
  assert.equal(verified.evidenceRefs[0].decision, EVIDENCE_DECISIONS.ACCEPTED);
  assert.equal(verified.subjectType, 'agent');
  assert.equal(String(verified.subjectId), String(ameer._id));

  const agencyFresh = await ProviderCapability.findById(orgClaim.record._id);
  assert.equal(agencyFresh.trustStatus, PROVIDER_TRUST_STATUSES.CLAIMED);
  assert.equal((agencyFresh.evidenceRefs || []).length, 0);

  const acceptAudits = await AuditLog.find({ action: GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_EVIDENCE_ACCEPTED });
  assert.ok(acceptAudits.length >= 1);
  assert.ok(!JSON.stringify(acceptAudits).includes('passport'));
});

test('needs-information evidence cannot be verified', async () => {
  const agent = await makeAgent('needs-info-evidence-17d4@example.test', 'Needs Info Evidence');
  const actor = { agentAccountId: String(agent._id), id: String(agent._id), isStaff: false };
  const subject = { subjectType: 'agent', subjectId: String(agent._id) };
  const claimed = await claimProviderCapability({
    ...subject,
    capabilityId: 'document_preparation',
    scope: wyScope,
    actor,
  });
  const submitted = await submitCapabilityEvidenceMetadata({
    id: claimed.record._id,
    ...subject,
    expectedVersion: claimed.record.recordVersion,
    evidence: {
      evidenceType: 'authority_confirmation',
      officialRegistryUrl: 'https://sos.wyo.gov/Business/needs-info',
      jurisdictionId: 'j:US-WY',
    },
    actor,
  });
  const svc = reviewService();
  const reviewed = await svc.reviewEvidence({
    id: submitted._id,
    ...subject,
    expectedVersion: submitted.recordVersion,
    actor: staff,
    evidenceIndex: 0,
    decision: EVIDENCE_DECISIONS.NEEDS_INFORMATION,
    reasonCode: 'missing_authority_letter',
  });
  assert.equal(reviewed.evidenceRefs[0].decision, EVIDENCE_DECISIONS.NEEDS_INFORMATION);
  await assert.rejects(
    () => svc.markEvidenceBacked({
      id: submitted._id,
      ...subject,
      expectedVersion: reviewed.recordVersion,
      actor: staff,
    }),
    (err) => err.code === 'required_evidence_absent'
  );
  await assert.rejects(
    () => svc.verify({
      id: submitted._id,
      ...subject,
      expectedVersion: reviewed.recordVersion,
      actor: staff,
    }),
    (err) => err.code === 'required_evidence_absent'
  );
  const fresh = await ProviderCapability.findById(submitted._id);
  assert.notEqual(fresh.trustStatus, PROVIDER_TRUST_STATUSES.VERIFIED);
});

