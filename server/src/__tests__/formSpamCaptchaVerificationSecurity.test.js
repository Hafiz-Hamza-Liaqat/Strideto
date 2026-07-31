/**
 * CAPTCHA verification security tests (STRIDETO-SEC-2).
 * Run: node src/__tests__/formSpamCaptchaVerificationSecurity.test.js
 *
 * Every network call in this suite is mocked at global.fetch — no real
 * request is ever sent to Google, Cloudflare, or any other host. The
 * original global.fetch is restored after every test and at the end of
 * the file via a try/finally wrapper around the whole run.
 */
import assert from 'assert';
import {
  verifyCaptchaToken,
  verifyCaptchaTokenDetailed,
  checkFormSpam,
  CAPTCHA_ERROR_CODES,
} from '../services/formSpamService.js';

let assertions = 0;
function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}
function deepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assertions += 1;
}
function ok(value, message) {
  assert.ok(value, message);
  assertions += 1;
}

const originalFetch = global.fetch;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

/** Captures every console call across all severities during a test. */
function captureConsole() {
  const lines = [];
  console.log = (...args) => lines.push(args.map(String).join(' '));
  console.warn = (...args) => lines.push(args.map(String).join(' '));
  console.error = (...args) => lines.push(args.map(String).join(' '));
  return {
    lines,
    restore() {
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    },
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

function mockFetch(handler) {
  let calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  return { calls: () => calls };
}

async function withEnv(vars, fn) {
  const previous = {};
  for (const key of Object.keys(vars)) {
    previous[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  try {
    await fn();
  } finally {
    for (const key of Object.keys(previous)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

async function run() {
  // ---------------------------------------------------------------------
  // CAPTCHA disabled — no request, always ok
  // ---------------------------------------------------------------------
  {
    const { calls } = mockFetch(() => {
      throw new Error('fetch must not be called when captcha is disabled');
    });
    const result = await verifyCaptchaTokenDetailed('none', '');
    deepEqual(
      result,
      { ok: true, code: null },
      'disabled provider passes with no network call'
    );
    equal(calls().length, 0, 'no fetch call when disabled');
    global.fetch = originalFetch;
  }
  {
    const { calls } = mockFetch(() => {
      throw new Error('fetch must not be called when provider is falsy');
    });
    const result = await verifyCaptchaTokenDetailed(undefined, 'irrelevant');
    equal(result.ok, true, 'falsy provider treated as disabled');
    equal(calls().length, 0, 'no fetch call for falsy provider');
    global.fetch = originalFetch;
  }

  // ---------------------------------------------------------------------
  // Missing / blank / oversized token — rejected before any network call
  // ---------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    const { calls } = mockFetch(() => {
      throw new Error('fetch must not be called for an invalid token');
    });
    const missing = await verifyCaptchaTokenDetailed('recaptcha', undefined);
    equal(missing.ok, false, 'missing token is rejected');
    equal(
      missing.code,
      CAPTCHA_ERROR_CODES.TOKEN_REQUIRED,
      'missing token classified TOKEN_REQUIRED'
    );

    const blank = await verifyCaptchaTokenDetailed('recaptcha', '   ');
    equal(blank.ok, false, 'blank token is rejected');
    equal(
      blank.code,
      CAPTCHA_ERROR_CODES.TOKEN_REQUIRED,
      'blank token classified TOKEN_REQUIRED'
    );

    const oversized = await verifyCaptchaTokenDetailed(
      'recaptcha',
      'x'.repeat(5000)
    );
    equal(oversized.ok, false, 'oversized token is rejected');
    equal(
      oversized.code,
      CAPTCHA_ERROR_CODES.TOKEN_REQUIRED,
      'oversized token classified TOKEN_REQUIRED'
    );

    equal(calls().length, 0, 'no network call for any invalid token shape');
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------
  // Unsupported provider — rejected, no network call, no new provider invented
  // ---------------------------------------------------------------------
  {
    const { calls } = mockFetch(() => {
      throw new Error('fetch must not be called for an unsupported provider');
    });
    const result = await verifyCaptchaTokenDetailed('hcaptcha', 'token-value');
    equal(result.ok, false, 'unsupported provider is rejected');
    equal(
      result.code,
      CAPTCHA_ERROR_CODES.PROVIDER_UNSUPPORTED,
      'unsupported provider classified PROVIDER_UNSUPPORTED'
    );
    equal(calls().length, 0, 'no network call for an unsupported provider');
    global.fetch = originalFetch;
  }

  // ---------------------------------------------------------------------
  // Missing secret — rejected, no network call (fail closed, not fail open)
  // ---------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: undefined }, async () => {
    const { calls } = mockFetch(() => {
      throw new Error(
        'fetch must not be called when the secret is not configured'
      );
    });
    const result = await verifyCaptchaTokenDetailed(
      'recaptcha',
      'a-real-looking-token'
    );
    equal(result.ok, false, 'missing secret is rejected');
    equal(
      result.code,
      CAPTCHA_ERROR_CODES.NOT_CONFIGURED,
      'missing secret classified NOT_CONFIGURED'
    );
    equal(calls().length, 0, 'no network call when the secret is missing');
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------
  // Supported provider success (recaptcha and turnstile)
  // ---------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    const { calls } = mockFetch(() => jsonResponse(200, { success: true }));
    const result = await verifyCaptchaTokenDetailed('recaptcha', 'good-token');
    deepEqual(
      result,
      { ok: true, code: null },
      'recaptcha success is accepted'
    );
    equal(calls().length, 1, 'exactly one verification request is made');
    equal(
      calls()[0].url,
      'https://www.google.com/recaptcha/api/siteverify',
      'the fixed, trusted recaptcha endpoint is used'
    );
    global.fetch = originalFetch;
  });
  await withEnv({ TURNSTILE_SECRET_KEY: 'secret-key' }, async () => {
    const { calls } = mockFetch(() => jsonResponse(200, { success: true }));
    const result = await verifyCaptchaTokenDetailed('turnstile', 'good-token');
    equal(result.ok, true, 'turnstile success is accepted');
    equal(
      calls()[0].url,
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      'the fixed, trusted turnstile endpoint is used'
    );
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------
  // Endpoint is not caller-controlled — verifyCaptchaToken accepts no URL parameter at all
  // ---------------------------------------------------------------------
  {
    equal(
      verifyCaptchaTokenDetailed.length,
      2,
      'verifyCaptchaTokenDetailed has no endpoint/URL parameter (only provider, token, and a defaulted options bag) — provider name is the only routing input, and it is validated against a fixed allowlist'
    );
  }

  // ---------------------------------------------------------------------
  // Unsuccessful provider result / missing success field / false success field
  // ---------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    mockFetch(() =>
      jsonResponse(200, {
        success: false,
        'error-codes': ['invalid-input-response'],
      })
    );
    const rejected = await verifyCaptchaTokenDetailed('recaptcha', 'bad-token');
    equal(rejected.ok, false, 'explicit success:false is rejected');
    equal(
      rejected.code,
      CAPTCHA_ERROR_CODES.VERIFICATION_REJECTED,
      'explicit failure classified VERIFICATION_REJECTED'
    );
    global.fetch = originalFetch;

    mockFetch(() => jsonResponse(200, {}));
    const missingField = await verifyCaptchaTokenDetailed('recaptcha', 'token');
    equal(
      missingField.ok,
      false,
      'a response with no success field is rejected, not treated as truthy'
    );
    equal(
      missingField.code,
      CAPTCHA_ERROR_CODES.VERIFICATION_REJECTED,
      'missing success field classified VERIFICATION_REJECTED'
    );
    global.fetch = originalFetch;

    mockFetch(() => jsonResponse(200, { success: 'true' }));
    const stringSuccess = await verifyCaptchaTokenDetailed(
      'recaptcha',
      'token'
    );
    equal(
      stringSuccess.ok,
      false,
      'a truthy non-boolean success value ("true" string) is rejected — strict boolean check only'
    );
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------
  // Malformed JSON / non-object body
  // ---------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    mockFetch(() => ({
      ok: true,
      status: 200,
      text: async () => 'not json at all {{{',
    }));
    const malformed = await verifyCaptchaTokenDetailed('recaptcha', 'token');
    equal(malformed.ok, false, 'malformed JSON is rejected');
    equal(
      malformed.code,
      CAPTCHA_ERROR_CODES.RESPONSE_INVALID,
      'malformed JSON classified RESPONSE_INVALID'
    );
    global.fetch = originalFetch;

    mockFetch(() => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([1, 2, 3]),
    }));
    const arrayBody = await verifyCaptchaTokenDetailed('recaptcha', 'token');
    equal(
      arrayBody.ok,
      false,
      'a JSON array body is rejected — not a strict plain object'
    );
    equal(
      arrayBody.code,
      CAPTCHA_ERROR_CODES.RESPONSE_INVALID,
      'array body classified RESPONSE_INVALID'
    );
    global.fetch = originalFetch;

    mockFetch(() => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify('just a string'),
    }));
    const stringBody = await verifyCaptchaTokenDetailed('recaptcha', 'token');
    equal(
      stringBody.ok,
      false,
      'a JSON string body is rejected — not a strict plain object'
    );
    global.fetch = originalFetch;

    mockFetch(() => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(null),
    }));
    const nullBody = await verifyCaptchaTokenDetailed('recaptcha', 'token');
    equal(nullBody.ok, false, 'a JSON null body is rejected');
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------
  // HTTP 4xx / 5xx
  // ---------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    mockFetch(() => jsonResponse(400, { success: true }));
    const http4xx = await verifyCaptchaTokenDetailed('recaptcha', 'token');
    equal(
      http4xx.ok,
      false,
      'HTTP 400 is rejected even if the body claims success'
    );
    equal(
      http4xx.code,
      CAPTCHA_ERROR_CODES.VERIFICATION_UNAVAILABLE,
      'HTTP 4xx classified VERIFICATION_UNAVAILABLE'
    );
    global.fetch = originalFetch;

    mockFetch(() => jsonResponse(503, { success: true }));
    const http5xx = await verifyCaptchaTokenDetailed('recaptcha', 'token');
    equal(http5xx.ok, false, 'HTTP 503 is rejected');
    equal(
      http5xx.code,
      CAPTCHA_ERROR_CODES.VERIFICATION_UNAVAILABLE,
      'HTTP 5xx classified VERIFICATION_UNAVAILABLE'
    );
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------
  // Network failure / timeout / aborted request
  // ---------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    global.fetch = async () => {
      throw new TypeError('fetch failed: getaddrinfo ENOTFOUND');
    };
    const networkFailure = await verifyCaptchaTokenDetailed(
      'recaptcha',
      'token'
    );
    equal(networkFailure.ok, false, 'a network failure is rejected');
    equal(
      networkFailure.code,
      CAPTCHA_ERROR_CODES.VERIFICATION_UNAVAILABLE,
      'network failure classified VERIFICATION_UNAVAILABLE, not exposed verbatim'
    );
    global.fetch = originalFetch;
  });
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    global.fetch = async (url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    const timedOut = await verifyCaptchaTokenDetailed('recaptcha', 'token');
    equal(timedOut.ok, false, 'a timed-out request is rejected');
    equal(
      timedOut.code,
      CAPTCHA_ERROR_CODES.VERIFICATION_TIMEOUT,
      'timeout classified VERIFICATION_TIMEOUT'
    );
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------
  // Redirect attempt — request is issued with redirect:'error' and a redirect
  // response is treated as a failure, not followed to an untrusted host.
  // ---------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    const { calls } = mockFetch((url, init) => {
      if (init.redirect === 'error') {
        throw new TypeError(
          'fetch failed: unexpected redirect, redirect mode is set to error'
        );
      }
      return jsonResponse(200, { success: true });
    });
    const redirected = await verifyCaptchaTokenDetailed('recaptcha', 'token');
    equal(
      redirected.ok,
      false,
      'a redirect response is rejected rather than followed'
    );
    equal(
      redirected.code,
      CAPTCHA_ERROR_CODES.VERIFICATION_UNAVAILABLE,
      'redirect rejection classified VERIFICATION_UNAVAILABLE'
    );
    equal(
      calls()[0].init.redirect,
      'error',
      'the request explicitly forbids following redirects'
    );
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------
  // Oversized response body (bounded read) — via the streaming body path
  // ---------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    const hugeChunk = new TextEncoder().encode('x'.repeat(70000));
    global.fetch = async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          let served = false;
          return {
            async read() {
              if (served) return { done: true, value: undefined };
              served = true;
              return { done: false, value: hugeChunk };
            },
            async cancel() {},
          };
        },
      },
      text: async () => 'x'.repeat(70000),
    });
    const oversizedResponse = await verifyCaptchaTokenDetailed(
      'recaptcha',
      'token'
    );
    equal(
      oversizedResponse.ok,
      false,
      'an oversized provider response body is rejected rather than buffered without bound'
    );
    equal(
      oversizedResponse.code,
      CAPTCHA_ERROR_CODES.RESPONSE_INVALID,
      'oversized response classified RESPONSE_INVALID'
    );
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------
  // Hostname / action / score — honored when explicitly supplied by the caller
  // (not currently populated by any live config; see the SEC-2 report)
  // ---------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    mockFetch(() =>
      jsonResponse(200, { success: true, hostname: 'strideto.com' })
    );
    const hostnameMatch = await verifyCaptchaTokenDetailed(
      'recaptcha',
      'token',
      { expectedHostname: 'strideto.com' }
    );
    equal(hostnameMatch.ok, true, 'matching hostname is accepted');
    global.fetch = originalFetch;

    mockFetch(() =>
      jsonResponse(200, { success: true, hostname: 'evil.example' })
    );
    const hostnameMismatch = await verifyCaptchaTokenDetailed(
      'recaptcha',
      'token',
      { expectedHostname: 'strideto.com' }
    );
    equal(hostnameMismatch.ok, false, 'mismatched hostname is rejected');
    equal(
      hostnameMismatch.code,
      CAPTCHA_ERROR_CODES.VERIFICATION_REJECTED,
      'hostname mismatch classified VERIFICATION_REJECTED'
    );
    global.fetch = originalFetch;

    mockFetch(() =>
      jsonResponse(200, { success: true, action: 'submit_contact' })
    );
    const actionMatch = await verifyCaptchaTokenDetailed('recaptcha', 'token', {
      expectedAction: 'submit_contact',
    });
    equal(actionMatch.ok, true, 'matching action is accepted');
    global.fetch = originalFetch;

    mockFetch(() => jsonResponse(200, { success: true, action: 'login' }));
    const actionMismatch = await verifyCaptchaTokenDetailed(
      'recaptcha',
      'token',
      { expectedAction: 'submit_contact' }
    );
    equal(actionMismatch.ok, false, 'mismatched action is rejected');
    global.fetch = originalFetch;

    mockFetch(() => jsonResponse(200, { success: true, score: 0.5 }));
    const scoreAtThreshold = await verifyCaptchaTokenDetailed(
      'recaptcha',
      'token',
      { minScore: 0.5 }
    );
    equal(
      scoreAtThreshold.ok,
      true,
      'a score exactly at the minimum threshold is accepted'
    );
    global.fetch = originalFetch;

    mockFetch(() => jsonResponse(200, { success: true, score: 0.1 }));
    const scoreBelow = await verifyCaptchaTokenDetailed('recaptcha', 'token', {
      minScore: 0.5,
    });
    equal(
      scoreBelow.ok,
      false,
      'a score below the minimum threshold is rejected'
    );
    equal(
      scoreBelow.code,
      CAPTCHA_ERROR_CODES.VERIFICATION_REJECTED,
      'below-threshold score classified VERIFICATION_REJECTED'
    );
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------
  // Privacy: token/secret/raw response/raw network error are never logged
  // or exposed on the returned result.
  // ---------------------------------------------------------------------
  await withEnv(
    { RECAPTCHA_SECRET_KEY: 'super-secret-value-should-never-appear' },
    async () => {
      const capture = captureConsole();
      mockFetch(() =>
        jsonResponse(200, {
          success: false,
          'error-codes': ['invalid-input-secret'],
        })
      );
      const secretToken = 'THIS-TOKEN-MUST-NEVER-BE-LOGGED';
      const result = await verifyCaptchaTokenDetailed('recaptcha', secretToken);
      capture.restore();
      equal(result.ok, false, 'rejected result returned as expected');
      deepEqual(
        Object.keys(result).sort(),
        ['code', 'ok'],
        'the returned result exposes only {ok, code} — no provider detail'
      );
      ok(
        !('response' in result) && !('error' in result) && !('raw' in result),
        'no raw-response/raw-error field exists on the result'
      );
      const combined = capture.lines.join('\n');
      ok(
        !combined.includes(secretToken),
        'the token is never written to any console method'
      );
      ok(
        !combined.includes('super-secret-value-should-never-appear'),
        'the secret is never written to any console method'
      );
      ok(
        !combined.includes('invalid-input-secret'),
        "the provider's raw error-codes are never written to any console method"
      );
      global.fetch = originalFetch;
    }
  );
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    const capture = captureConsole();
    global.fetch = async () => {
      throw new Error(
        'connect ECONNREFUSED 10.0.0.1:443 — internal-provider-detail'
      );
    };
    const result = await verifyCaptchaTokenDetailed('recaptcha', 'token-value');
    capture.restore();
    equal(
      result.code,
      CAPTCHA_ERROR_CODES.VERIFICATION_UNAVAILABLE,
      'network error classified generically'
    );
    const combined = capture.lines.join('\n');
    ok(
      !combined.includes('ECONNREFUSED') && !combined.includes('10.0.0.1'),
      'the raw network error message/cause is never logged'
    );
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------
  // No mutation of input/config objects
  // ---------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    mockFetch(() => jsonResponse(200, { success: true }));
    const options = Object.freeze({ expectedHostname: 'strideto.com' });
    await verifyCaptchaTokenDetailed('recaptcha', 'token', options);
    ok(
      true,
      'a frozen options object can be passed without the function attempting to mutate it (would throw in strict mode otherwise)'
    );
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------
  // checkFormSpam() integration — honeypot short-circuits before any CAPTCHA
  // network call; disabled provider triggers no call; enabled provider is
  // properly awaited and gates the result.
  // ---------------------------------------------------------------------
  {
    const { calls } = mockFetch(() => {
      throw new Error(
        'fetch must not be called when honeypot already blocked the submission'
      );
    });
    const form = {
      spamSettings: { honeypot: true, captchaProvider: 'recaptcha' },
    };
    const body = { website: 'i-am-a-bot' };
    const result = await checkFormSpam(form, body);
    deepEqual(
      result,
      { blocked: true, silent: true, reason: 'honeypot', score: 100 },
      'honeypot blocks before captcha is ever evaluated'
    );
    equal(
      calls().length,
      0,
      'no network call when the honeypot already blocked the submission'
    );
    global.fetch = originalFetch;
  }
  {
    const { calls } = mockFetch(() => {
      throw new Error('fetch must not be called when captchaProvider is none');
    });
    const form = { spamSettings: { honeypot: false, captchaProvider: 'none' } };
    const result = await checkFormSpam(form, {});
    equal(
      result.blocked,
      false,
      'no captcha configured means the submission is not blocked on that basis'
    );
    equal(calls().length, 0, 'no network call when captchaProvider is none');
    global.fetch = originalFetch;
  }
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    mockFetch(() => jsonResponse(200, { success: false }));
    const form = Object.freeze({
      spamSettings: Object.freeze({
        honeypot: false,
        captchaProvider: 'recaptcha',
      }),
    });
    const body = { captchaToken: 'a-token' };
    const bodySnapshot = JSON.parse(JSON.stringify(body));
    const result = await checkFormSpam(form, body);
    equal(
      result.blocked,
      true,
      'a rejected captcha verification blocks the submission (real check, not presence-only)'
    );
    equal(
      result.reason,
      'captcha_failed',
      'the public reason code is unchanged from the existing contract'
    );
    deepEqual(
      body,
      bodySnapshot,
      'checkFormSpam does not mutate the request body'
    );
    global.fetch = originalFetch;
  });
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    const { calls } = mockFetch(() => jsonResponse(200, { success: true }));
    const form = {
      spamSettings: { honeypot: false, captchaProvider: 'recaptcha' },
    };
    const result = await checkFormSpam(form, { captchaToken: 'a-real-token' });
    equal(
      result.blocked,
      false,
      'a genuinely successful verification allows the submission through'
    );
    equal(
      calls().length,
      1,
      'exactly one verification request per checkFormSpam invocation'
    );
    global.fetch = originalFetch;
  });

  // ---------------------------------------------------------------------
  // Arbitrary non-empty tokens are no longer accepted — the core regression
  // this suite exists to prevent.
  // ---------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    mockFetch(() => jsonResponse(200, { success: false }));
    const anyNonEmptyToken = await verifyCaptchaToken('recaptcha', 'x');
    equal(
      anyNonEmptyToken,
      false,
      'a merely non-empty token is no longer sufficient — the provider must confirm success'
    );
    global.fetch = originalFetch;
  });

  console.log(
    `formSpamCaptchaVerificationSecurity.test.js: ${assertions} assertions passed`
  );
}

try {
  await run();
} finally {
  global.fetch = originalFetch;
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
}
