/**
 * Account-security mutation primitive tests, against
 * injected in-memory model doubles (no live MongoDB connection).
 * Run: node src/__tests__/accountSecurityMutation.test.js
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createAccountSecurityMutationService } from '../services/auth/AccountSecurityMutationService.js';
import {
  ACCOUNT_SECURITY_MUTATION_RESULT_CODES,
  ACCOUNT_SECURITY_MUTATION_REALMS,
  ACCOUNT_ROLE_VALUES,
  ACCOUNT_STATUS_VALUES,
  VALID_TOKEN_VERSION_EXPR,
  isKnownRealm,
  isSafeNonNegativeInteger,
  isValidObjectIdString,
  isValidAccountStatus,
  isValidRole,
  isValidResetTokenHash,
  isWellFormedTokenVersion,
  isBelowTokenVersionMaximum,
  AccountSecurityMutationError,
} from '../services/auth/AccountSecurityMutationContracts.js';

let assertions = 0;
function equal(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
  assertions += 1;
}
function check(value, message) {
  assert.ok(value, message);
  assertions += 1;
}
function deepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
  assertions += 1;
}
function throwsType(fn, message) {
  assert.throws(fn, TypeError);
  assertions += 1;
  void message;
}

equal(
  mongoose.connection.readyState,
  0,
  'no live database connection is used by this test'
);

const USER_ID = '507f1f77bcf86cd799439011';
const MISSING_ID = '507f1f77bcf86cd799439000';
const MAX = Number.MAX_SAFE_INTEGER;

// ---------------------------------------------------------------------
// Minimal generic evaluator for $expr aggregation expressions — proves
// the exact nested $cond structure this service ships, not a stand-in
// mirror. Supports exactly the operators VALID_TOKEN_VERSION_EXPR uses.
// ---------------------------------------------------------------------
function evalExpr(expr, doc) {
  if (typeof expr === 'string' && expr.startsWith('$')) {
    return doc[expr.slice(1)];
  }
  if (expr === null || typeof expr !== 'object') {
    return expr;
  }
  if (Array.isArray(expr)) {
    return expr.map((e) => evalExpr(e, doc));
  }
  const [op] = Object.keys(expr);
  const args = expr[op];
  switch (op) {
    case '$isNumber':
      return typeof evalExpr(args, doc) === 'number';
    case '$cond': {
      const [ifE, thenE, elseE] = args;
      return evalExpr(ifE, doc) ? evalExpr(thenE, doc) : evalExpr(elseE, doc);
    }
    case '$and':
      return args.every((a) => Boolean(evalExpr(a, doc)));
    case '$gte': {
      const [a, b] = args.map((x) => evalExpr(x, doc));
      return a >= b;
    }
    case '$lt': {
      const [a, b] = args.map((x) => evalExpr(x, doc));
      return a < b;
    }
    case '$eq': {
      const [a, b] = args.map((x) => evalExpr(x, doc));
      return a === b;
    }
    case '$mod': {
      const [a, b] = args.map((x) => evalExpr(x, doc));
      return a % b;
    }
    default:
      throw new Error(`unsupported operator ${op} in test evaluator`);
  }
}

// ---------------------------------------------------------------------
// Deterministic fake model. No internal `await` between filter-match and
// mutation inside one call, faithfully emulating MongoDB's real
// per-document atomicity (matches sessionFamilyRevocation.test.js's
// convention). Supports call-indexed hooks so a test can inject a
// deterministic state mutation between two specific model calls — used
// to exercise the classify-to-retry race, not merely predetermine a
// result code.
// ---------------------------------------------------------------------
function createFakeModel({ seed = [], throwOn } = {}) {
  const store = new Map();
  for (const doc of seed) {
    store.set(String(doc._id), { ...doc });
  }
  const callCounts = { findById: 0, findOneAndUpdate: 0 };
  const hooks = { findById: new Map(), findOneAndUpdate: new Map() };

  function onCall(method, index, fn) {
    hooks[method].set(index, fn);
  }

  function project(doc, projection) {
    if (!projection) return { ...doc };
    const out = {};
    for (const key of Object.keys(projection)) {
      out[key] = doc[key];
    }
    return out;
  }

  function matchesFilter(doc, filter) {
    for (const [key, cond] of Object.entries(filter)) {
      if (key === '$expr') {
        if (!evalExpr(cond, doc)) return false;
        continue;
      }
      if (key === '_id') {
        if (String(doc._id) !== String(cond)) return false;
        continue;
      }
      if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('$eq' in cond) {
          if (doc[key] !== cond.$eq) return false;
          continue;
        }
        if ('$gt' in cond) {
          if (
            !(doc[key] instanceof Date) ||
            !(doc[key].getTime() > cond.$gt.getTime())
          )
            return false;
          continue;
        }
        continue;
      }
      if (doc[key] !== cond) return false;
    }
    return true;
  }

  function applyUpdate(doc, update) {
    if (update.$set) {
      for (const [k, v] of Object.entries(update.$set)) doc[k] = v;
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) doc[k] += v;
    }
    if (update.$unset) {
      for (const k of Object.keys(update.$unset)) delete doc[k];
    }
  }

  async function findById(id, projection) {
    const index = callCounts.findById;
    callCounts.findById += 1;
    const hook = hooks.findById.get(index);
    if (hook) hook(store);
    if (throwOn === 'findById') throw new Error('injected storage failure');
    const doc = store.get(String(id));
    if (!doc) return null;
    return project(doc, projection);
  }

  async function findOneAndUpdate(filter, update, options) {
    const index = callCounts.findOneAndUpdate;
    callCounts.findOneAndUpdate += 1;
    const hook = hooks.findOneAndUpdate.get(index);
    let forceMiss = false;
    if (hook) {
      const hookResult = hook(store);
      if (hookResult && hookResult.forceMiss) forceMiss = true;
    }
    if (throwOn === 'findOneAndUpdate')
      throw new Error('injected storage failure');
    if (forceMiss) return null;
    let matched = null;
    for (const doc of store.values()) {
      if (matchesFilter(doc, filter)) {
        matched = doc;
        break;
      }
    }
    if (!matched) return null;
    applyUpdate(matched, update);
    return project(matched, options && options.projection);
  }

  return {
    findById,
    findOneAndUpdate,
    onCall,
    callCounts,
    store,
  };
}

function seedUser(overrides = {}) {
  return {
    _id: USER_ID,
    accountStatus: 'active',
    role: 'User',
    tokenVersion: 5,
    password: 'oldHash',
    ...overrides,
  };
}

async function fixedHash() {
  return 'fixed-hash-value';
}

// =======================================================================
// Contract module
// =======================================================================
{
  equal(ACCOUNT_SECURITY_MUTATION_RESULT_CODES.length, 15, '15 result codes');
  equal(
    new Set(ACCOUNT_SECURITY_MUTATION_RESULT_CODES).size,
    15,
    'every result code is unique'
  );
  check(
    Object.isFrozen(ACCOUNT_SECURITY_MUTATION_RESULT_CODES),
    'result codes frozen'
  );
  check(Object.isFrozen(ACCOUNT_SECURITY_MUTATION_REALMS), 'realms frozen');
  check(Object.isFrozen(ACCOUNT_ROLE_VALUES), 'roles frozen');
  check(Object.isFrozen(ACCOUNT_STATUS_VALUES), 'statuses frozen');
  check(
    Object.isFrozen(VALID_TOKEN_VERSION_EXPR),
    'guard expression outer object frozen'
  );
  // Deep-immutability: Object.freeze alone is shallow, so every nested
  // array/object must independently resist mutation, not merely the
  // outermost object.
  check(
    Object.isFrozen(VALID_TOKEN_VERSION_EXPR.$cond),
    'guard outer $cond array frozen'
  );
  check(
    Object.isFrozen(VALID_TOKEN_VERSION_EXPR.$cond[0]),
    'guard $isNumber branch frozen'
  );
  check(
    Object.isFrozen(VALID_TOKEN_VERSION_EXPR.$cond[1]),
    'guard inner $cond object frozen'
  );
  check(
    Object.isFrozen(VALID_TOKEN_VERSION_EXPR.$cond[1].$cond),
    'guard inner $cond array frozen'
  );
  check(
    Object.isFrozen(VALID_TOKEN_VERSION_EXPR.$cond[1].$cond[0]),
    'guard $and object frozen'
  );
  check(
    Object.isFrozen(VALID_TOKEN_VERSION_EXPR.$cond[1].$cond[0].$and),
    'guard $and array frozen'
  );
  check(
    Object.isFrozen(VALID_TOKEN_VERSION_EXPR.$cond[1].$cond[1]),
    'guard $eq/$mod object frozen'
  );
  {
    const before = JSON.stringify(VALID_TOKEN_VERSION_EXPR);
    try {
      VALID_TOKEN_VERSION_EXPR.$cond[1].$cond[0] = 'mutated';
    } catch {
      /* strict-mode assignment to a frozen property may throw; either way
         the value must not change, asserted below. */
    }
    const after = JSON.stringify(VALID_TOKEN_VERSION_EXPR);
    equal(before, after, 'attempted deep mutation of the guard has no effect');
  }
  {
    let threwOnPush = false;
    try {
      VALID_TOKEN_VERSION_EXPR.$cond.push('extra');
    } catch {
      threwOnPush = true;
    }
    check(threwOnPush, 'attempting to extend a nested frozen array throws');
  }
  deepEqual(
    ACCOUNT_SECURITY_MUTATION_REALMS,
    ['user', 'employer'],
    'exact realm set'
  );
  deepEqual(
    ACCOUNT_ROLE_VALUES,
    ['User', 'Editor', 'Moderator', 'Admin', 'SuperAdmin'],
    'exact role set'
  );
  deepEqual(ACCOUNT_STATUS_VALUES, ['active', 'suspended'], 'exact status set');

  check(
    isKnownRealm('user') && isKnownRealm('employer'),
    'known realms accepted'
  );
  check(!isKnownRealm('admin') && !isKnownRealm(''), 'unknown realms rejected');
  check(
    isSafeNonNegativeInteger(0) && isSafeNonNegativeInteger(5),
    'safe non-negative integers accepted'
  );
  check(
    !isSafeNonNegativeInteger(-1) &&
      !isSafeNonNegativeInteger(1.5) &&
      !isSafeNonNegativeInteger(NaN),
    'unsafe values rejected'
  );
  check(isValidObjectIdString(USER_ID), 'valid ObjectId string accepted');
  check(
    !isValidObjectIdString('short') && !isValidObjectIdString(123),
    'invalid ObjectId string rejected'
  );
  check(
    isValidAccountStatus('active') && isValidAccountStatus('suspended'),
    'valid statuses accepted'
  );
  check(
    !isValidAccountStatus('banned') && !isValidAccountStatus(null),
    'invalid statuses rejected'
  );
  check(isValidRole('Admin'), 'valid role accepted');
  check(!isValidRole('Owner') && !isValidRole(''), 'invalid role rejected');
  check(isValidResetTokenHash('a'.repeat(64)), 'canonical hash accepted');
  check(
    !isValidResetTokenHash('A'.repeat(64)) &&
      !isValidResetTokenHash('a'.repeat(63)),
    'non-canonical hash rejected'
  );

  const err = new AccountSecurityMutationError(
    'ACCOUNT_SECURITY_MUTATION_INVALID'
  );
  check(err instanceof Error, 'error class extends Error');
  equal(err.code, 'ACCOUNT_SECURITY_MUTATION_INVALID', 'error carries code');
}

