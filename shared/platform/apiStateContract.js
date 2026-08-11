/**
 * Common API state contract (Phase 1 — shared platform foundation).
 *
 * Standard semantic outcomes for loading, empty, success, and error states.
 * Callers map HTTP status + body to these codes; never fabricate success.
 */

export const API_STATE = Object.freeze({
  LOADING: 'loading',
  EMPTY: 'empty',
  SUCCESS: 'success',
  VALIDATION_ERROR: 'validation_error',
  UNAUTHENTICATED: 'unauthenticated',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  PROVIDER_NOT_CONFIGURED: 'provider_not_configured',
  SERVER_ERROR: 'server_error',
});

/** Map HTTP status to canonical API state (fail closed on unknown 5xx). */
export function apiStateFromHttpStatus(status) {
  if (status >= 200 && status < 300) return API_STATE.SUCCESS;
  if (status === 400) return API_STATE.VALIDATION_ERROR;
  if (status === 401) return API_STATE.UNAUTHENTICATED;
  if (status === 403) return API_STATE.FORBIDDEN;
  if (status === 404) return API_STATE.NOT_FOUND;
  if (status === 409) return API_STATE.CONFLICT;
  if (status === 422) return API_STATE.VALIDATION_ERROR;
  if (status === 429) return API_STATE.RATE_LIMITED;
  if (status === 503) return API_STATE.PROVIDER_NOT_CONFIGURED;
  if (status >= 500) return API_STATE.SERVER_ERROR;
  return API_STATE.VALIDATION_ERROR;
}

/** True when the state represents a terminal client-visible error. */
export function isApiErrorState(state) {
  return (
    state === API_STATE.VALIDATION_ERROR ||
    state === API_STATE.UNAUTHENTICATED ||
    state === API_STATE.FORBIDDEN ||
    state === API_STATE.NOT_FOUND ||
    state === API_STATE.CONFLICT ||
    state === API_STATE.RATE_LIMITED ||
    state === API_STATE.PROVIDER_NOT_CONFIGURED ||
    state === API_STATE.SERVER_ERROR
  );
}

/** Safe user-facing message keys — never expose stack traces or secrets. */
export const SAFE_ERROR_MESSAGE_KEYS = Object.freeze({
  [API_STATE.UNAUTHENTICATED]: 'errors.sessionExpired',
  [API_STATE.FORBIDDEN]: 'errors.forbidden',
  [API_STATE.NOT_FOUND]: 'errors.notFound',
  [API_STATE.CONFLICT]: 'errors.conflict',
  [API_STATE.RATE_LIMITED]: 'errors.rateLimited',
  [API_STATE.PROVIDER_NOT_CONFIGURED]: 'errors.providerNotConfigured',
  [API_STATE.SERVER_ERROR]: 'errors.serverError',
  [API_STATE.VALIDATION_ERROR]: 'errors.validation',
});
