/**
 * Live CAPTCHA enforcement integration tests (STRIDETO-SEC-2A).
 * Run: node src/__tests__/formPublicCaptchaIntegrationSecurity.test.js
 *
 * Invokes the real, exported submitForm() handler from
 * formPublicController.js — not a reimplementation, not source inspection.
 * Mocking happens only at existing model/service/network boundaries:
 * FormDefinition/FormSubmission are the same Mongoose model singletons the
 * controller's own service layer imports (mongoose.model() returns one
 * shared object per process), so patching their static methods here is
 * visible to the real code path without modifying any file outside this
 * suite. global.fetch is the network boundary CAPTCHA verification uses.
 * mongoose.connect() is never called anywhere in this process.
 */
import assert from 'assert';
import mongoose from 'mongoose';
import { FormDefinition } from '../models/FormDefinition.js';
import { FormSubmission } from '../models/FormSubmission.js';
import { submitForm } from '../controllers/formPublicController.js';

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

equal(
  mongoose.connection.readyState,
  0,
  'no live database connection is used by this suite'
);

const originalFetch = global.fetch;
const originalFindOne = FormDefinition.findOne;
const originalCreate = FormSubmission.create;

function baseForm(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    slug: 'contact-us',
    status: 'published',
    successMessage: 'Thank you!',
    redirectUrl: '',
    fields: [
      {
        id: 'f1',
        type: 'text',
        name: 'message',
        label: 'Message',
        required: true,
      },
    ],
    spamSettings: { honeypot: false, captchaProvider: 'recaptcha' },
    notifications: { sendAdminEmail: false, sendUserConfirmation: false },
    ...overrides,
  };
}

function fakeRes() {
  const calls = { status: [], json: [] };
  const res = {
    status(code) {
      calls.status.push(code);
      return res;
    },
    json(payload) {
      calls.json.push(payload);
      return res;
    },
  };
  res.__calls = calls;
  return res;
}

