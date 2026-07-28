import {
  BETA_QUOTA_OWNER_TYPE,
  FREE_BETA_ACTIVE_SLOT_TRANSITIONS,
  FREE_BETA_PUBLISHING_POLICY,
  JOB_PUBLICATION_STATE,
  PUBLISHING_POLICY_CODES,
  PUBLISHING_QUOTA_RESULT_CODES,
} from '../../config/freeBetaPublishingPolicy.js';
import { Job } from '../../models/Job.js';
import { JobPublicationSubmission } from '../../models/JobPublicationSubmission.js';
import { normalizePublishingQuotaOwner } from './QuotaOwnerResolver.js';

function usageError(code, message) {
  const error = new TypeError(message);
  error.code = code;
  return error;
}

function validDate(value, code = 'INVALID_QUOTA_USAGE_TIME') {
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw usageError(code, 'Quota usage time must be a valid date');
  }
  return date;
}

function nonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw usageError(
      'INVALID_ACTIVE_SLOT_USAGE',
      `${field} must be a non-negative integer`
    );
  }
  return value;
}

export function calculateProjectedActiveFreeJobUsage({
  currentActiveFreeJobUsage,
  slotsReleasedByTransition = 0,
  slotsAcquiredByTransition = 0,
}) {
  const current = nonNegativeInteger(
    currentActiveFreeJobUsage,
    'currentActiveFreeJobUsage'
  );
  const released = nonNegativeInteger(
    slotsReleasedByTransition,
    'slotsReleasedByTransition'
  );
  const acquired = nonNegativeInteger(
    slotsAcquiredByTransition,
    'slotsAcquiredByTransition'
  );

  if (released > current) {
    throw usageError(
      'INVALID_ACTIVE_SLOT_TRANSITION',
      'A transition cannot release more active slots than are currently used'
    );
  }

  return current - released + acquired;
}

export function projectActiveFreeJobUsageForTransition(
  currentActiveFreeJobUsage,
  transitionName
) {
  const transition = FREE_BETA_ACTIVE_SLOT_TRANSITIONS[transitionName];
  if (!transition) {
    throw usageError(
      'UNKNOWN_ACTIVE_SLOT_TRANSITION',
      'Unknown active-slot transition'
    );
  }

  const projectedUsage = calculateProjectedActiveFreeJobUsage({
    currentActiveFreeJobUsage,
    slotsReleasedByTransition: transition.slotsReleased,
    slotsAcquiredByTransition: transition.slotsAcquired,
  });

  return Object.freeze({
    transition: transitionName,
    currentActiveFreeJobUsage,
    slotsReleased: transition.slotsReleased,
    slotsAcquired: transition.slotsAcquired,
    projectedUsage,
    capacityEnforced: transition.enforceCapacity,
    withinCapacity:
      projectedUsage <= FREE_BETA_PUBLISHING_POLICY.maximumActiveFreeJobs,
  });
}

/**
 * Pure rolling-window calculation. Only charged timestamps should be supplied.
 */
export function calculatePublishingQuotaUsage({
  chargedAcceptedAt = [],
  activeFreeJobsUsed = 0,
  now = new Date(),
}) {
  const at = validDate(now);
  const activeFree = nonNegativeInteger(
    activeFreeJobsUsed,
    'activeFreeJobsUsed'
  );
  const dailyPolicy =
    FREE_BETA_PUBLISHING_POLICY.chargedSubmissions.rolling24Hours;
  const monthlyPolicy =
    FREE_BETA_PUBLISHING_POLICY.chargedSubmissions.rolling30Days;
  const dailyStartMs = at.getTime() - dailyPolicy.windowMs;
  const monthlyStartMs = at.getTime() - monthlyPolicy.windowMs;

  const acceptedTimes = chargedAcceptedAt
    .map((value) => validDate(value, 'INVALID_SUBMISSION_ACCEPTED_AT'))
    .filter(
      (value) =>
        value.getTime() > monthlyStartMs && value.getTime() <= at.getTime()
    )
    .sort((left, right) => left.getTime() - right.getTime());

  const dailyTimes = acceptedTimes.filter(
    (value) => value.getTime() > dailyStartMs
  );
  const dailyUsed = dailyTimes.length;
  const monthlyUsed = acceptedTimes.length;
  const dailyRemaining = Math.max(0, dailyPolicy.limit - dailyUsed);
  const monthlyRemaining = Math.max(0, monthlyPolicy.limit - monthlyUsed);
  const activeLimit = FREE_BETA_PUBLISHING_POLICY.maximumActiveFreeJobs;
  const activeRemaining = Math.max(0, activeLimit - activeFree);
  const submissionBlockers = [];

  if (dailyUsed >= dailyPolicy.limit) {
    submissionBlockers.push(PUBLISHING_QUOTA_RESULT_CODES.ROLLING_24H_LIMIT);
  }
  if (monthlyUsed >= monthlyPolicy.limit) {
    submissionBlockers.push(PUBLISHING_QUOTA_RESULT_CODES.ROLLING_30D_LIMIT);
  }

  return Object.freeze({
    policy: Object.freeze({
      code: FREE_BETA_PUBLISHING_POLICY.code,
      version: FREE_BETA_PUBLISHING_POLICY.version,
    }),
    canAcceptChargedSubmission: submissionBlockers.length === 0,
    submissionBlockers: Object.freeze(submissionBlockers),
    daily: Object.freeze({
      window: 'rolling_24_hours',
      used: dailyUsed,
      limit: dailyPolicy.limit,
      remaining: dailyRemaining,
      nextEligibleAt:
        dailyUsed >= dailyPolicy.limit
          ? new Date(dailyTimes[0].getTime() + dailyPolicy.windowMs)
          : null,
    }),
    rolling30Days: Object.freeze({
      used: monthlyUsed,
      limit: monthlyPolicy.limit,
      remaining: monthlyRemaining,
      nextSlotAt:
        monthlyUsed >= monthlyPolicy.limit
          ? new Date(acceptedTimes[0].getTime() + monthlyPolicy.windowMs)
          : null,
    }),
    activeFreeJobs: Object.freeze({
      planCode: PUBLISHING_POLICY_CODES.FREE_BETA,
      used: activeFree,
      limit: activeLimit,
      remaining: activeRemaining,
      hasCapacity: activeFree < activeLimit,
    }),
    approvalCapacity: Object.freeze({
      planCode: PUBLISHING_POLICY_CODES.FREE_BETA,
      used: activeFree,
      limit: activeLimit,
      hasCapacity: activeFree < activeLimit,
      warningCode:
        activeFree < activeLimit
          ? null
          : PUBLISHING_QUOTA_RESULT_CODES.ACTIVE_LIMIT_REACHED_AT_APPROVAL,
    }),
    generatedAt: at,
  });
}