// =======================================================================
// Guard expression matrix — malformed tokenVersion values, evaluated
// directly against VALID_TOKEN_VERSION_EXPR to prove the exact nested
// $cond structure fails closed without throwing, for every listed case.
// =======================================================================
{
  const cases = [
    ['missing', {}],
    ['null', { tokenVersion: null }],
    ['string', { tokenVersion: '5' }],
    ['array', { tokenVersion: [5] }],
    ['object', { tokenVersion: { a: 1 } }],
    ['negative', { tokenVersion: -5 }],
    ['fractional', { tokenVersion: 5.5 }],
    ['NaN', { tokenVersion: NaN }],
    ['+Infinity', { tokenVersion: Infinity }],
    ['-Infinity', { tokenVersion: -Infinity }],
    ['greater than maximum', { tokenVersion: MAX + 1024 }],
    ['exactly maximum', { tokenVersion: MAX }],
  ];
  for (const [label, doc] of cases) {
    let result;
    let threw = false;
    try {
      result = evalExpr(VALID_TOKEN_VERSION_EXPR, doc);
    } catch {
      threw = true;
    }
    check(!threw, `guard does not throw for ${label}`);
    equal(result, false, `guard rejects ${label}`);
  }

  const validCases = [0, 1, 5, MAX - 1];
  for (const value of validCases) {
    equal(
      evalExpr(VALID_TOKEN_VERSION_EXPR, { tokenVersion: value }),
      true,
      `guard accepts ${value}`
    );
  }

  // Mirror helpers agree with the expression on the malformed/exhausted split.
  check(
    !isWellFormedTokenVersion(null) &&
      !isWellFormedTokenVersion('5') &&
      !isWellFormedTokenVersion(-1) &&
      !isWellFormedTokenVersion(1.5) &&
      !isWellFormedTokenVersion(NaN),
    'mirror rejects malformed'
  );
  check(
    isWellFormedTokenVersion(0) && isWellFormedTokenVersion(MAX),
    'mirror accepts well-formed including maximum'
  );
  check(
    isBelowTokenVersionMaximum(MAX - 1) && !isBelowTokenVersionMaximum(MAX),
    'mirror maximum boundary exact'
  );
}

// =======================================================================
// Construction validation
// =======================================================================
{
  throwsType(
    () =>
      createAccountSecurityMutationService({
        userModel: {},
        employerModel: createFakeModel(),
      }),
    'invalid userModel throws'
  );
  throwsType(
    () =>
      createAccountSecurityMutationService({
        userModel: createFakeModel(),
        employerModel: {},
      }),
    'invalid employerModel throws'
  );
  throwsType(
    () =>
      createAccountSecurityMutationService({
        userModel: createFakeModel(),
        employerModel: createFakeModel(),
        hashPassword: 'nope',
      }),
    'invalid hashPassword throws'
  );
  throwsType(
    () =>
      createAccountSecurityMutationService({
        userModel: createFakeModel(),
        employerModel: createFakeModel(),
        now: 'nope',
      }),
    'invalid now throws'
  );
}

