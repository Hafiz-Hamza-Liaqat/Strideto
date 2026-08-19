import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { APPROVED_RESPONSE_FIXTURES, approvedResponseFixture, classifyExpectedHttpFailure } from './lib/acceptanceNetworkPolicy.mjs';
import { mockResponse } from './lib/acceptanceFixtures.mjs';
import { disposableNamespace } from './lib/acceptanceRealSessions.mjs';

test('hybrid data plane has one exact approved response fixture', () => {
  assert.deepEqual(APPROVED_RESPONSE_FIXTURES.map(({ method, pathname }) => ({ method, pathname })), [
    { method: 'GET', pathname: '/api/agent/provider-domains/home' },
  ]);
  assert.ok(approvedResponseFixture('GET', '/api/agent/provider-domains/home'));
  assert.equal(approvedResponseFixture('POST', '/api/agent/provider-domains/home'), null);
  assert.equal(approvedResponseFixture('GET', '/api/agent/profile'), null);
});

test('unknown API remains fail-closed when it is explicitly classified for interception', () => {
  assert.throws(
    () => mockResponse('/api/acceptance-unknown', 'business-client', { method: 'GET', routeId: 'hybrid:test' }),
    (error) => error.code === 'UNHANDLED_ACCEPTANCE_API' && /persona=business-client/.test(error.message),
  );
});

test('full browser runner uses real API continuation for non-allowlisted API calls', () => {
  const source = fs.readFileSync('scripts/pre-freeze-final-acceptance-harness.mjs', 'utf8');
  // The session uses routeRef.current to resolve persona/id for the currently active route.
  assert.match(source, /fulfillApprovedResponse\(request, url, routeRef\.current\.persona, routeRef\.current\.id, session\.errors\)/);
  assert.match(source, /if \(!url\.pathname\.startsWith\('\/api\/'\)\) return request\.continue\(\)/);
  assert.match(source, /if \(fulfillApprovedResponse\([\s\S]*?\)\) return;/);
  assert.match(source, /return request\.continue\(\);/);
});

test('real sessions use disposable credentials and namespaced data markers', () => {
  assert.equal(disposableNamespace('hybrid-smoke-1'), 'acceptance_hybrid-smoke-1');
  assert.throws(() => disposableNamespace('bad namespace'), /Invalid disposable acceptance namespace/);
});

test('expected HTTP failures are classified from persona, method, URL, and status', () => {
  assert.ok(classifyExpectedHttpFailure({ persona: 'anonymous', method: 'POST', status: 401, url: 'https://localhost:5443/api/auth/refresh-token' }));
  assert.ok(classifyExpectedHttpFailure({ persona: 'institution', method: 'GET', status: 401, url: 'https://localhost:5443/api/announcements/feed?limit=8' }));
  assert.equal(classifyExpectedHttpFailure({ persona: 'student', method: 'POST', status: 401, url: 'https://localhost:5443/api/auth/refresh-token' }), null);
  assert.equal(classifyExpectedHttpFailure({ persona: 'anonymous', method: 'POST', status: 403, url: 'https://localhost:5443/api/auth/refresh-token' }), null);
  assert.equal(classifyExpectedHttpFailure({ persona: 'anonymous', method: 'POST', status: 401, url: 'https://localhost:5443/api/auth/login' }), null);
});

test('cross-domain 403s are classified as expected for education and business providers', () => {
  assert.ok(classifyExpectedHttpFailure({ persona: 'education-independent', method: 'GET', status: 403, url: 'https://localhost:5443/api/agent/business-services/enabled' }));
  assert.ok(classifyExpectedHttpFailure({ persona: 'education-agency', method: 'GET', status: 403, url: 'https://localhost:5443/api/agent/business-services/enabled' }));
  assert.ok(classifyExpectedHttpFailure({ persona: 'business-independent', method: 'GET', status: 403, url: 'https://localhost:5443/api/agent/education/enabled' }));
  assert.ok(classifyExpectedHttpFailure({ persona: 'business-agency', method: 'GET', status: 403, url: 'https://localhost:5443/api/agent/education/enabled' }));
  // Wrong persona must not match
  assert.equal(classifyExpectedHttpFailure({ persona: 'business-independent', method: 'GET', status: 403, url: 'https://localhost:5443/api/agent/business-services/enabled' }), null);
  assert.equal(classifyExpectedHttpFailure({ persona: 'education-independent', method: 'GET', status: 403, url: 'https://localhost:5443/api/agent/education/enabled' }), null);
});

test('static CMS page 404s are classified as expected for anonymous persona', () => {
  assert.ok(classifyExpectedHttpFailure({ persona: 'anonymous', method: 'GET', status: 404, url: 'https://localhost:5443/api/cms/site/pages/about' }));
  assert.ok(classifyExpectedHttpFailure({ persona: 'anonymous', method: 'GET', status: 404, url: 'https://localhost:5443/api/cms/site/pages/privacy-policy' }));
  // /license renders <NotFound /> (not StaticCmsPage), so the API call is never fired — policy correctly excludes it.
  assert.equal(classifyExpectedHttpFailure({ persona: 'anonymous', method: 'GET', status: 404, url: 'https://localhost:5443/api/cms/site/pages/license' }), null);
  // Non-static CMS slugs must not be classified
  assert.equal(classifyExpectedHttpFailure({ persona: 'anonymous', method: 'GET', status: 404, url: 'https://localhost:5443/api/cms/site/pages/unknown-page' }), null);
  // Wrong status and method must not match
  assert.equal(classifyExpectedHttpFailure({ persona: 'anonymous', method: 'GET', status: 500, url: 'https://localhost:5443/api/cms/site/pages/about' }), null);
  assert.equal(classifyExpectedHttpFailure({ persona: 'student', method: 'GET', status: 404, url: 'https://localhost:5443/api/cms/site/pages/about' }), null);
});

test('harness does not suppress console errors by text content matching (regression: Section 1)', () => {
  const source = fs.readFileSync('scripts/pre-freeze-final-acceptance-harness.mjs', 'utf8');
  // Forbidden pattern: console text used to decide suppression
  assert.doesNotMatch(source, /message\.text\(\)\.includes\('401/);
  assert.doesNotMatch(source, /message\.text\(\)\.includes\('403/);
  assert.doesNotMatch(source, /expectedAuth401/);
  assert.doesNotMatch(source, /expectedDomain403/);
  // Required pattern: structured URL-based suppression must be present (uses loc alias for detail.location.url)
  assert.match(source, /expectedHttpConsoleErrors\.has\(loc\)/);
});
