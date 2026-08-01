import { createJwtSessionProvider } from './JwtSessionProvider.js';
import {
  createAuthCookiePolicy,
  resolveRuntimeMode,
} from './AuthCookiePolicy.js';
import { createTrustedRequestOriginPolicy } from './TrustedRequestOriginPolicy.js';
import { REFRESH_SESSION_DEFAULT_TTL_MS } from './RefreshSessionContracts.js';

/**
 * SEC-3E — secure-auth boot-time composition. Reads `process.env` exactly
 * once, at module load (Node module caching guarantees a single evaluation
 * per process) — never re-read per request, matching the checkpointed
 * transitional-flag contract (architecture report §34A): the secure/legacy
 * selection is a boot-time decision, not a per-request one.
 *
 * Issuer and the four audiences are frozen application constants, not
 * secrets — matching the checkpointed SEC-3A.3 authority correction
 * (architecture report §18A/§19A). Only the two signing secrets are
 * environment-configured.
 */

export const JWT_ISSUER = 'strideto-api';
export const USER_ACCESS_AUDIENCE = 'strideto-user-access';
export const USER_REFRESH_AUDIENCE = 'strideto-user-refresh';
export const EMPLOYER_ACCESS_AUDIENCE = 'strideto-employer-access';
export const EMPLOYER_REFRESH_AUDIENCE = 'strideto-employer-refresh';

function truthyFlag(value) {
  return value === '1';
}

function falsyFlag(value) {
  return value === '0';
}

/**
 * Reuses the exact same origin sources `config/cors.js` already trusts
 * (`SITE_URL`/`FRONTEND_URL`/`APP_URL`/`CORS_ORIGINS`) as the single source
 * of truth for both the cookie policy's `trustedOrigins` validation gate and
 * the live `TrustedRequestOriginPolicy` — never a second, diverging list.
 */
function collectTrustedOrigins(env) {
  const raw = [
    env.SITE_URL,
    env.FRONTEND_URL,
    env.APP_URL,
    ...(env.CORS_ORIGINS || '').split(','),
  ]
    .map((v) => (v || '').trim().replace(/\/$/, ''))
    .filter(Boolean);
  const unique = [...new Set(raw)];
  if (unique.length > 0) return unique;
  // Non-production, nothing configured — matches `config/cors.js`'s own
  // existing hardcoded local-development allowance (§18B) rather than
  // leaving the trusted-origin policy unconstructible in local dev.
  if (env.NODE_ENV !== 'production') {
    return ['http://localhost:5173'];
  }
  return [];
}

function resolveApiOrigin(env) {
  return (env.API_URL || env.SITE_URL || '').trim().replace(/\/$/, '');
}

/**
 * SEC-3E.1 correction. The original contract silently treated an unset
 * flag as legacy mode in every non-production environment. This created a
 * real compatibility defect: the browser client (`axiosBase.js`,
 * `employerService.js`, `AuthContext.jsx`, `EmployerAuthContext.jsx`) was
 * rewritten to be secure-mode-only in the same SEC-3E pass, with no
 * legacy `localStorage`/JSON-refresh-token fallback left in it at all — a
 * developer whose local `server/.env` predates this phase (and therefore
 * lacks the flag) would silently get a legacy-mode server that the current
 * client can never successfully refresh a session against, with no
 * warning of any kind. The flag is now mandatory in every environment,
 * with no silent default: unset or malformed is always a configuration
 * error, in development and test exactly as in production. Explicit `'0'`
 * remains available outside production as a deliberate, self-documenting
 * legacy-server-only regression mode — chosen on purpose, never fallen
 * into by omission — and prints one clear, secret-free startup warning
 * when selected.
 */
function emitLegacyModeWarning() {
  console.warn(
    '\n⚠️  Legacy authentication mode is enabled explicitly.\n' +
      '   The current browser client supports secure authentication only.\n' +
      '   Do not use this mode for full-stack browser testing.\n'
  );
}

