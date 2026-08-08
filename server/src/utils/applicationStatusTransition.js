/**
 * Legacy Employer application-status transition helpers (Mission 0).
 *
 * Extracted as a pure module so the same-status idempotency contract is
 * unit-testable without a database or the full controller.
 */

/** Legacy statuses an Employer may set via the Applications page quick actions. */
export const LEGACY_EMPLOYER_STATUSES = ['shortlisted', 'rejected', 'interview', 'hired'];

/**
 * True when a requested status update is a no-op — the application is already in
 * that status. Callers must short-circuit (no write, no tracker sync, no
 * notification, no automation) when this returns true so repeated/duplicate
 * requests cannot append history or re-notify the candidate.
 */
export function isSameStatusNoOp(previousStatus, nextStatus) {
  return previousStatus === nextStatus;
}
