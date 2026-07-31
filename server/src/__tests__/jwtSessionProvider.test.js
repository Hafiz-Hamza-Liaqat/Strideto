/**
 * SEC-3B — dormant JWT session provider tests.
 * Run: node src/__tests__/jwtSessionProvider.test.js
 */
import assert from 'node:assert/strict';
import { createJwtSessionProvider } from '../services/auth/JwtSessionProvider.js';
import { RefreshSessionContractError } from '../services/auth/RefreshSessionContracts.js';

let assertions = 0;
function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}
function check(value, message) {
  assert.ok(value, message);
  assertions += 1;
}
function throws(fn) {
  assert.throws(fn);
  assertions += 1;
}

const ACCESS_SECRET = 'a'.repeat(32);
const REFRESH_SECRET = 'b'.repeat(32);
const ISSUER = 'strideto-api-test';
const ACCESS_AUD = 'strideto-user-access-test';
const REFRESH_AUD = 'strideto-user-refresh-test';

function validConfig(overrides = {}) {
  return {
    accessSecret: ACCESS_SECRET,
    refreshSecret: REFRESH_SECRET,
    issuer: ISSUER,
    accessAudience: ACCESS_AUD,
    refreshAudience: REFRESH_AUD,
    ...overrides,
  };
}

// --- No token or secret is ever logged: capture console output during the
// entire test run and assert nothing was written to it. ---
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const consoleCalls = [];
console.log = (...args) => consoleCalls.push(args);
console.warn = (...args) => consoleCalls.push(args);
console.error = (...args) => consoleCalls.push(args);

