import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { authenticateRealBrowserPage } from './lib/acceptanceRealSessions.mjs';

test('credential-backed sessions are the accepted restoration model', () => {
  const source = fs.readFileSync('scripts/lib/acceptanceRealSessions.mjs', 'utf8');
  assert.match(source, /createAuthenticatedContext/);
  assert.match(source, /IN_MEMORY_TOKEN_STORAGESTATE_NOT_APPLICABLE/);
  assert.match(source, /authenticateRealBrowserPage/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^)]*(token|access)/i);
  assert.doesNotMatch(source, /page\.waitForNavigation\(/, 'Must not depend on unconditional full-document page.waitForNavigation');
  assert.match(source, /page\.waitForResponse\(/, 'Must observe auth response before submit to avoid navigation race');
  assert.match(source, /page\.waitForFunction\(/, 'Must verify post-login URL transition');
});

test('authenticateRealBrowserPage executes SPA login cleanly without hanging on navigation', async () => {
  process.env.STRIDETO_QA_ADMIN = JSON.stringify({ email: 'admin@test.qa', password: 'password123' });

  const callLog = [];
  let clickCount = 0;
  let responseFilter = null;

  const mockPage = {
    async goto(url, options) {
      callLog.push({ call: 'goto', url, options });
    },
    async waitForSelector(selector, options) {
      callLog.push({ call: 'waitForSelector', selector, options });
    },
    async type(selector, text) {
      callLog.push({ call: 'type', selector, text });
    },
    waitForResponse(predicate, options) {
      callLog.push({ call: 'waitForResponse', options });
      responseFilter = predicate;
      return Promise.resolve({
        ok: () => true,
        status: () => 200,
        request: () => ({ method: () => 'POST' }),
        url: () => 'https://127.0.0.1:8443/api/auth/login',
      });
    },
    async click(selector) {
      clickCount += 1;
      callLog.push({ call: 'click', selector });
    },
    async waitForFunction(fn, options, ...args) {
      callLog.push({ call: 'waitForFunction', options, args });
    },
  };

  const result = await authenticateRealBrowserPage(mockPage, 'admin', 'https://127.0.0.1:8443');

  assert.equal(result.persona, 'admin');
  assert.equal(result.loginPath, '/auth/login');
  assert.equal(result.status, 200);
  assert.equal(clickCount, 1, 'Submit button must be clicked exactly once');

  // Verify call ordering: waitForResponse registered BEFORE click
  const responseIdx = callLog.findIndex((c) => c.call === 'waitForResponse');
  const clickIdx = callLog.findIndex((c) => c.call === 'click');
  const functionIdx = callLog.findIndex((c) => c.call === 'waitForFunction');

  assert.ok(responseIdx !== -1, 'waitForResponse must be called');
  assert.ok(clickIdx !== -1, 'click must be called');
  assert.ok(responseIdx < clickIdx, 'waitForResponse must be registered before click');
  assert.ok(clickIdx < functionIdx, 'click must precede post-login URL verification');

  // Verify response predicate filters correctly
  assert.ok(responseFilter({
    request: () => ({ method: () => 'POST' }),
    url: () => 'https://127.0.0.1:8443/api/auth/login',
  }));
  assert.ok(responseFilter({
    request: () => ({ method: () => 'POST' }),
    url: () => 'https://127.0.0.1:8443/api/auth/employer/login',
  }));
  assert.ok(responseFilter({
    request: () => ({ method: () => 'POST' }),
    url: () => 'https://127.0.0.1:8443/api/auth/institution/login',
  }));
  assert.ok(responseFilter({
    request: () => ({ method: () => 'POST' }),
    url: () => 'https://127.0.0.1:8443/api/auth/agent/login',
  }));
  assert.equal(responseFilter({
    request: () => ({ method: () => 'GET' }),
    url: () => 'https://127.0.0.1:8443/api/auth/login',
  }), false, 'GET requests must not match login response');
});

test('authenticateRealBrowserPage rejects failed credentials and does not swallow 401', async () => {
  process.env.STRIDETO_QA_STUDENT = JSON.stringify({ email: 'student@test.qa', password: 'badpassword' });

  const mockPage = {
    async goto() {},
    async waitForSelector() {},
    async type() {},
    waitForResponse() {
      return Promise.resolve({
        ok: () => false,
        status: () => 401,
        request: () => ({ method: () => 'POST' }),
        url: () => 'https://127.0.0.1:8443/api/auth/login',
      });
    },
    async click() {},
    async waitForFunction() {},
  };

  await assert.rejects(
    () => authenticateRealBrowserPage(mockPage, 'student', 'https://127.0.0.1:8443'),
    (err) => {
      assert.match(err.message, /REAL_API_LOGIN_HTTP_ERROR persona=student status=401/);
      return true;
    },
  );
});

test('authenticateRealBrowserPage rejects backend 403 errors', async () => {
  process.env.STRIDETO_QA_EMPLOYER = JSON.stringify({ email: 'employer@test.qa', password: 'password123' });

  const mockPage = {
    async goto() {},
    async waitForSelector() {},
    async type() {},
    waitForResponse() {
      return Promise.resolve({
        ok: () => false,
        status: () => 403,
        request: () => ({ method: () => 'POST' }),
        url: () => 'https://127.0.0.1:8443/api/auth/employer/login',
      });
    },
    async click() {},
    async waitForFunction() {},
  };

  await assert.rejects(
    () => authenticateRealBrowserPage(mockPage, 'employer', 'https://127.0.0.1:8443'),
    (err) => {
      assert.match(err.message, /REAL_API_LOGIN_HTTP_ERROR persona=employer status=403/);
      return true;
    },
  );
});

test('authenticateRealBrowserPage maps persona routes and selectors correctly', async () => {
  process.env.STRIDETO_QA_INSTITUTION = JSON.stringify({ email: 'inst@test.qa', password: 'password123' });
  process.env.STRIDETO_QA_EDUCATION_INDEPENDENT = JSON.stringify({ email: 'edu@test.qa', password: 'password123' });

  const institutionSelectors = [];
  const mockInstitutionPage = {
    async goto(url) {
      assert.equal(url, 'https://127.0.0.1:8443/institution/login');
    },
    async waitForSelector(sel) { institutionSelectors.push(sel); },
    async type() {},
    waitForResponse() {
      return Promise.resolve({
        ok: () => true,
        status: () => 200,
        request: () => ({ method: () => 'POST' }),
        url: () => 'https://127.0.0.1:8443/api/auth/institution/login',
      });
    },
    async click() {},
    async waitForFunction() {},
  };

  await authenticateRealBrowserPage(mockInstitutionPage, 'institution', 'https://127.0.0.1:8443');
  assert.ok(institutionSelectors.includes('#institution-email'), 'Institution realm must use #institution-email selector');
  assert.ok(institutionSelectors.includes('#institution-password'), 'Institution realm must use #institution-password selector');

  const mockAgentPage = {
    async goto(url) {
      assert.equal(url, 'https://127.0.0.1:8443/agent/login');
    },
    async waitForSelector() {},
    async type() {},
    waitForResponse() {
      return Promise.resolve({
        ok: () => true,
        status: () => 200,
        request: () => ({ method: () => 'POST' }),
        url: () => 'https://127.0.0.1:8443/api/auth/agent/login',
      });
    },
    async click() {},
    async waitForFunction() {},
  };

  const agentRes = await authenticateRealBrowserPage(mockAgentPage, 'education-independent', 'https://127.0.0.1:8443');
  assert.equal(agentRes.loginPath, '/agent/login');
});

test('authenticateRealBrowserPage waits for form readiness (email, password, submit) before typing', async () => {
  process.env.STRIDETO_QA_EDUCATION_INDEPENDENT = JSON.stringify({ email: 'edu@test.qa', password: 'password123' });

  const events = [];
  const mockPage = {
    async goto(url) { events.push(`goto:${url}`); },
    async waitForSelector(sel) { events.push(`wait:${sel}`); },
    async type(sel, text) { events.push(`type:${sel}`); },
    waitForResponse() {
      events.push('waitForResponse');
      return Promise.resolve({
        ok: () => true,
        status: () => 200,
        request: () => ({ method: () => 'POST' }),
        url: () => 'https://127.0.0.1:8443/api/auth/agent/login',
      });
    },
    async click(sel) { events.push(`click:${sel}`); },
    async waitForFunction() { events.push('waitForFunction'); },
  };

  await authenticateRealBrowserPage(mockPage, 'education-independent', 'https://127.0.0.1:8443');

  // Verify all 3 readiness checks precede any typing
  const waitEmailIdx = events.indexOf('wait:input[type="email"]');
  const waitPassIdx = events.indexOf('wait:input[type="password"]');
  const waitSubmitIdx = events.indexOf('wait:button[type="submit"]');
  const typeEmailIdx = events.indexOf('type:input[type="email"]');
  const typePassIdx = events.indexOf('type:input[type="password"]');
  const clickSubmitIdx = events.indexOf('click:button[type="submit"]');

  assert.ok(waitEmailIdx !== -1, 'Must wait for email selector');
  assert.ok(waitPassIdx !== -1, 'Must wait for password selector');
  assert.ok(waitSubmitIdx !== -1, 'Must wait for submit selector');
  assert.ok(waitEmailIdx < typeEmailIdx, 'Wait email must precede typing email');
  assert.ok(waitPassIdx < typePassIdx, 'Wait password must precede typing password');
  assert.ok(waitSubmitIdx < clickSubmitIdx, 'Wait submit must precede clicking submit');
  assert.ok(typeEmailIdx < clickSubmitIdx, 'Typing email must precede submit');
  assert.ok(typePassIdx < clickSubmitIdx, 'Typing password must precede submit');
});

test('authenticateRealBrowserPage handles asynchronous password element arrival', async () => {
  process.env.STRIDETO_QA_EMPLOYER = JSON.stringify({ email: 'employer@test.qa', password: 'password123' });

  let passwordReady = false;
  const mockPage = {
    async goto() {},
    async waitForSelector(sel) {
      if (sel === 'input[type="password"]') {
        // Simulate async render delay
        await new Promise((r) => setTimeout(r, 20));
        passwordReady = true;
      }
    },
    async type(sel) {
      if (sel === 'input[type="password"]') {
        assert.ok(passwordReady, 'Password input must be ready before typing');
      }
    },
    waitForResponse() {
      return Promise.resolve({
        ok: () => true,
        status: () => 200,
        request: () => ({ method: () => 'POST' }),
        url: () => 'https://127.0.0.1:8443/api/auth/employer/login',
      });
    },
    async click() {},
    async waitForFunction() {},
  };

  const res = await authenticateRealBrowserPage(mockPage, 'employer', 'https://127.0.0.1:8443');
  assert.equal(res.status, 200);
});

test('authenticateRealBrowserPage fails boundedly if password selector never appears', async () => {
  process.env.STRIDETO_QA_ADMIN = JSON.stringify({ email: 'admin@test.qa', password: 'password123' });

  const mockPage = {
    async goto() {},
    async waitForSelector(sel) {
      if (sel === 'input[type="password"]') {
        throw new Error('TimeoutError: waiting for selector `input[type="password"]` failed: timeout 15000ms exceeded');
      }
    },
    async type() {},
    waitForResponse() {},
    async click() {},
    async waitForFunction() {},
  };

  await assert.rejects(
    () => authenticateRealBrowserPage(mockPage, 'admin', 'https://127.0.0.1:8443'),
    (err) => {
      assert.match(err.message, /input\[type="password"\]/);
      return true;
    },
  );
});

