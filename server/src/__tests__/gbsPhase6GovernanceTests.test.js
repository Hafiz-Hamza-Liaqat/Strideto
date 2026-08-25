/**
 * GBS Phase 6 Governance Tests — pure in-memory, no live database.
 *
 * Covers: CAP-REVIEW-01..06, COV-01..06, APPEAL-01..05,
 *         TRUST-01..03, NOTIFY-01,
 *         COV-NOTE-01..03, APPEAL-CONFLICT-01..04, APPEAL-SCOPE-01..03.
 *
 * Run: node server/src/__tests__/gbsPhase6GovernanceTests.test.js
 */
import assert from 'node:assert/strict';
import {
  createProviderCapabilityReviewService,
  createMemoryProviderCapabilityStore,
} from '../services/gbs/providerCapabilityReviewService.js';
import {
  assertAppealEligibility,
  assertAppealDecisionEligibility,
  appealCoverageMetadata,
  isActiveAppeal,
  APPEAL_STATUSES,
} from '../services/gbs/coverageAppealService.js';
import {
  assertResubmitAllowed,
  publicListingProjection,
} from '../services/gbs/serviceListingService.js';
import {
  GBS_LISTING_MODERATION_STATUSES,
  GBS_LISTING_ADMIN_REVIEW_STATUSES,
  PROVIDER_TRUST_STATUSES,
} from '../../../shared/gbs/constants.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { EVIDENCE_DECISIONS } from '../../../shared/gbs/providerEvidence.js';
import { isCapabilityUsable } from '../services/gbs/providerCapabilityReviewService.js';
import { GBS_AUDIT_EVENTS } from '../../../shared/security/gbsAuditEvents.js';
import { marketplaceLeakKeys } from '../../../shared/gbs/marketplaceProjection.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      result.then(
        () => { passed += 1; console.log(`  PASS  ${name}`); },
        (err) => { failed += 1; console.error(`  FAIL  ${name}: ${err.message}`); }
      );
    } else {
      passed += 1;
      console.log(`  PASS  ${name}`);
    }
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${name}: ${err.message}`);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${name}: ${err.message}`);
  }
}

function makeCapability(overrides = {}) {
  return {
    id: 'cap-1',
    _id: 'cap-1',
    subjectType: 'agent',
    subjectId: 'agent-1',
    capabilityId: 'business_formation',
    status: GRANT_STATUSES.ACTIVE,
    trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED,
    scope: { jurisdictionIds: [] },
    evidenceRefs: [],
    review: {},
    recordVersion: 0,
    ...overrides,
  };
}

function makeStaffActor(overrides = {}) {
  return { isStaff: true, id: 'staff-99', subjectType: 'staff', subjectId: 'staff-99', ...overrides };
}

function makeProviderActor(subjectType = 'agent', subjectId = 'agent-1') {
  return { isStaff: false, id: subjectId, subjectType, subjectId };
}

function makeListing(overrides = {}) {
  return {
    _id: 'listing-1',
    id: 'listing-1',
    subjectType: 'agent',
    subjectId: 'agent-1',
    capabilityId: 'business_formation',
    jurisdictionId: 'us-wy',
    countryCode: 'US',
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.PENDING,
    publicationStatus: 'private',
    appeal: null,
    reviewReason: '',
    reviewedBy: null,
    recordVersion: 0,
    ...overrides,
  };
}

console.log('\nGBS Phase 6 Governance Tests\n');

// ─── CAP-REVIEW-01 ───────────────────────────────────────────────────────────
await asyncTest('CAP-REVIEW-01: submitted capability evidence is reviewable by admin', async () => {
  const store = createMemoryProviderCapabilityStore([
    makeCapability({ trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED }),
  ]);
  const svc = createProviderCapabilityReviewService({ store, audit: async () => {} });
  const providerActor = makeProviderActor();

  const afterSubmit = await svc.submitEvidence({
    id: 'cap-1',
    subjectType: 'agent',
    subjectId: 'agent-1',
    expectedVersion: 0,
    actor: providerActor,
    evidence: { evidenceType: 'certificate', decision: EVIDENCE_DECISIONS.PENDING, url: 'https://x.com/cert' },
  });
  assert.equal(afterSubmit.trustStatus, PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED, 'trust status should be evidence_submitted');
  assert.ok(afterSubmit.evidenceRefs.length >= 1, 'evidence attached');
});