function submissionAcceptedAt(row) {
  return row?.acceptedAt;
}

export async function countCanonicalActiveFreeJobs(
  owner,
  { JobModel = Job, SubmissionModel = JobPublicationSubmission } = {}
) {
  const normalizedOwner = normalizePublishingQuotaOwner(owner);
  if (normalizedOwner.ownerType !== BETA_QUOTA_OWNER_TYPE) {
    throw usageError(
      'UNSUPPORTED_ACTIVE_JOB_OWNER_TYPE',
      'Canonical active-job counting requires an owner-specific implementation'
    );
  }

  if (
    !JobModel?.schema?.path?.('publicationState') ||
    !JobModel.schema.path('lastApprovedSubmissionId')
  ) {
    throw usageError(
      'CANONICAL_PUBLICATION_STATE_NOT_AVAILABLE',
      'Canonical active Free Beta usage is unavailable before publication-state cutover'
    );
  }

  const submissionCollectionName = SubmissionModel?.collection?.name;
  if (
    typeof JobModel.aggregate !== 'function' ||
    typeof submissionCollectionName !== 'string' ||
    submissionCollectionName.length === 0
  ) {
    throw usageError(
      'CANONICAL_FREE_PLAN_LOOKUP_NOT_AVAILABLE',
      'Canonical active Free Beta usage requires the approved-submission plan lookup'
    );
  }

  const rows = await JobModel.aggregate([
    {
      $match: {
        employerId: normalizedOwner.ownerId,
        publicationState: JOB_PUBLICATION_STATE.ACTIVE,
      },
    },
    {
      $lookup: {
        from: submissionCollectionName,
        localField: 'lastApprovedSubmissionId',
        foreignField: '_id',
        as: 'lastApprovedSubmission',
      },
    },
    {
      $match: {
        lastApprovedSubmission: {
          $elemMatch: {
            planCode: PUBLISHING_POLICY_CODES.FREE_BETA,
            state: 'approved',
          },
        },
      },
    },
    { $count: 'used' },
  ]);

  return rows[0]?.used || 0;
}

export async function getPublishingQuotaUsage(
  owner,
  {
    now = new Date(),
    SubmissionModel = JobPublicationSubmission,
    JobModel = Job,
    ActiveFreeJobCounter = countCanonicalActiveFreeJobs,
  } = {}
) {
  const normalizedOwner = normalizePublishingQuotaOwner(owner);
  const at = validDate(now);
  const monthlyStart = new Date(
    at.getTime() -
      FREE_BETA_PUBLISHING_POLICY.chargedSubmissions.rolling30Days.windowMs
  );
  const ownerFilter = {
    quotaOwnerType: normalizedOwner.ownerType,
    quotaOwnerId: normalizedOwner.ownerId,
  };

  const [chargedRows, activeFreeJobsUsed] = await Promise.all([
    SubmissionModel.find({
      ...ownerFilter,
      planCode: PUBLISHING_POLICY_CODES.FREE_BETA,
      quotaCharged: true,
      acceptedAt: { $gt: monthlyStart, $lte: at },
    })
      .select({ acceptedAt: 1, _id: 0 })
      .sort({ acceptedAt: 1 })
      .lean(),
    ActiveFreeJobCounter(normalizedOwner, { JobModel, SubmissionModel }),
  ]);

  return calculatePublishingQuotaUsage({
    chargedAcceptedAt: chargedRows.map(submissionAcceptedAt),
    activeFreeJobsUsed,
    now: at,
  });
}

export const PublishingQuotaUsageService = Object.freeze({
  getUsage: getPublishingQuotaUsage,
  calculate: calculatePublishingQuotaUsage,
  projectActiveFreeJobUsage: projectActiveFreeJobUsageForTransition,
});