// =======================================================================
// Input validation — zero model calls on invalid input
// =======================================================================
{
  const userModel = createFakeModel({ seed: [seedUser()] });
  const employerModel = createFakeModel({ seed: [] });
  const service = createAccountSecurityMutationService({
    userModel,
    employerModel,
    hashPassword: fixedHash,
  });

  await (async () => {
    deepEqual(
      await service.incrementTokenVersionForLogoutAll({
        realm: 'admin',
        subjectId: USER_ID,
        expectedTokenVersion: 5,
      }),
      { code: 'INVALID_INPUT' },
      'logout-all rejects unknown realm'
    );
    deepEqual(
      await service.incrementTokenVersionForLogoutAll({
        realm: 'user',
        subjectId: 'bad',
        expectedTokenVersion: 5,
      }),
      { code: 'INVALID_INPUT' },
      'logout-all rejects bad subjectId'
    );
    deepEqual(
      await service.incrementTokenVersionForLogoutAll({
        realm: 'user',
        subjectId: USER_ID,
        expectedTokenVersion: -1,
      }),
      { code: 'INVALID_INPUT' },
      'logout-all rejects negative expected'
    );
    deepEqual(
      await service.incrementTokenVersionForLogoutAll({
        realm: 'user',
        subjectId: USER_ID,
        expectedTokenVersion: 1.5,
      }),
      { code: 'INVALID_INPUT' },
      'logout-all rejects fractional expected'
    );

    deepEqual(
      await service.incrementTokenVersionForAdminRevoke({
        realm: 'admin',
        subjectId: USER_ID,
      }),
      { code: 'INVALID_INPUT' },
      'admin-revoke rejects unknown realm'
    );
    deepEqual(
      await service.incrementTokenVersionForAdminRevoke({
        realm: 'user',
        subjectId: 'bad',
      }),
      { code: 'INVALID_INPUT' },
      'admin-revoke rejects bad subjectId'
    );

    deepEqual(
      await service.changePassword({
        subjectId: 'bad',
        expectedTokenVersion: 5,
        newPassword: 'x',
      }),
      { code: 'INVALID_INPUT' },
      'password change rejects bad subjectId'
    );
    deepEqual(
      await service.changePassword({
        subjectId: USER_ID,
        expectedTokenVersion: -1,
        newPassword: 'x',
      }),
      { code: 'INVALID_INPUT' },
      'password change rejects negative expected'
    );
    deepEqual(
      await service.changePassword({
        subjectId: USER_ID,
        expectedTokenVersion: 5,
        newPassword: '',
      }),
      { code: 'INVALID_INPUT' },
      'password change rejects empty password'
    );

    deepEqual(
      await service.resetPassword({ hashedToken: 'short', newPassword: 'x' }),
      { code: 'INVALID_INPUT' },
      'reset rejects non-canonical token'
    );
    deepEqual(
      await service.resetPassword({
        hashedToken: 'A'.repeat(64),
        newPassword: 'x',
      }),
      { code: 'INVALID_INPUT' },
      'reset rejects uppercase hash'
    );
    deepEqual(
      await service.resetPassword({
        hashedToken: 'a'.repeat(64),
        newPassword: '',
      }),
      { code: 'INVALID_INPUT' },
      'reset rejects empty password'
    );

    deepEqual(
      await service.suspend({ realm: 'admin', subjectId: USER_ID }),
      { code: 'INVALID_INPUT' },
      'suspend rejects unknown realm'
    );
    deepEqual(
      await service.suspend({ realm: 'user', subjectId: 'bad' }),
      { code: 'INVALID_INPUT' },
      'suspend rejects bad subjectId'
    );

    deepEqual(
      await service.reactivate({
        realm: 'user',
        subjectId: USER_ID,
        alsoInvalidateAccessTokens: 'true',
      }),
      { code: 'INVALID_INPUT' },
      'reactivate rejects non-boolean flag'
    );
    deepEqual(
      await service.reactivate({
        realm: 'user',
        subjectId: USER_ID,
        alsoInvalidateAccessTokens: 1,
      }),
      { code: 'INVALID_INPUT' },
      'reactivate rejects numeric flag'
    );

    deepEqual(
      await service.changeRole({
        subjectId: USER_ID,
        expectedPriorRole: 'Owner',
        newRole: 'Admin',
      }),
      { code: 'INVALID_INPUT' },
      'role change rejects invalid prior role'
    );
    deepEqual(
      await service.changeRole({
        subjectId: USER_ID,
        expectedPriorRole: 'User',
        newRole: 'Owner',
      }),
      { code: 'INVALID_INPUT' },
      'role change rejects invalid new role'
    );
    deepEqual(
      await service.changeRole({
        subjectId: USER_ID,
        expectedPriorRole: 'User',
        newRole: 'User',
      }),
      { code: 'INVALID_INPUT' },
      'role change rejects identical roles'
    );
  })();

  equal(userModel.callCounts.findById, 0, 'no findById calls on invalid input');
  equal(
    userModel.callCounts.findOneAndUpdate,
    0,
    'no findOneAndUpdate calls on invalid input'
  );
  equal(
    employerModel.callCounts.findById,
    0,
    'employer model untouched by invalid input'
  );
  equal(
    employerModel.callCounts.findOneAndUpdate,
    0,
    'employer model untouched by invalid input'
  );
}