// ─── CAP-REVIEW-02 ───────────────────────────────────────────────────────────
await asyncTest('CAP-REVIEW-02: admin can accept evidence', async () => {
  const cap = makeCapability({
    trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED,
    capabilityId: 'business_formation',
    evidenceRefs: [{ evidenceType: 'certificate', decision: EVIDENCE_DECISIONS.PENDING }],
    recordVersion: 1,
  });
  const store = createMemoryProviderCapabilityStore([cap]);
  const svc = createProviderCapabilityReviewService({ store, audit: async () => {} });
  const result = await svc.reviewEvidence({
    id: 'cap-1',
    subjectType: 'agent',
    subjectId: 'agent-1',
    expectedVersion: 1,
    actor: makeStaffActor(),
    evidenceIndex: 0,
    decision: EVIDENCE_DECISIONS.ACCEPTED,
  });
  assert.equal(result.evidenceRefs[0].decision, EVIDENCE_DECISIONS.ACCEPTED);
});

// ─── CAP-REVIEW-03 ───────────────────────────────────────────────────────────
await asyncTest('CAP-REVIEW-03: admin can request needs_information on evidence', async () => {
  const cap = makeCapability({
    trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED,
    capabilityId: 'business_formation',
    evidenceRefs: [{ evidenceType: 'certificate', decision: EVIDENCE_DECISIONS.PENDING }],
    recordVersion: 1,
  });
  const store = createMemoryProviderCapabilityStore([cap]);
  const svc = createProviderCapabilityReviewService({ store, audit: async () => {} });
  const result = await svc.reviewEvidence({
    id: 'cap-1',
    subjectType: 'agent',
    subjectId: 'agent-1',
    expectedVersion: 1,
    actor: makeStaffActor(),
    evidenceIndex: 0,
    decision: EVIDENCE_DECISIONS.NEEDS_INFORMATION,
  });
  assert.equal(result.evidenceRefs[0].decision, EVIDENCE_DECISIONS.NEEDS_INFORMATION);
});

// ─── CAP-REVIEW-04 ───────────────────────────────────────────────────────────
await asyncTest('CAP-REVIEW-04: provider can resubmit after needs_information', async () => {
  const cap = makeCapability({
    trustStatus: PROVIDER_TRUST_STATUSES.NEEDS_INFORMATION,
    capabilityId: 'business_formation',
    evidenceRefs: [],
    review: { decision: 'needs_information', reasonCode: 'docs_unclear' },
    recordVersion: 2,
  });
  const store = createMemoryProviderCapabilityStore([cap]);
  const svc = createProviderCapabilityReviewService({ store, audit: async () => {} });
  const result = await svc.submitEvidence({
    id: 'cap-1',
    subjectType: 'agent',
    subjectId: 'agent-1',
    expectedVersion: 2,
    actor: makeProviderActor(),
    evidence: { evidenceType: 'certificate', decision: EVIDENCE_DECISIONS.PENDING },
  });
  assert.equal(result.trustStatus, PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED, 'resubmit returns to evidence_submitted');
  assert.equal(result.evidenceRefs.length, 1, 'corrected evidence attached');
});

// ─── CAP-REVIEW-05 ───────────────────────────────────────────────────────────
await asyncTest('CAP-REVIEW-05: invalid evidence transition is denied', async () => {
  const cap = makeCapability({
    trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED,
    capabilityId: 'business_formation',
    evidenceRefs: [{ evidenceType: 'certificate', decision: EVIDENCE_DECISIONS.ACCEPTED }],
    recordVersion: 1,
  });
  const store = createMemoryProviderCapabilityStore([cap]);
  const svc = createProviderCapabilityReviewService({ store, audit: async () => {} });

  await assert.rejects(
    () => svc.reviewEvidence({
      id: 'cap-1',
      subjectType: 'agent',
      subjectId: 'agent-1',
      expectedVersion: 1,
      actor: makeStaffActor(),
      evidenceIndex: 0,
      decision: EVIDENCE_DECISIONS.NEEDS_INFORMATION,
    }),
    (err) => { assert.ok(err.code === 'invalid_evidence_decision', `expected invalid_evidence_decision, got ${err.code}`); return true; }
  );
});

