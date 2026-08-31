/**
 * Google OpenID Connect configuration (P2).
 *
 * Boot-time composition in the same shape as `secureAuthConfig.js`: a pure
 * builder that never reads `process.env` itself, plus one runtime singleton
 * computed once at module load.
 *
 * Endpoints and accepted issuers are pinned application constants, not
 * secrets and not discovered at runtime — the same treatment `secureAuthConfig`
 * gives the JWT issuer and audiences. Discovery would add an outbound
 * dependency and a cache to the login path for values that change on the order
 * of never.
 *
 * The two secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) are read but
 * never logged, never returned to a client, and never exposed to the frontend.
 */

export const GOOGLE_AUTHORIZATION_ENDPOINT =
  'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';

export const GOOGLE_ACCEPTED_ISSUERS = Object.freeze([
  'https://accounts.google.com',
  'accounts.google.com',
]);

/** OIDC scopes. `openid` is mandatory; `email`/`profile` back the assertion. */
export const GOOGLE_SCOPES = Object.freeze(['openid', 'email', 'profile']);
export const GOOGLE_SCOPE_STRING = GOOGLE_SCOPES.join(' ');

/** The route prefix both endpoints and the transaction cookie are scoped to. */
export const GOOGLE_OAUTH_ROUTE_PREFIX = '/api/auth/oauth/google';

/** Frontend landing route. The page itself is P3; only the target is fixed here. */
export const OAUTH_FRONTEND_CALLBACK_PATH = '/auth/callback';

/**
 * The complete allowlist of codes that may ever reach the browser on the
 * redirect. Nothing derived from an exception, a provider payload, or an email
 * address is redirectable — a code outside this set is coerced to
 * `oauth_failed`.
 */
export const OAUTH_REDIRECT_STATUSES = Object.freeze({
  SUCCESS: 'success',
});

export const OAUTH_REDIRECT_ERRORS = Object.freeze([
  'existing_account_requires_link',
  'provider_email_unverified',
  'account_suspended',
  'oauth_state_invalid',
  'oauth_provider_error',
  'oauth_unavailable',
  'oauth_failed',
]);

const REDIRECT_ERROR_SET = new Set(OAUTH_REDIRECT_ERRORS);

export function isAllowlistedRedirectError(code) {
  return typeof code === 'string' && REDIRECT_ERROR_SET.has(code);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Reuses the exact origin sources `config/cors.js` and `secureAuthConfig.js`
 * already trust, so the post-login redirect target can never be a second,
 * diverging list — and can never be taken from request input.
 */
function resolveFrontendOrigin(env) {
  const candidate = [env.FRONTEND_URL, env.APP_URL, env.SITE_URL]
    .map((value) => (value || '').trim().replace(/\/$/, ''))
    .find(Boolean);
  if (candidate) return candidate;
  if (env.NODE_ENV !== 'production') return 'http://localhost:5173';
  return '';
}

/**
 * Pure builder. Throws a descriptive `TypeError` on an enabled-but-invalid
 * configuration and never calls `process.exit` — the startup boundary
 * (`config/validateEnv.js`) decides what is production-fatal.
 *
 * @returns {object} frozen config. `enabled: false` when the feature flag is
 *   not exactly `'1'`, in which case no other field is validated.
 */
export function buildGoogleOidcConfig(env = {}) {
  const production = env.NODE_ENV === 'production';
  const enabled = String(env.OAUTH_GOOGLE_ENABLED || '').trim() === '1';

  if (!enabled) {
    return Object.freeze({
      enabled: false,
      production,
      configurationError: null,
    });
  }

  const clientId = (env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET || '').trim();
  const redirectUri = (env.GOOGLE_REDIRECT_URI || '').trim();

  if (!isNonEmptyString(clientId)) {
    throw new TypeError('GOOGLE_CLIENT_ID is required when OAUTH_GOOGLE_ENABLED=1');
  }
  if (!isNonEmptyString(clientSecret)) {
    throw new TypeError('GOOGLE_CLIENT_SECRET is required when OAUTH_GOOGLE_ENABLED=1');
  }
  if (clientId === clientSecret) {
    throw new TypeError('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must not be equal');
  }

  const parsedRedirect = parseUrl(redirectUri);
  if (!parsedRedirect) {
    throw new TypeError('GOOGLE_REDIRECT_URI must be an absolute URL');
  }
  if (parsedRedirect.hash || parsedRedirect.search) {
    throw new TypeError('GOOGLE_REDIRECT_URI must not carry a query string or fragment');
  }
  if (production && parsedRedirect.protocol !== 'https:') {
    throw new TypeError('GOOGLE_REDIRECT_URI must use HTTPS in production');
  }
  if (!production && parsedRedirect.protocol !== 'https:' && parsedRedirect.protocol !== 'http:') {
    throw new TypeError('GOOGLE_REDIRECT_URI must use HTTP or HTTPS');
  }
  if (!parsedRedirect.pathname.startsWith(GOOGLE_OAUTH_ROUTE_PREFIX)) {
    throw new TypeError(
      `GOOGLE_REDIRECT_URI path must be under ${GOOGLE_OAUTH_ROUTE_PREFIX}`
    );
  }

  const frontendOrigin = resolveFrontendOrigin(env);
  if (!isNonEmptyString(frontendOrigin)) {
    throw new TypeError(
      'FRONTEND_URL, APP_URL, or SITE_URL is required to build the OAuth callback redirect'
    );
  }
  const parsedFrontend = parseUrl(frontendOrigin);
  if (!parsedFrontend) {
    throw new TypeError('The configured frontend origin is not a valid URL');
  }
  if (production && parsedFrontend.protocol !== 'https:') {
    throw new TypeError('The frontend origin must use HTTPS in production');
  }

  return Object.freeze({
    enabled: true,
    production,
    clientId,
    clientSecret,
    redirectUri: parsedRedirect.toString(),
    frontendCallbackUrl: `${frontendOrigin}${OAUTH_FRONTEND_CALLBACK_PATH}`,
    authorizationEndpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
    tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
    jwksUri: GOOGLE_JWKS_URI,
    acceptedIssuers: GOOGLE_ACCEPTED_ISSUERS,
    scope: GOOGLE_SCOPE_STRING,
    configurationError: null,
  });
}

/**
 * Runtime singleton. An enabled-but-invalid configuration resolves to a
 * **disabled** config carrying the reason rather than throwing at import:
 * Google must fail closed, but it must never take password authentication or
 * the rest of the API down with it. `validateEnv.js` turns the same condition
 * into a hard production exit at startup.
 */
function buildRuntimeConfig(env) {
  try {
    return buildGoogleOidcConfig(env);
  } catch (error) {
    return Object.freeze({
      enabled: false,
      production: env.NODE_ENV === 'production',
      configurationError: error.message,
    });
  }
}

export const googleOidcConfig = buildRuntimeConfig(process.env);
