/**
 * Verified Data Launch — apply gate, environment boundary, batch identity
 * ledger (Mission 25).
 *
 * Mission 25 never executes apply mode. This module exists so that the gate a
 * future mutation must pass is written, tested and fails closed today.
 *
 * Authorization is NEVER inferred from NODE_ENV. An operator must state the
 * launch environment explicitly through STRIDETO_LAUNCH_ENV, and production /
 * staging are rejected outright in this mission.
 */
import {
  BATCH_REVIEW_STATES,
  ENVIRONMENT_INTENTS,
  FORBIDDEN_ENVIRONMENT_INTENTS,
  canApproveLaunchBatch,
  isValidEnvironmentIntent,
} from '../../../../shared/data/verifiedLaunch.js';

export class LaunchGateError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'LaunchGateError';
    this.code = code;
  }
}

/** Environment variable that must be set explicitly to permit any application. */
export const LAUNCH_ENV_VAR = 'STRIDETO_LAUNCH_ENV';

/**
 * Resolve the declared launch environment.
 *
 * Fails closed when:
 *   - the variable is unset (no default, no NODE_ENV fallback)
 *   - the value names production/staging
 *   - the value is not a recognised non-production intent
 *
 * @param {object} [env] injectable environment (defaults to process.env)
 */
export function resolveLaunchEnvironment(env = process.env) {
  const raw = env?.[LAUNCH_ENV_VAR];
  if (typeof raw !== 'string' || !raw.trim()) {
    return {
      ok: false,
      environment: null,
      reason: 'launch_environment_not_declared',
      // NODE_ENV is reported for observability only; it never authorizes.
      nodeEnvObserved: env?.NODE_ENV ?? null,
    };
  }
  const value = raw.trim().toLowerCase();
  if (FORBIDDEN_ENVIRONMENT_INTENTS.includes(value)) {
    return {
      ok: false,
      environment: value,
      reason: 'launch_environment_forbidden_in_mission_25',
      nodeEnvObserved: env?.NODE_ENV ?? null,
    };
  }
  if (!isValidEnvironmentIntent(value)) {
    return {
      ok: false,
      environment: value,
      reason: 'launch_environment_unrecognised',
      nodeEnvObserved: env?.NODE_ENV ?? null,
    };
  }
  return {
    ok: true,
    environment: value,
    reason: 'declared_nonproduction_environment',
    nodeEnvObserved: env?.NODE_ENV ?? null,
  };
}

/**
 * Assert that an apply run is permitted. Every safeguard must be satisfied:
 *
 *   1. explicit apply intent flag
 *   2. an approved, non-production declared environment
 *   3. manifest environmentIntent matching that environment
 *   4. batch review state approved_for_nonproduction
 *   5. the operator's expected fingerprint matching the computed one
 *   6. a typed operator acknowledgement
 *   7. a server-derived actor with Admin/SuperAdmin authority
 *
 * Throws LaunchGateError on the first failure; returns the resolved context on
 * success. Nothing here mutates anything.
 */