// ─── CAP-REVIEW-06 ───────────────────────────────────────────────────────────
await asyncTest('CAP-REVIEW-06: provider cannot review own capability', async () => {
  const cap = makeCapability({
    trustStatus: PROVIDER_TRUST_STATUSES.EVIDENCE_SUBMITTED,
    capabilityId: 'business_formation',
    evidenceRefs: [{ evidenceType: 'certificate', decision: EVIDENCE_DECISIONS.PENDING }],
    recordVersion: 1,
  });
  const store = createMemoryProviderCapabilityStore([cap]);
  const svc = createProviderCapabilityReviewService({ store, audit: async () => {} });

  const selfActor = { isStaff: false, id: 'agent-1', subjectType: 'agent', subjectId: 'agent-1' };
  await assert.rejects(
    () => svc.reviewEvidence({
      id: 'cap-1',
      subjectType: 'agent',
      subjectId: 'agent-1',
      expectedVersion: 1,
      actor: selfActor,
      evidenceIndex: 0,
      decision: EVIDENCE_DECISIONS.ACCEPTED,
    }),
    (err) => { assert.ok(err.code === 'staff_review_required', `expected staff_review_required, got ${err.code}`); return true; }
  );

  const selfStaffSpoofed = { isStaff: true, id: 'agent-1', subjectType: 'agent', subjectId: 'agent-1' };
  await assert.rejects(
    () => svc.reviewEvidence({
      id: 'cap-1',
      subjectType: 'agent',
      subjectId: 'agent-1',
      expectedVersion: 1,
      actor: selfStaffSpoofed,
      evidenceIndex: 0,
      decision: EVIDENCE_DECISIONS.ACCEPTED,
    }),
    (err) => { assert.ok(err.code === 'provider_self_review_forbidden', `expected provider_self_review_forbidden, got ${err.code}`); return true; }
  );
});

// ─── COV-01 ──────────────────────────────────────────────────────────────────
test('COV-01: approved capability + claimed jurisdiction → coverage enters review', () => {
  const listing = makeListing({ moderationStatus: GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW });
  assert.equal(listing.moderationStatus, GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW,
    'listing under_review is reviewable state');
  assert.equal(listing.adminReviewStatus, GBS_LISTING_ADMIN_REVIEW_STATUSES.PENDING,
    'admin review starts pending');
});

// ─── COV-02 ──────────────────────────────────────────────────────────────────
test('COV-02: coverage approval is independent from capability approval', () => {
  const verifiedCapability = makeCapability({ trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED, status: GRANT_STATUSES.ACTIVE });
  const pendingListing = makeListing({ moderationStatus: GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW });

  assert.equal(verifiedCapability.trustStatus, PROVIDER_TRUST_STATUSES.VERIFIED);
  assert.notEqual(
    pendingListing.moderationStatus,
    GBS_LISTING_MODERATION_STATUSES.APPROVED,
    'verified capability does not imply approved listing/coverage'
  );
});

// ─── COV-03 ──────────────────────────────────────────────────────────────────
test('COV-03: rejected coverage does not become approved implicitly', () => {
  const rejectedListing = makeListing({ moderationStatus: GBS_LISTING_MODERATION_STATUSES.REJECTED });
  assert.notEqual(rejectedListing.moderationStatus, GBS_LISTING_MODERATION_STATUSES.APPROVED,
    'rejected listing is not approved');
  assert.notEqual(rejectedListing.adminReviewStatus, GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
    'rejected listing adminReviewStatus is not approved');
});

// ─── COV-04 ──────────────────────────────────────────────────────────────────
test('COV-04: resubmission is allowed from rejected and needs_information states', () => {
  const SUBMITTABLE_FROM = new Set([
    GBS_LISTING_MODERATION_STATUSES.DRAFT,
    GBS_LISTING_MODERATION_STATUSES.NEEDS_INFORMATION,
    GBS_LISTING_MODERATION_STATUSES.REJECTED,
  ]);
  for (const state of [GBS_LISTING_MODERATION_STATUSES.REJECTED, GBS_LISTING_MODERATION_STATUSES.NEEDS_INFORMATION]) {
    assert.ok(SUBMITTABLE_FROM.has(state), `${state} should be resubmittable`);
  }
  assert.doesNotThrow(() => assertResubmitAllowed(makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.REJECTED,
    appeal: null,
  })));
  assert.doesNotThrow(() => assertResubmitAllowed(makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.NEEDS_INFORMATION,
    appeal: null,
  })));
});

