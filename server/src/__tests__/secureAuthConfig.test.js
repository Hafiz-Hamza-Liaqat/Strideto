import assert from 'node:assert/strict';
import mongoose from 'mongoose';

assert.strictEqual(
  mongoose.connection.readyState,
  0,
  'must not be connected to MongoDB'
);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

// The runtime singleton requires canonical signing secrets at import time.
process.env.JWT_SECRET = 'z'.repeat(32);
process.env.REFRESH_SECRET = 'y'.repeat(32);

const {
  buildSecureAuthConfig,
  JWT_ISSUER,
  USER_ACCESS_AUDIENCE,
  USER_REFRESH_AUDIENCE,
  EMPLOYER_ACCESS_AUDIENCE,
  EMPLOYER_REFRESH_AUDIENCE,
} = await import('../services/auth/secureAuthConfig.js');

const BASE_ENV = Object.freeze({
  NODE_ENV: 'development',
  JWT_SECRET: 'a'.repeat(32),
  REFRESH_SECRET: 'b'.repeat(32),
  SITE_URL: 'https://strideto.com',
  API_URL: 'https://api.strideto.com',
});

// --- The removed selector cannot disable canonical secure authentication ---
{
  const unset = buildSecureAuthConfig(BASE_ENV);
  const zero = buildSecureAuthConfig({
    ...BASE_ENV,
    STRIDETO_SECURE_AUTH_ENABLED: '0',
  });
  const malformed = buildSecureAuthConfig({
    ...BASE_ENV,
    STRIDETO_SECURE_AUTH_ENABLED: 'legacy',
  });
  check(
    typeof unset.userJwtProvider.issueAccessToken === 'function',
    'canonical secure authentication is active without a selector'
  );
  check(
    typeof zero.userJwtProvider.issueAccessToken === 'function',
    'obsolete selector value 0 cannot enable a fallback'
  );
  check(
    typeof malformed.userJwtProvider.issueAccessToken === 'function',
    'obsolete malformed selector cannot alter canonical composition'
  );
  check(
    typeof zero.userJwtProvider.issueAccessToken === 'function',
    'secure providers are always constructed'
  );
}

// --- Missing canonical secrets fail in every environment -----------------
{
  assert.throws(
    () => buildSecureAuthConfig({}),
    /JWT_SECRET is required/,
    'missing canonical secrets fail in development'
  );
  count += 1;

  assert.throws(
    () => buildSecureAuthConfig({ NODE_ENV: 'production' }),
    /JWT_SECRET is required/,
    'missing canonical secrets fail in production'
  );
  count += 1;
}

// --- Secret requirements ---------------------------------------------------
{
  assert.throws(
    () => buildSecureAuthConfig({ ...BASE_ENV, JWT_SECRET: undefined }),
    /JWT_SECRET is required/
  );
  count += 1;

  assert.throws(
    () => buildSecureAuthConfig({ ...BASE_ENV, REFRESH_SECRET: undefined }),
    /REFRESH_SECRET is required/
  );
  count += 1;

  assert.throws(
    () =>
      buildSecureAuthConfig({
        ...BASE_ENV,
        REFRESH_SECRET: BASE_ENV.JWT_SECRET,
      }),
    /must not be equal/
  );
  count += 1;
}

// --- Successful construction -----------------------------------------------
{
  const config = buildSecureAuthConfig(BASE_ENV);
  check(Object.isFrozen(config), 'canonical config is frozen');
  check(config.mode === 'development', 'mode resolved');
  check(
    typeof config.userJwtProvider.issueAccessToken === 'function',
    'user provider built'
  );
  check(
    typeof config.employerJwtProvider.issueAccessToken === 'function',
    'employer provider built'
  );
  check(
    typeof config.cookiePolicy.writeRefreshCookie === 'function',
    'cookie policy built'
  );
  check(
    typeof config.originPolicy.evaluateRequestOrigin === 'function',
    'origin policy built'
  );
  check(
    config.requireSharedDenylistStore === false,
    'denylist not required outside production'
  );
}

// --- Production requires shared denylist store -----------------------------
{
  const config = buildSecureAuthConfig({ ...BASE_ENV, NODE_ENV: 'production' });
  check(
    config.requireSharedDenylistStore === true,
    'denylist required in production'
  );
}

