import { Job } from '../../models/Job.js';
import {
  FREE_BETA_PUBLISHING_POLICY,
} from '../../config/freeBetaPublishingPolicy.js';
import { calculatePublishingQuotaUsage } from '../publishing/PublishingQuotaUsageService.js';
import { evaluateEmployerSubmissionEligibility } from '../publishing/EmployerSubmissionEligibility.js';
import { Employer } from '../../models/Employer.js';
import { Organization } from '../../models/Organization.js';
import { OrganizationVerification } from '../../models/OrganizationVerification.js';

async function overlayOrganizationVerification(employer, employerId) {
  if (!employer) return employer;
  const org = await Organization.findOne({ legacyEmployerId: employerId }).select('_id').lean();
  if (!org) return employer;
  const ver = await OrganizationVerification.findOne({ organizationId: org._id }).select('status').lean();
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

export async function loadEmployerPublishingUsage(employerId, { now = new Date() } = {}) {
  const eid = employerId;
  const [drafts, closed, activeFree, pendingReview, chargedJobs, employer] = await Promise.all([
    Job.countDocuments({ employerId: eid, status: 'draft' }),
    Job.countDocuments({ employerId: eid, status: 'closed' }),
    Job.countDocuments({
      employerId: eid,
      status: 'active',
      approvalStatus: 'approved',
      planType: 'free',
    }),
    Job.countDocuments({ employerId: eid, approvalStatus: 'pending' }),
    Job.find({ employerId: eid, chargedSubmissionAt: { $exists: true, $ne: [] } })
      .select('chargedSubmissionAt')
      .lean(),
    Employer.findById(eid).select('verified verificationLevel accountStatus companyName email companyDescription industry location city province').lean(),
  ]);

  const chargedAcceptedAt = chargedJobs.flatMap((job) =>
    Array.isArray(job.chargedSubmissionAt) ? job.chargedSubmissionAt : []
  );
  const usage = calculatePublishingQuotaUsage({
    chargedAcceptedAt,
    activeFreeJobsUsed: activeFree,
    now,
  });
  const eligibilityEmployer = await overlayOrganizationVerification(employer, eid);
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
    pendingReview,
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

export function recordChargedSubmission(job, at = new Date()) {
  if (!Array.isArray(job.chargedSubmissionAt)) job.chargedSubmissionAt = [];
  job.chargedSubmissionAt.push(at);
  job.submittedAt = at;
}