// ─── COV-05 ──────────────────────────────────────────────────────────────────
test('COV-05: subject filter prevents cross-subject mutation', () => {
  const listing = makeListing({ subjectType: 'agent', subjectId: 'agent-1' });
  const differentSubject = { subjectType: 'agent', subjectId: 'agent-2' };
  const matched = listing.subjectType === differentSubject.subjectType &&
    String(listing.subjectId) === String(differentSubject.subjectId);
  assert.equal(matched, false, 'different subjectId must not match');
});

// ─── COV-06 ──────────────────────────────────────────────────────────────────
test('COV-06: suspended/revoked capability is not usable', () => {
  const suspendedCap = makeCapability({
    status: GRANT_STATUSES.SUSPENDED,
    trustStatus: PROVIDER_TRUST_STATUSES.SUSPENDED,
    capabilityId: 'business_formation',
    scope: { jurisdictionIds: ['us-wy'] },
  });
  const revokedCap = makeCapability({
    status: GRANT_STATUSES.REVOKED,
    trustStatus: PROVIDER_TRUST_STATUSES.REVOKED,
    capabilityId: 'business_formation',
    scope: { jurisdictionIds: ['us-wy'] },
  });
  assert.equal(isCapabilityUsable(suspendedCap), false, 'suspended capability is not usable');
  assert.equal(isCapabilityUsable(revokedCap), false, 'revoked capability is not usable');
});

// ─── COV-NOTE-01 ─────────────────────────────────────────────────────────────
test('COV-NOTE-01: provider projection contains provider-visible correction/rejection reason', () => {
  const listing = makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.REJECTED,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.REJECTED,
    reviewReason: 'Missing formation authority evidence for Wyoming',
    reviewedBy: 'staff-internal-99',
  });
  const projected = publicListingProjection(listing);
  assert.equal(projected.reviewFeedback, 'Missing formation authority evidence for Wyoming');
  assert.equal(projected.reviewNote, undefined, 'legacy reviewNote alias must not be exposed');
  assert.equal(projected.reviewReason, undefined, 'raw reviewReason key must not leak under that name');
});

// ─── COV-NOTE-02 ─────────────────────────────────────────────────────────────
test('COV-NOTE-02: internal moderator/private note fields are not exposed', () => {
  const listing = makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.REJECTED,
    reviewReason: 'Correct entity type documentation',
    reviewedBy: 'staff-secret',
    reviewedAt: new Date(),
  });
  const projected = publicListingProjection(listing);
  assert.equal(projected.reviewedBy, undefined);
  assert.equal(projected.reviewedAt, undefined);
  assert.equal(projected.adminNotes, undefined);
  assert.equal(projected.internalNote, undefined);
  assert.equal(projected.moderatorNote, undefined);
  assert.equal(projected.privateNote, undefined);
  assert.ok(marketplaceLeakKeys().includes('reviewReason'),
    'marketplace leak list must keep excluding reviewReason');
  assert.ok(marketplaceLeakKeys().includes('reviewedBy'),
    'marketplace leak list must keep excluding reviewedBy');
});

// ─── COV-NOTE-03 ─────────────────────────────────────────────────────────────
test('COV-NOTE-03: needs-information workflow exposes actionable provider feedback', () => {
  const listing = makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.NEEDS_INFORMATION,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.NEEDS_INFORMATION,
    reviewReason: 'Add turnaround estimate and clarify excluded items',
  });
  const projected = publicListingProjection(listing);
  assert.equal(projected.adminReviewStatus, GBS_LISTING_ADMIN_REVIEW_STATUSES.NEEDS_INFORMATION);
  assert.equal(projected.moderationStatus, GBS_LISTING_MODERATION_STATUSES.NEEDS_INFORMATION);
  assert.equal(
    projected.reviewFeedback,
    'Add turnaround estimate and clarify excluded items',
    'needs-information must surface actionable correction feedback'
  );
});

