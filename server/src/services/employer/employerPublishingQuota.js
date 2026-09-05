import { Job } from '../../models/Job.js';
import {
  FREE_BETA_PUBLISHING_POLICY,
  PUBLISHING_QUOTA_RESULT_CODES,
} from '../../config/freeBetaPublishingPolicy.js';
import { calculatePublishingQuotaUsage } from '../publishing/PublishingQuotaUsageService.js';
import { evaluateEmployerSubmissionEligibility } from '../publishing/EmployerSubmissionEligibility.js';
import { Employer } from '../../models/Employer.js';
import { Organization } from '../../models/Organization.js';
import { OrganizationVerification } from '../../models/OrganizationVerification.js';
import { EmployerMembership } from '../../models/employer/EmployerMembership.js';
import { isModerationPendingJob } from '../publishing/employerJobSubmissionState.js';

async function overlayOrganizationVerification(employer, employerId, session) {
  if (!employer) return employer;
  // The active membership is the live Employer-realm organization link. The
  // legacyEmployerId link is retained only as a backward-compatible fallback;
  // it must not win over a current membership when both exist.
  let membershipQuery = EmployerMembership.findOne({ employerId, active: true })
    .select('organizationId')
    .lean();
  if (session) membershipQuery = membershipQuery.session(session);
  const membership = await membershipQuery;
  let orgQuery = membership?.organizationId
    ? Organization.findById(membership.organizationId).select('_id').lean()
    : Organization.findOne({ legacyEmployerId: employerId }).select('_id').lean();
  if (session) orgQuery = orgQuery.session(session);
  const org = await orgQuery;
  if (!org) return employer;
  let verificationQuery = OrganizationVerification.findOne({ organizationId: org._id })
    .sort({ updatedAt: -1, _id: -1 })
    .select('status')
    .lean();
  if (session) verificationQuery = verificationQuery.session(session);
  const ver = await verificationQuery;
  if (ver?.status === 'approved') {
    return {
      ...employer,
      verified: true,
      verificationLevel: ['verified', 'trusted'].includes(employer.verificationLevel)
        ? employer.verificationLevel
        : 'verified',
    };
  }
  if (['rejected', 'suspended', 'revoked', 'expired'].includes(ver?.status)) {
    return { ...employer, verified: false, verificationLevel: 'basic' };
  }
  return employer;
}

function quotaError(status, code, message, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.body = { error: message, code, ...extra };
  return error;
}

/** Server-derived entitlement type for admin review and employer usage UI. */
export function derivePublishingEntitlementType(snapshot) {
  if (!snapshot?.policy) return 'not_configured';
  if (snapshot.policy.paidPublishingEnabled) return 'paid_product';
  if (snapshot.policy.code) return 'free_quota';
  return 'not_configured';
}

