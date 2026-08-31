import { isSafeInternalReturnPath } from '../publicDiscovery/safePublicUrl.js';

/**
 * Client-side Google sign-in contract (P3).
 *
 * Pure policy only — no React, no `import.meta.env`, no browser API — so the
 * repository's Node-based test runner can exercise the real behaviour rather
 * than only grepping source text. The thin runtime that reads Vite env and
 * touches `window` lives in `client/src/auth/googleSignIn.js`.
 *
 * Nothing here understands OAuth. The browser's whole role is: navigate to the
 * backend start endpoint, and later read one of two safe query values the
 * backend put on the redirect. It never sees a code, a token, a nonce, or a
 * PKCE verifier.
 */

/** Path appended to the configured API base. Never a hardcoded host. */
export const GOOGLE_START_PATH = '/auth/oauth/google/start';

/**
 * A provider is enabled only on the exact string '1', matching the
 * `OAUTH_<PROVIDER>_ENABLED` convention already used by
 * `shared/auth/connectedAccounts.js`. Anything else — absent, '0', 'true' —
 * leaves the button in its existing coming-soon state.
 */
export function isGoogleSignInEnabled(flagValue) {
  return String(flagValue == null ? '' : flagValue).trim() === '1';
}

export function buildGoogleStartUrl(apiBaseUrl) {
  const base = String(apiBaseUrl || '').replace(/\/$/, '');
  return `${base}${GOOGLE_START_PATH}`;
}

export const OAUTH_CALLBACK_STATUS_SUCCESS = 'success';

/**
 * Mirror of the server's `OAUTH_REDIRECT_ERRORS` allowlist
 * (`server/src/services/auth/googleOidcConfig.js`). A test asserts the two
 * lists are identical, so neither can drift without the other failing.
 */
export const OAUTH_CALLBACK_ERROR_CODES = Object.freeze([
  'existing_account_requires_link',
  'provider_email_unverified',
  'account_suspended',
  'oauth_state_invalid',
  'oauth_provider_error',
  'oauth_unavailable',
  'oauth_failed',
]);

const ERROR_CODE_SET = new Set(OAUTH_CALLBACK_ERROR_CODES);

export const OAUTH_GENERIC_ERROR_CODE = 'oauth_failed';

/** Additional client-side outcomes; never sent by the backend. */
export const OAUTH_CLIENT_ERROR_CODES = Object.freeze({
  /** The backend said success but the session could not be established. */
  SESSION_FAILED: 'session_failed',
  /** No recognisable status or error on the redirect at all. */
  MISSING_RESULT: 'oauth_failed',
});

export function isKnownOAuthErrorCode(code) {
  return typeof code === 'string' && ERROR_CODE_SET.has(code);
}

/**
 * Reads a callback query string. Only two keys are ever consulted, and both
 * are matched against a fixed vocabulary — an unknown error collapses to the
 * generic code rather than being echoed into the UI.
 *
 * Deliberately never reads `access_token`, `id_token`, `refresh_token`,
 * `code`, `email`, `sub`, or anything else, and never looks at the fragment.
 *
 * @returns {{ outcome: 'success'|'error', errorCode: string|null }}
 */
export function parseOAuthCallbackParams(search) {
  let params;
  try {
    params = new URLSearchParams(typeof search === 'string' ? search : '');
  } catch {
    return Object.freeze({ outcome: 'error', errorCode: OAUTH_GENERIC_ERROR_CODE });
  }

  const error = params.get('error');
  if (typeof error === 'string' && error.length > 0) {
    return Object.freeze({
      outcome: 'error',
      errorCode: isKnownOAuthErrorCode(error) ? error : OAUTH_GENERIC_ERROR_CODE,
    });
  }

  if (params.get('status') === OAUTH_CALLBACK_STATUS_SUCCESS) {
    return Object.freeze({ outcome: 'success', errorCode: null });
  }

  // No status, an unrecognised status, or an empty query: not a success.
  return Object.freeze({ outcome: 'error', errorCode: OAUTH_GENERIC_ERROR_CODE });
}

/**
 * i18n key for a result code. Every code resolves to a key; an unrecognised
 * one resolves to the generic message rather than being rendered verbatim.
 */
export function oauthErrorMessageKey(code) {
  const known = isKnownOAuthErrorCode(code)
    || code === OAUTH_CLIENT_ERROR_CODES.SESSION_FAILED;
  return `oauthCallback.errors.${known ? code : OAUTH_GENERIC_ERROR_CODE}`;
}

/**
 * Only `existing_account_requires_link` offers a "Create account" action —
 * for every other failure the account state is unknown or unusable, and
 * pushing the user toward registration would be wrong.
 */
export function shouldOfferRegister(code) {
  return code === 'existing_account_requires_link';
}

/**
 * A return path survives the round trip through Google only if it is a plain
 * same-origin path. Reuses the canonical checker rather than a second rule,
 * so an absolute or scheme-relative URL can never be navigated to.
 */
export function sanitizeOAuthReturnPath(path) {
  if (!isSafeInternalReturnPath(path)) return null;
  return path;
}