/**
 * Pure builder — never reads `process.env` itself, so it can be exercised
 * directly in tests with a synthetic `env` object. Throws a descriptive
 * `TypeError` (never `process.exit`) on any invalid/missing input; the
 * server startup boundary (`validateEnv.js`) is responsible for turning a
 * production-fatal case into a hard process exit — this module only ever
 * decides what "valid" means.
 */
export function buildSecureAuthConfig(env = {}) {
  const nodeEnv = env.NODE_ENV;
  const appEnv = env.APP_ENV;
  const production = nodeEnv === 'production';

  const rawFlag = env.STRIDETO_SECURE_AUTH_ENABLED;
  let enabled;
  if (truthyFlag(rawFlag)) {
    enabled = true;
  } else if (falsyFlag(rawFlag)) {
    enabled = false;
  } else if (rawFlag === undefined) {
    throw new TypeError(
      'STRIDETO_SECURE_AUTH_ENABLED is required and must be set explicitly to "1" or "0" — no environment (production, development, or test) may silently default to legacy authentication mode'
    );
  } else {
    throw new TypeError(
      `STRIDETO_SECURE_AUTH_ENABLED must be "1" or "0", got ${JSON.stringify(rawFlag)}`
    );
  }

  if (production && !enabled) {
    throw new TypeError(
      'STRIDETO_SECURE_AUTH_ENABLED must equal "1" in production — legacy authentication must never be selected in production'
    );
  }

  if (!enabled) {
    // Legacy mode selected (never permitted in production, enforced above)
    // — and, from this correction on, only ever selected explicitly, never
    // by omission. No provider, cookie policy, or origin policy is
    // constructed — the secure composition layer stays entirely inert,
    // matching §34A's "no request is ever served by a mix of legacy and
    // secure token shapes" requirement by construction (nothing secure
    // exists to mix).
    emitLegacyModeWarning();
    return Object.freeze({ enabled: false, production });
  }

  const accessSecret = env.JWT_SECRET;
  const refreshSecret = env.REFRESH_SECRET;
  if (!accessSecret) {
    throw new TypeError('JWT_SECRET is required when secure auth is enabled');
  }
  if (!refreshSecret) {
    throw new TypeError(
      'REFRESH_SECRET is required when secure auth is enabled'
    );
  }
  if (accessSecret === refreshSecret) {
    throw new TypeError('JWT_SECRET and REFRESH_SECRET must not be equal');
  }

  const userJwtProvider = createJwtSessionProvider({
    accessSecret,
    refreshSecret,
    issuer: JWT_ISSUER,
    accessAudience: USER_ACCESS_AUDIENCE,
    refreshAudience: USER_REFRESH_AUDIENCE,
  });

  const employerJwtProvider = createJwtSessionProvider({
    accessSecret,
    refreshSecret,
    issuer: JWT_ISSUER,
    accessAudience: EMPLOYER_ACCESS_AUDIENCE,
    refreshAudience: EMPLOYER_REFRESH_AUDIENCE,
  });

  const mode = resolveRuntimeMode({ nodeEnv, appEnv });
  const trustedOrigins = collectTrustedOrigins(env);
  const apiOrigin = resolveApiOrigin(env);

  const cookiePolicy = createAuthCookiePolicy({
    mode,
    apiOrigin,
    trustedOrigins,
    maxAgeMs: REFRESH_SESSION_DEFAULT_TTL_MS,
  });

  const originPolicy = createTrustedRequestOriginPolicy({
    mode,
    trustedOrigins,
  });

  const requireSharedDenylistStore = production;

  return Object.freeze({
    enabled: true,
    production,
    mode,
    userJwtProvider,
    employerJwtProvider,
    cookiePolicy,
    originPolicy,
    requireSharedDenylistStore,
  });
}

/**
 * Runtime singleton — computed once at module load. Every controller,
 * middleware, and route imports this value rather than calling
 * `buildSecureAuthConfig` itself, so `process.env` is read exactly once
 * for the lifetime of the process.
 */
export const secureAuthConfig = buildSecureAuthConfig(process.env);
