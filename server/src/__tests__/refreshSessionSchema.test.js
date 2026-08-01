/**
 * SEC-3B — RefreshSession schema tests (no DB connection).
 * Run: node src/__tests__/refreshSessionSchema.test.js
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

const readyStateBeforeImport = mongoose.connection.readyState;

const { RefreshSession } = await import('../models/RefreshSession.js');
const { User } = await import('../models/User.js');
const { Employer } = await import('../models/Employer.js');
const { REFRESH_SESSION_SUBJECT_TYPES, REFRESH_SESSION_REVOKE_REASONS } =
  await import('../services/auth/RefreshSessionContracts.js');

let assertions = 0;
function check(value, message) {
  assert.ok(value, message);
  assertions += 1;
}
function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}
function deepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assertions += 1;
}

// Model construction performs no database connection.
equal(readyStateBeforeImport, 0, 'no connection before importing the model');
equal(
  mongoose.connection.readyState,
  0,
  'no connection after importing the model'
);

const schema = RefreshSession.schema;
const paths = schema.paths;

// Required fields.
check(paths.subjectType.isRequired, 'subjectType is required');
check(paths.subjectId.isRequired, 'subjectId is required');
check(paths.currentTokenHash.isRequired, 'currentTokenHash is required');
check(paths.tokenVersionAtIssue.isRequired, 'tokenVersionAtIssue is required');
check(paths.lastUsedAt.isRequired, 'lastUsedAt is required');
check(paths.expiresAt.isRequired, 'expiresAt is required');
check(!paths.previousTokenHash.isRequired, 'previousTokenHash is optional');
check(
  !paths.previousTokenRotatedAt.isRequired,
  'previousTokenRotatedAt is optional'
);
check(!paths.revokedAt.isRequired, 'revokedAt is optional');
check(!paths.revokeReason.isRequired, 'revokeReason is optional');

// Exact subjectType enum.
deepEqual(
  paths.subjectType.enumValues,
  ['user', 'employer'],
  'subjectType enum is exact'
);
deepEqual(
  REFRESH_SESSION_SUBJECT_TYPES,
  ['user', 'employer'],
  'contract subject types match'
);

// Non-negative tokenVersionAtIssue.
const tokenVersionMinValidator = paths.tokenVersionAtIssue.validators.find(
  (v) => v.type === 'min'
);
check(tokenVersionMinValidator, 'tokenVersionAtIssue has a min validator');
equal(tokenVersionMinValidator.min, 0, 'tokenVersionAtIssue minimum is 0');

// Allowed revoke reasons — exact set, plus null. Ten values: the original
// nine plus SEC-3D.3's 'refresh_final_state_mismatch' (readiness audit
// §11.2/§18), added because the accepted architecture already mandated a
// distinct system-generated post-rotation cleanup event without assigning
// it a truthful audit reason.
const expectedRevokeReasons = [
  'logout',
  'logout_all',
  'replay_detected',
  'password_change',
  'password_reset',
  'account_suspended',
  'account_deleted',
  'role_changed',
  'admin_revoked',
  'refresh_final_state_mismatch',
];
equal(expectedRevokeReasons.length, 10, 'exactly ten revoke reasons');
equal(new Set(expectedRevokeReasons).size, 10, 'every revoke reason is unique');
deepEqual(
  REFRESH_SESSION_REVOKE_REASONS,
  expectedRevokeReasons,
  'contract revoke reasons match the accepted architecture'
);
deepEqual(
  paths.revokeReason.enumValues.filter((v) => v !== null),
  expectedRevokeReasons,
  'schema revoke reason enum matches the contract'
);
check(
  paths.revokeReason.enumValues.includes(null),
  'revokeReason enum allows null'
);
check(
  paths.revokeReason.enumValues.includes('refresh_final_state_mismatch'),
  'the new reason is accepted by the schema enum'
);
check(
  !paths.revokeReason.enumValues.includes('some_unknown_reason'),
  'unknown reasons remain rejected by the schema enum'
);
for (const reason of expectedRevokeReasons.filter(
  (r) => r !== 'refresh_final_state_mismatch'
)) {
  check(
    paths.revokeReason.enumValues.includes(reason),
    `existing reason "${reason}" remains accepted`
  );
}

// TTL index on expiresAt.
const indexes = schema.indexes();
const ttlIndex = indexes.find(
  ([, options]) => options?.name === 'refresh_session_ttl'
);
check(ttlIndex, 'a TTL index named refresh_session_ttl exists');
equal(ttlIndex[0].expiresAt, 1, 'TTL index is keyed on expiresAt');
equal(
  ttlIndex[1].expireAfterSeconds,
  0,
  'TTL index uses expireAfterSeconds: 0'
);

// Active-subject lookup index.
const activeSubjectIndex = indexes.find(
  ([, options]) => options?.name === 'refresh_session_active_by_subject'
);
check(activeSubjectIndex, 'an active-session-by-subject index exists');
deepEqual(
  activeSubjectIndex[0],
  { subjectType: 1, subjectId: 1, revokedAt: 1 },
  'active-subject index covers subjectType, subjectId, revokedAt'
);

// Defense-in-depth uniqueness on currentTokenHash.
const currentHashIndex = indexes.find(
  ([, options]) => options?.name === 'refresh_session_current_token_hash_unique'
);
check(currentHashIndex, 'a unique index on currentTokenHash exists');
equal(currentHashIndex[1].unique, true, 'currentTokenHash index is unique');

// No plaintext access/refresh token fields.
check(!paths.accessToken, 'no plaintext accessToken field exists');
check(!paths.refreshToken, 'no plaintext refreshToken field exists');
check(!paths.token, 'no generic plaintext token field exists');

// No IP / User-Agent / device fields — §20's privacy correction.
check(!paths.ip, 'no raw ip field exists');
check(!paths.ipHash, 'no ipHash field exists');
check(!paths.userAgent, 'no raw userAgent field exists');
check(
  !paths.deviceLabel,
  'no required deviceLabel field exists in the MVP schema'
);

// One document per family — the model has no rotation-generation counter
// or parent/family-reference field implying a new document per rotation.
check(
  !paths.familyId,
  'no separate familyId field — _id itself is the family identifier'
);
check(
  !paths.replacedByTokenId,
  'no replacedByTokenId field — one doc is mutated in place, not chained'
);

// Strict schema.
equal(schema.options.strict, 'throw', 'schema is strict: "throw"');
equal(
  schema.options.autoIndex,
  false,
  'autoIndex is disabled (no implicit DB connection)'
);
equal(
  schema.options.autoCreate,
  false,
  'autoCreate is disabled (no implicit DB connection)'
);

// --- SEC-3B.1: real behavioral proof of integer-only tokenVersion, not
// just presence of a validator function. ---

function tokenVersionError(Model, extra, value) {
  const doc = new Model({ ...extra, tokenVersion: value });
  const err = doc.validateSync();
  return err && err.errors && err.errors.tokenVersion;
}

const userBase = { email: 'sec3b1@example.com', password: 'x'.repeat(8) };
check(tokenVersionError(User, userBase, 0.5), 'User tokenVersion rejects 0.5');
check(tokenVersionError(User, userBase, 1.5), 'User tokenVersion rejects 1.5');
check(
  tokenVersionError(User, userBase, Infinity),
  'User tokenVersion rejects Infinity'
);
check(
  tokenVersionError(User, userBase, -Infinity),
  'User tokenVersion rejects -Infinity'
);
check(
  tokenVersionError(User, userBase, -1),
  'User tokenVersion rejects negative integers'
);
check(!tokenVersionError(User, userBase, 0), 'User tokenVersion accepts 0');
check(
  !tokenVersionError(User, userBase, 1),
  'User tokenVersion accepts positive integers'
);
check(
  !tokenVersionError(User, userBase, undefined),
  'User tokenVersion defaults to 0 when omitted'
);
equal(
  new User(userBase).tokenVersion,
  0,
  'User tokenVersion default value is exactly 0'
);

const employerBase = {
  companyName: 'Acme',
  email: 'sec3b1-employer@example.com',
  password: 'x'.repeat(8),
};
check(
  tokenVersionError(Employer, employerBase, 0.5),
  'Employer tokenVersion rejects 0.5'
);
check(
  tokenVersionError(Employer, employerBase, 1.5),
  'Employer tokenVersion rejects 1.5'
);
check(
  tokenVersionError(Employer, employerBase, Infinity),
  'Employer tokenVersion rejects Infinity'
);
check(
  tokenVersionError(Employer, employerBase, -Infinity),
  'Employer tokenVersion rejects -Infinity'
);
check(
  tokenVersionError(Employer, employerBase, -1),
  'Employer tokenVersion rejects negative integers'
);
check(
  !tokenVersionError(Employer, employerBase, 0),
  'Employer tokenVersion accepts 0'
);
check(
  !tokenVersionError(Employer, employerBase, 1),
  'Employer tokenVersion accepts positive integers'
);

// RefreshSession.tokenVersionAtIssue — real behavioral proof (not just the
// validator's presence, already checked above).
function refreshSessionWith(overrides) {
  const now = new Date();
  return new RefreshSession({
    subjectType: 'user',
    subjectId: new mongoose.Types.ObjectId(),
    currentTokenHash: 'a'.repeat(64),
    tokenVersionAtIssue: 0,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + 1000),
    ...overrides,
  });
}
function tokenVersionAtIssueError(value) {
  const err = refreshSessionWith({ tokenVersionAtIssue: value }).validateSync();
  return err && err.errors && err.errors.tokenVersionAtIssue;
}
check(
  tokenVersionAtIssueError(0.5),
  'RefreshSession tokenVersionAtIssue rejects 0.5 (behavioral)'
);
check(
  tokenVersionAtIssueError(1.5),
  'RefreshSession tokenVersionAtIssue rejects 1.5 (behavioral)'
);
check(
  tokenVersionAtIssueError(Infinity),
  'RefreshSession tokenVersionAtIssue rejects Infinity (behavioral)'
);
check(
  !tokenVersionAtIssueError(0),
  'RefreshSession tokenVersionAtIssue accepts 0 (behavioral)'
);
check(
  !tokenVersionAtIssueError(3),
  'RefreshSession tokenVersionAtIssue accepts positive integers (behavioral)'
);

// lastUsedAt default behavior — SEC-3B.1: defaults to Date.now when omitted.
const withoutLastUsedAt = refreshSessionWith({ lastUsedAt: undefined });
check(
  withoutLastUsedAt.lastUsedAt instanceof Date,
  'lastUsedAt defaults to a Date when omitted'
);
check(
  !Number.isNaN(withoutLastUsedAt.lastUsedAt.getTime()),
  'the default lastUsedAt is a valid Date'
);
check(
  Math.abs(withoutLastUsedAt.lastUsedAt.getTime() - Date.now()) < 5000,
  'the default lastUsedAt is close to the current time'
);

// No database connection was triggered by any of the behavioral checks above.
equal(
  mongoose.connection.readyState,
  0,
  'still no live database connection after behavioral validation checks'
);

console.log(`refreshSessionSchema.test.js: ${assertions} assertions passed`);