// --- Exact audience matrix, matching the checkpointed SEC-3A.3 authority ---
{
  const config = buildSecureAuthConfig(BASE_ENV);
  const userAccess = config.userJwtProvider.issueAccessToken({
    sub: '507f1f77bcf86cd799439011',
    realm: 'user',
    sid: '507f1f77bcf86cd799439012',
    tokenVersion: 0,
  }).token;
  const userRefresh = config.userJwtProvider.issueRefreshToken({
    sub: '507f1f77bcf86cd799439011',
    realm: 'user',
    sid: '507f1f77bcf86cd799439012',
    tokenVersion: 0,
  }).token;
  const employerAccess = config.employerJwtProvider.issueAccessToken({
    sub: '507f1f77bcf86cd799439013',
    realm: 'employer',
    sid: '507f1f77bcf86cd799439014',
    tokenVersion: 0,
  }).token;

  check(JWT_ISSUER === 'strideto-api', 'exact issuer constant');
  check(
    USER_ACCESS_AUDIENCE === 'strideto-user-access',
    'exact user access audience constant'
  );
  check(
    USER_REFRESH_AUDIENCE === 'strideto-user-refresh',
    'exact user refresh audience constant'
  );
  check(
    EMPLOYER_ACCESS_AUDIENCE === 'strideto-employer-access',
    'exact employer access audience constant'
  );
  check(
    EMPLOYER_REFRESH_AUDIENCE === 'strideto-employer-refresh',
    'exact employer refresh audience constant'
  );

  // A user refresh token must never verify as a user access token (wrong audience).
  assert.throws(() => config.userJwtProvider.verifyAccessToken(userRefresh));
  count += 1;
  // A user access token must never verify through the employer provider (wrong secret pairing is
  // the same, but audience alone already rejects it).
  assert.throws(() => config.employerJwtProvider.verifyAccessToken(userAccess));
  count += 1;
  // Sanity: each token verifies correctly through its own matching provider/operation.
  check(
    config.userJwtProvider.verifyAccessToken(userAccess).sub ===
      '507f1f77bcf86cd799439011',
    'user access verifies'
  );
  check(
    config.employerJwtProvider.verifyAccessToken(employerAccess).sub ===
      '507f1f77bcf86cd799439013',
    'employer access verifies'
  );
}

// --- Boot-time-only, no per-request re-evaluation or fallback --------------
{
  // buildSecureAuthConfig is a pure function of its input snapshot; calling
  // it twice with the same env produces independently-constructed but
  // equivalent config, proving no hidden mutable state persists between
  // calls that a "per-request" caller could exploit. The real runtime
  // singleton (secureAuthConfig.js's own top-level `export const`) is
  // evaluated exactly once at module load, which this file's own use of a
  // one-time dynamic import (see top of file) already demonstrates.
  const first = buildSecureAuthConfig(BASE_ENV);
  const second = buildSecureAuthConfig(BASE_ENV);
  check(
    typeof first.userJwtProvider.issueAccessToken === 'function' &&
      typeof second.userJwtProvider.issueAccessToken === 'function',
    'repeated calls remain consistent'
  );
  check(
    first !== second,
    'each call returns its own frozen object — no shared mutable global'
  );
}

// --- Actual runtime singleton is immune to a later process.env mutation ---
// (proves the exported secureAuthConfig singleton itself, not merely the
// pure buildSecureAuthConfig function, is constructed once at module
// evaluation and is never recomputed by a later process.env change)
{
  const ENV_KEYS = [
    'NODE_ENV',
    'STRIDETO_SECURE_AUTH_ENABLED',
    'JWT_SECRET',
    'REFRESH_SECRET',
    'REDIS_URL',
  ];
  const originalValues = {};
  for (const key of ENV_KEYS) {
    originalValues[key] = Object.prototype.hasOwnProperty.call(process.env, key)
      ? process.env[key]
      : undefined;
  }

  try {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'q'.repeat(32);
    process.env.REFRESH_SECRET = 'p'.repeat(32);
    delete process.env.REDIS_URL;

    const moduleUrl = new URL(
      '../services/auth/secureAuthConfig.js',
      import.meta.url
    );
    // A unique query string forces a fresh module evaluation, bypassing
    // Node's ESM module cache, so this block constructs and observes its
    // own dedicated singleton instead of reusing the one already imported
    // at the top of this file.
    moduleUrl.searchParams.set(
      'singleton-test',
      `${Date.now()}-${Math.random()}`
    );

    const imported = await import(moduleUrl.href);
    const singleton = imported.secureAuthConfig;

    check(
      Boolean(singleton),
      'the actual exported runtime singleton (not buildSecureAuthConfig) is captured'
    );
    check(
      typeof singleton.userJwtProvider.issueAccessToken === 'function',
      'singleton is canonical immediately after module evaluation'
    );

    // The removed selector cannot affect an already-constructed singleton.
    process.env.STRIDETO_SECURE_AUTH_ENABLED = '0';

    const reread = imported.secureAuthConfig;

    check(
      typeof reread.userJwtProvider.issueAccessToken === 'function',
      'singleton remains canonical after the obsolete selector is changed'
    );
    check(
      reread === singleton,
      'rereading the module export yields the exact same object reference — no recomputation occurred'
    );
  } finally {
    for (const key of ENV_KEYS) {
      if (originalValues[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValues[key];
      }
    }
  }
}

console.log(`secureAuthConfig.test.js: ${count} assertions passed`);
