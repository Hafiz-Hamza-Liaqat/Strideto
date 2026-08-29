/**
 * Legacy Employer application-status transition helpers (Mission 0 / MKT-P6).
 *
 * Re-exports shared transition rules so server tests import a stable path.
 */
export {
  LEGACY_EMPLOYER_STATUSES,
  CLOSED_LEGACY_STATUSES,
  RECONSIDERATION_TARGET_STATUSES,
  HIRED_LEGACY_STATUS,
  isSameStatusNoOp,
  isClosedLegacyStatus,
  isReconsiderationTransition,
  isHiredReopenTransition,
  requiresEmployerStatusConfirmation,
  canTransitionApplicationStatus,
  resolveEmployerStatusSyncReason,
  HIRING_REOPEN_REQUIRED_CODE,
} from '../../../shared/employer/applicationStatusTransition.js';