// =======================================================================
// Logout-all
// =======================================================================
{
  // Success.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ tokenVersion: 5 })],
    });
    const employerModel = createFakeModel();
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel,
      hashPassword: fixedHash,
    });
    const result = await service.incrementTokenVersionForLogoutAll({
      realm: 'user',
      subjectId: USER_ID,
      expectedTokenVersion: 5,
    });
    deepEqual(result, { code: 'VERSION_INCREMENTED' }, 'logout-all success');
    equal(
      userModel.store.get(USER_ID).tokenVersion,
      6,
      'tokenVersion incremented exactly once'
    );
    equal(
      userModel.callCounts.findOneAndUpdate,
      1,
      'exactly one write on success'
    );
    equal(
      userModel.callCounts.findById,
      0,
      'no classification read on success'
    );
  }

  // Employer realm supported.
  {
    const employerModel = createFakeModel({
      seed: [seedUser({ tokenVersion: 3 })],
    });
    const service = createAccountSecurityMutationService({
      userModel: createFakeModel(),
      employerModel,
      hashPassword: fixedHash,
    });
    const result = await service.incrementTokenVersionForLogoutAll({
      realm: 'employer',
      subjectId: USER_ID,
      expectedTokenVersion: 3,
    });
    deepEqual(
      result,
      { code: 'VERSION_INCREMENTED' },
      'logout-all succeeds for employer realm'
    );
  }

  // Duplicate collapse — current already advanced.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ tokenVersion: 6 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.incrementTokenVersionForLogoutAll({
      realm: 'user',
      subjectId: USER_ID,
      expectedTokenVersion: 5,
    });
    deepEqual(
      result,
      { code: 'VERSION_ALREADY_ADVANCED' },
      'duplicate logout-all collapses'
    );
    equal(userModel.store.get(USER_ID).tokenVersion, 6, 'no second increment');
    equal(
      userModel.callCounts.findOneAndUpdate,
      1,
      'no retry when already-advanced'
    );
    equal(userModel.callCounts.findById, 1, 'exactly one classification read');
  }

  // Retry success — primary write forced to miss, state unchanged, retry lands.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ tokenVersion: 5 })],
    });
    userModel.onCall('findOneAndUpdate', 0, () => ({ forceMiss: true }));
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.incrementTokenVersionForLogoutAll({
      realm: 'user',
      subjectId: USER_ID,
      expectedTokenVersion: 5,
    });
    deepEqual(
      result,
      { code: 'VERSION_INCREMENTED' },
      'retry succeeds when state was unchanged'
    );
    equal(
      userModel.store.get(USER_ID).tokenVersion,
      6,
      'exactly one real increment via the retry'
    );
    equal(
      userModel.callCounts.findOneAndUpdate,
      2,
      'exactly two write attempts: primary + one retry'
    );
    equal(userModel.callCounts.findById, 1, 'exactly one classification read');
  }

  // Retry miss — classify-to-retry race: state changes strictly between the
  // classification read (findById, already resolved as retry-eligible) and
  // the retry write's own filter-match logic (findOneAndUpdate call #1).
  {
    const userModel = createFakeModel({
      seed: [seedUser({ tokenVersion: 5 })],
    });
    userModel.onCall('findOneAndUpdate', 0, () => ({ forceMiss: true }));
    userModel.onCall('findOneAndUpdate', 1, (store) => {
      store.get(USER_ID).tokenVersion = 9;
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.incrementTokenVersionForLogoutAll({
      realm: 'user',
      subjectId: USER_ID,
      expectedTokenVersion: 5,
    });
    deepEqual(
      result,
      { code: 'CLASSIFICATION_STALE' },
      'retry miss after a genuine classify-to-retry race returns CLASSIFICATION_STALE'
    );
    equal(
      userModel.callCounts.findOneAndUpdate,
      2,
      'exactly two write attempts, never a third'
    );
    equal(
      userModel.callCounts.findById,
      1,
      'exactly one classification read, never two'
    );
  }

  // Missing subject.
  {
    const userModel = createFakeModel({ seed: [] });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.incrementTokenVersionForLogoutAll({
      realm: 'user',
      subjectId: MISSING_ID,
      expectedTokenVersion: 0,
    });
    deepEqual(
      result,
      { code: 'SUBJECT_MISSING' },
      'missing subject classified correctly'
    );
  }

  // Malformed / exhausted / regression via direct classification.
  {
    const cases = [
      ['SUBJECT_STATE_MALFORMED', 'not-a-number'],
      ['SUBJECT_STATE_MALFORMED', -3],
      ['SUBJECT_STATE_MALFORMED', 4.5],
      ['SUBJECT_STATE_MALFORMED', NaN],
      ['VERSION_EXHAUSTED', MAX],
      ['VERSION_REGRESSION', 2],
    ];
    for (const [expectedCode, storedValue] of cases) {
      const userModel = createFakeModel({
        seed: [seedUser({ tokenVersion: storedValue })],
      });
      const service = createAccountSecurityMutationService({
        userModel,
        employerModel: createFakeModel(),
        hashPassword: fixedHash,
      });
      const result = await service.incrementTokenVersionForLogoutAll({
        realm: 'user',
        subjectId: USER_ID,
        expectedTokenVersion: 5,
      });
      deepEqual(
        result,
        { code: expectedCode },
        `stored ${String(storedValue)} classified ${expectedCode}`
      );
    }
  }

  // Storage failure on primary write and on classification read.
  {
    const userModel = createFakeModel({
      seed: [seedUser()],
      throwOn: 'findOneAndUpdate',
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.incrementTokenVersionForLogoutAll({
        realm: 'user',
        subjectId: USER_ID,
        expectedTokenVersion: 5,
      }),
      { code: 'STORAGE_FAILURE' },
      'write throw maps to STORAGE_FAILURE'
    );
  }
  {
    const userModel = createFakeModel({
      seed: [seedUser({ tokenVersion: 4 })],
      throwOn: 'findById',
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.incrementTokenVersionForLogoutAll({
        realm: 'user',
        subjectId: USER_ID,
        expectedTokenVersion: 5,
      }),
      { code: 'STORAGE_FAILURE' },
      'classify throw maps to STORAGE_FAILURE'
    );
  }
}

// =======================================================================
// Admin revoke
// =======================================================================
{
  // Success via fresh preread.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ tokenVersion: 5 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.incrementTokenVersionForAdminRevoke({
      realm: 'user',
      subjectId: USER_ID,
    });
    deepEqual(result, { code: 'VERSION_INCREMENTED' }, 'admin-revoke success');
    equal(
      userModel.store.get(USER_ID).tokenVersion,
      6,
      'tokenVersion incremented'
    );
    equal(userModel.callCounts.findById, 1, 'exactly one preread');
    equal(userModel.callCounts.findOneAndUpdate, 1, 'exactly one write');
  }

  // Missing / malformed / exhausted at preread.
  {
    const missingModel = createFakeModel({ seed: [] });
    const service1 = createAccountSecurityMutationService({
      userModel: missingModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service1.incrementTokenVersionForAdminRevoke({
        realm: 'user',
        subjectId: MISSING_ID,
      }),
      { code: 'SUBJECT_MISSING' },
      'admin-revoke missing subject at preread'
    );

    const malformedModel = createFakeModel({
      seed: [seedUser({ tokenVersion: null })],
    });
    const service2 = createAccountSecurityMutationService({
      userModel: malformedModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service2.incrementTokenVersionForAdminRevoke({
        realm: 'user',
        subjectId: USER_ID,
      }),
      { code: 'SUBJECT_STATE_MALFORMED' },
      'admin-revoke malformed at preread'
    );

    const exhaustedModel = createFakeModel({
      seed: [seedUser({ tokenVersion: MAX })],
    });
    const service3 = createAccountSecurityMutationService({
      userModel: exhaustedModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service3.incrementTokenVersionForAdminRevoke({
        realm: 'user',
        subjectId: USER_ID,
      }),
      { code: 'VERSION_EXHAUSTED' },
      'admin-revoke exhausted at preread'
    );
  }

  // Concurrent same-baseline collapse.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ tokenVersion: 5 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const [a, b] = await Promise.all([
      service.incrementTokenVersionForAdminRevoke({
        realm: 'user',
        subjectId: USER_ID,
      }),
      service.incrementTokenVersionForAdminRevoke({
        realm: 'user',
        subjectId: USER_ID,
      }),
    ]);
    const codes = [a.code, b.code].sort();
    deepEqual(
      codes,
      ['VERSION_ALREADY_ADVANCED', 'VERSION_INCREMENTED'],
      'concurrent same-baseline admin-revoke collapses to one real increment'
    );
    equal(
      userModel.store.get(USER_ID).tokenVersion,
      6,
      'exactly one real increment across both concurrent calls'
    );
  }

  // Sequential invocations each increment independently (not idempotent).
  {
    const userModel = createFakeModel({
      seed: [seedUser({ tokenVersion: 5 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const first = await service.incrementTokenVersionForAdminRevoke({
      realm: 'user',
      subjectId: USER_ID,
    });
    const second = await service.incrementTokenVersionForAdminRevoke({
      realm: 'user',
      subjectId: USER_ID,
    });
    deepEqual(
      first,
      { code: 'VERSION_INCREMENTED' },
      'sequential admin-revoke call 1 increments'
    );
    deepEqual(
      second,
      { code: 'VERSION_INCREMENTED' },
      'sequential admin-revoke call 2 also increments (fresh preread, not idempotent)'
    );
    equal(
      userModel.store.get(USER_ID).tokenVersion,
      7,
      'two real increments across two sequential invocations'
    );
  }

  // Retry-miss — classify-to-retry race, exact call bound (maximum 4:
  // preread + primary write + classification read + one retry).
  {
    const userModel = createFakeModel({
      seed: [seedUser({ tokenVersion: 5 })],
    });
    userModel.onCall('findOneAndUpdate', 0, () => ({ forceMiss: true }));
    userModel.onCall('findOneAndUpdate', 1, (store) => {
      store.get(USER_ID).tokenVersion = 9;
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.incrementTokenVersionForAdminRevoke({
      realm: 'user',
      subjectId: USER_ID,
    });
    deepEqual(
      result,
      { code: 'CLASSIFICATION_STALE' },
      'admin-revoke retry miss after classify-to-retry race'
    );
    equal(
      userModel.callCounts.findOneAndUpdate,
      2,
      'admin-revoke retry miss: exactly two writes, never a third'
    );
    equal(
      userModel.callCounts.findById,
      2,
      'admin-revoke retry miss: exactly one preread plus one classification read'
    );
    equal(
      userModel.callCounts.findOneAndUpdate + userModel.callCounts.findById,
      4,
      'admin-revoke retry-miss total calls at the exact maximum bound of 4'
    );
  }
}

// =======================================================================
// Password change
// =======================================================================
{
  // Success, validation before hashing, projection minimal.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ tokenVersion: 5 })],
    });
    let hashCalls = 0;
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: async (plain) => {
        hashCalls += 1;
        return `hashed:${plain}`;
      },
    });
    const result = await service.changePassword({
      subjectId: USER_ID,
      expectedTokenVersion: 5,
      newPassword: 'NewPass123!',
    });
    deepEqual(
      result,
      { code: 'VERSION_INCREMENTED' },
      'password change success'
    );
    equal(
      userModel.store.get(USER_ID).password,
      'hashed:NewPass123!',
      'stored hash matches hashed plaintext'
    );
    equal(
      userModel.store.get(USER_ID).tokenVersion,
      6,
      'tokenVersion incremented alongside password'
    );
    equal(hashCalls, 1, 'hashing invoked exactly once');
    equal(
      userModel.callCounts.findOneAndUpdate,
      1,
      'exactly one write on success'
    );
    equal(
      userModel.callCounts.findById,
      0,
      'no classification read on success'
    );
  }

  // Validation occurs before hashing — invalid input causes zero hash calls.
  {
    const userModel = createFakeModel({ seed: [seedUser()] });
    let hashCalls = 0;
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: async () => {
        hashCalls += 1;
        return 'x';
      },
    });
    await service.changePassword({
      subjectId: 'bad',
      expectedTokenVersion: 5,
      newPassword: 'x',
    });
    equal(hashCalls, 0, 'hashing never invoked for invalid input');
  }

  // Real bcryptjs cost-12 boundary, using the default hasher.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ tokenVersion: 0 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
    });
    const result = await service.changePassword({
      subjectId: USER_ID,
      expectedTokenVersion: 0,
      newPassword: 'RealBcryptCost12!',
    });
    deepEqual(
      result,
      { code: 'VERSION_INCREMENTED' },
      'default bcryptjs hasher succeeds'
    );
    const stored = userModel.store.get(USER_ID).password;
    check(
      /^\$2[aby]\$12\$/.test(stored),
      'stored hash uses bcrypt cost factor 12'
    );
    check(stored !== 'RealBcryptCost12!', 'plaintext never stored');
  }

  // Hashing throw and hashing rejection both map to STORAGE_FAILURE, no write attempted.
  {
    const userModel = createFakeModel({ seed: [seedUser()] });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: () => {
        throw new Error('sync throw');
      },
    });
    deepEqual(
      await service.changePassword({
        subjectId: USER_ID,
        expectedTokenVersion: 5,
        newPassword: 'x',
      }),
      { code: 'STORAGE_FAILURE' },
      'synchronous hashing throw maps to STORAGE_FAILURE'
    );
    equal(
      userModel.callCounts.findOneAndUpdate,
      0,
      'no write attempted after a hashing throw'
    );
  }
  {
    const userModel = createFakeModel({ seed: [seedUser()] });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: () => Promise.reject(new Error('rejected')),
    });
    deepEqual(
      await service.changePassword({
        subjectId: USER_ID,
        expectedTokenVersion: 5,
        newPassword: 'x',
      }),
      { code: 'STORAGE_FAILURE' },
      'rejected hashing promise maps to STORAGE_FAILURE'
    );
    equal(
      userModel.callCounts.findOneAndUpdate,
      0,
      'no write attempted after a hashing rejection'
    );
  }

  // Zero automatic retries, exact classification, no exposure.
  {
    const cases = [
      ['VERSION_CONFLICT', 6, false], // current > expected
      ['VERSION_REGRESSION', 2, false],
      ['SUBJECT_STATE_MALFORMED', 'nope', false],
      ['VERSION_EXHAUSTED', MAX, false],
    ];
    for (const [expectedCode, storedValue, forcePrimaryMiss] of cases) {
      const userModel = createFakeModel({
        seed: [seedUser({ tokenVersion: storedValue })],
      });
      if (forcePrimaryMiss)
        userModel.onCall('findOneAndUpdate', 0, () => ({ forceMiss: true }));
      const service = createAccountSecurityMutationService({
        userModel,
        employerModel: createFakeModel(),
        hashPassword: fixedHash,
      });
      const result = await service.changePassword({
        subjectId: USER_ID,
        expectedTokenVersion: 5,
        newPassword: 'x',
      });
      deepEqual(
        result,
        { code: expectedCode },
        `password change classifies stored ${String(storedValue)} as ${expectedCode}`
      );
      equal(
        userModel.callCounts.findOneAndUpdate,
        1,
        'exactly one write attempt, never retried'
      );
      equal(
        userModel.callCounts.findById,
        1,
        'exactly one classification read'
      );
      deepEqual(
        Object.keys(result),
        ['code'],
        'result carries no field besides code'
      );
    }

    // current === expected after an artificially forced primary-write miss —
    // still no proof this specific password write occurred: VERSION_CONFLICT,
    // never retried, unlike the tokenVersion-only operations.
    {
      const userModel = createFakeModel({
        seed: [seedUser({ tokenVersion: 5 })],
      });
      userModel.onCall('findOneAndUpdate', 0, () => ({ forceMiss: true }));
      const service = createAccountSecurityMutationService({
        userModel,
        employerModel: createFakeModel(),
        hashPassword: fixedHash,
      });
      const result = await service.changePassword({
        subjectId: USER_ID,
        expectedTokenVersion: 5,
        newPassword: 'x',
      });
      deepEqual(
        result,
        { code: 'VERSION_CONFLICT' },
        'password change never retries even when reread shows current === expected'
      );
      equal(
        userModel.callCounts.findOneAndUpdate,
        1,
        'exactly one write attempt, no retry ever for password change'
      );
      equal(
        userModel.callCounts.findById,
        1,
        'exactly one classification read'
      );
    }
  }

  // Missing subject.
  {
    const userModel = createFakeModel({ seed: [] });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.changePassword({
        subjectId: MISSING_ID,
        expectedTokenVersion: 0,
        newPassword: 'x',
      }),
      { code: 'SUBJECT_MISSING' },
      'password change missing subject'
    );
  }
}

