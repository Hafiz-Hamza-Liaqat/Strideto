/**
 * SEC-3C — dormant cookie policy tests.
 * Run: node src/__tests__/authCookiePolicy.test.js
 */
import assert from 'node:assert/strict';
import {
  createAuthCookiePolicy,
  resolveRuntimeMode,
} from '../services/auth/AuthCookiePolicy.js';

let assertions = 0;
function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}
function check(value, message) {
  assert.ok(value, message);
  assertions += 1;
}
function throwsType(fn) {
  assert.throws(fn, TypeError);
  assertions += 1;
}

function fakeRes() {
  const cookieCalls = [];
  const clearCookieCalls = [];
  return {
    cookie(name, value, options) {
      cookieCalls.push({ name, value, options });
    },
    clearCookie(name, options) {
      clearCookieCalls.push({ name, options });
    },
    cookieCalls,
    clearCookieCalls,
  };
}

const prodConfig = {
  mode: 'production',
  apiOrigin: 'https://api.strideto.com',
  trustedOrigins: ['https://strideto.com'],
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
};
const devConfig = {
  mode: 'development',
  apiOrigin: 'http://localhost:5000',
  trustedOrigins: ['http://localhost:5173'],
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
};

// --- resolveRuntimeMode ---
equal(
  resolveRuntimeMode({ nodeEnv: 'production' }),
  'production',
  'NODE_ENV=production resolves to production'
);
equal(
  resolveRuntimeMode({ nodeEnv: 'development' }),
  'development',
  'NODE_ENV=development resolves to development'
);
equal(
  resolveRuntimeMode({ nodeEnv: 'production', appEnv: 'production' }),
  'production',
  'agreeing NODE_ENV/APP_ENV resolve to production'
);
equal(
  resolveRuntimeMode({ nodeEnv: 'development', appEnv: 'development' }),
  'development',
  'agreeing NODE_ENV/APP_ENV resolve to development'
);
throwsType(
  () => resolveRuntimeMode({ nodeEnv: 'production', appEnv: 'development' }),
  'disagreeing NODE_ENV/APP_ENV is ambiguous'
);
throwsType(
  () => resolveRuntimeMode({ nodeEnv: 'development', appEnv: 'production' }),
  'disagreeing NODE_ENV/APP_ENV is ambiguous (reverse)'
);

// --- Production configuration validation ---
throwsType(
  () =>
    createAuthCookiePolicy({
      ...prodConfig,
      apiOrigin: 'http://api.strideto.com',
    }),
  'non-HTTPS apiOrigin is rejected in production'
);
throwsType(
  () => createAuthCookiePolicy({ ...prodConfig, apiOrigin: '' }),
  'missing apiOrigin is rejected in production'
);
throwsType(
  () => createAuthCookiePolicy({ ...prodConfig, trustedOrigins: [] }),
  'empty trustedOrigins is rejected in production'
);
throwsType(
  () => createAuthCookiePolicy({ ...prodConfig, maxAgeMs: 0 }),
  'zero maxAgeMs is rejected'
);
throwsType(
  () => createAuthCookiePolicy({ ...prodConfig, maxAgeMs: -1 }),
  'negative maxAgeMs is rejected'
);
throwsType(
  () => createAuthCookiePolicy({ ...prodConfig, maxAgeMs: 1.5 }),
  'fractional maxAgeMs is rejected'
);
throwsType(
  () =>
    createAuthCookiePolicy({
      mode: 'staging',
      apiOrigin: 'https://x',
      trustedOrigins: ['https://x'],
      maxAgeMs: 1,
    }),
  'an ambiguous/unknown mode is rejected'
);