function fakeReq({ slug = 'contact-us', body = {} } = {}) {
  return {
    params: { slug },
    body,
    files: [],
    ip: '127.0.0.1',
    socket: {},
    get: () => 'test-agent',
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

function installFormMock(form) {
  FormDefinition.findOne = () => ({ lean: () => Promise.resolve(form) });
}

function installSubmissionCapture() {
  const calls = [];
  FormSubmission.create = async (payload) => {
    const created = { ...payload, _id: new mongoose.Types.ObjectId() };
    created.toObject = () => created;
    calls.push(created);
    return created;
  };
  return calls;
}

function restoreAll() {
  global.fetch = originalFetch;
  FormDefinition.findOne = originalFindOne;
  FormSubmission.create = originalCreate;
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
  // -------------------------------------------------------------------
  // CAPTCHA disabled — existing flow, no provider request
  // -------------------------------------------------------------------
  {
    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      throw new Error('fetch must not be called when captcha is disabled');
    };
    installFormMock(
      baseForm({ spamSettings: { honeypot: false, captchaProvider: 'none' } })
    );
    const submissions = installSubmissionCapture();
    const res = fakeRes();
    const body = { message: 'hello' };
    const bodySnapshot = JSON.parse(JSON.stringify(body));
    await submitForm(fakeReq({ body }), res);
    equal(fetchCalls, 0, 'no network call when captcha is disabled');
    equal(
      submissions.length,
      1,
      'submission persists normally when captcha is disabled'
    );
    equal(
      res.__calls.status[0],
      201,
      'normal success response when captcha is disabled'
    );
    deepEqual(
      body,
      bodySnapshot,
      'req.body is not mutated on the captcha-disabled path'
    );
    restoreAll();
  }

  // -------------------------------------------------------------------
  // CAPTCHA required and successful
  // -------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      return jsonResponse(200, { success: true });
    };
    installFormMock(baseForm());
    const submissions = installSubmissionCapture();
    const res = fakeRes();
    const body = { message: 'hello', captchaToken: 'good-token' };
    const bodySnapshot = JSON.parse(JSON.stringify(body));
    await submitForm(fakeReq({ body }), res);
    equal(
      fetchCalls,
      1,
      'exactly one provider verification call for one submission attempt'
    );
    equal(
      submissions.length,
      1,
      'persistence occurs after a successful verification'
    );
    equal(res.__calls.status[0], 201, 'normal success response is returned');
    deepEqual(
      res.__calls.json[0],
      {
        message: 'Thank you!',
        redirectUrl: '',
        submissionId: submissions[0]._id,
      },
      'the response shape matches the existing contract'
    );
    deepEqual(
      body,
      bodySnapshot,
      'req.body is not mutated on the successful-verification path (captchaToken remains on the caller-owned object, only the controller-internal copy is stripped)'
    );
    restoreAll();
  });

  // -------------------------------------------------------------------
  // CAPTCHA required and rejected — no persistence, safe response, no raw detail
  // -------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    global.fetch = async () =>
      jsonResponse(200, {
        success: false,
        'error-codes': ['invalid-input-response'],
      });
    installFormMock(baseForm());
    const submissions = installSubmissionCapture();
    const res = fakeRes();
    const body = { message: 'hello', captchaToken: 'bad-token' };
    const bodySnapshot = JSON.parse(JSON.stringify(body));
    await submitForm(fakeReq({ body }), res);
    equal(
      submissions.length,
      0,
      'no persistence when verification is rejected'
    );
    equal(
      res.__calls.status[0],
      400,
      'a rejected verification yields a safe 400 response'
    );
    deepEqual(
      res.__calls.json[0],
      { error: 'Submission blocked', reason: 'captcha_failed' },
      'the public response contains only the existing safe reason code'
    );
    const responseText = JSON.stringify(res.__calls.json[0]);
    ok(
      !responseText.includes('invalid-input-response'),
      "the provider's raw error-codes never reach the public response"
    );
    ok(
      !responseText.includes('recaptcha.google.com') &&
        !responseText.includes('siteverify'),
      'the provider endpoint is never exposed in the response'
    );
    deepEqual(
      body,
      bodySnapshot,
      'req.body is not mutated on the rejected-verification path'
    );
    restoreAll();
  });

  // -------------------------------------------------------------------
  // Missing secret — fail closed, no provider request, no persistence
  // -------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: undefined }, async () => {
    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      throw new Error(
        'fetch must not be called when the secret is not configured'
      );
    };
    installFormMock(baseForm());
    const submissions = installSubmissionCapture();
    const res = fakeRes();
    const body = { message: 'hello', captchaToken: 'token' };
    const bodySnapshot = JSON.parse(JSON.stringify(body));
    await submitForm(fakeReq({ body }), res);
    equal(fetchCalls, 0, 'no network call when the secret is missing');
    equal(
      submissions.length,
      0,
      'no persistence when the secret is missing (fails closed)'
    );
    equal(
      res.__calls.status[0],
      400,
      'a missing-secret verification fails closed with a safe response'
    );
    deepEqual(
      body,
      bodySnapshot,
      'req.body is not mutated on the missing-secret path'
    );
    restoreAll();
  });

  // -------------------------------------------------------------------
  // Network failure — fail closed, no persistence, bounded public response
  // -------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    global.fetch = async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.1:443 — internal detail');
    };
    installFormMock(baseForm());
    const submissions = installSubmissionCapture();
    const res = fakeRes();
    const body = { message: 'hello', captchaToken: 'token' };
    const bodySnapshot = JSON.parse(JSON.stringify(body));
    await submitForm(fakeReq({ body }), res);
    equal(submissions.length, 0, 'no persistence on network failure');
    equal(
      res.__calls.status[0],
      400,
      'network failure yields a safe bounded response'
    );
    const responseText = JSON.stringify(res.__calls.json[0]);
    ok(
      !responseText.includes('ECONNREFUSED') &&
        !responseText.includes('10.0.0.1'),
      'the raw network error never reaches the public response'
    );
    deepEqual(
      body,
      bodySnapshot,
      'req.body is not mutated on the network-failure path'
    );
    restoreAll();
  });

  // -------------------------------------------------------------------
  // Timeout — fail closed, no persistence, no raw abort detail
  // -------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    global.fetch = async (url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    installFormMock(baseForm());
    const submissions = installSubmissionCapture();
    const res = fakeRes();
    await submitForm(
      fakeReq({ body: { message: 'hello', captchaToken: 'token' } }),
      res
    );
    equal(submissions.length, 0, 'no persistence on a timed-out verification');
    equal(
      res.__calls.status[0],
      400,
      'a timeout fails closed with a safe response'
    );
    const responseText = JSON.stringify(res.__calls.json[0]);
    ok(
      !responseText.toLowerCase().includes('abort'),
      'no raw abort/timeout detail reaches the public response'
    );
    restoreAll();
  });

  // -------------------------------------------------------------------
  // Malformed provider response — fail closed, no persistence
  // -------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => 'not json {{{',
    });
    installFormMock(baseForm());
    const submissions = installSubmissionCapture();
    const res = fakeRes();
    await submitForm(
      fakeReq({ body: { message: 'hello', captchaToken: 'token' } }),
      res
    );
    equal(
      submissions.length,
      0,
      'no persistence on a malformed provider response'
    );
    equal(
      res.__calls.status[0],
      400,
      'a malformed response fails closed with a safe response'
    );
    restoreAll();
  });

  // -------------------------------------------------------------------
  // Unsupported provider — fail closed, no persistence, no request
  // -------------------------------------------------------------------
  {
    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      throw new Error('fetch must not be called for an unsupported provider');
    };
    installFormMock(
      baseForm({
        spamSettings: { honeypot: false, captchaProvider: 'hcaptcha' },
      })
    );
    const submissions = installSubmissionCapture();
    const res = fakeRes();
    await submitForm(
      fakeReq({ body: { message: 'hello', captchaToken: 'token' } }),
      res
    );
    equal(fetchCalls, 0, 'no network call for an unsupported provider');
    equal(submissions.length, 0, 'no persistence for an unsupported provider');
    equal(
      res.__calls.status[0],
      400,
      'an unsupported provider fails closed with a safe response'
    );
    restoreAll();
  }

  // -------------------------------------------------------------------
  // Privacy: the captcha token is never persisted, never in the response,
  // never logged, and the provider secret never appears anywhere observable.
  // -------------------------------------------------------------------
  await withEnv(
    { RECAPTCHA_SECRET_KEY: 'super-secret-value-must-never-appear' },
    async () => {
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;
      const consoleLines = [];
      console.log = (...args) => consoleLines.push(args.map(String).join(' '));
      console.warn = (...args) => consoleLines.push(args.map(String).join(' '));
      console.error = (...args) =>
        consoleLines.push(args.map(String).join(' '));

      global.fetch = async () => jsonResponse(200, { success: true });
      installFormMock(baseForm());
      const submissions = installSubmissionCapture();
      const res = fakeRes();
      const secretToken = 'THE-CAPTCHA-TOKEN-MUST-NEVER-BE-STORED-OR-LOGGED';
      await submitForm(
        fakeReq({ body: { message: 'hello', captchaToken: secretToken } }),
        res
      );

      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;

      equal(
        submissions.length,
        1,
        'the submission still persists successfully'
      );
      ok(
        !('captchaToken' in submissions[0].data),
        'captchaToken is not present in the persisted submission data'
      );
      ok(
        !('g-recaptcha-response' in submissions[0].data),
        'the alternate recaptcha field name is not present in the persisted data'
      );
      ok(
        !('cfTurnstileResponse' in submissions[0].data),
        'the alternate turnstile field name is not present in the persisted data'
      );
      equal(
        submissions[0].data.message,
        'hello',
        'ordinary form content is still persisted correctly'
      );

      const responseText = JSON.stringify(res.__calls.json[0]);
      ok(
        !responseText.includes(secretToken),
        'the captcha token never appears in the public response'
      );

      const combinedLogs = consoleLines.join('\n');
      ok(
        !combinedLogs.includes(secretToken),
        'the captcha token is never logged by the request path'
      );
      ok(
        !combinedLogs.includes('super-secret-value-must-never-appear'),
        'the provider secret is never logged by the request path'
      );
      restoreAll();
    }
  );

  // -------------------------------------------------------------------
  // Await-regression protection: a deferred/controlled verification Promise
  // proves the handler genuinely awaits — persistence cannot occur while
  // verification is pending, and correctly proceeds/blocks once it settles.
  // This test fails if a future maintainer removes `await`: without it,
  // `spam` would be the pending Promise itself, `spam.blocked`/`spam.silent`
  // would both be `undefined`, and control would fall through to
  // persistence immediately — before this test ever resolves the deferred
  // fetch — which the "no persistence while pending" assertion below would
  // catch.
  // -------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    let deferredResolve;
    const deferredFetch = new Promise((resolve) => {
      deferredResolve = resolve;
    });
    global.fetch = () => deferredFetch;
    installFormMock(baseForm());
    const submissions = installSubmissionCapture();
    const res = fakeRes();

    const handlerPromise = submitForm(
      fakeReq({ body: { message: 'hello', captchaToken: 'token' } }),
      res
    );

    // Let pending microtasks run without ever resolving the deferred fetch.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    equal(
      submissions.length,
      0,
      'no persistence occurs while verification is still pending (proves await is real)'
    );
    equal(
      res.__calls.status.length,
      0,
      'no response has been sent yet while verification is pending'
    );

    deferredResolve(jsonResponse(200, { success: true }));
    await handlerPromise;
    equal(
      submissions.length,
      1,
      'persistence proceeds once the deferred verification resolves successfully'
    );
    equal(
      res.__calls.status[0],
      201,
      'the success response is sent only after verification settles'
    );
    restoreAll();
  });
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    let deferredResolve;
    const deferredFetch = new Promise((resolve) => {
      deferredResolve = resolve;
    });
    global.fetch = () => deferredFetch;
    installFormMock(baseForm());
    const submissions = installSubmissionCapture();
    const res = fakeRes();

    const handlerPromise = submitForm(
      fakeReq({ body: { message: 'hello', captchaToken: 'token' } }),
      res
    );
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    equal(
      submissions.length,
      0,
      'no persistence occurs while a to-be-rejected verification is still pending'
    );

    deferredResolve(jsonResponse(200, { success: false }));
    await handlerPromise;
    equal(
      submissions.length,
      0,
      'no persistence after the deferred verification resolves as rejected'
    );
    equal(
      res.__calls.status[0],
      400,
      'a safe blocked response is sent once rejection settles'
    );
    restoreAll();
  });

  // -------------------------------------------------------------------
  // Input safety: request body / form definition are not mutated; exactly
  // one verification per submission attempt.
  // -------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    let fetchCalls = 0;
    global.fetch = async () => {
      fetchCalls += 1;
      return jsonResponse(200, { success: true });
    };
    const form = Object.freeze(baseForm());
    installFormMock(form);
    installSubmissionCapture();
    const body = { message: 'hello', captchaToken: 'token' };
    const bodySnapshot = JSON.parse(JSON.stringify(body));
    const res = fakeRes();
    await submitForm(fakeReq({ body }), res);
    equal(
      fetchCalls,
      1,
      'exactly one verification request for one submission attempt'
    );
    deepEqual(
      body,
      bodySnapshot,
      'the incoming request body object is not mutated by the controller'
    );
    restoreAll();
  });

  // -------------------------------------------------------------------
  // Caller-owned nested arrays/objects are not aliased-then-mutated: the
  // controller's field-sanitization loop reassigns computed values onto its
  // own copy rather than transforming the source array in place.
  // -------------------------------------------------------------------
  await withEnv({ RECAPTCHA_SECRET_KEY: 'secret-key' }, async () => {
    global.fetch = async () => jsonResponse(200, { success: true });
    const form = baseForm({
      fields: [
        {
          id: 'f1',
          type: 'text',
          name: 'message',
          label: 'Message',
          required: true,
        },
        {
          id: 'f2',
          type: 'multi-checkbox',
          name: 'interests',
          label: 'Interests',
          options: [{ value: 'jobs' }, { value: 'scholarships' }],
        },
      ],
    });
    installFormMock(form);
    const submissions = installSubmissionCapture();
    const originalInterests = ['jobs', 'scholarships'];
    const body = {
      message: 'hello',
      captchaToken: 'token',
      interests: originalInterests,
    };
    const res = fakeRes();
    await submitForm(fakeReq({ body }), res);
    equal(
      submissions.length,
      1,
      'submission with a nested array field persists successfully'
    );
    ok(
      body.interests === originalInterests,
      'the nested array on the caller-owned body object retains the exact same reference — it was never reassigned or mutated in place'
    );
    deepEqual(
      originalInterests,
      ['jobs', 'scholarships'],
      'the nested array contents are untouched (no in-place transform such as map/sort/push was applied to the caller-owned array)'
    );
    deepEqual(
      submissions[0].data.interests,
      ['jobs', 'scholarships'],
      'the persisted submission still receives the correctly sanitized field value from the independent copy'
    );
    restoreAll();
  });

  console.log(
    `formPublicCaptchaIntegrationSecurity.test.js: ${assertions} assertions passed`
  );
}

try {
  await run();
} finally {
  restoreAll();
}