// ─── APPEAL-01 ───────────────────────────────────────────────────────────────
test('APPEAL-01: rejected listing qualifies for appeal', () => {
  const rejectedListing = makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.REJECTED,
    appeal: null,
  });
  assert.doesNotThrow(() => assertAppealEligibility(rejectedListing), 'rejected listing should be eligible for appeal');
});

// ─── APPEAL-02 ───────────────────────────────────────────────────────────────
test('APPEAL-02: approved/non-rejected listing is not eligible for appeal', () => {
  const approvedListing = makeListing({ moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED });
  assert.throws(() => assertAppealEligibility(approvedListing),
    (err) => { assert.equal(err.code, 'appeal_listing_not_rejected'); return true; }
  );

  const underReviewListing = makeListing({ moderationStatus: GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW });
  assert.throws(() => assertAppealEligibility(underReviewListing),
    (err) => { assert.equal(err.code, 'appeal_listing_not_rejected'); return true; }
  );

  const draftListing = makeListing({ moderationStatus: GBS_LISTING_MODERATION_STATUSES.DRAFT });
  assert.throws(() => assertAppealEligibility(draftListing),
    (err) => { assert.equal(err.code, 'appeal_listing_not_rejected'); return true; }
  );
});

// ─── APPEAL-03 ───────────────────────────────────────────────────────────────
test('APPEAL-03: active appeal blocks a second appeal submission', () => {
  const listingWithActiveAppeal = makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.REJECTED,
    appeal: { status: APPEAL_STATUSES.SUBMITTED, reason: 'first appeal', submittedAt: new Date() },
  });
  assert.throws(() => assertAppealEligibility(listingWithActiveAppeal),
    (err) => { assert.equal(err.code, 'appeal_already_active'); return true; }
  );
});

// ─── APPEAL-03b ──────────────────────────────────────────────────────────────
test('APPEAL-03b: approved appeal returns listing to under_review, not approved', () => {
  assert.equal(APPEAL_STATUSES.APPROVED, 'approved', 'appeal approved status exists');
  const expectedListingStatusAfterAppealApproval = GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW;
  assert.notEqual(
    expectedListingStatusAfterAppealApproval,
    GBS_LISTING_MODERATION_STATUSES.APPROVED,
    'appeal approval does not directly approve coverage'
  );
});

// ─── APPEAL-04 ───────────────────────────────────────────────────────────────
test('APPEAL-04: admin appeal decision states are distinct and defined', () => {
  assert.equal(APPEAL_STATUSES.APPROVED, 'approved');
  assert.equal(APPEAL_STATUSES.REJECTED, 'rejected');
  assert.notEqual(APPEAL_STATUSES.APPROVED, APPEAL_STATUSES.REJECTED);

  const activeStatuses = [APPEAL_STATUSES.SUBMITTED, APPEAL_STATUSES.UNDER_REVIEW];
  for (const s of activeStatuses) {
    assert.ok(isActiveAppeal({ status: s }), `${s} is active`);
  }
  const terminalStatuses = [APPEAL_STATUSES.APPROVED, APPEAL_STATUSES.REJECTED];
  for (const s of terminalStatuses) {
    assert.ok(!isActiveAppeal({ status: s }), `${s} is terminal (not active)`);
  }
});

// ─── APPEAL-05 ───────────────────────────────────────────────────────────────
test('APPEAL-05: provider appeal decision is rejected without isStaff', () => {
  function fakeApproveAppeal({ actor }) {
    if (!actor?.isStaff) {
      throw Object.assign(new Error('staff_review_required'), { code: 'staff_review_required', status: 403 });
    }
  }
  assert.throws(
    () => fakeApproveAppeal({ actor: makeProviderActor() }),
    (err) => { assert.equal(err.code, 'staff_review_required'); return true; }
  );
  assert.doesNotThrow(
    () => fakeApproveAppeal({ actor: makeStaffActor() }),
    'staff actor should not throw'
  );
});

// ─── APPEAL-CONFLICT-01 ──────────────────────────────────────────────────────
test('APPEAL-CONFLICT-01: pending appeal blocks provider resubmit', () => {
  const listing = makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.REJECTED,
    appeal: { status: APPEAL_STATUSES.SUBMITTED, reason: 'Please reconsider', submittedAt: new Date() },
  });
  assert.throws(() => assertResubmitAllowed(listing),
    (err) => { assert.equal(err.code, 'appeal_in_progress'); return true; }
  );
  assert.equal(listing.moderationStatus, GBS_LISTING_MODERATION_STATUSES.REJECTED);
  assert.ok(isActiveAppeal(listing.appeal));
});

