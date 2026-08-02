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
  executeIndexReadiness,
  expectedRefreshSessionIndexes,
  helpText,
  inspectIndexesSafely,
  isNamespaceNotFoundError,
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

strictEqual(
  isNamespaceNotFoundError({ code: 26 }),
  true,
  'numeric NamespaceNotFound code must be recognized'
);
strictEqual(
  isNamespaceNotFoundError({ codeName: 'NamespaceNotFound' }),
  true,
  'NamespaceNotFound codeName must be recognized'
);
strictEqual(
  isNamespaceNotFoundError({ errorResponse: { code: 26 } }),
  true,
  'nested driver NamespaceNotFound shape must be recognized'
);
strictEqual(
  isNamespaceNotFoundError({ code: 13, codeName: 'Unauthorized' }),
  false,
  'unrelated database errors must not be treated as collection absence'
);

const absentInspection = await inspectIndexesSafely(async () => {
  throw Object.assign(new Error('safe test error'), {
    code: 26,
    codeName: 'NamespaceNotFound',
  });
});
strictEqual(
  absentInspection.collectionExists,
  false,
  'NamespaceNotFound must report an absent collection'
);
deepStrictEqual(
  absentInspection.indexes,
  [],
  'absent collection must have no indexes'
);

const unrelatedError = Object.assign(new Error('unrelated safe test error'), {
  code: 13,
  codeName: 'Unauthorized',
});
await assert.rejects(
  () =>
    inspectIndexesSafely(async () => {
      throw unrelatedError;
    }),
  (error) => error === unrelatedError
);
assertions += 1;

const absentComparison = compareRefreshSessionIndexes(
  expected,
  absentInspection.indexes
);
strictEqual(
  absentComparison.missing.length,
  5,
  'absent collection must report implicit and named indexes missing'
);
strictEqual(
  comparisonOutput(absentComparison).includes('MISSING _id_'),
  true,
  'absent collection output must report implicit _id safely'
);
const firstRunPlan = buildSafeApplyPlan(absentComparison, {
  collectionExists: false,
});
deepStrictEqual(
  firstRunPlan.map(({ name }) => name),
  REQUIRED_REFRESH_SESSION_INDEX_NAMES,
  'first-run apply plan must contain only schema-defined named indexes'
);
strictEqual(
  firstRunPlan.some(({ implicit }) => implicit),
  false,
  '_id must never be planned for manual creation'
);

let verifyCreates = 0;
const verifyOutputs = [];
const verifyAbsent = await executeIndexReadiness({
  mode: 'verify',
  expected,
  inspectIndexes: async () => absentInspection,
  createSchemaIndexes: async () => {
    verifyCreates += 1;
  },
  output: (line) => verifyOutputs.push(line),
});
strictEqual(verifyAbsent.exitCode, 1, 'absent verify must fail readiness');
strictEqual(verifyCreates, 0, 'verify mode must never request index creation');
strictEqual(
  verifyOutputs.join('\n').includes('STATUS NOT_READY'),
  true,
  'absent verify must emit a safe not-ready status'
);

let applyInspections = 0;
let applyCreates = 0;
const applyOutputs = [];
const applyFirstRun = await executeIndexReadiness({
  mode: 'apply',
  expected,
  inspectIndexes: async () => {
    applyInspections += 1;
    return applyInspections === 1
      ? absentInspection
      : { collectionExists: true, indexes: matchingActual };
  },
  createSchemaIndexes: async () => {
    applyCreates += 1;
  },
  output: (line) => applyOutputs.push(line),
});
strictEqual(applyCreates, 1, 'first-run apply must request schema creation once');
strictEqual(applyInspections, 2, 'first-run apply must re-inspect after creation');
strictEqual(applyFirstRun.exitCode, 0, 'matching re-verification must pass');
strictEqual(
  applyFirstRun.comparison.ok,
  true,
  'post-creation comparison must be ready'
);
strictEqual(
  applyOutputs.join('\n').includes('CREATE _id_'),
  false,
  'apply output must never claim manual _id creation'
);
strictEqual(
  applyOutputs.join('\n').includes(secret),
  false,
  'first-run output must not expose credential text'
);

console.log(
  `provisionRefreshSessionIndexes tests passed (${assertions} assertions).`
);
