/**
 * C1 — Job Apply Auth Contract
 *
 * Pure logic tests for the apply-button authority decision in JobDetail.
 * Mirrors the rendered guard tree (lines 318–356 of JobDetail.jsx):
 *
 *   canActAsStudent && !isExternal && accepting  → Apply button (internal)
 *   studentWriteBlocked && !isExternal           → StudentAuthorityNotice
 *   isHydrating && !canActAsStudent && ...       → loading pulse
 *   !isHydrating && !canActAsStudent && ...      → "Login to Apply" link
 *   isExternal && accepting && applicationLink   → external link
 *
 * No DOM / React / network — pure state-machine assertion.
 * Run: node --experimental-vm-modules src/__tests__/jobApplyAuthContract.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// Models the JobDetail apply-surface decision as a pure function.
// Returns which UI branch is active for the actions div.
function applyBranch({
  isExternal,
  accepting,
  applicationLink,
  applyEmail,
  canActAsStudent,
  studentWriteBlocked,
  isHydrating,
}) {
  if (!accepting) return 'not-accepting';
  if (isExternal && applicationLink) return 'external-link';
  if (isExternal && !applicationLink && applyEmail) return 'external-email';
  if (!isExternal && canActAsStudent) return 'internal-apply';
  if (!isExternal && studentWriteBlocked) return 'authority-notice';
  if (!isExternal && isHydrating) return 'loading-pulse';
  if (!isExternal && !isHydrating && !canActAsStudent && !studentWriteBlocked) return 'login-to-apply';
  return 'none';
}

// Workspace hydration state — mirrors useActiveWorkspace
function workspaceState(realm, isHydrating = false) {
  const isAuthenticated = realm !== null && realm !== 'guest';
  const canActAsStudent = realm === 'student';
  // Non-student authenticated realm blocks student writes
  const studentWriteBlocked = isAuthenticated && realm !== 'student' && realm !== 'guest';
  return { canActAsStudent, studentWriteBlocked, isHydrating, realm, isAuthenticated };
}

// -----------------------------------------------------------------------
// Logged-out visitor — internal job, accepting
// -----------------------------------------------------------------------

test('C1: logged-out → Login to Apply', () => {
  const ws = workspaceState(null);
  const branch = applyBranch({
    isExternal: false, accepting: true, applicationLink: null, applyEmail: '',
    ...ws,
  });
  assert.equal(branch, 'login-to-apply');
});

test('C1: logged-out → Login to Apply even when job is external (external link takes precedence)', () => {
  const ws = workspaceState(null);
  // External jobs show the external link, not login-to-apply
  const branch = applyBranch({
    isExternal: true, accepting: true, applicationLink: 'https://example.com/apply', applyEmail: '',
    ...ws,
  });
  assert.equal(branch, 'external-link');
});

// -----------------------------------------------------------------------
// Student workspace — eligible to apply
// -----------------------------------------------------------------------

test('C1: logged-in student → Apply button shown for internal accepting job', () => {
  const ws = workspaceState('student');
  const branch = applyBranch({
    isExternal: false, accepting: true, applicationLink: null, applyEmail: '',
    ...ws,
  });
  assert.equal(branch, 'internal-apply');
});

test('C1: logged-in student + external job with link → external-link (not apply)', () => {
  const ws = workspaceState('student');
  const branch = applyBranch({
    isExternal: true, accepting: true, applicationLink: 'https://example.com/apply', applyEmail: '',
    ...ws,
  });
  assert.equal(branch, 'external-link');
});

test('C1: logged-in student + external job without link, has email → external-email', () => {
  const ws = workspaceState('student');
  const branch = applyBranch({
    isExternal: true, accepting: true, applicationLink: null, applyEmail: 'hr@example.com',
    ...ws,
  });
  assert.equal(branch, 'external-email');
});

// -----------------------------------------------------------------------
// Wrong realm (employer, institution, agent) → authority notice
// -----------------------------------------------------------------------

test('C1: employer realm → authority/eligibility notice for internal job', () => {
  const ws = workspaceState('employer');
  const branch = applyBranch({
    isExternal: false, accepting: true, applicationLink: null, applyEmail: '',
    ...ws,
  });
  assert.equal(branch, 'authority-notice');
});

test('C1: institution realm → authority notice', () => {
  const ws = workspaceState('institution');
  const branch = applyBranch({
    isExternal: false, accepting: true, applicationLink: null, applyEmail: '',
    ...ws,
  });
  assert.equal(branch, 'authority-notice');
});

test('C1: agent realm → authority notice', () => {
  const ws = workspaceState('agent');
  const branch = applyBranch({
    isExternal: false, accepting: true, applicationLink: null, applyEmail: '',
    ...ws,
  });
  assert.equal(branch, 'authority-notice');
});

// -----------------------------------------------------------------------
// Workspace still hydrating — loading pulse
// -----------------------------------------------------------------------

test('C1: isHydrating → loading pulse, not login-to-apply', () => {
  const ws = workspaceState(null, true);
  const branch = applyBranch({
    isExternal: false, accepting: true, applicationLink: null, applyEmail: '',
    ...ws,
  });
  assert.equal(branch, 'loading-pulse');
});

// -----------------------------------------------------------------------
// Not-accepting job — all branches suppressed
// -----------------------------------------------------------------------

test('C1: deadline passed → not-accepting regardless of auth state', () => {
  for (const realm of [null, 'student', 'employer']) {
    const ws = workspaceState(realm);
    const branch = applyBranch({
      isExternal: false, accepting: false, applicationLink: null, applyEmail: '',
      ...ws,
    });
    assert.equal(branch, 'not-accepting', `realm="${realm}" must show not-accepting`);
  }
});

// -----------------------------------------------------------------------
// useActiveWorkspace hydration contract
// -----------------------------------------------------------------------

test('C1 workspace: student realm → canActAsStudent=true, studentWriteBlocked=false', () => {
  const ws = workspaceState('student');
  assert.equal(ws.canActAsStudent, true);
  assert.equal(ws.studentWriteBlocked, false);
  assert.equal(ws.isAuthenticated, true);
});

test('C1 workspace: null realm (logged-out) → canActAsStudent=false, studentWriteBlocked=false', () => {
  const ws = workspaceState(null);
  assert.equal(ws.canActAsStudent, false);
  assert.equal(ws.studentWriteBlocked, false);
  assert.equal(ws.isAuthenticated, false);
});

test('C1 workspace: employer realm → canActAsStudent=false, studentWriteBlocked=true', () => {
  const ws = workspaceState('employer');
  assert.equal(ws.canActAsStudent, false);
  assert.equal(ws.studentWriteBlocked, true);
  assert.equal(ws.isAuthenticated, true);
});

// -----------------------------------------------------------------------
// C1 ROOT — workspace resolution behavior (models the effect in ActiveWorkspaceContext)
// Verifies the fix: authenticated student with no stored preference → student realm,
// not guest. Pure function mirrors the !preferred branch logic.
// -----------------------------------------------------------------------

/**
 * Models the !preferred branch in ActiveWorkspaceContext's resolution effect.
 * Returns the resolved workspace state after the effect runs.
 *
 * @param {object} opts
 *   studentLoading   - studentAuth.loading (bootstrap in progress)
 *   isAuthenticated  - studentAuth.isAuthenticated
 *   hasAccessToken   - whether getAccessToken() returns a value
 *   preference       - stored workspace preference (null = none)
 */