export async function loadEmployerPublishingUsage(employerId, { now = new Date(), session = null } = {}) {
  const eid = employerId;
  const count = (filter) => {
    const query = Job.countDocuments(filter);
    return session ? query.session(session) : query;
  };
  const find = (query) => (session ? query.session(session) : query);
  const [drafts, closed, activeFree, pendingReview, chargedJobs, employer] = await Promise.all([
    count({ employerId: eid, status: 'draft' }),
    count({ employerId: eid, status: 'closed' }),
    count({
      employerId: eid,
      status: 'active',
      approvalStatus: 'approved',
      planType: 'free',
    }),
    find(Job.find({ employerId: eid, approvalStatus: 'pending' }).select('source submittedAt').lean()),
    find(Job.find({ employerId: eid, chargedSubmissionAt: { $exists: true, $ne: [] } })
      .select('chargedSubmissionAt')
      .lean()),
    find(Employer.findById(eid).select('verified verificationLevel accountStatus companyName email companyDescription industry location city province').lean()),
  ]);

  const chargedAcceptedAt = chargedJobs.flatMap((job) =>
    Array.isArray(job.chargedSubmissionAt) ? job.chargedSubmissionAt : []
  );
  const usage = calculatePublishingQuotaUsage({
    chargedAcceptedAt,
    activeFreeJobsUsed: activeFree,
    now,
  });
  const eligibilityEmployer = await overlayOrganizationVerification(employer, eid, session);
  const eligibility = evaluateEmployerSubmissionEligibility(eligibilityEmployer || {});

  const payload = {
    policy: {
      code: FREE_BETA_PUBLISHING_POLICY.code,
      version: FREE_BETA_PUBLISHING_POLICY.version,
      draftsUnlimited: FREE_BETA_PUBLISHING_POLICY.drafts.unlimited,
      draftsConsumeQuota: FREE_BETA_PUBLISHING_POLICY.drafts.consumesQuota,
      verificationRequired: FREE_BETA_PUBLISHING_POLICY.employerVerificationRequired,
      moderationRequired: FREE_BETA_PUBLISHING_POLICY.moderationRequired,
      visibilityDays: FREE_BETA_PUBLISHING_POLICY.listing.visibilityDays,
      paidPublishingEnabled: FREE_BETA_PUBLISHING_POLICY.paidPublishingEnabled,
    },
    drafts: { count: drafts, consumesQuota: false, unlimited: true },
    closedJobs: closed,
    pendingReview: pendingReview.filter(isModerationPendingJob).length,
    verification: {
      required: true,
      eligible: eligibility.eligible,
      blockers: eligibility.blockers,
      verified: eligibilityEmployer?.verified === true,
      verificationLevel: eligibilityEmployer?.verificationLevel || 'basic',
    },
    usage,
    nextReset: usage.daily.nextEligibleAt || usage.rolling30Days.nextSlotAt || null,
  };
  return {
    ...payload,
    entitlement: {
      type: derivePublishingEntitlementType(payload),
      policyCode: payload.policy.code,
      policyVersion: payload.policy.version,
      paidPublishingEnabled: payload.policy.paidPublishingEnabled,
    },
  };
}

export async function assertChargedSubmissionAllowed(employerId, { now = new Date() } = {}) {
  const snapshot = await loadEmployerPublishingUsage(employerId, { now });
  if (!snapshot.verification.eligible) {
    throw quotaError(403, 'EMPLOYER_NOT_ELIGIBLE', 'Employer verification is required before submitting a job', {
      blockers: snapshot.verification.blockers,
    });
  }
  if (!snapshot.usage.canAcceptChargedSubmission) {
    throw quotaError(429, snapshot.usage.submissionBlockers[0] || 'QUOTA_EXCEEDED', 'Free submission quota exceeded', {
      blockers: snapshot.usage.submissionBlockers,
      daily: snapshot.usage.daily,
      rolling30Days: snapshot.usage.rolling30Days,
    });
  }
  return snapshot;
}

export async function assertEmployerSubmissionEligible(employerId, { now = new Date() } = {}) {
  const snapshot = await loadEmployerPublishingUsage(employerId, { now });
  if (!snapshot.verification.eligible) {
    throw quotaError(403, 'EMPLOYER_NOT_ELIGIBLE', 'Employer verification is required before submitting a job', {
      blockers: snapshot.verification.blockers,
    });
  }
  return snapshot;
}

export function recordChargedSubmission(job, at = new Date()) {
  if (!Array.isArray(job.chargedSubmissionAt)) job.chargedSubmissionAt = [];
  job.chargedSubmissionAt.push(at);
  job.submittedAt = at;
}

/** True when approving this job would consume a Free Beta active slot. */
export function jobWouldConsumeFreeActiveSlot(job, snapshot) {
  if (!job) return false;
  if (job.status === 'active' && job.approvalStatus === 'approved') return false;
  if (
    snapshot?.policy?.paidPublishingEnabled === true
    && job.planType
    && job.planType !== 'free'
    && FREE_BETA_PUBLISHING_POLICY.paidJobsConsumeFreeActiveCapacity !== true
  ) {
    return false;
  }
  return true;
}