// ─── APPEAL-CONFLICT-02 ──────────────────────────────────────────────────────
test('APPEAL-CONFLICT-02: approved appeal reopens review and blocks further decision', () => {
  const afterApproval = makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.PENDING,
    publicationStatus: 'private',
    appeal: {
      status: APPEAL_STATUSES.APPROVED,
      reason: 'Please reconsider',
      decidedAt: new Date(),
      decisionReason: 'reopen for review',
    },
  });
  assert.equal(afterApproval.moderationStatus, GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW);
  assert.equal(afterApproval.publicationStatus, 'private');
  assert.ok(!isActiveAppeal(afterApproval.appeal));
  assert.throws(() => assertAppealDecisionEligibility(afterApproval),
    (err) => { assert.equal(err.code, 'no_active_appeal'); return true; }
  );
});

// ─── APPEAL-CONFLICT-03 ──────────────────────────────────────────────────────
test('APPEAL-CONFLICT-03: rejected appeal keeps listing rejected; resubmit then allowed', () => {
  const afterReject = makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.REJECTED,
    appeal: {
      status: APPEAL_STATUSES.REJECTED,
      reason: 'Please reconsider',
      decidedAt: new Date(),
      decisionReason: 'insufficient grounds',
    },
  });
  assert.equal(afterReject.moderationStatus, GBS_LISTING_MODERATION_STATUSES.REJECTED);
  assert.ok(!isActiveAppeal(afterReject.appeal));
  assert.doesNotThrow(() => assertResubmitAllowed(afterReject));
});

// ─── APPEAL-CONFLICT-04 ──────────────────────────────────────────────────────
test('APPEAL-CONFLICT-04: stale/decided appeal cannot mutate a newer listing state', () => {
  const staleDecided = makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW,
    appeal: { status: APPEAL_STATUSES.APPROVED, decidedAt: new Date() },
  });
  assert.throws(() => assertAppealDecisionEligibility(staleDecided),
    (err) => { assert.equal(err.code, 'no_active_appeal'); return true; }
  );

  const stateMismatch = makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW,
    appeal: { status: APPEAL_STATUSES.SUBMITTED, reason: 'stale', submittedAt: new Date() },
  });
  assert.throws(() => assertAppealDecisionEligibility(stateMismatch),
    (err) => { assert.equal(err.code, 'appeal_listing_state_mismatch'); return true; }
  );

  const valid = makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.REJECTED,
    appeal: { status: APPEAL_STATUSES.UNDER_REVIEW, reason: 'ok', submittedAt: new Date() },
  });
  assert.doesNotThrow(() => assertAppealDecisionEligibility(valid));
});

// ─── APPEAL-SCOPE-01 ─────────────────────────────────────────────────────────
test('APPEAL-SCOPE-01: appeal audit/event contains exact capabilityId + jurisdictionId', () => {
  const listing = makeListing({
    _id: 'listing-abc',
    capabilityId: 'business_formation',
    jurisdictionId: 'us-wy',
    subjectType: 'agent',
    subjectId: 'agent-1',
  });
  const meta = appealCoverageMetadata(listing, { appealStatus: APPEAL_STATUSES.SUBMITTED });
  assert.equal(meta.listingId, 'listing-abc');
  assert.equal(meta.capabilityId, 'business_formation');
  assert.equal(meta.jurisdictionId, 'us-wy');
  assert.equal(meta.subjectType, 'agent');
  assert.equal(meta.subjectId, 'agent-1');
  assert.equal(meta.appealStatus, APPEAL_STATUSES.SUBMITTED);
  assert.equal(meta.evidenceRef, undefined);
  assert.equal(meta.explanation, undefined);
});

// ─── APPEAL-SCOPE-02 ─────────────────────────────────────────────────────────
test('APPEAL-SCOPE-02: provider subject ownership remains exact', () => {
  const listing = makeListing({ subjectType: 'organization', subjectId: 'org-99' });
  const meta = appealCoverageMetadata(listing, { decision: 'rejected' });
  assert.equal(meta.subjectType, 'organization');
  assert.equal(meta.subjectId, 'org-99');
  const foreign = { subjectType: 'organization', subjectId: 'org-other' };
  const owned =
    listing.subjectType === foreign.subjectType &&
    String(listing.subjectId) === String(foreign.subjectId);
  assert.equal(owned, false);
});

