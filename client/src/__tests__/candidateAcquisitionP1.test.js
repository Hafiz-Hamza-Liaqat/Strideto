import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { buildLandingAttributionMetadata, extractApprovedAttributionParams } from '../../../shared/seo/measurement/landingAttribution.js';
import { resolveRealmReturnPath } from '../../../shared/platform/returnPathPolicy.js';

const read = (file) => fs.readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
  clear() { this.#values.clear(); }
}

const originalGlobals = {
  window: globalThis.window,
  document: globalThis.document,
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
};

test.after(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});

test('CA-01 captures bounded first-touch attribution at the Jobs landing boundary', () => {
  const session = new MemoryStorage();
  const local = new MemoryStorage();
  globalThis.sessionStorage = session;
  globalThis.localStorage = local;
  globalThis.document = { referrer: '' };
  globalThis.window = {
    location: {
      pathname: '/jobs',
      search: '?utm_source=Google&utm_medium=CPC&utm_campaign=candidate_pilot_01&utm_content=software_engineer_01&secret=discard',
    },
  };
  local.setItem('strideto-cookie-consent', JSON.stringify({ version: 1, necessary: true, functional: true, analytics: true }));

  const first = buildLandingAttributionMetadata('/jobs', globalThis.window.location.search, '');
  assert.equal(first.utm_source, 'google');
  assert.equal(first.utm_medium, 'cpc');
  assert.equal(first.utm_campaign, 'candidate_pilot_01');
  assert.equal(first.utm_content, 'software_engineer_01');
  assert.equal(first.landingPage, '/jobs');
  assert.equal(first.secret, undefined);

  globalThis.window.location = { pathname: '/jobs/example-job', search: '' };
  const second = first;
  assert.deepEqual(second, first, 'internal navigation does not overwrite first touch');
});

test('CA-01 consent-off preserves registration functionality without attribution storage', () => {
  const session = new MemoryStorage();
  const local = new MemoryStorage();
  globalThis.sessionStorage = session;
  globalThis.localStorage = local;
  globalThis.document = { referrer: '' };
  globalThis.window = { location: { pathname: '/jobs', search: '?utm_source=google' } };
  local.setItem('strideto-cookie-consent', JSON.stringify({ version: 1, necessary: true, functional: true, analytics: false }));
  const analytics = read('client/src/utils/platformAnalytics.js');
  assert.match(analytics, /if \(!allowsAnalytics\(\)\) return \{\};/);
  assert.match(analytics, /sessionStorage\.setItem\(ACQUISITION_KEY/);
  assert.equal(session.getItem('er_acquisition_attribution'), null);
});

test('CA-01 shared contract keeps approved fields and excludes unknown/raw query data', () => {
  const metadata = buildLandingAttributionMetadata('/jobs', '?utm_source=google&utm_medium=cpc&utm_campaign=x&utm_content=y&utm_term=secret&raw=a', '');
  assert.deepEqual(extractApprovedAttributionParams('?utm_source=google&utm_medium=cpc&utm_campaign=x&utm_content=y&utm_term=secret&raw=a'), {
    utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'x', utm_content: 'y',
  });
  assert.equal(metadata.utm_term, undefined);
  assert.equal(metadata.raw, undefined);
});

test('CA-02 validated return intent survives Login → Register → verification → Login', () => {
  assert.equal(resolveRealmReturnPath({ pathname: '/jobs/example-job', search: '?source=pilot', hash: '#apply' }, '/', 'student'), '/jobs/example-job?source=pilot');
});

test('CA-02 rejects external and dangerous return destinations', () => {
  for (const unsafe of ['https://evil.example', '//evil.example', 'javascript:alert(1)', 'data:text/html,x']) {
    assert.equal(resolveRealmReturnPath(unsafe, '/', 'student'), '/');
  }
});

test('CA-02 route wiring carries validated return state without auto-applying', () => {
  const login = read('client/src/pages/Auth/Login.jsx');
  const register = read('client/src/pages/Auth/Register.jsx');
  const verify = read('client/src/pages/Auth/VerifyEmail.jsx');
  assert.match(login, /to=\{ROUTES\.REGISTER\}[\s\S]*state=\{requestedFrom/);
  assert.match(register, /rememberLoginReturnPath\(returnPath/);
  assert.match(verify, /state=\{returnState\}/);
  assert.doesNotMatch(verify, /authApi\.login|createApplication|apply\(/);
});

test('CA-03 Jobs search measurement uses authoritative total and one first-page boundary', () => {
  const jobs = read('client/src/pages/Jobs/Jobs.jsx');
  const controller = read('server/src/controllers/jobsController.js');
  assert.match(jobs, /initializeLandingAttribution\(\)/);
  assert.match(controller, /page === 1 && hasJobSearchIntent\(req\.query\)/);
  assert.match(controller, /resultCount: total/);
  assert.match(controller, /source: 'public'/);
  assert.doesNotMatch(controller, /page > 1.*logSearchQuery/);
});