try {
  // --- Configuration validation ---
  throws(
    () =>
      createJwtSessionProvider(validConfig({ accessSecret: REFRESH_SECRET })),
    'access === refresh secret is rejected'
  );
  throws(
    () => createJwtSessionProvider(validConfig({ accessSecret: undefined })),
    'missing access secret is rejected'
  );
  throws(
    () => createJwtSessionProvider(validConfig({ refreshSecret: undefined })),
    'missing refresh secret is rejected'
  );
  throws(
    () =>
      createJwtSessionProvider(
        validConfig({
          accessSecret: 'your-super-secret-jwt-key-change-in-production',
        })
      ),
    'a known ≥32-char placeholder secret is rejected by the blocklist, not just by length'
  );
  throws(
    () => createJwtSessionProvider(validConfig({ accessSecret: 'short' })),
    'too-short secret is rejected'
  );
  throws(
    () => createJwtSessionProvider(validConfig({ issuer: '' })),
    'empty issuer is rejected'
  );
  throws(
    () => createJwtSessionProvider(validConfig({ accessAudience: '' })),
    'empty access audience is rejected'
  );
  throws(
    () => createJwtSessionProvider(validConfig({ refreshAudience: '' })),
    'empty refresh audience is rejected'
  );
  throws(
    () =>
      createJwtSessionProvider(validConfig({ refreshAudience: ACCESS_AUD })),
    'access and refresh audiences must not be equal'
  );

  const provider = createJwtSessionProvider(validConfig());
  const otherProvider = createJwtSessionProvider(
    validConfig({ accessSecret: 'c'.repeat(32), refreshSecret: 'd'.repeat(32) })
  );

  // --- Issuance ---
  const SID = '507f1f77bcf86cd799439011';
  const SUB = '507f1f77bcf86cd799439012';

  const access = provider.issueAccessToken({
    sub: SUB,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  });
  equal(typeof access.token, 'string', 'access token is issued');
  check(access.jti.length > 0, 'access issuance returns a jti');

  const refresh = provider.issueRefreshToken({
    sub: SUB,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  });
  equal(typeof refresh.token, 'string', 'refresh token is issued');
  check(refresh.jti !== access.jti, 'access and refresh jti values differ');

  // Every issuance generates a unique jti — sid stays stable across two issuances.
  const access2 = provider.issueAccessToken({
    sub: SUB,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  });
  check(access2.jti !== access.jti, 'every issuance generates a unique jti');

  // --- Verification: success paths ---
  const verifiedAccess = provider.verifyAccessToken(access.token);
  equal(verifiedAccess.sub, SUB, 'verified access token has the correct sub');
  equal(
    verifiedAccess.sid,
    SID,
    'verified access token carries the stable supplied sid'
  );
  equal(
    verifiedAccess.realm,
    'user',
    'verified access token has the correct realm'
  );
  equal(
    verifiedAccess.tokenVersion,
    0,
    'verified access token has the correct tokenVersion'
  );
  check(Object.isFrozen(verifiedAccess), 'verified access claims are frozen');

  const verifiedRefresh = provider.verifyRefreshToken(refresh.token);
  equal(
    verifiedRefresh.sid,
    SID,
    'verified refresh token carries the stable supplied sid'
  );

  // --- Verification: failure paths ---
  throws(
    () => provider.verifyAccessToken(refresh.token),
    'a refresh token fails access verification (wrong type)'
  );
  throws(
    () => provider.verifyRefreshToken(access.token),
    'an access token fails refresh verification (wrong type)'
  );
  throws(
    () => otherProvider.verifyAccessToken(access.token),
    'wrong secret fails verification'
  );
  throws(
    () => provider.verifyAccessToken('not-a-jwt'),
    'a malformed token fails verification'
  );

  const wrongIssuerProvider = createJwtSessionProvider(
    validConfig({ issuer: 'someone-else' })
  );
  const wrongIssuerToken = wrongIssuerProvider.issueAccessToken({
    sub: SUB,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  });
  throws(
    () => provider.verifyAccessToken(wrongIssuerToken.token),
    'wrong issuer fails verification'
  );

  const wrongAudienceProvider = createJwtSessionProvider(
    validConfig({ accessAudience: 'someone-else-aud' })
  );
  const wrongAudienceToken = wrongAudienceProvider.issueAccessToken({
    sub: SUB,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
  });
  throws(
    () => provider.verifyAccessToken(wrongAudienceToken.token),
    'wrong audience fails verification'
  );

  // Wrong algorithm: sign a token with a different algorithm than the
  // provider's allowlist expects, using the same secret.
  const jwtLib = await import('jsonwebtoken');
  const wrongAlgToken = jwtLib.default.sign(
    { sub: SUB, realm: 'user', sid: SID, tokenVersion: 0, type: 'access' },
    ACCESS_SECRET,
    {
      algorithm: 'HS384',
      issuer: ISSUER,
      audience: ACCESS_AUD,
      expiresIn: '15m',
    }
  );
  throws(
    () => provider.verifyAccessToken(wrongAlgToken),
    'wrong algorithm fails verification'
  );

  // Invalid realm.
  throws(
    () =>
      provider.issueAccessToken({
        sub: SUB,
        realm: 'admin',
        sid: SID,
        tokenVersion: 0,
      }),
    'invalid realm is rejected at issuance'
  );
  const invalidRealmToken = jwtLib.default.sign(
    { sub: SUB, realm: 'admin', sid: SID, tokenVersion: 0, type: 'access' },
    ACCESS_SECRET,
    {
      algorithm: 'HS256',
      issuer: ISSUER,
      audience: ACCESS_AUD,
      expiresIn: '15m',
    }
  );
  throws(
    () => provider.verifyAccessToken(invalidRealmToken),
    'invalid realm fails verification'
  );

  // Missing sid / jti / sub / tokenVersion.
  const missingSidToken = jwtLib.default.sign(
    { sub: SUB, realm: 'user', tokenVersion: 0, type: 'access' },
    ACCESS_SECRET,
    {
      algorithm: 'HS256',
      issuer: ISSUER,
      audience: ACCESS_AUD,
      expiresIn: '15m',
      jwtid: 'x',
    }
  );
  throws(
    () => provider.verifyAccessToken(missingSidToken),
    'missing sid fails verification'
  );

  const missingSubToken = jwtLib.default.sign(
    { realm: 'user', sid: SID, tokenVersion: 0, type: 'access' },
    ACCESS_SECRET,
    {
      algorithm: 'HS256',
      issuer: ISSUER,
      audience: ACCESS_AUD,
      expiresIn: '15m',
      jwtid: 'x',
    }
  );
  throws(
    () => provider.verifyAccessToken(missingSubToken),
    'missing sub fails verification'
  );

  const missingVersionToken = jwtLib.default.sign(
    { sub: SUB, realm: 'user', sid: SID, type: 'access' },
    ACCESS_SECRET,
    {
      algorithm: 'HS256',
      issuer: ISSUER,
      audience: ACCESS_AUD,
      expiresIn: '15m',
      jwtid: 'x',
    }
  );
  throws(
    () => provider.verifyAccessToken(missingVersionToken),
    'missing tokenVersion fails verification'
  );

  // Errors are the shared contract error type.
  try {
    provider.verifyAccessToken('garbage');
    assert.fail('expected verifyAccessToken to throw');
  } catch (error) {
    check(
      error instanceof RefreshSessionContractError,
      'verification failures use RefreshSessionContractError'
    );
    assertions += 1;
  }

  // --- SEC-3B.1: fractional/infinite/negative/non-number tokenVersion is
  // rejected at issuance itself, not deferred to verification of an
  // already-issued token. ---
  const invalidTokenVersions = [
    0.5,
    1.5,
    -1,
    Infinity,
    -Infinity,
    NaN,
    'x',
    undefined,
    null,
  ];
  for (const badVersion of invalidTokenVersions) {
    throws(
      () =>
        provider.issueAccessToken({
          sub: SUB,
          realm: 'user',
          sid: SID,
          tokenVersion: badVersion,
        }),
      `access issuance rejects tokenVersion=${String(badVersion)}`
    );
    throws(
      () =>
        provider.issueRefreshToken({
          sub: SUB,
          realm: 'user',
          sid: SID,
          tokenVersion: badVersion,
        }),
      `refresh issuance rejects tokenVersion=${String(badVersion)}`
    );
  }
  // 0 and positive integers remain accepted.
  check(
    typeof provider.issueAccessToken({
      sub: SUB,
      realm: 'user',
      sid: SID,
      tokenVersion: 0,
    }).token === 'string',
    'access issuance accepts tokenVersion=0'
  );
  check(
    typeof provider.issueAccessToken({
      sub: SUB,
      realm: 'user',
      sid: SID,
      tokenVersion: 7,
    }).token === 'string',
    'access issuance accepts a positive integer tokenVersion'
  );

  // Verification independently continues enforcing the same rule, for a
  // token that could only exist if issuance's own check were bypassed
  // (signed directly, not through the provider).
  const fractionalVersionToken = jwtLib.default.sign(
    { sub: SUB, realm: 'user', sid: SID, tokenVersion: 1.5, type: 'access' },
    ACCESS_SECRET,
    {
      algorithm: 'HS256',
      issuer: ISSUER,
      audience: ACCESS_AUD,
      expiresIn: '15m',
      jwtid: 'x',
    }
  );
  throws(
    () => provider.verifyAccessToken(fractionalVersionToken),
    'verification independently rejects a fractional tokenVersion'
  );
  const infiniteVersionToken = jwtLib.default.sign(
    {
      sub: SUB,
      realm: 'user',
      sid: SID,
      tokenVersion: Infinity,
      type: 'access',
    },
    ACCESS_SECRET,
    {
      algorithm: 'HS256',
      issuer: ISSUER,
      audience: ACCESS_AUD,
      expiresIn: '15m',
      jwtid: 'x',
    }
  );
  throws(
    () => provider.verifyAccessToken(infiniteVersionToken),
    'verification independently rejects an infinite tokenVersion (Infinity is not valid JSON, so the JWT payload actually loses the value — this still fails verification either way, proving no bypass exists)'
  );

  // --- SEC-3B.1: explicit, locked-in regression tests proving
  // caller-supplied reserved claims cannot override provider-controlled
  // values, even when a caller passes every reserved claim name
  // explicitly on the input object. ---
  const maliciousInput = {
    sub: SUB,
    realm: 'user',
    sid: SID,
    tokenVersion: 0,
    type: 'refresh',
    jti: 'attacker-chosen-jti',
    iss: 'attacker-issuer',
    aud: 'attacker-audience',
    exp: 9999999999,
    algorithm: 'none',
  };
  const maliciousAccess = provider.issueAccessToken(maliciousInput);
  const decodedMalicious = jwtLib.default.decode(maliciousAccess.token, {
    complete: true,
  });
  equal(
    decodedMalicious.header.alg,
    'HS256',
    'caller-supplied algorithm cannot override the pinned HS256 algorithm'
  );
  equal(
    decodedMalicious.payload.type,
    'access',
    'caller-supplied type cannot override the provider-controlled access type'
  );
  check(
    decodedMalicious.payload.jti !== 'attacker-chosen-jti',
    'caller-supplied jti cannot override the internally generated jti'
  );
  equal(
    maliciousAccess.jti !== 'attacker-chosen-jti',
    true,
    'the returned jti is never the caller-supplied value'
  );
  equal(
    decodedMalicious.payload.iss,
    ISSUER,
    'caller-supplied issuer cannot override the provider-controlled issuer'
  );
  equal(
    decodedMalicious.payload.aud,
    ACCESS_AUD,
    'caller-supplied audience cannot override the provider-controlled audience'
  );
  check(
    decodedMalicious.payload.exp < 9999999999,
    'caller-supplied expiry cannot override the provider-controlled lifetime'
  );
  // A maliciously-supplied `type: 'refresh'` did not make this a refresh
  // token — it must still verify as an access token and fail as a refresh
  // token, confirming the override attempt had no effect end to end.
  const verifiedMalicious = provider.verifyAccessToken(maliciousAccess.token);
  equal(
    verifiedMalicious.sub,
    SUB,
    'the token issued from malicious input still verifies correctly as an access token'
  );
  throws(
    () => provider.verifyRefreshToken(maliciousAccess.token),
    'the token issued from malicious input still fails refresh verification'
  );
} finally {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
}

equal(
  consoleCalls.length,
  0,
  'no token or secret was ever logged during this test run'
);

console.log(`jwtSessionProvider.test.js: ${assertions} assertions passed`);
