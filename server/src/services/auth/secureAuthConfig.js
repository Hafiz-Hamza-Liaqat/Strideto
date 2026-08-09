import { createJwtSessionProvider } from './JwtSessionProvider.js';
import {
  createAuthCookiePolicy,
  resolveRuntimeMode,
} from './AuthCookiePolicy.js';
import { createTrustedRequestOriginPolicy } from './TrustedRequestOriginPolicy.js';
import { REFRESH_SESSION_DEFAULT_TTL_MS } from './RefreshSessionContracts.js';

/**
 * Secure-auth boot-time composition. Reads `process.env` exactly once, at
 * module load (Node module caching guarantees a single evaluation per
 * process) and always constructs the canonical secure authentication path.
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
export const AGENT_ACCESS_AUDIENCE = 'strideto-agent-access';
export const AGENT_REFRESH_AUDIENCE = 'strideto-agent-refresh';

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

  const accessSecret = env.JWT_SECRET;
  const refreshSecret = env.REFRESH_SECRET;
  if (!accessSecret) {
    throw new TypeError('JWT_SECRET is required for secure authentication');
  }
  if (!refreshSecret) {
    throw new TypeError('REFRESH_SECRET is required for secure authentication');
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

  const agentJwtProvider = createJwtSessionProvider({
    accessSecret,
    refreshSecret,
    issuer: JWT_ISSUER,
    accessAudience: AGENT_ACCESS_AUDIENCE,
    refreshAudience: AGENT_REFRESH_AUDIENCE,
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
    production,
    mode,
    userJwtProvider,
    employerJwtProvider,
    agentJwtProvider,
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
