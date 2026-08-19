/**
 * Regression tests for detached-frame retry logic (Fix B) and realm refresh
 * 401 classification (Fix A).
 *
 * Does NOT require a browser. Tests the decision logic in isolation.
 */
import assert from 'node:assert/strict';
import { classifyExpectedHttpFailure, classifyExpectedConsoleError } from './lib/acceptanceNetworkPolicy.mjs';

// ---------------------------------------------------------------------------
// isDetachedFrameError — replicated from harness for isolation testing
// ---------------------------------------------------------------------------
function isDetachedFrameError(error) {
  return typeof error?.message === 'string' && error.message.includes('Attempted to use detached Frame');
}

// ---------------------------------------------------------------------------
// Retry state machine — mirrors the harness cell loop decision logic
// Returns the sequence of actions taken for a given sequence of thrown errors
// ---------------------------------------------------------------------------
function simulateCellLoop(errorSequence) {
  const actions = [];
  let detachedFrameRetried = false;
  let lastError = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const error = errorSequence[attempt] || null;
    if (!error) {
      lastError = null;
      actions.push('PASS');
      break;
    }
    lastError = error;
    if (isDetachedFrameError(error) && !detachedFrameRetried) {
      detachedFrameRetried = true;
      actions.push('DETACHED_FRAME_RECOVERY');
      continue;
    }
    // Rate limit simulation: harness checks session.last429Ms
    if (error.code === 'RATE_LIMIT' && attempt < 3) {
      actions.push('RATE_LIMIT_RETRY');
      continue;
    }
    actions.push('TERMINAL_FAIL');
    break;
  }
  return { actions, lastError, detachedFrameRetried };
}

// ---------------------------------------------------------------------------
// Fix B: detached-frame retry logic
// ---------------------------------------------------------------------------

// Case 1: first detach → recovery → PASS
{
  const detachedError = new Error('Attempted to use detached Frame');
  const result = simulateCellLoop([detachedError, null]);
  assert.deepEqual(result.actions, ['DETACHED_FRAME_RECOVERY', 'PASS']);
  assert.equal(result.lastError, null);
  assert.equal(result.detachedFrameRetried, true);
}

// Case 2: first detach → second detach → TERMINAL FAIL (no second retry)
{
  const e1 = new Error('Attempted to use detached Frame');
  const e2 = new Error('Attempted to use detached Frame');
  const result = simulateCellLoop([e1, e2]);
  assert.deepEqual(result.actions, ['DETACHED_FRAME_RECOVERY', 'TERMINAL_FAIL']);
  assert.equal(result.lastError, e2);
  assert.equal(result.detachedFrameRetried, true);
}

// Case 3: assertion error → immediate TERMINAL FAIL (no detach retry, no rate-limit retry)
{
  const assertionError = new assert.AssertionError({ message: 'Expected values to be strictly equal' });
  const result = simulateCellLoop([assertionError]);
  assert.deepEqual(result.actions, ['TERMINAL_FAIL']);
  assert.equal(result.detachedFrameRetried, false);
}

// Case 4: timeout error → immediate TERMINAL FAIL (not a detach, not a rate limit)
{
  const timeoutError = new Error('Navigation Timeout Exceeded: 30000ms exceeded');
  const result = simulateCellLoop([timeoutError]);
  assert.deepEqual(result.actions, ['TERMINAL_FAIL']);
  assert.equal(result.detachedFrameRetried, false);
}

// Case 5: rate limit → rate limit retry → PASS (unchanged path)
{
  const rateLimitError = new Error('429 Too Many Requests');
  rateLimitError.code = 'RATE_LIMIT';
  const result = simulateCellLoop([rateLimitError, null]);
  assert.deepEqual(result.actions, ['RATE_LIMIT_RETRY', 'PASS']);
  assert.equal(result.detachedFrameRetried, false);
}

// Case 6: partial match — error message containing but not exactly detached-frame phrase
{
  const notDetached = new Error('Frame was already detached');
  const result = simulateCellLoop([notDetached]);
  assert.deepEqual(result.actions, ['TERMINAL_FAIL']);
  assert.equal(result.detachedFrameRetried, false);
}

// Case 7: null/undefined errors are not detached-frame
{
  assert.equal(isDetachedFrameError(null), false);
  assert.equal(isDetachedFrameError(undefined), false);
  assert.equal(isDetachedFrameError({ message: 42 }), false);
  assert.equal(isDetachedFrameError(new Error('Attempted to use detached Frame')), true);
  assert.equal(isDetachedFrameError(new Error('detached Frame Attempted to use')), false);
}

// ---------------------------------------------------------------------------
// Fix A: realm refresh 401 network policy classifications
// ---------------------------------------------------------------------------

// All three anonymous realm refresh variants must be classified
const realmRefreshCases = [
  { pathname: '/api/auth/institution/refresh-token', label: 'institution' },
  { pathname: '/api/auth/employer/refresh-token', label: 'employer' },
  { pathname: '/api/auth/agent/refresh-token', label: 'agent' },
];

for (const { pathname, label } of realmRefreshCases) {
  const entry = classifyExpectedHttpFailure({
    persona: 'anonymous',
    method: 'GET',
    status: 401,
    url: `https://localhost:5443${pathname}`,
  });
  assert.ok(entry, `missing classification for anonymous GET 401 ${pathname} (${label})`);
  assert.equal(entry.persona, 'anonymous');
  assert.equal(entry.method, 'GET');
  assert.equal(entry.status, 401);
  assert.equal(entry.pathname, pathname);
}

