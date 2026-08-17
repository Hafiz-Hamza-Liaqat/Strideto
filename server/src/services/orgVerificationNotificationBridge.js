/**
 * Organization verification / canonical-claim → in-app notifications (Phase 2).
 *
 * Reuses UserNotification + createUserNotificationOnce. No email, SMS, push,
 * or worker enqueue. Staff fan-out is permission-scoped (verification:read),
 * never notifyStaff(). Internal reviewer reasons never appear in title/body.
 */
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { createUserNotificationOnce } from './notificationService.js';
import { notifyAgentOrganizationOwners } from './agentInboxNotificationBridge.js';
import { notifyInstitutionOrganizationOwners } from './institutionInboxNotificationBridge.js';
import { isInstitutionOrgType } from '../../../shared/institution/institutionPortal.js';
import { STAFF_ROLES, PERMISSIONS, hasPermission } from '../config/rbac.js';
import { VERIFICATION_STATUSES } from '../../../shared/international/verification.js';
import {
  ORG_VERIFICATION_NOTIFICATION_TYPES,
  CANONICAL_CLAIM_NOTIFICATION_TYPES,
  orgVerificationDedupeKey,
  canonicalClaimDedupeKey,
  sanitizeOrgVerificationNotificationMetadata,
} from '../../../shared/platform/organizationVerificationNotifications.js';

const VS = VERIFICATION_STATUSES;

async function resolveReviewerRecipients(UserModel = User) {
  const staff = await UserModel.find({ role: { $in: STAFF_ROLES } })
    .select('_id role')
    .lean();
  return staff.filter((u) => hasPermission(u.role, PERMISSIONS.VERIFICATION_READ));
}

function staffCopy(fromStatus, toStatus) {
  if (toStatus === VS.VERIFICATION_PENDING && fromStatus === VS.NEEDS_INFORMATION) {
    return {
      type: ORG_VERIFICATION_NOTIFICATION_TYPES.RESUBMITTED,
      title: 'Organization verification resubmitted',
      body: 'An organization resubmitted verification after a request for more information.',
    };
  }
  if (toStatus === VS.VERIFICATION_PENDING) {
    return {
      type: ORG_VERIFICATION_NOTIFICATION_TYPES.SUBMITTED,
      title: 'Organization verification submitted',
      body: 'A new organization verification request is ready for review.',
    };
  }
  if (toStatus === VS.ENHANCED_REVIEW) {
    return {
      type: ORG_VERIFICATION_NOTIFICATION_TYPES.SUBMITTED,
      title: 'Organization moved to enhanced review',
      body: 'An organization verification was escalated and needs enhanced review.',
    };
  }
  if (toStatus === VS.EXPIRED) {
    return {
      type: ORG_VERIFICATION_NOTIFICATION_TYPES.EXPIRED_REVIEW_DUE,
      title: 'Organization verification expired — review due',
      body: 'An organization verification expired and staff action may be required.',
    };
  }
  return null;
}

function orgCopy(toStatus) {
  switch (toStatus) {
    case VS.NEEDS_INFORMATION:
      return {
        type: ORG_VERIFICATION_NOTIFICATION_TYPES.NEEDS_INFORMATION,
        title: 'More information needed',
        body: 'Reviewers requested additional information for your organization verification.',
      };
    case VS.APPROVED:
      return {
        type: ORG_VERIFICATION_NOTIFICATION_TYPES.APPROVED,
        title: 'Organization verification approved',
        body: 'Your organization verification was approved.',
      };
    case VS.REJECTED:
      return {
        type: ORG_VERIFICATION_NOTIFICATION_TYPES.REJECTED,
        title: 'Organization verification not approved',
        body: 'Your organization verification was not approved.',
      };
    case VS.SUSPENDED:
      return {
        type: ORG_VERIFICATION_NOTIFICATION_TYPES.SUSPENDED,
        title: 'Organization verification suspended',
        body: 'Your organization verification was suspended.',
      };
    case VS.REVOKED:
      return {
        type: ORG_VERIFICATION_NOTIFICATION_TYPES.REVOKED,
        title: 'Organization verification revoked',
        body: 'Your organization verification was revoked.',
      };
    case VS.EXPIRED:
      return {
        type: ORG_VERIFICATION_NOTIFICATION_TYPES.EXPIRED_REVIEW_DUE,
        title: 'Organization verification expired',
        body: 'Your organization verification expired and may require re-review.',
      };
    default:
      return null;
  }
}