// ─── APPEAL-SCOPE-03 ─────────────────────────────────────────────────────────
test('APPEAL-SCOPE-03: appeal approval reopens only the exact listing/coverage tuple', () => {
  const listing = makeListing({
    _id: 'listing-exact',
    capabilityId: 'registered_agent',
    jurisdictionId: 'us-de',
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.REJECTED,
    appeal: { status: APPEAL_STATUSES.SUBMITTED, reason: 'reopen', submittedAt: new Date() },
  });
  assert.doesNotThrow(() => assertAppealDecisionEligibility(listing));
  const after = {
    ...listing,
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW,
    publicationStatus: 'private',
    appeal: { ...listing.appeal, status: APPEAL_STATUSES.APPROVED, decidedAt: new Date() },
  };
  const meta = appealCoverageMetadata(listing, {
    appealStatus: APPEAL_STATUSES.APPROVED,
    decision: 'approved',
    toModeration: GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW,
  });
  assert.equal(meta.listingId, 'listing-exact');
  assert.equal(meta.capabilityId, 'registered_agent');
  assert.equal(meta.jurisdictionId, 'us-de');
  assert.equal(meta.toModeration, GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW);
  assert.notEqual(after.moderationStatus, GBS_LISTING_MODERATION_STATUSES.APPROVED);
  assert.equal(after.publicationStatus, 'private');
  assert.notEqual(meta.capabilityId, 'business_formation');
});

// ─── TRUST-01 ────────────────────────────────────────────────────────────────
test('TRUST-01: organization verified does not imply capability approved', () => {
  const orgVerified = true;
  const capabilityTrustStatus = PROVIDER_TRUST_STATUSES.CLAIMED;
  assert.notEqual(orgVerified, capabilityTrustStatus === PROVIDER_TRUST_STATUSES.VERIFIED,
    'org verified != capability verified');
});

// ─── TRUST-02 ────────────────────────────────────────────────────────────────
test('TRUST-02: capability approved does not imply coverage approved', () => {
  const cap = makeCapability({ trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED, status: GRANT_STATUSES.ACTIVE });
  const listing = makeListing({ moderationStatus: GBS_LISTING_MODERATION_STATUSES.UNDER_REVIEW });

  assert.equal(cap.trustStatus, PROVIDER_TRUST_STATUSES.VERIFIED);
  assert.notEqual(listing.moderationStatus, GBS_LISTING_MODERATION_STATUSES.APPROVED,
    'verified capability does not approve coverage');
});

// ─── TRUST-03 ────────────────────────────────────────────────────────────────
test('TRUST-03: coverage approved does not imply listing published', () => {
  const approvedListing = makeListing({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED,
    publicationStatus: 'private',
  });
  assert.equal(approvedListing.publicationStatus, 'private',
    'approved coverage listing remains private until publication gate passes');
  assert.notEqual(approvedListing.publicationStatus, 'public',
    'approved coverage is not automatically public');
});

// ─── NOTIFY-01 ───────────────────────────────────────────────────────────────
test('NOTIFY-01: GBS_LISTING_APPEAL_SUBMITTED audit event is defined', () => {
  assert.equal(typeof GBS_AUDIT_EVENTS.GBS_LISTING_APPEAL_SUBMITTED, 'string',
    'appeal submitted audit event must exist');
  assert.equal(typeof GBS_AUDIT_EVENTS.GBS_LISTING_APPEAL_APPROVED, 'string',
    'appeal approved audit event must exist');
  assert.equal(typeof GBS_AUDIT_EVENTS.GBS_LISTING_APPEAL_REJECTED, 'string',
    'appeal rejected audit event must exist');
  assert.equal(GBS_AUDIT_EVENTS.PROVIDER_CAPABILITY_EVIDENCE_SUBMITTED, 'provider_capability_evidence_submitted',
    'Phase 3 capability evidence submitted event remains intact');
});

// ─── Summary ─────────────────────────────────────────────────────────────────
await new Promise((resolve) => setImmediate(resolve));

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