// =======================================================================
// Password reset — Design 1
// =======================================================================
{
  const hashedToken = 'a'.repeat(64);

  // Success clears fields, sets password, increments version.
  {
    const future = new Date(Date.now() + 60_000);
    const userModel = createFakeModel({
      seed: [
        seedUser({
          tokenVersion: 5,
          passwordResetToken: hashedToken,
          passwordResetExpires: future,
          mustChangePassword: true,
          tempPasswordExpires: future,
        }),
      ],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: async (p) => `hashed:${p}`,
    });
    const result = await service.resetPassword({
      hashedToken,
      newPassword: 'NewPass1!',
    });
    deepEqual(result, { code: 'VERSION_INCREMENTED' }, 'reset success');
    const doc = userModel.store.get(USER_ID);
    equal(doc.password, 'hashed:NewPass1!', 'password updated');
    equal(
      doc.tokenVersion,
      6,
      'tokenVersion incremented atomically with reset'
    );
    equal(doc.mustChangePassword, false, 'mustChangePassword cleared');
    check(!('passwordResetToken' in doc), 'passwordResetToken unset');
    check(!('passwordResetExpires' in doc), 'passwordResetExpires unset');
    check(!('tempPasswordExpires' in doc), 'tempPasswordExpires unset');
    equal(
      userModel.callCounts.findById,
      0,
      'zero classification reads, always'
    );
    equal(
      userModel.callCounts.findOneAndUpdate,
      1,
      'exactly one write, always'
    );
  }

  // Every miss cause returns the same uniform RESET_TOKEN_INVALID.
  {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    const missCases = [
      [
        'wrong token',
        [
          seedUser({
            passwordResetToken: 'b'.repeat(64),
            passwordResetExpires: future,
          }),
        ],
        'a'.repeat(64),
      ],
      [
        'expired token',
        [
          seedUser({
            passwordResetToken: hashedToken,
            passwordResetExpires: past,
          }),
        ],
        hashedToken,
      ],
      [
        'already consumed (no token field)',
        [seedUser({ tokenVersion: 5 })],
        hashedToken,
      ],
      [
        'malformed tokenVersion',
        [
          seedUser({
            passwordResetToken: hashedToken,
            passwordResetExpires: future,
            tokenVersion: 'nope',
          }),
        ],
        hashedToken,
      ],
      [
        'exhausted tokenVersion',
        [
          seedUser({
            passwordResetToken: hashedToken,
            passwordResetExpires: future,
            tokenVersion: MAX,
          }),
        ],
        hashedToken,
      ],
      ['missing subject', [], hashedToken],
    ];
    for (const [label, seed, tokenToUse] of missCases) {
      const userModel = createFakeModel({ seed });
      const service = createAccountSecurityMutationService({
        userModel,
        employerModel: createFakeModel(),
        hashPassword: fixedHash,
      });
      const result = await service.resetPassword({
        hashedToken: tokenToUse,
        newPassword: 'x',
      });
      deepEqual(
        result,
        { code: 'RESET_TOKEN_INVALID' },
        `reset miss (${label}) returns uniform RESET_TOKEN_INVALID`
      );
      equal(
        userModel.callCounts.findById,
        0,
        `no classification read for ${label}`
      );
      equal(
        userModel.callCounts.findOneAndUpdate,
        1,
        `exactly one write attempt for ${label}`
      );
    }
  }
}