function finish(result, plannedCount) {
  if (result.failed > 0) result.status = 'PENDING_RECONCILIATION';
  else if (plannedCount === 0) result.status = 'NOT_APPLICABLE';
  else result.status = 'ENSURED';
  return result;
}

/**
 * Emit in-app notifications for one committed organization-verification transition.
 * Never throws into the caller’s transition path — failures are counted.
 */
export async function emitOrgVerificationNotifications({
  organizationId,
  fromStatus,
  toStatus,
  transitionId,
  organizationType = '',
} = {}, {
  UserModel = User,
  OrganizationModel = Organization,
  createNotificationOnce = createUserNotificationOnce,
} = {}) {
  const result = { created: 0, skipped: 0, failed: 0, status: null, transitionId: transitionId ? String(transitionId) : null };
  if (!organizationId || !toStatus || !transitionId) return finish(result, 0);

  const metadata = sanitizeOrgVerificationNotificationMetadata({
    organizationId: String(organizationId),
    organizationType,
    fromStatus,
    toStatus,
  });
  const link = `/admin/verification-queue?org=${encodeURIComponent(String(organizationId))}`;

  let planned = 0;

  const staffMsg = staffCopy(fromStatus, toStatus);
  if (staffMsg) {
    let reviewers = [];
    try {
      reviewers = await resolveReviewerRecipients(UserModel);
    } catch {
      result.failed += 1;
      return finish(result, 1);
    }
    planned += reviewers.length;
    for (const reviewer of reviewers) {
      try {
        const outcome = await createNotificationOnce({
          recipientType: 'staff',
          userId: reviewer._id,
          category: 'verification',
          type: staffMsg.type,
          title: staffMsg.title,
          body: staffMsg.body,
          link,
          metadata,
          dedupeKey: `${orgVerificationDedupeKey({
            organizationId: String(organizationId),
            notificationType: staffMsg.type,
            transitionId: String(transitionId),
          })}:staff:${reviewer._id}`,
        });
        outcome.created ? (result.created += 1) : (result.skipped += 1);
      } catch {
        result.failed += 1;
      }
    }
  }

  const applicantMsg = orgCopy(toStatus);
  if (applicantMsg) {
    try {
      const org = await OrganizationModel.findById(organizationId)
        .select('legacyEmployerId organizationType')
        .lean();
      if (org?.legacyEmployerId) {
        planned += 1;
        const outcome = await createNotificationOnce({
          recipientType: 'employer',
          employerId: org.legacyEmployerId,
          category: 'verification',
          type: applicantMsg.type,
          title: applicantMsg.title,
          body: applicantMsg.body,
          link: '/employer/verification',
          metadata,
          dedupeKey: `${orgVerificationDedupeKey({
            organizationId: String(organizationId),
            notificationType: applicantMsg.type,
            transitionId: String(transitionId),
          })}:employer:${org.legacyEmployerId}`,
        });
        outcome.created ? (result.created += 1) : (result.skipped += 1);
      }
      if (org?.organizationType === 'agent' || org?.organizationType === 'agency') {
        planned += 1;
        const agentOutcome = await notifyAgentOrganizationOwners({
          organizationId,
          category: 'verification',
          type: applicantMsg.type,
          title: applicantMsg.title.replace('Organization', 'Professional'),
          body: applicantMsg.body.replace('organization verification', 'professional verification'),
          link: '/agent/education/verification',
          metadata,
          dedupeKey: `${orgVerificationDedupeKey({
            organizationId: String(organizationId),
            notificationType: applicantMsg.type,
            transitionId: String(transitionId),
          })}`,
        });
        if (agentOutcome.created > 0) result.created += agentOutcome.created;
        else result.skipped += 1;
      }
      if (isInstitutionOrgType(org?.organizationType)) {
        planned += 1;
        const instOutcome = await notifyInstitutionOrganizationOwners({
          organizationId,
          category: 'verification',
          type: applicantMsg.type,
          title: applicantMsg.title,
          body: applicantMsg.body,
          link: '/institution/verification',
          metadata,
          dedupeKey: `${orgVerificationDedupeKey({
            organizationId: String(organizationId),
            notificationType: applicantMsg.type,
            transitionId: String(transitionId),
          })}`,
        });
        if (instOutcome.created > 0) result.created += instOutcome.created;
        else result.skipped += 1;
      }
    } catch {
      result.failed += 1;
    }
  }

  return finish(result, planned);
}

