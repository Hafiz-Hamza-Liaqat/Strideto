/**
 * Focused pure tests for RefreshSession index readiness tooling (no DB).
 * Run: node src/__tests__/provisionRefreshSessionIndexes.test.js
 */
import assert from 'assert';
import {
  IndexReadinessError,
  assertApplyConfirmation,
  buildSafeApplyPlan,
  compareRefreshSessionIndexes,
  comparisonOutput,
  expectedRefreshSessionIndexes,
  helpText,
  parseCliMode,
  REQUIRED_REFRESH_SESSION_INDEX_NAMES,
} from '../scripts/provisionRefreshSessionIndexes.js';

let assertions = 0;

function strictEqual(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}

function deepStrictEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assertions += 1;
}

function ok(value, message) {
  assert.ok(value, message);
  assertions += 1;
}

function throwsCode(action, expectedCode) {
  assert.throws(
    action,
    (error) =>
      error instanceof IndexReadinessError && error.code === expectedCode
  );
  assertions += 1;
}

function asMongoIndex(definition) {
  return {
    name: definition.name,
    key: Object.fromEntries(definition.key),
    ...(definition.options.unique ? { unique: true } : {}),
    ...(definition.options.sparse ? { sparse: true } : {}),
    ...(definition.options.expireAfterSeconds !== null
      ? { expireAfterSeconds: definition.options.expireAfterSeconds }
      : {}),
  };
}

function cloneIndexes(indexes) {
  return indexes.map((index) => ({
    ...index,
    key: { ...index.key },
  }));
}

const expected = expectedRefreshSessionIndexes();
const matchingActual = expected.map(asMongoIndex);

strictEqual(expected.length, 5, 'expected implicit and four named indexes');
deepStrictEqual(
  expected.slice(1).map(({ name }) => name),
  REQUIRED_REFRESH_SESSION_INDEX_NAMES,
  'schema index names must match the frozen contract'
);

const matching = compareRefreshSessionIndexes(expected, matchingActual);
strictEqual(matching.ok, true, 'matching indexes must pass');
strictEqual(matching.matched.length, 5, 'all expected indexes must match');
strictEqual(matching.missing.length, 0, 'matching indexes must not be missing');
strictEqual(matching.mismatched.length, 0, 'matching indexes must not mismatch');
deepStrictEqual(buildSafeApplyPlan(matching), [], 'matching indexes need no apply');

const missingActual = matchingActual.filter(
  ({ name }) => name !== 'refresh_session_active_by_subject'
);
const missing = compareRefreshSessionIndexes(expected, missingActual);
strictEqual(missing.ok, false, 'a missing index must fail readiness');
strictEqual(missing.missing.length, 1, 'one missing index must be reported');
strictEqual(
  missing.missing[0].name,
  'refresh_session_active_by_subject',
  'the missing index name must be exact'
);
strictEqual(buildSafeApplyPlan(missing).length, 1, 'missing schema index is creatable');

const keyMismatchActual = cloneIndexes(matchingActual);
keyMismatchActual.find(
  ({ name }) => name === 'refresh_session_active_by_subject'
).key = { subjectId: 1, subjectType: 1, revokedAt: 1 };
const keyMismatch = compareRefreshSessionIndexes(expected, keyMismatchActual);
deepStrictEqual(
  keyMismatch.mismatched[0].differences,
  ['key'],
  'compound key order mismatch must fail'
);
throwsCode(
  () => buildSafeApplyPlan(keyMismatch),
  'MISMATCHED_INDEX_REQUIRES_OPERATOR_REVIEW'
);

const uniqueMismatchActual = cloneIndexes(matchingActual);
delete uniqueMismatchActual.find(
  ({ name }) => name === 'refresh_session_current_token_hash_unique'
).unique;
deepStrictEqual(
  compareRefreshSessionIndexes(expected, uniqueMismatchActual).mismatched[0]
    .differences,
  ['unique'],
  'unique option mismatch must fail'
);

const sparseMismatchActual = cloneIndexes(matchingActual);
delete sparseMismatchActual.find(
  ({ name }) => name === 'refresh_session_previous_token_hash'
).sparse;
deepStrictEqual(
  compareRefreshSessionIndexes(expected, sparseMismatchActual).mismatched[0]
    .differences,
  ['sparse'],
  'sparse option mismatch must fail'
);

const ttlMismatchActual = cloneIndexes(matchingActual);
ttlMismatchActual.find(
  ({ name }) => name === 'refresh_session_ttl'
).expireAfterSeconds = 60;
deepStrictEqual(
  compareRefreshSessionIndexes(expected, ttlMismatchActual).mismatched[0]
    .differences,
  ['expireAfterSeconds'],
  'TTL option mismatch must fail'
);

const missingId = compareRefreshSessionIndexes(
  expected,
  matchingActual.filter(({ name }) => name !== '_id_')
);
strictEqual(missingId.missing[0].implicit, true, '_id must be implicit');
throwsCode(() => buildSafeApplyPlan(missingId), 'IMPLICIT_ID_INDEX_MISSING');

throwsCode(
  () => assertApplyConfirmation('apply', {}),
  'APPLY_CONFIRMATION_REQUIRED'
);
assertApplyConfirmation('apply', { STRIDETO_INDEX_PROVISION_CONFIRM: '1' });
assertions += 1;
assertApplyConfirmation('verify', {});
assertions += 1;

strictEqual(parseCliMode([]), 'verify', 'default CLI mode must verify');
strictEqual(parseCliMode(['--verify']), 'verify', '--verify must verify');
strictEqual(parseCliMode(['--apply']), 'apply', '--apply must apply');
strictEqual(parseCliMode(['--help']), 'help', '--help must not connect');
throwsCode(() => parseCliMode(['--apply', '--verify']), 'INVALID_ARGUMENTS');

const secret = 'mongodb://secret-user:secret-password@example.invalid/database';
const safeText = `${helpText()}\n${comparisonOutput(missing)}`;
strictEqual(safeText.includes(secret), false, 'safe output must not contain URI');
strictEqual(
  safeText.includes('refresh_session_active_by_subject'),
  true,
  'safe output may contain index names'
);
ok(safeText.includes('STATUS NOT_READY'), 'safe output must contain readiness status');

console.log(
  `provisionRefreshSessionIndexes tests passed (${assertions} assertions).`
);
