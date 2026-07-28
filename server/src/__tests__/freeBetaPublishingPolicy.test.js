/**
 * Free Beta policy/domain contract tests (E.1F-H2A).
 * Run: node src/__tests__/freeBetaPublishingPolicy.test.js
 */
import assert from 'assert';
import {
  BETA_QUOTA_OWNER_TYPE,
  FREE_BETA_ACTIVE_SLOT_TRANSITIONS,
  FREE_BETA_POLICY_VERSION,
  FREE_BETA_PUBLISHING_POLICY,
  JOB_PUBLICATION_STATE,
  JOB_PUBLICATION_STATES,
  PUBLISHING_POLICY_CODES,
  PUBLISHING_QUOTA_RESULT_CODES,
  buildPublishingQuotaGuardId,
} from '../config/freeBetaPublishingPolicy.js';
import {
  normalizePublishingQuotaOwner,
  resolveEmployerPublishingQuotaOwner,
} from '../services/publishing/QuotaOwnerResolver.js';
import {
  calculateProjectedActiveFreeJobUsage,
  projectActiveFreeJobUsageForTransition,
} from '../services/publishing/PublishingQuotaUsageService.js';

const ownerId = '507f1f77bcf86cd799439011';

assert.strictEqual(PUBLISHING_POLICY_CODES.FREE_BETA, 'free_beta');
assert.strictEqual(FREE_BETA_POLICY_VERSION, 'free-beta-2026-01');
assert.strictEqual(BETA_QUOTA_OWNER_TYPE, 'employer');
assert.strictEqual(FREE_BETA_PUBLISHING_POLICY.drafts.unlimited, true);
assert.strictEqual(FREE_BETA_PUBLISHING_POLICY.drafts.consumesQuota, false);
assert.strictEqual(
  FREE_BETA_PUBLISHING_POLICY.chargedSubmissions.rolling24Hours.limit,
  1
);
assert.strictEqual(
  FREE_BETA_PUBLISHING_POLICY.chargedSubmissions.rolling30Days.limit,
  10
);
assert.strictEqual(FREE_BETA_PUBLISHING_POLICY.maximumActiveFreeJobs, 5);
assert.strictEqual(
  FREE_BETA_PUBLISHING_POLICY.activeFreeJobCapacity.enforcedAt,
  'approval'
);
assert.strictEqual(
  FREE_BETA_PUBLISHING_POLICY.activeFreeJobCapacity.pendingReviewReservesSlot,
  false
);
assert.strictEqual(FREE_BETA_PUBLISHING_POLICY.listing.visibilityDays, 30);
assert.strictEqual(FREE_BETA_PUBLISHING_POLICY.paidPublishingEnabled, false);
assert.strictEqual(
  FREE_BETA_PUBLISHING_POLICY.paidJobsConsumeFreeActiveCapacity,
  false
);
assert.strictEqual(
  FREE_BETA_PUBLISHING_POLICY.employerVerificationRequired,
  true
);
assert.strictEqual(FREE_BETA_PUBLISHING_POLICY.moderationRequired, true);
assert.strictEqual(Object.isFrozen(FREE_BETA_PUBLISHING_POLICY), true);
assert.strictEqual(
  Object.isFrozen(FREE_BETA_PUBLISHING_POLICY.activeFreeJobCapacity),
  true
);
assert.strictEqual(
  Object.isFrozen(FREE_BETA_PUBLISHING_POLICY.chargedSubmissions),
  true
);
assert.strictEqual(
  PUBLISHING_QUOTA_RESULT_CODES.ACTIVE_LIMIT_REACHED_AT_APPROVAL,
  'ACTIVE_LIMIT_REACHED_AT_APPROVAL'
);

assert.deepStrictEqual(JOB_PUBLICATION_STATES, [
  'draft',
  'pending_review',
  'active',
  'rejected',
  'closed',
  'expired',
]);
assert.strictEqual(JOB_PUBLICATION_STATE.ACTIVE, 'active');

assert.deepStrictEqual(FREE_BETA_ACTIVE_SLOT_TRANSITIONS.initial_submission, {
  slotsReleased: 0,
  slotsAcquired: 0,
  enforceCapacity: false,
});
assert.deepStrictEqual(
  FREE_BETA_ACTIVE_SLOT_TRANSITIONS.active_major_edit_submission,
  {
    slotsReleased: 1,
    slotsAcquired: 0,
    enforceCapacity: false,
  }
);
assert.deepStrictEqual(FREE_BETA_ACTIVE_SLOT_TRANSITIONS.approval, {
  slotsReleased: 0,
  slotsAcquired: 1,
  enforceCapacity: true,
});

assert.strictEqual(
  calculateProjectedActiveFreeJobUsage({
    currentActiveFreeJobUsage: 5,
    slotsReleasedByTransition: 1,
    slotsAcquiredByTransition: 0,
  }),
  4
);
assert.strictEqual(
  projectActiveFreeJobUsageForTransition(5, 'initial_submission')
    .projectedUsage,
  5
);
assert.strictEqual(
  projectActiveFreeJobUsageForTransition(5, 'initial_submission')
    .capacityEnforced,
  false
);
assert.strictEqual(
  projectActiveFreeJobUsageForTransition(5, 'active_major_edit_submission')
    .projectedUsage,
  4
);
assert.strictEqual(
  projectActiveFreeJobUsageForTransition(5, 'approval').projectedUsage,
  6
);
assert.strictEqual(
  projectActiveFreeJobUsageForTransition(5, 'approval').withinCapacity,
  false
);
assert.strictEqual(
  projectActiveFreeJobUsageForTransition(5, 'close_active').projectedUsage,
  4
);
assert.strictEqual(
  projectActiveFreeJobUsageForTransition(5, 'expire_active').projectedUsage,
  4
);

assert.throws(
  () =>
    calculateProjectedActiveFreeJobUsage({
      currentActiveFreeJobUsage: 0,
      slotsReleasedByTransition: 1,
    }),
  (error) => error.code === 'INVALID_ACTIVE_SLOT_TRANSITION'
);

assert.strictEqual(
  buildPublishingQuotaGuardId('employer', ownerId),
  `employer:${ownerId}`
);
assert.strictEqual(
  buildPublishingQuotaGuardId('organization', ownerId),
  `organization:${ownerId}`
);
assert.notStrictEqual(
  buildPublishingQuotaGuardId('employer', ownerId),
  buildPublishingQuotaGuardId('organization', ownerId)
);

const resolvedEmployer = resolveEmployerPublishingQuotaOwner({ _id: ownerId });
assert.strictEqual(resolvedEmployer.ownerType, 'employer');
assert.strictEqual(resolvedEmployer.ownerId.toString(), ownerId);
assert.strictEqual(resolvedEmployer.guardId, `employer:${ownerId}`);

const futureOrganization = normalizePublishingQuotaOwner({
  ownerType: 'organization',
  ownerId,
});
assert.strictEqual(futureOrganization.guardId, `organization:${ownerId}`);

assert.throws(
  () => normalizePublishingQuotaOwner({ ownerType: 'company', ownerId }),
  (error) => error.code === 'INVALID_QUOTA_OWNER_TYPE'
);
assert.throws(
  () => resolveEmployerPublishingQuotaOwner('not-an-id'),
  (error) => error.code === 'INVALID_QUOTA_OWNER_ID'
);

console.log('freeBetaPublishingPolicy tests passed.');
