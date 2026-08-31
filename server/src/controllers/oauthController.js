import { asyncHandler } from '../utils/asyncHandler.js';
import { logAudit, auditFromRequest } from '../services/auditService.js';
import { googleOidcConfig } from '../services/auth/googleOidcConfig.js';
import { secureAuthConfig } from '../services/auth/secureAuthConfig.js';
import {
  GOOGLE_FLOW_RESULTS,
} from '../services/auth/googleOidcFlows.js';
import {
  getGoogleOidcFlows,
  getGoogleOidcTransactionService,
} from '../services/auth/googleOidcRuntime.js';

/**
 * Express boundary for the Google OIDC flow. Holds no policy: every decision
 * is made by `googleOidcFlows`, and this file only performs cookie and
 * redirect IO plus audit logging.
 *
 * Note the asymmetry with the password routes: `secureTrustedOrigin` is
 * deliberately not applied to these endpoints. Both are top-level browser
 * navigations — the callback arrives from Google's origin and carries no
 * trusted `Origin` header at all, so an origin check there would reject every
 * legitimate login. State + PKCE + nonce are the CSRF and replay controls on
 * this path, which is what the OAuth 2.1 / OIDC guidance prescribes.
 */

function writeTransactionCookie(res, value) {
  return getGoogleOidcTransactionService().writeCookie(res)(value);
}

function clearTransactionCookie(res) {
  return getGoogleOidcTransactionService().clearCookie(res);
}

function writeUserRefreshCookie(res, token) {
  secureAuthConfig.cookiePolicy.writeRefreshCookie({ res, realm: 'user', token });
}

/** A disabled or unconfigured provider is simply not there. */
function notFound(res) {
  return res.status(404).json({ error: 'Not found' });
}

export const googleStart = asyncHandler(async (req, res) => {
  if (!googleOidcConfig.enabled) return notFound(res);

  const result = await getGoogleOidcFlows().start();

  if (result.code === GOOGLE_FLOW_RESULTS.DISABLED) return notFound(res);
  if (result.code === GOOGLE_FLOW_RESULTS.NOT_READY) {
    // Fail closed: the physical UserIdentity uniqueness guarantees this flow
    // depends on are not in place. No transaction is issued.
    return res.status(503).json({ error: 'Service unavailable' });
  }
  if (result.code !== GOOGLE_FLOW_RESULTS.AUTHORIZATION_REDIRECT) {
    return res.status(503).json({ error: 'Service unavailable' });
  }

  if (!writeTransactionCookie(res, result.cookieValue)) {
    return res.status(503).json({ error: 'Service unavailable' });
  }
  return res.redirect(302, result.authorizationUrl);
});

export const googleCallback = asyncHandler(async (req, res) => {
  if (!googleOidcConfig.enabled) return notFound(res);

  const flows = getGoogleOidcFlows();
  const result = await flows.callback({
    code: typeof req.query.code === 'string' ? req.query.code : undefined,
    state: typeof req.query.state === 'string' ? req.query.state : undefined,
    providerError: typeof req.query.error === 'string' ? req.query.error : undefined,
    cookieHeader: req.headers.cookie,
  });

  if (result.code === GOOGLE_FLOW_RESULTS.DISABLED) return notFound(res);

  // Every terminal outcome burns the transaction — success, policy rejection,
  // provider error, and every failure in between.
  if (result.clearTransactionCookie) clearTransactionCookie(res);

  if (result.code === GOOGLE_FLOW_RESULTS.SESSION_ISSUED) {
    // The ordinary user refresh cookie, written by the unchanged cookie
    // policy. The access token is deliberately discarded here: the frontend
    // mints one through the existing /api/auth/refresh-token call, so no token
    // is ever placed in a URL, a fragment, or a readable cookie.
    writeUserRefreshCookie(res, result.refreshToken);
    await logAudit({
      ...auditFromRequest(req),
      actor: { userId: result.userId },
      action: result.createdAccount ? 'auth.oauth_register' : 'auth.oauth_login',
      targetType: 'user',
      targetId: result.userId,
      metadata: { provider: 'google' },
    });
  }

  return res.redirect(302, flows.buildFrontendRedirect(result));
});