// --- Production cookie names and Paths ---
{
  const policy = createAuthCookiePolicy(prodConfig);
  equal(
    policy.getCookieName('user'),
    '__Secure-strideto_user_rt',
    'production user cookie name matches the architecture report'
  );
  equal(
    policy.getCookieName('employer'),
    '__Secure-strideto_employer_rt',
    'production employer cookie name matches the architecture report'
  );
  equal(
    policy.getCookiePath('user'),
    '/api/auth/refresh-token',
    'production user Path matches the confirmed live route'
  );
  equal(
    policy.getCookiePath('employer'),
    '/api/auth/employer/refresh-token',
    'production employer Path matches the confirmed live route'
  );
  throwsType(
    () => policy.getCookieName('admin'),
    'an invalid realm is rejected'
  );
}

// --- Development cookie names and Paths ---
{
  const policy = createAuthCookiePolicy(devConfig);
  equal(
    policy.getCookieName('user'),
    'strideto_dev_rt',
    'development user cookie name matches the architecture report'
  );
  equal(
    policy.getCookieName('employer'),
    'strideto_dev_employer_rt',
    'development employer cookie name matches the architecture report'
  );
  equal(
    policy.getCookiePath('user'),
    '/api/auth/refresh-token',
    'development user Path matches production (same route)'
  );
  equal(
    policy.getCookiePath('employer'),
    '/api/auth/employer/refresh-token',
    'development employer Path matches production (same route)'
  );
}

// --- Realm isolation: names and Paths never overlap ---
{
  const prod = createAuthCookiePolicy(prodConfig);
  const dev = createAuthCookiePolicy(devConfig);
  for (const policy of [prod, dev]) {
    check(
      policy.getCookieName('user') !== policy.getCookieName('employer'),
      'user and employer cookie names differ'
    );
    const userPath = policy.getCookiePath('user');
    const employerPath = policy.getCookiePath('employer');
    check(
      !employerPath.startsWith(userPath),
      'the user Path is not a prefix of the employer Path'
    );
    check(
      !userPath.startsWith(employerPath),
      'the employer Path is not a prefix of the user Path'
    );
  }
}

// --- Cookie attributes ---
{
  const res = fakeRes();
  const policy = createAuthCookiePolicy(prodConfig);
  const result = policy.writeRefreshCookie({
    res,
    realm: 'user',
    token: 'a'.repeat(200),
  });
  equal(result.code, 'COOKIE_WRITTEN', 'writing a valid token succeeds');
  equal(res.cookieCalls.length, 1, 'exactly one cookie is set');
  const [{ name, options }] = res.cookieCalls;
  equal(
    name,
    '__Secure-strideto_user_rt',
    'the exact realm cookie name is used'
  );
  equal(options.httpOnly, true, 'HttpOnly is true');
  equal(options.secure, true, 'Secure is true in production');
  equal(options.sameSite, 'lax', 'SameSite is lax');
  equal(options.path, '/api/auth/refresh-token', 'Path is route-exact');
  equal(
    options.maxAge,
    prodConfig.maxAgeMs,
    'Max-Age matches the injected value'
  );
  equal(
    options.priority,
    'high',
    'Priority is set for eviction-risk reduction'
  );
  check(!('domain' in options), 'no Domain attribute is set');
}

// --- Development Secure=false ---
{
  const res = fakeRes();
  const policy = createAuthCookiePolicy(devConfig);
  policy.writeRefreshCookie({ res, realm: 'user', token: 'a'.repeat(200) });
  equal(
    res.cookieCalls[0].options.secure,
    false,
    'Secure is false in development'
  );
  equal(
    res.cookieCalls[0].name,
    'strideto_dev_rt',
    'a production __Secure- name is never selected for insecure localhost'
  );
}