/**
 * Emit staff in-app notifications for a canonical Institution claim event.
 */
export async function emitCanonicalClaimNotifications({
  organizationId,
  claimId,
  notificationType,
  transitionId,
  conflict = false,
} = {}, {
  UserModel = User,
  createNotificationOnce = createUserNotificationOnce,
} = {}) {
  const result = { created: 0, skipped: 0, failed: 0, status: null, transitionId: transitionId ? String(transitionId) : null };
  if (!organizationId || !claimId || !notificationType || !transitionId) return finish(result, 0);

  const type = conflict
    ? CANONICAL_CLAIM_NOTIFICATION_TYPES.CONFLICT
    : notificationType;

  const staffFacing = type === CANONICAL_CLAIM_NOTIFICATION_TYPES.SUBMITTED
    || type === CANONICAL_CLAIM_NOTIFICATION_TYPES.CONFLICT
    || conflict;

  const title = conflict || type === CANONICAL_CLAIM_NOTIFICATION_TYPES.CONFLICT
    ? 'Canonical institution claim conflict'
    : type === CANONICAL_CLAIM_NOTIFICATION_TYPES.SUBMITTED
      ? 'Canonical institution claim submitted'
      : type === CANONICAL_CLAIM_NOTIFICATION_TYPES.APPROVED
        ? 'Canonical institution claim approved'
        : type === CANONICAL_CLAIM_NOTIFICATION_TYPES.REJECTED
          ? 'Canonical institution claim not approved'
          : type === CANONICAL_CLAIM_NOTIFICATION_TYPES.NEEDS_INFORMATION
            ? 'Canonical claim needs information'
            : 'Canonical institution claim requires review';
  const body = conflict || type === CANONICAL_CLAIM_NOTIFICATION_TYPES.CONFLICT
    ? 'A canonical institution claim needs staff action because of a competing claim.'
    : type === CANONICAL_CLAIM_NOTIFICATION_TYPES.APPROVED
      ? 'Your canonical Institution claim was approved.'
      : type === CANONICAL_CLAIM_NOTIFICATION_TYPES.REJECTED
        ? 'Your canonical Institution claim was not approved.'
        : type === CANONICAL_CLAIM_NOTIFICATION_TYPES.NEEDS_INFORMATION
          ? 'Reviewers requested additional information for your canonical claim.'
          : 'A canonical institution claim is ready for staff review.';

  let reviewers = [];
  try {
    reviewers = await resolveReviewerRecipients(UserModel);
  } catch {
    result.failed += 1;
    return finish(result, 1);
  }

  const metadata = sanitizeOrgVerificationNotificationMetadata({
    organizationId: String(organizationId),
    claimId: String(claimId),
  });
  const link = `/admin/sc/claims?claim=${encodeURIComponent(String(claimId))}`;

  if (staffFacing) {
    for (const reviewer of reviewers) {
      try {
        const outcome = await createNotificationOnce({
          recipientType: 'staff',
          userId: reviewer._id,
          category: 'verification',
          type,
          title,
          body,
          link,
          metadata,
          dedupeKey: `${canonicalClaimDedupeKey({
            organizationId: String(organizationId),
            notificationType: type,
            transitionId: String(transitionId),
          })}:staff:${reviewer._id}`,
        });
        outcome.created ? (result.created += 1) : (result.skipped += 1);
      } catch {
        result.failed += 1;
      }
    }
  }

  const institutionFacing = true;
  if (institutionFacing) {
    try {
      const instOutcome = await notifyInstitutionOrganizationOwners({
        organizationId,
        category: 'verification',
        type,
        title,
        body,
        link: '/institution/claim',
        metadata,
        dedupeKey: `${canonicalClaimDedupeKey({
          organizationId: String(organizationId),
          notificationType: type,
          transitionId: String(transitionId),
        })}`,
      });
      if (instOutcome.created > 0) result.created += instOutcome.created;
      else result.skipped += 1;
    } catch {
      result.failed += 1;
    }
  }

  return finish(result, reviewers.length);
}