// =======================================================================
// Suspend
// =======================================================================
{
  // Success.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'active', tokenVersion: 5 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.suspend({ realm: 'user', subjectId: USER_ID });
    deepEqual(
      result,
      { code: 'SUBJECT_STATE_UPDATED' },
      'suspend success uses SUBJECT_STATE_UPDATED, not VERSION_INCREMENTED'
    );
    const doc = userModel.store.get(USER_ID);
    equal(doc.accountStatus, 'suspended', 'accountStatus transitioned');
    equal(doc.tokenVersion, 6, 'tokenVersion incremented alongside');
  }

  // Employer realm supported.
  {
    const employerModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'active' })],
    });
    const service = createAccountSecurityMutationService({
      userModel: createFakeModel(),
      employerModel,
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.suspend({ realm: 'employer', subjectId: USER_ID }),
      { code: 'SUBJECT_STATE_UPDATED' },
      'suspend succeeds for employer realm'
    );
  }

  // Already suspended.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'suspended', tokenVersion: 5 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.suspend({ realm: 'user', subjectId: USER_ID });
    deepEqual(
      result,
      { code: 'SUBJECT_STATE_ALREADY_APPLIED' },
      'already-suspended is idempotent success'
    );
    equal(userModel.store.get(USER_ID).tokenVersion, 5, 'no second increment');
  }

  // Malformed accountStatus vs malformed tokenVersion precedence.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'active', tokenVersion: 'nope' })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.suspend({ realm: 'user', subjectId: USER_ID }),
      { code: 'SUBJECT_STATE_MALFORMED' },
      'malformed tokenVersion precedes accountStatus checks'
    );
  }
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'banned', tokenVersion: 5 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.suspend({ realm: 'user', subjectId: USER_ID }),
      { code: 'SUBJECT_STATE_INVALID' },
      'malformed accountStatus (outside enum) classified distinctly from malformed tokenVersion'
    );
  }
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'active', tokenVersion: MAX })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.suspend({ realm: 'user', subjectId: USER_ID }),
      { code: 'VERSION_EXHAUSTED' },
      'exhausted tokenVersion precedes accountStatus checks'
    );
  }

  // Missing subject.
  {
    const userModel = createFakeModel({ seed: [] });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.suspend({ realm: 'user', subjectId: MISSING_ID }),
      { code: 'SUBJECT_MISSING' },
      'suspend missing subject'
    );
  }

  // Retry success — primary write forced to miss, state unchanged, retry lands.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'active', tokenVersion: 5 })],
    });
    userModel.onCall('findOneAndUpdate', 0, () => ({ forceMiss: true }));
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.suspend({ realm: 'user', subjectId: USER_ID });
    deepEqual(
      result,
      { code: 'SUBJECT_STATE_UPDATED' },
      'suspend retry succeeds when state unchanged'
    );
    equal(
      userModel.callCounts.findOneAndUpdate,
      2,
      'exactly two write attempts: primary + one retry'
    );
    equal(userModel.callCounts.findById, 1, 'exactly one classification read');
  }

  // Retry miss — classify-to-retry race for a state operation: a
  // conflicting concurrent transition lands strictly between the
  // classification read and the retry write's own filter-match.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'active', tokenVersion: 5 })],
    });
    userModel.onCall('findOneAndUpdate', 0, () => ({ forceMiss: true }));
    userModel.onCall('findOneAndUpdate', 1, (store) => {
      store.get(USER_ID).accountStatus = 'suspended';
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.suspend({ realm: 'user', subjectId: USER_ID });
    deepEqual(
      result,
      { code: 'CLASSIFICATION_STALE' },
      'suspend retry miss after a classify-to-retry race returns CLASSIFICATION_STALE'
    );
    equal(userModel.callCounts.findOneAndUpdate, 2, 'no third write attempted');
    equal(userModel.callCounts.findById, 1, 'no second classification read');
  }
}