export function projectAdminEntitlementSnapshot(snapshot) {
  if (!snapshot?.policy) {
    return {
      type: 'not_configured',
      paidPublishingEnabled: false,
      payment: { state: 'not_configured' },
    };
  }
  const active = snapshot.usage?.activeFreeJobs || {};
  const daily = snapshot.usage?.daily || {};
  const rolling = snapshot.usage?.rolling30Days || {};
  return {
    type: derivePublishingEntitlementType(snapshot),
    policyCode: snapshot.policy.code,
    policyVersion: snapshot.policy.version,
    paidPublishingEnabled: snapshot.policy.paidPublishingEnabled === true,
    activeFreeJobs: {
      used: active.used ?? 0,
      limit: active.limit ?? FREE_BETA_PUBLISHING_POLICY.maximumActiveFreeJobs,
      remaining: active.remaining ?? 0,
    },
    rolling24Hours: {
      used: daily.used ?? 0,
      limit: daily.limit ?? 0,
      remaining: daily.remaining ?? 0,
      nextEligibleAt: daily.nextEligibleAt || null,
    },
    rolling30Days: {
      used: rolling.used ?? 0,
      limit: rolling.limit ?? 0,
      remaining: rolling.remaining ?? 0,
      nextSlotAt: rolling.nextSlotAt || null,
    },
    blockers: snapshot.usage?.submissionBlockers || [],
    approvalCapacity: snapshot.usage?.approvalCapacity || null,
    verification: snapshot.verification || null,
    payment: { state: snapshot.policy.paidPublishingEnabled ? 'provider' : 'not_configured' },
    nextReset: snapshot.nextReset || null,
  };
}

/**
 * Build the live posting-access context shown to Admin reviewers. This is a
 * projection only: pending jobs never increment active usage and the approval
 * endpoint remains the authority that rechecks capacity.
 */
export function projectJobPublishingEntitlement(job, snapshot) {
  if (!job?.employerId) return null;

  const isPaid = Boolean(job.planType && job.planType !== 'free');
  if (isPaid) {
    return {
      type: 'paid',
      label: 'Paid Job Posting',
      entitlement: snapshot?.policy?.paidPublishingEnabled === true ? 'confirmed' : 'configured',
      freeBeta: { impact: 'none' },
    };
  }

  const active = snapshot?.usage?.activeFreeJobs?.used ?? 0;
  const limit = snapshot?.usage?.activeFreeJobs?.limit
    ?? FREE_BETA_PUBLISHING_POLICY.maximumActiveFreeJobs;
  const remaining = Math.max(0, limit - active);
  const pending = snapshot?.pendingReview ?? 0;
  const canApprove = remaining > 0;
  return {
    type: 'free_beta',
    label: 'Free Beta',
    freeBeta: {
      active,
      limit,
      remaining,
      pending,
      activeAfterApproval: canApprove ? active + 1 : active,
      remainingAfterApproval: canApprove ? remaining - 1 : 0,
      canApprove,
      approvalImpact: canApprove ? 'available' : 'blocked',
    },
  };
}

export async function assertActiveFreeApprovalAllowed(
  employerId,
  { additionalSlots = 1, now = new Date(), session = null } = {}
) {
  if (!employerId) {
    return { entitlement: { type: 'not_configured' }, usage: null };
  }
  const snapshot = await loadEmployerPublishingUsage(employerId, { now, session });
  if (
    snapshot.policy.paidPublishingEnabled === true
    && FREE_BETA_PUBLISHING_POLICY.paidJobsConsumeFreeActiveCapacity !== true
  ) {
    return snapshot;
  }
  const remaining = snapshot.usage?.activeFreeJobs?.remaining ?? 0;
  if (additionalSlots > remaining) {
    throw quotaError(
      409,
      PUBLISHING_QUOTA_RESULT_CODES.ACTIVE_LIMIT_REACHED_AT_APPROVAL,
      'Free Beta active job capacity is exhausted',
      {
        used: snapshot.usage?.activeFreeJobs?.used ?? 0,
        limit: snapshot.usage?.activeFreeJobs?.limit
          ?? FREE_BETA_PUBLISHING_POLICY.maximumActiveFreeJobs,
        remaining,
      }
    );
  }
  return snapshot;
}