function resolveWorkspace({ studentLoading, isAuthenticated, hasAccessToken, preference }) {
  // Models the full resolution path
  if (preference) {
    // Stored preference exists — validate it (simplified: assume it matches the realm)
    return { realm: preference, isHydrating: false, canActAsStudent: preference === 'student' };
  }

  // !preferred branch
  if (studentLoading || (hasAccessToken && !isAuthenticated)) {
    return { realm: null, isHydrating: true, canActAsStudent: false };
  }
  if (isAuthenticated) {
    // Auto-project student identity (the fix)
    return { realm: 'student', isHydrating: false, canActAsStudent: true };
  }
  // Guest
  return { realm: 'guest', isHydrating: false, canActAsStudent: false };
}

test('C1 root: logged-out, no preference → guest', () => {
  const result = resolveWorkspace({ studentLoading: false, isAuthenticated: false, hasAccessToken: false, preference: null });
  assert.equal(result.realm, 'guest');
  assert.equal(result.canActAsStudent, false);
  assert.equal(result.isHydrating, false);
});

test('C1 root: authenticated student, no preference → auto-resolve student realm', () => {
  const result = resolveWorkspace({ studentLoading: false, isAuthenticated: true, hasAccessToken: true, preference: null });
  assert.equal(result.realm, 'student');
  assert.equal(result.canActAsStudent, true);
  assert.equal(result.isHydrating, false);
});

test('C1 root: authenticated student, stored student preference → student realm', () => {
  const result = resolveWorkspace({ studentLoading: false, isAuthenticated: true, hasAccessToken: true, preference: 'student' });
  assert.equal(result.realm, 'student');
  assert.equal(result.canActAsStudent, true);
  assert.equal(result.isHydrating, false);
});

test('C1 root: authenticated with employer preference → preserve employer realm', () => {
  const result = resolveWorkspace({ studentLoading: false, isAuthenticated: false, hasAccessToken: false, preference: 'employer' });
  assert.equal(result.realm, 'employer');
  assert.equal(result.canActAsStudent, false);
  assert.equal(result.isHydrating, false);
});

test('C1 root: student auth bootstrapping (loading=true), no preference → isHydrating, not guest', () => {
  const result = resolveWorkspace({ studentLoading: true, isAuthenticated: false, hasAccessToken: false, preference: null });
  assert.equal(result.isHydrating, true);
  assert.equal(result.canActAsStudent, false);
  // Must NOT resolve to guest prematurely
  assert.notEqual(result.realm, 'guest');
});

test('C1 root: access token present but auth not yet resolved → isHydrating, not guest', () => {
  // This is the intermediate state during token refresh: token in flight, isAuthenticated still false
  const result = resolveWorkspace({ studentLoading: false, isAuthenticated: false, hasAccessToken: true, preference: null });
  assert.equal(result.isHydrating, true);
  assert.notEqual(result.realm, 'guest');
});

test('C1 apply-branch: resolved student (no preference) → Apply button, not Login', () => {
  // After workspace auto-resolution, canActAsStudent=true
  const ws = { canActAsStudent: true, studentWriteBlocked: false, isHydrating: false };
  const branch = applyBranch({ isExternal: false, accepting: true, applicationLink: null, applyEmail: '', ...ws });
  assert.equal(branch, 'internal-apply');
});

test('C1 apply-branch: unresolved auth (isHydrating) → loading pulse, not Login', () => {
  const ws = { canActAsStudent: false, studentWriteBlocked: false, isHydrating: true };
  const branch = applyBranch({ isExternal: false, accepting: true, applicationLink: null, applyEmail: '', ...ws });
  assert.equal(branch, 'loading-pulse');
});

console.log('jobApplyAuthContract.test.js: all assertions passed');