// --- Cookie write input validation ---
{
  const res = fakeRes();
  const policy = createAuthCookiePolicy(prodConfig);
  equal(
    policy.writeRefreshCookie({ res, realm: 'admin', token: 'x'.repeat(50) })
      .code,
    'INVALID_COOKIE_INPUT',
    'an invalid realm is rejected on write'
  );
  equal(
    policy.writeRefreshCookie({ res, realm: 'user', token: '' }).code,
    'INVALID_COOKIE_INPUT',
    'an empty token is rejected on write'
  );
  equal(
    policy.writeRefreshCookie({ res, realm: 'user', token: '   ' }).code,
    'INVALID_COOKIE_INPUT',
    'a whitespace-only token is rejected on write'
  );
  equal(
    policy.writeRefreshCookie({ res, realm: 'user', token: 'a'.repeat(5000) })
      .code,
    'INVALID_COOKIE_INPUT',
    'a token exceeding the maximum length is rejected on write'
  );
  equal(
    policy.writeRefreshCookie({ res: {}, realm: 'user', token: 'x'.repeat(50) })
      .code,
    'INVALID_COOKIE_CONFIGURATION',
    'a response boundary without cookie() is rejected'
  );
  equal(res.cookieCalls.length, 0, 'no cookie was set for any rejected input');
}

// --- Cookie clearing matches setting attributes exactly ---
{
  const res = fakeRes();
  const policy = createAuthCookiePolicy(prodConfig);
  const result = policy.clearRefreshCookie({ res, realm: 'employer' });
  equal(result.code, 'COOKIE_CLEARED', 'clearing succeeds');
  const [{ name, options }] = res.clearCookieCalls;
  equal(
    name,
    '__Secure-strideto_employer_rt',
    'clearing uses the exact same cookie name'
  );
  equal(
    options.path,
    '/api/auth/employer/refresh-token',
    'clearing uses the exact same Path'
  );
  equal(options.secure, true, 'clearing matches Secure mode');
  equal(options.sameSite, 'lax', 'clearing matches SameSite');
  check(
    !('domain' in options),
    'clearing omits Domain exactly as setting does'
  );
  check(!('maxAge' in options), 'clearing does not include maxAge');
}

// --- Logout can clear the cookie even when it was not attached to the request ---
{
  const res = fakeRes();
  const policy = createAuthCookiePolicy(prodConfig);
  // No extractRefreshToken call happened at all — clearRefreshCookie does
  // not require the cookie to have been present on the request.
  const result = policy.clearRefreshCookie({ res, realm: 'user' });
  equal(
    result.code,
    'COOKIE_CLEARED',
    'clearing succeeds without the cookie having been read first'
  );
}

// --- Cookie extraction ---
{
  const policy = createAuthCookiePolicy(prodConfig);
  const name = policy.getCookieName('user');
  const employerName = policy.getCookieName('employer');

  const found = policy.extractRefreshToken({
    cookieHeader: `${name}=real-token-value; other=1`,
    realm: 'user',
  });
  equal(found.code, 'COOKIE_FOUND', 'a present cookie is found');
  equal(found.token, 'real-token-value', 'the exact token value is returned');

  const missing = policy.extractRefreshToken({
    cookieHeader: 'unrelated=1',
    realm: 'user',
  });
  equal(
    missing.code,
    'COOKIE_MISSING',
    'an absent cookie is reported as missing'
  );

  const emptyHeader = policy.extractRefreshToken({
    cookieHeader: '',
    realm: 'user',
  });
  equal(
    emptyHeader.code,
    'COOKIE_MISSING',
    'an empty header is reported as missing'
  );

  const duplicate = policy.extractRefreshToken({
    cookieHeader: `${name}=a; ${name}=b`,
    realm: 'user',
  });
  equal(
    duplicate.code,
    'COOKIE_DUPLICATE',
    'a duplicate occurrence is rejected, not silently resolved'
  );
  check(!('token' in duplicate), 'a duplicate result exposes no token');

  const emptyValue = policy.extractRefreshToken({
    cookieHeader: `${name}=`,
    realm: 'user',
  });
  equal(
    emptyValue.code,
    'COOKIE_MISSING',
    'an empty selected value is treated as missing'
  );

  const tooLong = policy.extractRefreshToken({
    cookieHeader: `${name}=${'a'.repeat(5000)}`,
    realm: 'user',
  });
  equal(
    tooLong.code,
    'INVALID_COOKIE_INPUT',
    'a value exceeding the maximum length is rejected'
  );

  // Never confuses user and employer names, even when both are present.
  const both = policy.extractRefreshToken({
    cookieHeader: `${name}=user-token; ${employerName}=employer-token`,
    realm: 'employer',
  });
  equal(
    both.code,
    'COOKIE_FOUND',
    'the employer extractor finds only the employer cookie'
  );
  equal(
    both.token,
    'employer-token',
    'the employer extractor never returns the user token'
  );
  const userSide = policy.extractRefreshToken({
    cookieHeader: `${name}=user-token; ${employerName}=employer-token`,
    realm: 'user',
  });
  equal(
    userSide.token,
    'user-token',
    'the user extractor never returns the employer token'
  );

  // SEC-3C.1: no decodeURIComponent is used — a percent-encoded-looking
  // string is validated and returned as the literal, opaque wire value it
  // is, never decoded. This closes the "safe-looking-when-encoded,
  // unsafe-once-decoded" class of bypass entirely, rather than merely
  // handling a decode failure safely.
  const percentLookingLiteral = policy.extractRefreshToken({
    cookieHeader: `${name}=%E0%A4%A`,
    realm: 'user',
  });
  equal(
    percentLookingLiteral.code,
    'COOKIE_FOUND',
    'a percent-encoded-looking value is treated as an opaque literal, never decoded'
  );
  equal(
    percentLookingLiteral.token,
    '%E0%A4%A',
    'the exact literal wire bytes are returned unchanged'
  );
}

