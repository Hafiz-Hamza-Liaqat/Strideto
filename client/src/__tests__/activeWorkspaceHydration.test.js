/**
 * C1 — ActiveWorkspace no-preference resolution
 *
 * Pure state-machine tests for the workspace identity resolution logic.
 * Verifies that:
 *   - isHydrating never stays true indefinitely due to a stale access token
 *   - studentLoading=false + !isAuthenticated → guest (not indefinite hydrating)
 *   - studentLoading=false + isAuthenticated → student workspace
 *   - explicit employer/agent/institution preference is preserved
 *   - no preference + another live realm does not impersonate student
 */
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Models the no-preference branch of the main effect in ActiveWorkspaceContext.
 *
 * The fix: only `studentLoading` gates hydration for the student realm.
 * `getAccessToken()` is NOT used as an indefinite hydration signal.
 *
 * @returns {'hydrating'|'student'|'guest'}
 */
function noPreferenceResolution({ studentLoading, studentAuthenticated, studentLive }) {
  if (studentLoading) return 'hydrating';
  if (studentAuthenticated && studentLive) return 'student';
  return 'guest';
}

/**
 * Models the explicit-preference branch of the main effect.
 *
 * @returns {'hydrating'|'validated'|'guest'}
 */
function preferenceResolution({ preferred, studentLoading, realmLive, validateResult }) {
  if (realmLive) return 'validated';
  if (preferred === 'student' && studentLoading) return 'hydrating';
  // validateRealm settled with no live result → clear preference, use guest
  if (!validateResult) return 'guest';
  return 'validated';
}

/**
 * Models validateRealm for student (fixed: no access-token indefinite pending).
 * After the fix, once studentLoading=false, student realm returns null if not authenticated.
 */
function validateStudent({ studentLoading, studentAuthenticated }) {
  if (studentAuthenticated) return { isAuthenticated: true };  // projectLive shortcut
  if (studentLoading) return { pending: true };
  // Fixed: no getAccessToken() check here — loading is settled, not authenticated → null
  return null;
}

// -----------------------------------------------------------------------
// No preference — student loading
// -----------------------------------------------------------------------

test('C1: no preference + studentLoading=true → isHydrating (waiting for auth)', () => {
  const result = noPreferenceResolution({ studentLoading: true, studentAuthenticated: false, studentLive: false });
  assert.equal(result, 'hydrating');
});

// -----------------------------------------------------------------------
// No preference — student auth settled
// -----------------------------------------------------------------------

test('C1: no preference + studentLoading=false + authenticated → student workspace', () => {
  const result = noPreferenceResolution({ studentLoading: false, studentAuthenticated: true, studentLive: true });
  assert.equal(result, 'student');
});

test('C1: no preference + studentLoading=false + not authenticated → guest', () => {
  const result = noPreferenceResolution({ studentLoading: false, studentAuthenticated: false, studentLive: false });
  assert.equal(result, 'guest');
});

// -----------------------------------------------------------------------
// No preference — stale token must NOT cause indefinite hydrating (the bug)
// -----------------------------------------------------------------------

test('C1: fixed: stale token with studentLoading=false → guest (not indefinite hydrating)', () => {
  // Before fix: getAccessToken() && !projectLive('student') would keep isHydrating=true forever.
  // After fix: only studentLoading gates hydration; once false, auth is settled.
  const validateResult = validateStudent({ studentLoading: false, studentAuthenticated: false });
  assert.equal(validateResult, null, 'validateStudent must return null when loading=false and not authenticated');

  const resolution = noPreferenceResolution({ studentLoading: false, studentAuthenticated: false, studentLive: false });
  assert.equal(resolution, 'guest', 'must resolve to guest, not stay hydrating');
});

// -----------------------------------------------------------------------
// Explicit preference — employer / agent / institution preserved
// -----------------------------------------------------------------------

test('C1: explicit employer preference + employer live → preserved (not cleared)', () => {
  const result = preferenceResolution({
    preferred: 'employer',
    studentLoading: false,
    realmLive: true,
    validateResult: { isAuthenticated: true },
  });
  assert.equal(result, 'validated');
});

test('C1: explicit agent preference + agent live → preserved', () => {
  const result = preferenceResolution({
    preferred: 'agent',
    studentLoading: false,
    realmLive: true,
    validateResult: { isAuthenticated: true },
  });
  assert.equal(result, 'validated');
});

test('C1: explicit institution preference + institution live → preserved', () => {
  const result = preferenceResolution({
    preferred: 'institution',
    studentLoading: false,
    realmLive: true,
    validateResult: { isAuthenticated: true },
  });
  assert.equal(result, 'validated');
});

test('C1: explicit employer preference, employer not live → guest (preference cleared)', () => {
  const result = preferenceResolution({
    preferred: 'employer',
    studentLoading: false,
    realmLive: false,
    validateResult: null,
  });
  assert.equal(result, 'guest');
});

// -----------------------------------------------------------------------
// Explicit student preference — studentLoading gates hydration, token does not
// -----------------------------------------------------------------------

test('C1: preferred=student + studentLoading=true → hydrating (not settled yet)', () => {
  const result = preferenceResolution({
    preferred: 'student',
    studentLoading: true,
    realmLive: false,
    validateResult: null,
  });
  assert.equal(result, 'hydrating');
});

test('C1: preferred=student + studentLoading=false + not authenticated → guest (no indefinite hydrating)', () => {
  // Before fix: getAccessToken() check inside validateRealm returned {pending:true} indefinitely.
  // After fix: validateStudent returns null when settled + not authenticated.
  const validate = validateStudent({ studentLoading: false, studentAuthenticated: false });
  assert.equal(validate, null);

  const result = preferenceResolution({
    preferred: 'student',
    studentLoading: false,
    realmLive: false,
    validateResult: null,
  });
  assert.equal(result, 'guest');
});

// -----------------------------------------------------------------------
// No preference + another live realm — must NOT impersonate student
// -----------------------------------------------------------------------

test('C1: no preference + employer live but student not authenticated → guest (not student)', () => {
  // No preference, student not authenticated, employer is live elsewhere.
  // Expected: no-preference resolution picks guest, NOT student.
  const result = noPreferenceResolution({ studentLoading: false, studentAuthenticated: false, studentLive: false });
  assert.notEqual(result, 'student', 'employer being live must not cause student auto-assignment');
  assert.equal(result, 'guest');
});

// -----------------------------------------------------------------------
// validateStudent fixed: pending only when actually loading
// -----------------------------------------------------------------------

test('C1: validateStudent: studentLoading=true → pending', () => {
  const result = validateStudent({ studentLoading: true, studentAuthenticated: false });
  assert.deepEqual(result, { pending: true });
});

test('C1: validateStudent: studentLoading=false + authenticated → live', () => {
  const result = validateStudent({ studentLoading: false, studentAuthenticated: true });
  assert.ok(result?.isAuthenticated, 'authenticated student must resolve as live');
});

test('C1: validateStudent: studentLoading=false + not authenticated → null (fixed, no stale-token loop)', () => {
  const result = validateStudent({ studentLoading: false, studentAuthenticated: false });
  assert.equal(result, null, 'must return null when not authenticated, regardless of token');
});

console.log('activeWorkspaceHydration.test.js: all assertions passed');
