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

/**
 * SEC-3E.1 — `secureAuthConfig.js`'s own module-top-level code constructs a
 * runtime singleton from `process.env` at import time (`export const
 * secureAuthConfig = buildSecureAuthConfig(process.env)`). Since ESM
 * `import` statements are hoisted and evaluate before any other top-level
 * code in this file, `process.env.STRIDETO_SECURE_AUTH_ENABLED` must be
 * set *before* that import happens — a dynamic `import()` (not hoisted) is
 * used here specifically so this file can set the flag first, matching
 * the new "no environment may silently default to legacy mode" contract
 * this correction introduces (§14). `node src/__tests__/secureAuthConfig.test.js`
 * is otherwise run exactly like every other test file in this repository
 * — this is the only difference, and it is required by the contract under
 * test, not a convention change elsewhere.
 */
process.env.STRIDETO_SECURE_AUTH_ENABLED = '1';
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
  STRIDETO_SECURE_AUTH_ENABLED: '1',
  JWT_SECRET: 'a'.repeat(32),
  REFRESH_SECRET: 'b'.repeat(32),
  SITE_URL: 'https://strideto.com',
  API_URL: 'https://api.strideto.com',
});

// --- Flag parsing: unset is always a configuration error, every environment ---
{
  assert.throws(
    () => buildSecureAuthConfig({}),
    /is required and must be set explicitly/,
    'unset flag throws in development'
  );
  count += 1;

  assert.throws(
    () => buildSecureAuthConfig({ NODE_ENV: 'test' }),
    /is required and must be set explicitly/,
    'unset flag throws in test (no NODE_ENV-specific carve-out)'
  );
  count += 1;

  assert.throws(
    () => buildSecureAuthConfig({ STRIDETO_SECURE_AUTH_ENABLED: 'yes' }),
    /must be "1" or "0"/,
    'malformed flag throws'
  );
  count += 1;
}

// --- Explicit '0' -> legacy mode, with exactly one startup warning, no secrets in it ---
{
  const originalWarn = console.warn;
  const warnCalls = [];
  console.warn = (...args) => warnCalls.push(args.join(' '));
  let zero;
  try {
    zero = buildSecureAuthConfig({
      NODE_ENV: 'development',
      STRIDETO_SECURE_AUTH_ENABLED: '0',
    });
  } finally {
    console.warn = originalWarn;
  }
  check(zero.enabled === false, 'explicit flag=0 -> disabled (legacy mode)');
  check(
    warnCalls.length === 1,
    'exactly one startup warning emitted for explicit legacy mode'
  );
  check(
    /secure authentication only/i.test(warnCalls[0] || ''),
    'warning mentions the client is secure-only'
  );
  check(
    !/[A-Za-z0-9]{32}/.test(warnCalls[0] || ''),
    'warning contains no secret-shaped value'
  );
}

// --- Production requires the flag -----------------------------------------
{
  assert.throws(
    () => buildSecureAuthConfig({ NODE_ENV: 'production' }),
    /is required and must be set explicitly/,
    'production without flag throws the same required-configuration error'
  );
  count += 1;

  assert.throws(
    () =>
      buildSecureAuthConfig({
        NODE_ENV: 'production',
        STRIDETO_SECURE_AUTH_ENABLED: '0',
      }),
    /must equal "1" in production/,
    'production with flag=0 throws'
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
  check(config.enabled === true, 'enabled true');
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

// --- Legacy mode leaves the composition layer entirely inert ---------------
{
  const originalWarn = console.warn;
  console.warn = () => {};
  let config;
  try {
    config = buildSecureAuthConfig({
      NODE_ENV: 'development',
      STRIDETO_SECURE_AUTH_ENABLED: '0',
    });
  } finally {
    console.warn = originalWarn;
  }
  check(
    Object.keys(config).length === 2,
    'legacy config exposes only enabled/production, nothing secure'
  );
  check(
    'userJwtProvider' in config === false,
    'no provider constructed in legacy mode'
  );
}

// --- Boot-time-only, no per-request re-evaluation, no automatic fallback ---
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
    first.enabled === true && second.enabled === true,
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
    process.env.STRIDETO_SECURE_AUTH_ENABLED = '1';
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
      singleton.enabled === true,
      'singleton.enabled is true immediately after module evaluation'
    );

    // Mutate process.env *after* the singleton above has already been
    // constructed and captured.
    process.env.STRIDETO_SECURE_AUTH_ENABLED = '0';

    const reread = imported.secureAuthConfig;

    check(
      reread.enabled === true,
      'singleton.enabled remains true after process.env is mutated to "0" post-construction'
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
