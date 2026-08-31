import { SOCIAL_IDENTITY_RESULTS } from './socialIdentityLinking.js';
import {
  GOOGLE_ID_TOKEN_RESULTS,
} from './googleIdTokenVerifier.js';
import { OAUTH_TRANSACTION_RESULTS } from './googleOidcTransaction.js';
import { INDEX_READINESS_RESULTS } from './googleOidcIndexReadiness.js';
import { isAllowlistedRedirectError } from './googleOidcConfig.js';

/**
 * Google OIDC authorization-code flow composition (P2).
 *
 * Framework-agnostic in the same sense as `userSecureAuthFlows.js`: every
 * function returns a plain frozen result object and no Express type is
 * referenced. The controller owns cookie and redirect IO.
 *
 * Google authenticates an identity. It never decides authorization — the
 * session that comes out the far end is the ordinary STRIDETO user session
 * issued by the unchanged `userSecureAuthFlows.issueLoginSession`, and
 * authority remains `role` + `UserCapabilityGrant`.
 */

export const GOOGLE_FLOW_RESULTS = Object.freeze({
  AUTHORIZATION_REDIRECT: 'authorization_redirect',
  SESSION_ISSUED: 'session_issued',
  DISABLED: 'google_oauth_disabled',
  NOT_READY: 'google_oauth_not_ready',
  PROVIDER_ERROR: 'google_provider_error',
  TRANSACTION_INVALID: 'google_transaction_invalid',
  CODE_MISSING: 'google_code_missing',
  TOKEN_EXCHANGE_FAILED: 'google_token_exchange_failed',
  ID_TOKEN_INVALID: 'google_id_token_invalid',
  POLICY_REJECTED: 'google_policy_rejected',
  SESSION_FAILED: 'google_session_failed',
});

/** Provenance handed to the P1 foundation for a brand-new Google account. */
export const GOOGLE_PROVENANCE = Object.freeze({
  grantedBy: 'system:oauth_google',
  grantReason: 'student_registration_google',
});

const TOKEN_EXCHANGE_TIMEOUT_MS = 8000;

/**
 * Maps an internal outcome to one of the small allowlisted codes that may
 * reach the browser. Anything unrecognised collapses to `oauth_failed` — no
 * exception text, no provider payload, no email, no subject, ever.
 */
export function toRedirectErrorCode(code) {
  switch (code) {
    case SOCIAL_IDENTITY_RESULTS.EXISTING_ACCOUNT_REQUIRES_LINK:
      return 'existing_account_requires_link';
    case SOCIAL_IDENTITY_RESULTS.ACCOUNT_SUSPENDED:
      return 'account_suspended';
    case SOCIAL_IDENTITY_RESULTS.PROVIDER_EMAIL_UNVERIFIED:
    case GOOGLE_ID_TOKEN_RESULTS.EMAIL_UNVERIFIED:
      return 'provider_email_unverified';
    case OAUTH_TRANSACTION_RESULTS.MISSING:
    case OAUTH_TRANSACTION_RESULTS.INVALID:
    case OAUTH_TRANSACTION_RESULTS.EXPIRED:
    case OAUTH_TRANSACTION_RESULTS.REPLAYED:
    case OAUTH_TRANSACTION_RESULTS.STATE_MISMATCH:
      return 'oauth_state_invalid';
    case GOOGLE_FLOW_RESULTS.PROVIDER_ERROR:
      return 'oauth_provider_error';
    case GOOGLE_FLOW_RESULTS.DISABLED:
    case GOOGLE_FLOW_RESULTS.NOT_READY:
      return 'oauth_unavailable';
    default:
      return 'oauth_failed';
  }
}

function frozen(code, extra = {}) {
  return Object.freeze({ code, ...extra });
}

/**
 * @param {object} deps
 * @param {object} deps.config — `googleOidcConfig`
 * @param {object} deps.transactionService — `googleOidcTransaction` service
 * @param {object} deps.idTokenVerifier — `googleIdTokenVerifier`
 * @param {object} deps.socialIdentityService — the P1 linking service
 * @param {object} deps.sessionFlows — `userSecureAuthFlows`
 * @param {object} deps.indexReadiness — `userIdentityIndexReadiness`
 * @param {(account: {userId: string, email: string, name: string}) => Promise<unknown>} [deps.onNewAccountCreated]
 *   — best-effort, non-authoritative side effects for a completed new account.
 */