// Original anonymous POST refresh-token must still be classified (regression guard)
{
  const entry = classifyExpectedHttpFailure({
    persona: 'anonymous',
    method: 'POST',
    status: 401,
    url: 'https://localhost:5443/api/auth/refresh-token',
  });
  assert.ok(entry, 'missing classification for original anonymous POST 401 /api/auth/refresh-token');
}

// Authenticated persona must NOT have these auto-classified (only anonymous)
{
  const entry = classifyExpectedHttpFailure({
    persona: 'student',
    method: 'GET',
    status: 401,
    url: 'https://localhost:5443/api/auth/institution/refresh-token',
  });
  assert.equal(entry, null, 'student persona must not auto-classify institution refresh 401');
}

// Wrong method (POST instead of GET for realm refresh) must NOT match
{
  const entry = classifyExpectedHttpFailure({
    persona: 'anonymous',
    method: 'POST',
    status: 401,
    url: 'https://localhost:5443/api/auth/institution/refresh-token',
  });
  assert.equal(entry, null, 'POST to institution refresh-token must not match GET entry');
}

// ---------------------------------------------------------------------------
// classifyExpectedConsoleError — race-condition-safe URL-only fallback
// ---------------------------------------------------------------------------

// Must match institution realm refresh for anonymous
for (const { pathname, label } of realmRefreshCases) {
  const entry = classifyExpectedConsoleError({
    persona: 'anonymous',
    url: `https://localhost:5443${pathname}`,
  });
  assert.ok(entry, `classifyExpectedConsoleError missing match for anonymous ${pathname} (${label})`);
}

// Must match original anonymous POST refresh-token (any method)
{
  const entry = classifyExpectedConsoleError({
    persona: 'anonymous',
    url: 'https://localhost:5443/api/auth/refresh-token',
  });
  assert.ok(entry, 'classifyExpectedConsoleError missing match for original POST refresh-token');
}

// Authenticated persona must NOT match
{
  const entry = classifyExpectedConsoleError({
    persona: 'student',
    url: 'https://localhost:5443/api/auth/institution/refresh-token',
  });
  assert.equal(entry, null, 'classifyExpectedConsoleError must not match student persona');
}

// Unknown URL must return null
{
  const entry = classifyExpectedConsoleError({
    persona: 'anonymous',
    url: 'https://localhost:5443/api/some/unknown/endpoint',
  });
  assert.equal(entry, null, 'classifyExpectedConsoleError must return null for unknown URL');
}

// ---------------------------------------------------------------------------
// Journey saved-item prefix match
// ---------------------------------------------------------------------------

// Anonymous + /api/journey/saved/ prefix must match (any content-type + ID)
{
  const e1 = classifyExpectedHttpFailure({ persona: 'anonymous', method: 'GET', status: 401, url: 'https://localhost:5443/api/journey/saved/agent_marketplace_post/6a84da8828ba448407051cf5/status' });
  assert.ok(e1, 'classifyExpectedHttpFailure must match anonymous /api/journey/saved/ prefix');
  const e2 = classifyExpectedConsoleError({ persona: 'anonymous', url: 'https://localhost:5443/api/journey/saved/agent_marketplace_post/abc123/status' });
  assert.ok(e2, 'classifyExpectedConsoleError must match anonymous /api/journey/saved/ prefix');
}

// Wrong persona must NOT match prefix
{
  const e = classifyExpectedConsoleError({ persona: 'student', url: 'https://localhost:5443/api/journey/saved/agent_marketplace_post/abc123/status' });
  assert.equal(e, null, 'classifyExpectedConsoleError must not match student persona for /api/journey/saved/');
}

// Prefix must not over-match other /api/journey/ paths
{
  const e = classifyExpectedConsoleError({ persona: 'anonymous', url: 'https://localhost:5443/api/journey/recommendations' });
  assert.equal(e, null, 'classifyExpectedConsoleError must not match /api/journey/ (not /api/journey/saved/)');
}

console.log(JSON.stringify({
  detachedFrameFirstRetryThenPass: 'PASS',
  detachedFrameSecondRetryTerminalFail: 'PASS',
  assertionErrorNoRetry: 'PASS',
  timeoutErrorNoRetry: 'PASS',
  rateLimitRetryUnchanged: 'PASS',
  partialMatchNotDetached: 'PASS',
  nullInputGuards: 'PASS',
  realmRefreshInstitution401: 'PASS',
  realmRefreshEmployer401: 'PASS',
  realmRefreshAgent401: 'PASS',
  originalRefreshTokenRegression: 'PASS',
  authenticatedPersonaNotClassified: 'PASS',
  wrongMethodNotClassified: 'PASS',
  consoleErrorRealmRefreshInstitution: 'PASS',
  consoleErrorRealmRefreshEmployer: 'PASS',
  consoleErrorRealmRefreshAgent: 'PASS',
  consoleErrorOriginalRefreshToken: 'PASS',
  consoleErrorAuthenticatedPersonaNotMatched: 'PASS',
  consoleErrorUnknownUrlNotMatched: 'PASS',
  journeySavedPrefixHttpFailure: 'PASS',
  journeySavedPrefixConsoleError: 'PASS',
  journeySavedWrongPersonaNotMatched: 'PASS',
  journeySavedPrefixDoesNotOvermatch: 'PASS',
}));
