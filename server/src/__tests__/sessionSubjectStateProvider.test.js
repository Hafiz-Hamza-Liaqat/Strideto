/**
 * SEC-3C — dormant subject-state provider tests, against injected model
 * doubles (no live MongoDB connection).
 * Run: node src/__tests__/sessionSubjectStateProvider.test.js
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createSessionSubjectStateProvider } from '../services/auth/SessionSubjectStateProvider.js';

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

equal(
  mongoose.connection.readyState,
  0,
  'no live database connection is used by this test'
);

const VALID_ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439099';

function createFakeModel(docsById, { throwOn } = {}) {
  const calls = [];
  return {
    calls,
    async findById(id, projection) {
      calls.push({ id, projection });
      if (throwOn) throw new Error('simulated storage failure');
      const doc = docsById.get(id);
      if (!doc) return null;
      // Simulate a real minimal-projection read: only the requested
      // fields (plus _id) are ever returned.
      const projected = { _id: id };
      for (const key of Object.keys(projection || {})) {
        if (projection[key]) projected[key] = doc[key];
      }
      return projected;
    },
  };
}

// --- Constructor validation ---
assert.throws(
  () => createSessionSubjectStateProvider({ userModel: {} }),
  TypeError
);
assertions += 1;
assert.throws(
  () => createSessionSubjectStateProvider({ employerModel: {} }),
  TypeError
);
assertions += 1;

// --- Input validation, before any model call ---
{
  const userModel = createFakeModel(new Map());
  const employerModel = createFakeModel(new Map());
  const provider = createSessionSubjectStateProvider({
    userModel,
    employerModel,
  });

  equal(
    (await provider.getSubjectState({ realm: 'admin', subjectId: VALID_ID }))
      .code,
    'INVALID_INPUT',
    'an invalid realm is rejected'
  );
  equal(
    (await provider.getSubjectState({ realm: 'user', subjectId: '' })).code,
    'INVALID_INPUT',
    'an empty subjectId is rejected'
  );
  equal(
    (
      await provider.getSubjectState({
        realm: 'user',
        subjectId: 'not-an-object-id',
      })
    ).code,
    'INVALID_INPUT',
    'a malformed subjectId is rejected'
  );
  equal(
    (
      await provider.getSubjectState({
        realm: 'user',
        subjectId: VALID_ID,
        expectedTokenVersion: 1.5,
      })
    ).code,
    'INVALID_INPUT',
    'a fractional expectedTokenVersion is rejected'
  );
  equal(
    (
      await provider.getSubjectState({
        realm: 'user',
        subjectId: VALID_ID,
        expectedTokenVersion: -1,
      })
    ).code,
    'INVALID_INPUT',
    'a negative expectedTokenVersion is rejected'
  );
  equal(
    (
      await provider.getSubjectState({
        realm: 'user',
        subjectId: VALID_ID,
        expectedTokenVersion: 'x',
      })
    ).code,
    'INVALID_INPUT',
    'a non-number expectedTokenVersion is rejected'
  );
  equal(
    userModel.calls.length,
    0,
    'no model call occurs for any rejected input'
  );
  equal(
    employerModel.calls.length,
    0,
    'no model call occurs for any rejected input (employer)'
  );
}

// --- Active subject, both realms ---
for (const realm of ['user', 'employer']) {
  const docs = new Map([
    [VALID_ID, { accountStatus: 'active', tokenVersion: 3 }],
  ]);
  const userModel = createFakeModel(realm === 'user' ? docs : new Map());
  const employerModel = createFakeModel(
    realm === 'employer' ? docs : new Map()
  );
  const provider = createSessionSubjectStateProvider({
    userModel,
    employerModel,
  });

  const result = await provider.getSubjectState({ realm, subjectId: VALID_ID });
  equal(
    result.code,
    'SUBJECT_ACTIVE',
    `an active ${realm} subject with no expected version is SUBJECT_ACTIVE`
  );
  equal(
    result.tokenVersion,
    3,
    `the current tokenVersion is available internally for ${realm}`
  );

  const matching = await provider.getSubjectState({
    realm,
    subjectId: VALID_ID,
    expectedTokenVersion: 3,
  });
  equal(
    matching.code,
    'SUBJECT_ACTIVE',
    `a matching expected version is SUBJECT_ACTIVE for ${realm}`
  );

  const mismatch = await provider.getSubjectState({
    realm,
    subjectId: VALID_ID,
    expectedTokenVersion: 4,
  });
  equal(
    mismatch.code,
    'TOKEN_VERSION_MISMATCH',
    `a mismatched expected version is TOKEN_VERSION_MISMATCH for ${realm}`
  );
}

// --- expectedTokenVersion: 0 is not treated as absent or false
// (SEC-3C.2A) — the provider must use `!== undefined`, not a truthy
// check, so a legitimate zero must be distinguished from "no expected
// version supplied". ---
for (const realm of ['user', 'employer']) {
  // Matching zero: stored tokenVersion is genuinely 0 and expectedTokenVersion
  // is genuinely 0 — must resolve as a real match, not as "no check requested".
  {
    const docs = new Map([
      [VALID_ID, { accountStatus: 'active', tokenVersion: 0 }],
    ]);
    const userModel = createFakeModel(realm === 'user' ? docs : new Map());
    const employerModel = createFakeModel(
      realm === 'employer' ? docs : new Map()
    );
    for (const m of [userModel, employerModel]) {
      m.create = () => {
        throw new Error('the provider must never write');
      };
      m.findOneAndUpdate = () => {
        throw new Error('the provider must never write');
      };
    }
    const provider = createSessionSubjectStateProvider({
      userModel,
      employerModel,
    });
    const model = realm === 'user' ? userModel : employerModel;

    const result = await provider.getSubjectState({
      realm,
      subjectId: VALID_ID,
      expectedTokenVersion: 0,
    });
    equal(
      result.code,
      'SUBJECT_ACTIVE',
      `expectedTokenVersion: 0 matching a stored tokenVersion of 0 is SUBJECT_ACTIVE for ${realm}`
    );
    equal(
      result.tokenVersion,
      0,
      `the returned internal tokenVersion is exactly 0 for ${realm}`
    );
    equal(
      model.calls.length,
      1,
      `exactly one authoritative read occurs for the ${realm} zero-match case`
    );
    deepEqual(
      model.calls[0].projection,
      { tokenVersion: 1, accountStatus: 1 },
      `the exact minimal projection is requested for the ${realm} zero-match case`
    );
    check(
      !('subjectId' in result) && !('_id' in result),
      `no identifier leaks into the ${realm} zero-match result`
    );
  }

  // Mismatching zero: expectedTokenVersion 0 must still be enforced as a
  // real check against a genuinely different stored version, not silently
  // skipped as if it were absent.
  {
    const docs = new Map([
      [VALID_ID, { accountStatus: 'active', tokenVersion: 1 }],
    ]);
    const userModel = createFakeModel(realm === 'user' ? docs : new Map());
    const employerModel = createFakeModel(
      realm === 'employer' ? docs : new Map()
    );
    for (const m of [userModel, employerModel]) {
      m.create = () => {
        throw new Error('the provider must never write');
      };
      m.findOneAndUpdate = () => {
        throw new Error('the provider must never write');
      };
    }
    const provider = createSessionSubjectStateProvider({
      userModel,
      employerModel,
    });
    const model = realm === 'user' ? userModel : employerModel;

    const result = await provider.getSubjectState({
      realm,
      subjectId: VALID_ID,
      expectedTokenVersion: 0,
    });
    equal(
      result.code,
      'TOKEN_VERSION_MISMATCH',
      `expectedTokenVersion: 0 against a stored tokenVersion of 1 is TOKEN_VERSION_MISMATCH for ${realm}`
    );
    check(
      !('tokenVersion' in result),
      `no tokenVersion value is exposed on the ${realm} zero-mismatch result`
    );
    equal(
      model.calls.length,
      1,
      `exactly one authoritative read occurs for the ${realm} zero-mismatch case`
    );
  }
}

// --- Missing subject, both realms ---
for (const realm of ['user', 'employer']) {
  const userModel = createFakeModel(new Map());
  const employerModel = createFakeModel(new Map());
  const provider = createSessionSubjectStateProvider({
    userModel,
    employerModel,
  });
  const result = await provider.getSubjectState({ realm, subjectId: OTHER_ID });
  equal(
    result.code,
    'SUBJECT_MISSING',
    `a missing ${realm} subject is SUBJECT_MISSING`
  );
}

// --- Suspended subject, both realms (the only inactive status the actual schema supports) ---
for (const realm of ['user', 'employer']) {
  const docs = new Map([
    [VALID_ID, { accountStatus: 'suspended', tokenVersion: 0 }],
  ]);
  const userModel = createFakeModel(realm === 'user' ? docs : new Map());
  const employerModel = createFakeModel(
    realm === 'employer' ? docs : new Map()
  );
  const provider = createSessionSubjectStateProvider({
    userModel,
    employerModel,
  });
  const result = await provider.getSubjectState({ realm, subjectId: VALID_ID });
  equal(
    result.code,
    'SUBJECT_INACTIVE',
    `a suspended ${realm} subject is SUBJECT_INACTIVE`
  );
}

// --- No "deleted" status exists in the current User/Employer schema
// (accountStatus enum is exactly ['active', 'suspended'] — confirmed by
// direct inspection of server/src/models/User.js and Employer.js). A
// hypothetical deleted/other value therefore falls through the same
// "unknown status" path proven below, not a separate deleted-specific
// path — there is nothing further to test here beyond that. ---

// --- Unknown/malformed accountStatus never treated as active ---
for (const status of ['deleted', 'pending', '', null, undefined, 42]) {
  const docs = new Map([
    [VALID_ID, { accountStatus: status, tokenVersion: 0 }],
  ]);
  const userModel = createFakeModel(docs);
  const employerModel = createFakeModel(new Map());
  const provider = createSessionSubjectStateProvider({
    userModel,
    employerModel,
  });
  const result = await provider.getSubjectState({
    realm: 'user',
    subjectId: VALID_ID,
  });
  equal(
    result.code,
    'SUBJECT_STATE_INVALID',
    `an unknown accountStatus (${JSON.stringify(status)}) fails closed, never active`
  );
}

// --- Malformed tokenVersion never treated as active ---
for (const tokenVersion of [1.5, -1, 'x', null, undefined, NaN, Infinity]) {
  const docs = new Map([[VALID_ID, { accountStatus: 'active', tokenVersion }]]);
  const userModel = createFakeModel(docs);
  const employerModel = createFakeModel(new Map());
  const provider = createSessionSubjectStateProvider({
    userModel,
    employerModel,
  });
  const result = await provider.getSubjectState({
    realm: 'user',
    subjectId: VALID_ID,
  });
  equal(
    result.code,
    'SUBJECT_STATE_INVALID',
    `a malformed tokenVersion (${String(tokenVersion)}) fails closed, never active`
  );
}

// --- Storage failure ---
{
  const userModel = createFakeModel(new Map(), { throwOn: true });
  const employerModel = createFakeModel(new Map());
  const provider = createSessionSubjectStateProvider({
    userModel,
    employerModel,
  });
  const result = await provider.getSubjectState({
    realm: 'user',
    subjectId: VALID_ID,
  });
  equal(result.code, 'STORAGE_FAILURE', 'a storage error is normalized safely');
}

// --- Correct minimal projection, one authoritative read per validation, no writes ---
{
  const docs = new Map([
    [
      VALID_ID,
      {
        accountStatus: 'active',
        tokenVersion: 1,
        password: 'should-never-be-selected',
        email: 'should-never-be-selected',
      },
    ],
  ]);
  const userModel = createFakeModel(docs);
  userModel.create = () => {
    throw new Error('the provider must never write');
  };
  userModel.findOneAndUpdate = () => {
    throw new Error('the provider must never write');
  };
  const employerModel = createFakeModel(new Map());
  const provider = createSessionSubjectStateProvider({
    userModel,
    employerModel,
  });

  const result = await provider.getSubjectState({
    realm: 'user',
    subjectId: VALID_ID,
    expectedTokenVersion: 1,
  });
  equal(result.code, 'SUBJECT_ACTIVE', 'the call succeeds');
  equal(
    userModel.calls.length,
    1,
    'exactly one authoritative read occurs per validation'
  );
  deepEqual(
    userModel.calls[0].projection,
    { tokenVersion: 1, accountStatus: 1 },
    'the exact minimal projection is requested — nothing else'
  );
  check(
    !('password' in result),
    'no password field leaks into the safe result'
  );
  check(!('email' in result), 'no email field leaks into the safe result');
  check(!('subjectId' in result), 'no subject ID leaks into the safe result');
}

// --- No process-local cache: two consecutive calls each perform their own read ---
{
  const docs = new Map([
    [VALID_ID, { accountStatus: 'active', tokenVersion: 5 }],
  ]);
  const userModel = createFakeModel(docs);
  const employerModel = createFakeModel(new Map());
  const provider = createSessionSubjectStateProvider({
    userModel,
    employerModel,
  });

  await provider.getSubjectState({ realm: 'user', subjectId: VALID_ID });
  await provider.getSubjectState({ realm: 'user', subjectId: VALID_ID });
  equal(
    userModel.calls.length,
    2,
    'no cache is used — each call performs its own fresh read'
  );

  // Mutate the underlying store between calls and confirm the provider
  // observes the change immediately (zero staleness by construction).
  docs.set(VALID_ID, { accountStatus: 'suspended', tokenVersion: 5 });
  const afterMutation = await provider.getSubjectState({
    realm: 'user',
    subjectId: VALID_ID,
  });
  equal(
    afterMutation.code,
    'SUBJECT_INACTIVE',
    'a status change is observed immediately on the very next call, with no stale positive result'
  );
}

console.log(
  `sessionSubjectStateProvider.test.js: ${assertions} assertions passed`
);