// =======================================================================
// Reactivation — Mode A (no invalidation) and Mode B (with invalidation)
// =======================================================================
{
  // Mode A success — tokenVersion never touched.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'suspended', tokenVersion: 5 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.reactivate({
      realm: 'user',
      subjectId: USER_ID,
      alsoInvalidateAccessTokens: false,
    });
    deepEqual(
      result,
      { code: 'SUBJECT_STATE_UPDATED' },
      'reactivate Mode A success'
    );
    const doc = userModel.store.get(USER_ID);
    equal(doc.accountStatus, 'active', 'accountStatus transitioned');
    equal(doc.tokenVersion, 5, 'tokenVersion completely untouched in Mode A');
    equal(
      userModel.callCounts.findOneAndUpdate,
      1,
      'Mode A success: exactly one write, within the maximum-3 bound'
    );
    equal(
      userModel.callCounts.findById,
      0,
      'Mode A success: no classification read needed'
    );
  }

  // Mode A default (flag omitted).
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'suspended', tokenVersion: 5 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.reactivate({
      realm: 'user',
      subjectId: USER_ID,
    });
    deepEqual(
      result,
      { code: 'SUBJECT_STATE_UPDATED' },
      'reactivate defaults to Mode A when flag omitted'
    );
    equal(
      userModel.store.get(USER_ID).tokenVersion,
      5,
      'default Mode A leaves tokenVersion untouched'
    );
  }

  // Mode A: malformed tokenVersion has no effect at all (never read).
  {
    const userModel = createFakeModel({
      seed: [
        seedUser({
          accountStatus: 'suspended',
          tokenVersion: 'malformed-but-irrelevant',
        }),
      ],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.reactivate({
      realm: 'user',
      subjectId: USER_ID,
      alsoInvalidateAccessTokens: false,
    });
    deepEqual(
      result,
      { code: 'SUBJECT_STATE_UPDATED' },
      'Mode A succeeds regardless of malformed tokenVersion, since it is never read'
    );
  }

  // Mode A: already active.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'active' })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.reactivate({
        realm: 'user',
        subjectId: USER_ID,
        alsoInvalidateAccessTokens: false,
      }),
      { code: 'SUBJECT_STATE_ALREADY_APPLIED' },
      'Mode A already-active idempotent'
    );
  }

  // Mode A: malformed accountStatus.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'banned' })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.reactivate({
        realm: 'user',
        subjectId: USER_ID,
        alsoInvalidateAccessTokens: false,
      }),
      { code: 'SUBJECT_STATE_INVALID' },
      'Mode A malformed accountStatus'
    );
  }

  // Mode B success — same shape as suspend.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'suspended', tokenVersion: 5 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.reactivate({
      realm: 'user',
      subjectId: USER_ID,
      alsoInvalidateAccessTokens: true,
    });
    deepEqual(
      result,
      { code: 'SUBJECT_STATE_UPDATED' },
      'reactivate Mode B success'
    );
    const doc = userModel.store.get(USER_ID);
    equal(doc.accountStatus, 'active', 'accountStatus transitioned');
    equal(doc.tokenVersion, 6, 'tokenVersion incremented in Mode B');
    equal(
      userModel.callCounts.findOneAndUpdate,
      1,
      'Mode B success: exactly one write, within the maximum-3 bound'
    );
    equal(
      userModel.callCounts.findById,
      0,
      'Mode B success: no classification read needed'
    );
  }

  // Mode B retry-miss — classify-to-retry race, exact call bound (maximum 3).
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'suspended', tokenVersion: 5 })],
    });
    userModel.onCall('findOneAndUpdate', 0, () => ({ forceMiss: true }));
    userModel.onCall('findOneAndUpdate', 1, (store) => {
      store.get(USER_ID).accountStatus = 'active';
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.reactivate({
      realm: 'user',
      subjectId: USER_ID,
      alsoInvalidateAccessTokens: true,
    });
    deepEqual(
      result,
      { code: 'CLASSIFICATION_STALE' },
      'Mode B retry miss after classify-to-retry race'
    );
    equal(
      userModel.callCounts.findOneAndUpdate,
      2,
      'Mode B retry miss: exactly two writes (primary + retry), never a third'
    );
    equal(
      userModel.callCounts.findById,
      1,
      'Mode B retry miss: exactly one classification read, never two'
    );
    equal(
      userModel.callCounts.findOneAndUpdate + userModel.callCounts.findById,
      3,
      'Mode B retry-miss total calls at the exact maximum bound of 3'
    );
  }

  // Mode B: malformed / exhausted tokenVersion precede accountStatus checks.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'suspended', tokenVersion: NaN })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.reactivate({
        realm: 'user',
        subjectId: USER_ID,
        alsoInvalidateAccessTokens: true,
      }),
      { code: 'SUBJECT_STATE_MALFORMED' },
      'Mode B malformed tokenVersion'
    );
  }
  {
    const userModel = createFakeModel({
      seed: [seedUser({ accountStatus: 'suspended', tokenVersion: MAX })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.reactivate({
        realm: 'user',
        subjectId: USER_ID,
        alsoInvalidateAccessTokens: true,
      }),
      { code: 'VERSION_EXHAUSTED' },
      'Mode B exhausted tokenVersion'
    );
  }
}

// =======================================================================
// Role change
// =======================================================================
{
  // Success.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ role: 'User', tokenVersion: 5 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.changeRole({
      subjectId: USER_ID,
      expectedPriorRole: 'User',
      newRole: 'Editor',
    });
    deepEqual(result, { code: 'SUBJECT_STATE_UPDATED' }, 'role change success');
    const doc = userModel.store.get(USER_ID);
    equal(doc.role, 'Editor', 'role transitioned');
    equal(
      doc.tokenVersion,
      6,
      'tokenVersion incremented alongside role change'
    );
    equal(
      userModel.callCounts.findOneAndUpdate,
      1,
      'role change success: exactly one write, within the maximum-3 bound'
    );
    equal(
      userModel.callCounts.findById,
      0,
      'role change success: no classification read needed'
    );
  }

  // Retry-miss — classify-to-retry race, exact call bound (maximum 3).
  {
    const userModel = createFakeModel({
      seed: [seedUser({ role: 'User', tokenVersion: 5 })],
    });
    userModel.onCall('findOneAndUpdate', 0, () => ({ forceMiss: true }));
    userModel.onCall('findOneAndUpdate', 1, (store) => {
      store.get(USER_ID).role = 'Editor';
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.changeRole({
      subjectId: USER_ID,
      expectedPriorRole: 'User',
      newRole: 'Editor',
    });
    deepEqual(
      result,
      { code: 'CLASSIFICATION_STALE' },
      'role change retry miss after classify-to-retry race'
    );
    equal(
      userModel.callCounts.findOneAndUpdate,
      2,
      'role change retry miss: exactly two writes, never a third'
    );
    equal(
      userModel.callCounts.findById,
      1,
      'role change retry miss: exactly one classification read, never two'
    );
    equal(
      userModel.callCounts.findOneAndUpdate + userModel.callCounts.findById,
      3,
      'role change retry-miss total calls at the exact maximum bound of 3'
    );
  }

  // Already at target role.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ role: 'Editor', tokenVersion: 5 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.changeRole({
        subjectId: USER_ID,
        expectedPriorRole: 'User',
        newRole: 'Editor',
      }),
      { code: 'SUBJECT_STATE_ALREADY_APPLIED' },
      'role already at target idempotent'
    );
  }

  // Conflicting valid role — SUBJECT_STATE_CONFLICT is live/reachable here (5-value enum).
  {
    const userModel = createFakeModel({
      seed: [seedUser({ role: 'Moderator', tokenVersion: 5 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    const result = await service.changeRole({
      subjectId: USER_ID,
      expectedPriorRole: 'User',
      newRole: 'Editor',
    });
    deepEqual(
      result,
      { code: 'SUBJECT_STATE_CONFLICT' },
      'conflicting valid role change is a real conflict'
    );
  }

  // Malformed role distinguished from conflicting valid role.
  {
    const userModel = createFakeModel({
      seed: [seedUser({ role: 'NotARole', tokenVersion: 5 })],
    });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.changeRole({
        subjectId: USER_ID,
        expectedPriorRole: 'User',
        newRole: 'Editor',
      }),
      { code: 'SUBJECT_STATE_INVALID' },
      'malformed stored role classified distinctly from a valid conflict'
    );
  }

  // Missing subject.
  {
    const userModel = createFakeModel({ seed: [] });
    const service = createAccountSecurityMutationService({
      userModel,
      employerModel: createFakeModel(),
      hashPassword: fixedHash,
    });
    deepEqual(
      await service.changeRole({
        subjectId: MISSING_ID,
        expectedPriorRole: 'User',
        newRole: 'Editor',
      }),
      { code: 'SUBJECT_MISSING' },
      'role change missing subject'
    );
  }
}

// =======================================================================
// Admin temporary-password reset: password + tokenVersion are one write
// =======================================================================
{
  const future = new Date(Date.now() + 60_000);
  const userModel = createFakeModel({ seed: [seedUser({ tokenVersion: 5 })] });
  const employerModel = createFakeModel({
    seed: [seedUser({ tokenVersion: 9 })],
  });
  const service = createAccountSecurityMutationService({
    userModel,
    employerModel,
    hashPassword: fixedHash,
  });

  deepEqual(
    await service.adminResetUserPassword({
      subjectId: USER_ID,
      newPassword: 'TemporaryPassword1',
      tempPasswordExpires: future,
    }),
    { code: 'VERSION_INCREMENTED' },
    'Admin reset atomically changes password and advances access authority'
  );
  const user = userModel.store.get(USER_ID);
  equal(user.password, 'fixed-hash-value', 'Admin reset stores only the hash');
  equal(user.tokenVersion, 6, 'Admin reset advances tokenVersion exactly once');
  equal(user.mustChangePassword, true, 'Admin reset requires password change');
  equal(
    user.tempPasswordExpires,
    future,
    'Admin reset records the bounded temporary-password expiry'
  );
  equal(userModel.callCounts.findOneAndUpdate, 1, 'Admin reset uses one write');
  equal(
    employerModel.store.get(USER_ID).tokenVersion,
    9,
    'Admin User reset cannot mutate the Employer realm'
  );
}

{
  const userModel = createFakeModel({ seed: [seedUser()] });
  const service = createAccountSecurityMutationService({
    userModel,
    employerModel: createFakeModel(),
    hashPassword: fixedHash,
  });
  deepEqual(
    await service.adminResetUserPassword({
      subjectId: USER_ID,
      newPassword: 'TemporaryPassword1',
      tempPasswordExpires: new Date(Date.now() - 1),
    }),
    { code: 'INVALID_INPUT' },
    'Expired Admin temporary-password authority is rejected before writing'
  );
  equal(
    userModel.callCounts.findOneAndUpdate,
    0,
    'Invalid Admin reset writes nothing'
  );
}

{
  const userModel = createFakeModel({
    seed: [seedUser()],
    throwOn: 'findOneAndUpdate',
  });
  const service = createAccountSecurityMutationService({
    userModel,
    employerModel: createFakeModel(),
    hashPassword: fixedHash,
  });
  deepEqual(
    await service.adminResetUserPassword({
      subjectId: USER_ID,
      newPassword: 'TemporaryPassword1',
      tempPasswordExpires: new Date(Date.now() + 60_000),
    }),
    { code: 'STORAGE_FAILURE' },
    'Admin reset fails closed on subject storage failure'
  );
}

// =======================================================================
// Cross-cutting: no SEC-3D.1 runtime import, exact result-key shape everywhere
// =======================================================================
{
  const hashedToken = 'e'.repeat(64);
  const future = new Date(Date.now() + 60_000);
  const employerModel = createFakeModel({
    seed: [
      seedUser({
        tokenVersion: 2,
        passwordResetToken: hashedToken,
        passwordResetExpires: future,
      }),
    ],
  });
  const userModel = createFakeModel({ seed: [seedUser()] });
  const service = createAccountSecurityMutationService({
    userModel,
    employerModel,
    hashPassword: async (plain) => `employer-hash:${plain}`,
  });

  deepEqual(
    await service.changePassword({
      realm: 'employer',
      subjectId: USER_ID,
      expectedTokenVersion: 2,
      newPassword: 'EmployerPassword1',
    }),
    { code: 'VERSION_INCREMENTED' },
    'Employer password and tokenVersion change atomically'
  );
  equal(
    employerModel.store.get(USER_ID).tokenVersion,
    3,
    'Employer version advanced'
  );
  equal(
    userModel.store.get(USER_ID).tokenVersion,
    5,
    'User realm remains untouched'
  );

  deepEqual(
    await service.resetPassword({
      realm: 'employer',
      hashedToken,
      newPassword: 'EmployerReset1',
    }),
    { code: 'VERSION_INCREMENTED' },
    'Employer reset token is atomically consumed'
  );
  const employer = employerModel.store.get(USER_ID);
  equal(employer.tokenVersion, 4, 'Employer reset advances tokenVersion');
  check(
    !('passwordResetToken' in employer),
    'Employer reset token hash is cleared'
  );
  check(
    !('passwordResetExpires' in employer),
    'Employer reset expiry is cleared'
  );
  deepEqual(
    await service.resetPassword({
      realm: 'employer',
      hashedToken,
      newPassword: 'EmployerReset2',
    }),
    { code: 'RESET_TOKEN_INVALID' },
    'Employer reset token is single-use'
  );
}

{
  const source = await import('node:fs').then((fs) =>
    fs.readFileSync(
      new URL(
        '../services/auth/AccountSecurityMutationService.js',
        import.meta.url
      ),
      'utf8'
    )
  );
  check(
    !/^import .*SessionFamilyRevocation/m.test(source),
    'SEC-3D.2 production module never imports SEC-3D.1 (a doc-comment mention of the pattern is not a runtime import)'
  );
}

console.log(`accountSecurityMutation.test.js: ${assertions} assertions passed`);
