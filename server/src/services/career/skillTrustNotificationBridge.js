/**
 * Skill trust → in-app notifications.
 *
 * The ONLY producer of skill-verification notifications, and it is reachable
 * only from SkillVerificationService AFTER an authoritative transition has been
 * committed. There is no HTTP route into this module, so a client cannot
 * fabricate a recipient, an outcome, a type or a timestamp: every field below
 * is derived from the persisted claim and the persisted history row.
 *
 * It writes through the platform's existing notification model and service
 * (UserNotification / createUserNotificationOnce) — no parallel inbox, no
 * second delivery path, no new counter.
 *
 * Delivery boundary: this creates in-app records only. It sends no email, SMS
 * or push, and enqueues nothing for the worker.
 */
import { UserSkillClaim } from '../../models/career/UserSkillClaim.js';
import { SkillVerificationHistory } from '../../models/career/SkillVerificationHistory.js';
import { User } from '../../models/User.js';
import { createUserNotificationOnce } from '../notificationService.js';
import { STAFF_ROLES, PERMISSIONS, hasPermission } from '../../config/rbac.js';
import {
  buildSkillTrustNotifications,
  SKILL_TRUST_RECIPIENTS,
} from '../../../../shared/career/skillTrustNotifications.js';

/**
 * Staff who may act on a skill-verification review.
 *
 * Scoped by PERMISSION, not merely by "is staff" — an Editor is a staff role
 * but holds no skill_verification:review grant, so routing a review-queue
 * notification to them would leak the existence of a claim under review to
 * someone with no authority over it.
 */
async function resolveReviewerRecipients(UserModel = User) {
  const staff = await UserModel.find({ role: { $in: STAFF_ROLES } })
    .select('_id role')
    .lean();
  return staff.filter((u) => hasPermission(u.role, PERMISSIONS.SKILL_VERIFICATION_REVIEW));
}

export const SKILL_TRUST_IN_APP_DELIVERY = Object.freeze({
  ENSURED: 'ENSURED',
  PENDING_RECONCILIATION: 'PENDING_RECONCILIATION',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  HISTORY_MISSING: 'HISTORY_MISSING',
  CLAIM_MISSING: 'CLAIM_MISSING',
  IDENTITY_MISMATCH: 'IDENTITY_MISMATCH',
});

function finish(result, plannedCount) {
  if (result.failed > 0) result.status = SKILL_TRUST_IN_APP_DELIVERY.PENDING_RECONCILIATION;
  else if (plannedCount === 0) result.status = SKILL_TRUST_IN_APP_DELIVERY.NOT_APPLICABLE;
  else result.status = SKILL_TRUST_IN_APP_DELIVERY.ENSURED;
  return result;
}

/**
 * Emit the notifications justified by one committed transition.
 *
 * Non-transactional by contract: a notification failure must never roll back
 * or mask a trust decision that already happened. Failures are returned as
 * PENDING_RECONCILIATION, and the immutable history id lets reconciliation
 * retry the same notification without repeating the transition.
 *
 * @returns {Promise<{ created: number, skipped: number, failed: number, status: string, transitionId: string|null }>}
 */
export async function emitSkillTrustNotifications({
  claim,
  fromStatus,
  toStatus,
  historyId,
  applicantVisibleRequest = '',
  occurredAt = new Date(),
}, {
  UserModel = User,
  createNotificationOnce = createUserNotificationOnce,
} = {}) {
  const result = {
    created: 0,
    skipped: 0,
    failed: 0,
    status: null,
    transitionId: historyId ? String(historyId) : null,
  };
  if (!claim || !historyId) return finish(result, 0);

  let planned = [];
  try {
    planned = buildSkillTrustNotifications({
      fromStatus,
      toStatus,
      claim,
      historyId,
      applicantVisibleRequest,
      occurredAt,
    });
  } catch {
    // A truthful-copy violation must not be papered over with a vaguer message:
    // report it for reconciliation/operator attention rather than emitting
    // something misleading.
    result.failed += 1;
    return finish(result, 1);
  }

  for (const item of planned) {
    const { recipientKind, dedupeKey, ...payload } = item;

    try {
      if (recipientKind === SKILL_TRUST_RECIPIENTS.APPLICANT) {
        // Recipient is the claim OWNER as persisted — never a request value.
        const outcome = await createNotificationOnce({
          recipientType: 'user',
          userId: claim.userId,
          dedupeKey,
          ...payload,
        });
        outcome.created ? (result.created += 1) : (result.skipped += 1);
        continue;
      }

      if (recipientKind === SKILL_TRUST_RECIPIENTS.STAFF) {
        const reviewers = await resolveReviewerRecipients(UserModel);
        for (const reviewer of reviewers) {
          // Fan-out needs a per-recipient key: one transition legitimately
          // produces one row PER reviewer, and a shared key would make the
          // unique index drop every reviewer after the first.
          const outcome = await createNotificationOnce({
            recipientType: 'staff',
            userId: reviewer._id,
            dedupeKey: `${dedupeKey}:${String(reviewer._id)}`,
            ...payload,
          });
          outcome.created ? (result.created += 1) : (result.skipped += 1);
        }
      }
    } catch {
      // Trust state is already committed. Keep that truth and make the missing
      // inbox side effect observable/retryable instead of pretending success.
      result.failed += 1;
    }
  }

  return finish(result, planned.length);
}