export function assertApplyAllowed({
  applyRequested = false,
  env = process.env,
  environmentIntent = null,
  batchReviewState = null,
  expectedFingerprint = null,
  actualFingerprint = null,
  operatorAcknowledgement = null,
  actor = null,
} = {}) {
  if (applyRequested !== true) {
    throw new LaunchGateError('apply_not_requested', 'apply mode requires an explicit flag');
  }

  const resolved = resolveLaunchEnvironment(env);
  if (!resolved.ok) {
    throw new LaunchGateError(`apply_environment_denied:${resolved.reason}`, 'launch environment is not approved');
  }

  if (!isValidEnvironmentIntent(environmentIntent)) {
    throw new LaunchGateError('apply_manifest_intent_invalid', 'manifest environmentIntent is not a non-production intent');
  }
  if (
    environmentIntent !== resolved.environment &&
    environmentIntent !== ENVIRONMENT_INTENTS.NONPRODUCTION
  ) {
    throw new LaunchGateError(
      'apply_environment_intent_mismatch',
      'manifest environmentIntent does not match the declared launch environment'
    );
  }

  if (batchReviewState !== BATCH_REVIEW_STATES.APPROVED_FOR_NONPRODUCTION) {
    throw new LaunchGateError(
      'apply_batch_not_approved',
      'batch must be approved_for_nonproduction before application'
    );
  }

  if (typeof expectedFingerprint !== 'string' || expectedFingerprint.length !== 64) {
    throw new LaunchGateError('apply_expected_fingerprint_required', 'an expected manifest fingerprint is required');
  }
  if (expectedFingerprint !== actualFingerprint) {
    throw new LaunchGateError('apply_fingerprint_mismatch', 'manifest fingerprint does not match the approved fingerprint');
  }

  if (operatorAcknowledgement !== 'i-understand-this-mutates-canonical-data') {
    throw new LaunchGateError('apply_operator_acknowledgement_required', 'operator acknowledgement is required');
  }

  if (!canApproveLaunchBatch(actor ?? {})) {
    throw new LaunchGateError('apply_actor_not_authorized', 'apply requires an Admin/SuperAdmin actor');
  }

  return { environment: resolved.environment, environmentIntent, fingerprint: actualFingerprint };
}

// ── Batch identity / idempotency ─────────────────────────────────────────────

export const BATCH_IDEMPOTENCY_OUTCOMES = Object.freeze({
  FIRST_APPLICATION: 'first_application',
  IDEMPOTENT_REPEAT: 'idempotent_repeat',
  FINGERPRINT_CONFLICT: 'fingerprint_conflict',
});

/**
 * Reconcile a batch against a ledger of previously seen batches.
 *
 *   unseen batchId                      → first_application
 *   same batchId + same fingerprint     → idempotent_repeat (no re-application)
 *   same batchId + different fingerprint→ fingerprint_conflict (rejected)
 *
 * @param {Map<string,string>|object} ledger batchId → fingerprint
 */
export function checkBatchIdempotency(ledger, batchId, fingerprint) {
  const lookup =
    ledger instanceof Map ? ledger.get(batchId) : Object.prototype.hasOwnProperty.call(ledger ?? {}, batchId)
      ? ledger[batchId]
      : undefined;

  if (lookup === undefined) {
    return { outcome: BATCH_IDEMPOTENCY_OUTCOMES.FIRST_APPLICATION, previousFingerprint: null };
  }
  if (lookup === fingerprint) {
    return { outcome: BATCH_IDEMPOTENCY_OUTCOMES.IDEMPOTENT_REPEAT, previousFingerprint: lookup };
  }
  return { outcome: BATCH_IDEMPOTENCY_OUTCOMES.FINGERPRINT_CONFLICT, previousFingerprint: lookup };
}

/**
 * Atomicity statement for a future apply run.
 *
 * The canonical store is MongoDB. Multi-document transactions require a replica
 * set / sharded cluster; a standalone mongod cannot provide them. This function
 * reports the honest guarantee rather than asserting atomicity that may not
 * exist.
 */
export function describeApplyAtomicity({ transactionsAvailable = false } = {}) {
  return transactionsAvailable
    ? {
        mode: 'transactional',
        guarantee: 'all_or_nothing_across_entities',
        partialFailureStates: ['applied', 'failed'],
        note: 'Cross-entity multi-document transaction available on this deployment topology.',
      }
    : {
        mode: 'ordered_non_transactional',
        guarantee: 'per_operation_only',
        partialFailureStates: [
          'applied',
          'partially_applied',
          'failed',
          'manual_recovery_required',
        ],
        note:
          'No cross-entity transaction is assumed. Operations are applied in dependency order '
          + 'with durable per-operation batch state; a mid-batch failure is reported as '
          + 'partially_applied and never as success.',
      };
}

export { BATCH_REVIEW_STATES, canApproveLaunchBatch };
