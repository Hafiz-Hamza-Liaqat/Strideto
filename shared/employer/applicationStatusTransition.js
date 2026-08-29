/**
 * Legacy Application.status transition rules for employer PATCH (MKT-P3 / MKT-P6).
 *
 * Application.status is current state; OpportunityApplication.stageHistory is
 * append-only audit history. Reconsideration moves a closed application back
 * into an active hiring stage without erasing prior outcomes.
 */

/** Legacy statuses an employer may set via PATCH /employer/applications/:id */
export const LEGACY_EMPLOYER_STATUSES = ['shortlisted', 'rejected', 'interview', 'hired'];

/** Closed / not-selected legacy statuses that may be reconsidered into active hiring. */
export const CLOSED_LEGACY_STATUSES = ['rejected'];

/** Active hiring targets an employer may restore after reconsideration. */
export const RECONSIDERATION_TARGET_STATUSES = ['shortlisted', 'interview'];

export const HIRED_LEGACY_STATUS = 'hired';

/**
 * True when a requested status update is a no-op — the application is already in
 * that status. Callers must short-circuit (no write, no tracker sync, no
 * notification, no automation) when this returns true.
 */
export function isSameStatusNoOp(previousStatus, nextStatus) {
  return previousStatus === nextStatus;
}

export function isClosedLegacyStatus(status) {
  return CLOSED_LEGACY_STATUSES.includes(status);
}

/** Employer moves from not-selected / rejected back into active hiring. */
export function isReconsiderationTransition(fromStatus, toStatus) {
  return (
    isClosedLegacyStatus(fromStatus) &&
    RECONSIDERATION_TARGET_STATUSES.includes(toStatus)
  );
}

/** Employer moves from hired back into a non-hired hiring stage (protected in UI). */
export function isHiredReopenTransition(fromStatus, toStatus) {
  return (
    fromStatus === HIRED_LEGACY_STATUS &&
    LEGACY_EMPLOYER_STATUSES.includes(toStatus) &&
    toStatus !== HIRED_LEGACY_STATUS
  );
}

export function requiresEmployerStatusConfirmation(fromStatus, toStatus) {
  return isReconsiderationTransition(fromStatus, toStatus) || isHiredReopenTransition(fromStatus, toStatus);
}

/**
 * Whether an employer may set `toStatus` from `fromStatus`.
 * Hired reopen requires explicit `confirmReopen: true` on the PATCH body.
 */
export function canTransitionApplicationStatus(fromStatus, toStatus, { confirmReopen = false } = {}) {
  if (!LEGACY_EMPLOYER_STATUSES.includes(toStatus)) return false;
  if (isSameStatusNoOp(fromStatus, toStatus)) return true;
  if (isHiredReopenTransition(fromStatus, toStatus) && confirmReopen !== true) return false;
  return true;
}

/** Error code when a hired application is reopened without explicit intent. */
export const HIRING_REOPEN_REQUIRED_CODE = 'HIRING_REOPEN_REQUIRED';

/** Sync / history reason token for OpportunityApplication.stageHistory. */
export function resolveEmployerStatusSyncReason(fromStatus, toStatus) {
  if (isReconsiderationTransition(fromStatus, toStatus)) return 'employer_reconsideration';
  if (isHiredReopenTransition(fromStatus, toStatus)) return 'employer_reopen';
  return 'employer_status_update';
}