async function asPlain(queryOrValue) {
  if (queryOrValue && typeof queryOrValue.lean === 'function') {
    return queryOrValue.lean();
  }
  const value = await queryOrValue;
  return value && typeof value.toObject === 'function' ? value.toObject() : value;
}

/**
 * Ensure inbox rows for one already-committed immutable history transition.
 *
 * This is an internal service function, not an HTTP handler. It performs only
 * authoritative reads plus idempotent UserNotification writes: it never
 * updates a claim, appends history or creates a SkillVerification. Consequently
 * retrying it cannot replay the trust decision, and the notification unique key
 * makes concurrent reconciliation collapse to at most one row per recipient.
 */
export async function reconcileSkillTrustNotifications({ historyId }, {
  HistoryModel = SkillVerificationHistory,
  ClaimModel = UserSkillClaim,
  UserModel = User,
  createNotificationOnce = createUserNotificationOnce,
} = {}) {
  let history;
  try {
    history = await asPlain(HistoryModel.findById(historyId));
  } catch {
    return {
      created: 0,
      skipped: 0,
      failed: 1,
      status: SKILL_TRUST_IN_APP_DELIVERY.PENDING_RECONCILIATION,
      transitionId: historyId ? String(historyId) : null,
    };
  }
  if (!history) {
    return {
      created: 0,
      skipped: 0,
      failed: 0,
      status: SKILL_TRUST_IN_APP_DELIVERY.HISTORY_MISSING,
      transitionId: historyId ? String(historyId) : null,
    };
  }

  let claim;
  try {
    claim = await asPlain(ClaimModel.findById(history.claimId));
  } catch {
    return {
      created: 0,
      skipped: 0,
      failed: 1,
      status: SKILL_TRUST_IN_APP_DELIVERY.PENDING_RECONCILIATION,
      transitionId: String(history._id),
    };
  }
  if (!claim) {
    return {
      created: 0,
      skipped: 0,
      failed: 0,
      status: SKILL_TRUST_IN_APP_DELIVERY.CLAIM_MISSING,
      transitionId: String(history._id),
    };
  }
  if (String(history.userId) !== String(claim.userId)) {
    return {
      created: 0,
      skipped: 0,
      failed: 0,
      status: SKILL_TRUST_IN_APP_DELIVERY.IDENTITY_MISMATCH,
      transitionId: String(history._id),
    };
  }

  return emitSkillTrustNotifications({
    claim,
    fromStatus: history.fromStatus,
    toStatus: history.toStatus,
    historyId: history._id,
    applicantVisibleRequest: history.applicantVisibleRequest ?? '',
    occurredAt: history.occurredAt,
  }, { UserModel, createNotificationOnce });
}

/**
 * Reconcile a claim's notification-visible state with its CURRENT trust state.
 *
 * Used by revocation and expiry, where the requirement is not merely "send an
 * alert" but "the badge is gone and the inbox agrees". Reads the claim fresh so
 * the reported state is the persisted one rather than an in-memory copy.
 */
export async function readCurrentTrustStateForNotification(claimId) {
  const claim = await UserSkillClaim.findById(claimId).select('status expiresAt revokedAt').lean();
  return claim?.status ?? null;
}