// --- RFC 6265 cookie-octet validation (SEC-3C.1) ---
{
  const policy = createAuthCookiePolicy(prodConfig);
  const name = policy.getCookieName('user');

  const unsafeValues = {
    CR: 'abc\rdef',
    LF: 'abc\ndef',
    CRLF: 'abc\r\ndef',
    NUL: 'abc\0def',
    tab: 'abc\tdef',
    space: 'abc def',
    'double quote': 'abc"def',
    comma: 'abc,def',
    semicolon: 'abc;def',
    backslash: 'abc\\def',
    'non-ASCII': 'abcé def',
  };

  // --- Write path: every unsafe value is rejected, res.cookie is never invoked ---
  for (const [label, value] of Object.entries(unsafeValues)) {
    const res = fakeRes();
    const result = policy.writeRefreshCookie({
      res,
      realm: 'user',
      token: value,
    });
    equal(
      result.code,
      'INVALID_COOKIE_INPUT',
      `writeRefreshCookie rejects a value containing ${label}`
    );
    equal(
      res.cookieCalls.length,
      0,
      `res.cookie is never invoked when the value contains ${label}`
    );
  }

  // --- Extraction path: header-level CR/LF/NUL are rejected before any parsing ---
  equal(
    policy.extractRefreshToken({
      cookieHeader: `${name}=abc\rdef`,
      realm: 'user',
    }).code,
    'INVALID_COOKIE_INPUT',
    'a Cookie header containing CR is rejected'
  );
  equal(
    policy.extractRefreshToken({
      cookieHeader: `${name}=abc\ndef`,
      realm: 'user',
    }).code,
    'INVALID_COOKIE_INPUT',
    'a Cookie header containing LF is rejected'
  );
  equal(
    policy.extractRefreshToken({
      cookieHeader: `${name}=abc\0def`,
      realm: 'user',
    }).code,
    'INVALID_COOKIE_INPUT',
    'a Cookie header containing NUL is rejected'
  );

  // --- Extraction path: unsafe selected values are rejected, never returned ---
  const selectedValueCases = {
    tab: `${name}=abc\tdef`,
    space: `${name}=abc def`,
    'double quote': `${name}=abc"def`,
    comma: `${name}=abc,def`,
    backslash: `${name}=abc\\def`,
    'non-ASCII': `${name}=abcé def`,
  };
  for (const [label, cookieHeader] of Object.entries(selectedValueCases)) {
    const result = policy.extractRefreshToken({ cookieHeader, realm: 'user' });
    equal(
      result.code,
      'INVALID_COOKIE_INPUT',
      `extractRefreshToken rejects a selected value containing ${label}`
    );
    check(
      !('token' in result),
      `no token is exposed when the selected value contains ${label}`
    );
  }
  // A semicolon in the raw header always terminates the pair at that point
  // (semicolon is the pair delimiter itself) — so a value containing one
  // is never actually presented to the cookie-octet validator as a single
  // value; it instead becomes a shorter valid value followed by a new
  // (unrelated, ignored) pair. Confirm this resolves safely either way:
  // the extractor never throws and never returns an unsafe value.
  const semicolonHeader = policy.extractRefreshToken({
    cookieHeader: `${name}=abc;def=ghi`,
    realm: 'user',
  });
  check(
    semicolonHeader.code === 'COOKIE_FOUND' ||
      semicolonHeader.code === 'INVALID_COOKIE_INPUT',
    'a semicolon in the intended value safely resolves to either the truncated safe prefix or rejection, never a thrown error'
  );
  if (semicolonHeader.code === 'COOKIE_FOUND') {
    check(
      !semicolonHeader.token.includes(';'),
      'a semicolon can never appear inside a returned token'
    );
  }

  // --- Equals sign preserved exactly (already covered above by
  // percentLookingLiteral-style tests; re-confirmed directly here) ---
  const withEquals = policy.extractRefreshToken({
    cookieHeader: `${name}=abc=def=ghi`,
    realm: 'user',
  });
  equal(
    withEquals.code,
    'COOKIE_FOUND',
    'a value containing later = characters is accepted'
  );
  equal(
    withEquals.token,
    'abc=def=ghi',
    'later = characters are preserved exactly'
  );

  // --- Length boundary: exactly 4096 succeeds, 4097 fails ---
  const exactly4096 = 'a'.repeat(4096);
  const boundaryOk = policy.extractRefreshToken({
    cookieHeader: `${name}=${exactly4096}`,
    realm: 'user',
  });
  equal(
    boundaryOk.code,
    'COOKIE_FOUND',
    'a value of exactly 4096 characters succeeds'
  );
  equal(
    boundaryOk.token.length,
    4096,
    'the full 4096-character value is preserved'
  );

  const exactly4097 = 'a'.repeat(4097);
  const boundaryFail = policy.extractRefreshToken({
    cookieHeader: `${name}=${exactly4097}`,
    realm: 'user',
  });
  equal(
    boundaryFail.code,
    'INVALID_COOKIE_INPUT',
    'a value of 4097 characters is rejected'
  );

  const writeBoundaryOk = policy.writeRefreshCookie({
    res: fakeRes(),
    realm: 'user',
    token: exactly4096,
  });
  equal(
    writeBoundaryOk.code,
    'COOKIE_WRITTEN',
    'writing exactly 4096 characters succeeds'
  );
  const writeBoundaryFail = policy.writeRefreshCookie({
    res: fakeRes(),
    realm: 'user',
    token: exactly4097,
  });
  equal(
    writeBoundaryFail.code,
    'INVALID_COOKIE_INPUT',
    'writing 4097 characters is rejected'
  );
}

// --- No JavaScript-readable CSRF cookie is created ---
{
  const policy = createAuthCookiePolicy(prodConfig);
  check(
    typeof policy.writeCsrfCookie === 'undefined',
    'no CSRF-cookie-writing capability exists on the policy'
  );
  const res = fakeRes();
  policy.writeRefreshCookie({ res, realm: 'user', token: 'x'.repeat(50) });
  check(
    res.cookieCalls[0].options.httpOnly === true,
    'the only cookie this policy ever writes is HttpOnly'
  );
}

console.log(`authCookiePolicy.test.js: ${assertions} assertions passed`);