export function createGoogleOidcFlows({
  config,
  transactionService,
  idTokenVerifier,
  socialIdentityService,
  sessionFlows,
  indexReadiness,
  fetchImpl = globalThis.fetch,
  recordLastLogin = async () => undefined,
  onNewAccountCreated = async () => undefined,
} = {}) {
  if (!config) throw new TypeError('config is required');
  if (!transactionService?.createTransaction) {
    throw new TypeError('transactionService is required');
  }
  if (!idTokenVerifier?.verify) throw new TypeError('idTokenVerifier is required');
  if (!socialIdentityService?.resolveIdentity) {
    throw new TypeError('socialIdentityService is required');
  }
  if (!sessionFlows?.issueLoginSession) {
    throw new TypeError('sessionFlows exposing issueLoginSession is required');
  }
  if (!indexReadiness?.assertReady) {
    throw new TypeError('indexReadiness is required');
  }
  if (typeof onNewAccountCreated !== 'function') {
    throw new TypeError('onNewAccountCreated must be a function');
  }

  /**
   * The single gate every entry point passes. Disabled means the routes behave
   * as if Google does not exist; not-ready means the physical uniqueness
   * guarantees are absent and the flow refuses rather than risking forked
   * accounts.
   */
  async function assertAvailable() {
    if (!config.enabled) return frozen(GOOGLE_FLOW_RESULTS.DISABLED);
    const readiness = await indexReadiness.assertReady();
    if (readiness.code !== INDEX_READINESS_RESULTS.READY) {
      return frozen(GOOGLE_FLOW_RESULTS.NOT_READY, { readiness: readiness.code });
    }
    return null;
  }

  /** Builds the authorization URL. `redirect_uri` is configuration, never input. */
  function buildAuthorizationUrl({ state, nonce, codeChallenge }) {
    const url = new URL(config.authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('scope', config.scope);
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async function start() {
    const unavailable = await assertAvailable();
    if (unavailable) return unavailable;

    const transaction = transactionService.createTransaction();
    return frozen(GOOGLE_FLOW_RESULTS.AUTHORIZATION_REDIRECT, {
      authorizationUrl: buildAuthorizationUrl(transaction),
      cookieValue: transaction.cookieValue,
    });
  }

  /** Server-to-server code exchange. The client secret never leaves this call. */
  async function exchangeCode({ code, codeVerifier }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TOKEN_EXCHANGE_TIMEOUT_MS);
    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
      });
      const response = await fetchImpl(config.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body,
        signal: controller.signal,
      });
      if (!response || response.ok !== true) return { ok: false };
      const payload = await response.json();
      if (!payload || typeof payload.id_token !== 'string' || !payload.id_token) {
        return { ok: false };
      }
      // Only the id_token is retained. Google's access/refresh tokens are not
      // stored, not logged, and not returned — nothing here calls a Google API.
      return { ok: true, idToken: payload.id_token };
    } catch {
      return { ok: false };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * @param {object} input
   * @param {string} [input.code] — `code` query parameter
   * @param {string} [input.state] — `state` query parameter
   * @param {string} [input.providerError] — `error` query parameter
   * @param {string} [input.cookieHeader] — raw `Cookie` request header
   *
   * Every terminal outcome sets `clearTransactionCookie: true`; a transaction
   * is never reusable regardless of how the callback ends.
   */
  async function callback({ code, state, providerError, cookieHeader } = {}) {
    const unavailable = await assertAvailable();
    if (unavailable) {
      return Object.freeze({ ...unavailable, clearTransactionCookie: true });
    }

    // Google reported a failure (access_denied, invalid_request, ...). The
    // provider's text is never echoed onward.
    if (typeof providerError === 'string' && providerError.length > 0) {
      return frozen(GOOGLE_FLOW_RESULTS.PROVIDER_ERROR, { clearTransactionCookie: true });
    }

    const transaction = await transactionService.consumeTransaction({
      cookieHeader,
      presentedState: state,
    });
    if (transaction.code !== OAUTH_TRANSACTION_RESULTS.VALID) {
      return frozen(GOOGLE_FLOW_RESULTS.TRANSACTION_INVALID, {
        reason: transaction.code,
        clearTransactionCookie: true,
      });
    }

    if (typeof code !== 'string' || code.length === 0) {
      return frozen(GOOGLE_FLOW_RESULTS.CODE_MISSING, { clearTransactionCookie: true });
    }

    const exchanged = await exchangeCode({
      code,
      codeVerifier: transaction.codeVerifier,
    });
    if (!exchanged.ok) {
      return frozen(GOOGLE_FLOW_RESULTS.TOKEN_EXCHANGE_FAILED, {
        clearTransactionCookie: true,
      });
    }

    const verified = await idTokenVerifier.verify({
      idToken: exchanged.idToken,
      clientId: config.clientId,
      expectedNonce: transaction.nonce,
    });
    if (verified.code !== GOOGLE_ID_TOKEN_RESULTS.VERIFIED) {
      return frozen(GOOGLE_FLOW_RESULTS.ID_TOKEN_INVALID, {
        reason: verified.code,
        clearTransactionCookie: true,
      });
    }

    // Everything below acts only on claims this server verified itself.
    const resolution = await socialIdentityService.resolveOrCreate(
      verified.assertion,
      GOOGLE_PROVENANCE
    );

    if (resolution.code !== SOCIAL_IDENTITY_RESULTS.IDENTITY_RESOLVED) {
      // Includes existing_account_requires_link, account_suspended,
      // provider_email_unverified, capability_initialization_failed and every
      // storage failure. No session is issued for any of them.
      return frozen(GOOGLE_FLOW_RESULTS.POLICY_REJECTED, {
        reason: resolution.code,
        clearTransactionCookie: true,
      });
    }

    const user = resolution.user;
    if (resolution.created === true) {
      // `created` is the authoritative P1 result: capability initialization
      // and identity persistence have both completed. Welcome delivery is a
      // best-effort side effect and must never change the account or login
      // result. Run it before session issuance so a completed account is not
      // deprived of its welcome when session persistence subsequently fails.
      try {
        await onNewAccountCreated({
          userId: String(user._id),
          email: user.email,
          name: user.name,
        });
      } catch {
        // The runtime hook records a safe operational warning. Provider data,
        // credentials, and tokens never enter this boundary or its logs.
      }
    }

    const sessionResult = await sessionFlows.issueLoginSession({
      subjectId: String(user._id),
      tokenVersion: user.tokenVersion,
    });
    if (sessionResult.code !== 'SESSION_ISSUED') {
      return frozen(GOOGLE_FLOW_RESULTS.SESSION_FAILED, { clearTransactionCookie: true });
    }

    // Recorded only after the session actually exists, so a failed login never
    // looks like a successful one. Best-effort: never fails an issued session.
    await recordLastLogin({
      userId: user._id,
      identityId: resolution.identity?._id,
      provider: verified.assertion.provider,
    }).catch(() => undefined);

    return Object.freeze({
      code: GOOGLE_FLOW_RESULTS.SESSION_ISSUED,
      refreshToken: sessionResult.refreshToken,
      userId: String(user._id),
      createdAccount: resolution.created === true,
      clearTransactionCookie: true,
    });
  }

  /** Builds the frontend redirect. Only allowlisted codes ever appear. */
  function buildFrontendRedirect(result) {
    const url = new URL(config.frontendCallbackUrl);
    if (result.code === GOOGLE_FLOW_RESULTS.SESSION_ISSUED) {
      url.searchParams.set('status', 'success');
      return url.toString();
    }
    const candidate = toRedirectErrorCode(result.reason || result.code);
    url.searchParams.set(
      'error',
      isAllowlistedRedirectError(candidate) ? candidate : 'oauth_failed'
    );
    return url.toString();
  }

  return Object.freeze({
    start,
    callback,
    buildAuthorizationUrl,
    buildFrontendRedirect,
    assertAvailable,
  });
}
