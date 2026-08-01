import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  mapRefreshResultToHttpStatus,
  mapAccessResultToHttpStatus,
  shouldClearRefreshCookie,
} from '../services/auth/secureAuthResultMapping.js';

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

// --- Exact refresh mapping, per the task's own required table -----------------
{
  check(
    mapRefreshResultToHttpStatus('REFRESH_ROTATED') === 200,
    'REFRESH_ROTATED -> 200'
  );
  for (const code of [
    'REFRESH_TOKEN_INVALID',
    'SESSION_MISSING',
    'SUBJECT_MISMATCH',
    'SESSION_REVOKED',
    'SESSION_EXPIRED',
    'VERSION_MISMATCH',
    'REFRESH_FINAL_STATE_MISMATCH',
    'REPLAY_DETECTED',
  ]) {
    check(mapRefreshResultToHttpStatus(code) === 401, `${code} -> 401`);
  }
  check(
    mapRefreshResultToHttpStatus('CONFLICT_BENIGN') === 409,
    'CONFLICT_BENIGN -> 409'
  );
  check(
    mapRefreshResultToHttpStatus('STORAGE_FAILURE') === 503,
    'STORAGE_FAILURE -> 503'
  );
  check(
    mapRefreshResultToHttpStatus('CLASSIFICATION_STALE') === 503,
    'CLASSIFICATION_STALE -> 503'
  );
  check(
    mapRefreshResultToHttpStatus('SOMETHING_UNRECOGNIZED') === 503,
    'unrecognized code fails closed to 503, never 200'
  );
}

// --- Exact access mapping -------------------------------------------------------
{
  check(
    mapAccessResultToHttpStatus('ACCESS_AUTHORIZED') === 200,
    'ACCESS_AUTHORIZED -> 200'
  );
  check(
    mapAccessResultToHttpStatus('ACCESS_TOKEN_INVALID') === 401,
    'ACCESS_TOKEN_INVALID -> 401'
  );
  check(
    mapAccessResultToHttpStatus('ACCESS_SUBJECT_INACTIVE') === 401,
    'ACCESS_SUBJECT_INACTIVE -> 401'
  );
  check(
    mapAccessResultToHttpStatus('ACCESS_VERSION_MISMATCH') === 401,
    'ACCESS_VERSION_MISMATCH -> 401'
  );
  check(
    mapAccessResultToHttpStatus('ACCESS_STORAGE_FAILURE') === 503,
    'ACCESS_STORAGE_FAILURE -> 503'
  );
  check(
    mapAccessResultToHttpStatus('UNKNOWN') === 503,
    'unrecognized access code fails closed to 503'
  );
}

// --- Cookie-clear policy: terminal failures clear, transient/benign do not -----
{
  check(
    shouldClearRefreshCookie('SESSION_REVOKED') === true,
    'terminal failure clears cookie'
  );
  check(
    shouldClearRefreshCookie('REPLAY_DETECTED') === true,
    'replay clears cookie'
  );
  check(
    shouldClearRefreshCookie('CONFLICT_BENIGN') === false,
    'benign conflict never clears cookie'
  );
  check(
    shouldClearRefreshCookie('STORAGE_FAILURE') === false,
    'storage failure never clears cookie'
  );
  check(
    shouldClearRefreshCookie('CLASSIFICATION_STALE') === false,
    'classification-stale never clears cookie'
  );
  check(
    shouldClearRefreshCookie('REFRESH_ROTATED') === false,
    'success never clears cookie'
  );
}

console.log(`secureAuthResultMapping.test.js: ${count} assertions passed`);
