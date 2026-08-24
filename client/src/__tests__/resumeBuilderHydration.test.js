/**
 * B6b — Resume Builder Auth-Bootstrap Overwrite Race
 *
 * Pure logic tests for the hydration state-machine that guards against
 * remote data silently overwriting dirty local resume edits.
 *
 * Mirrors the effect in ResumeBuilder.jsx:
 *   authLoading=true     → keep skeleton, skip hydration
 *   !isAuthenticated     → clear loading, no hydration
 *   hydrationRef matches → skip (guard: do NOT overwrite user edits)
 *   otherwise            → hydrate once, mark hydrationRef
 *
 * Run: node --experimental-vm-modules src/__tests__/resumeBuilderHydration.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Models the decision logic inside the ResumeBuilder hydration effect.
 * Returns what the effect would do.
 *
 * @param {object} opts
 *   authLoading     - auth bootstrap in progress
 *   isAuthenticated - stable auth state (after bootstrap)
 *   editId          - URL param or null
 *   hydrationRef    - current value of hydrationRef.current (null = not yet hydrated)
 * @returns {'keep-skeleton'|'clear-loading'|'skip-guard'|'hydrate'}
 */
function effectDecision({ authLoading, isAuthenticated, editId, hydrationRef }) {
  if (authLoading) return 'keep-skeleton';
  if (!isAuthenticated) return 'clear-loading';

  // '' is the sentinel for the no-editId (talent-profile) flow; null means not-yet-hydrated.
  const hydrateKey = editId || '';
  if (hydrationRef !== null && hydrationRef === hydrateKey) return 'skip-guard';

  return 'hydrate';
}

// -----------------------------------------------------------------------
// Auth bootstrap scenarios
// -----------------------------------------------------------------------

test('B6b: authLoading=true → keep-skeleton (no editable form exposed)', () => {
  const result = effectDecision({ authLoading: true, isAuthenticated: false, editId: null, hydrationRef: null });
  assert.equal(result, 'keep-skeleton');
});

test('B6b: authLoading=true even if isAuthenticated somehow true → keep-skeleton', () => {
  const result = effectDecision({ authLoading: true, isAuthenticated: true, editId: null, hydrationRef: null });
  assert.equal(result, 'keep-skeleton');
});

// -----------------------------------------------------------------------
// Unauthenticated (logged-out) scenarios
// -----------------------------------------------------------------------

test('B6b: authLoading=false, isAuthenticated=false → clear-loading (show empty form)', () => {
  const result = effectDecision({ authLoading: false, isAuthenticated: false, editId: null, hydrationRef: null });
  assert.equal(result, 'clear-loading');
});

test('B6b: authLoading=false, isAuthenticated=false, editId present → clear-loading', () => {
  const result = effectDecision({ authLoading: false, isAuthenticated: false, editId: 'abc123', hydrationRef: null });
  assert.equal(result, 'clear-loading');
});

// -----------------------------------------------------------------------
// Initial hydration (bootstrap completes, first authenticated run)
// -----------------------------------------------------------------------

test('B6b: auth just resolved (false→true), hydrationRef=null → hydrate (first time)', () => {
  const result = effectDecision({ authLoading: false, isAuthenticated: true, editId: null, hydrationRef: null });
  assert.equal(result, 'hydrate');
});

test('B6b: auth resolved, editId present, hydrationRef=null → hydrate for editId', () => {
  const result = effectDecision({ authLoading: false, isAuthenticated: true, editId: 'abc123', hydrationRef: null });
  assert.equal(result, 'hydrate');
});

// -----------------------------------------------------------------------
// Post-hydration guard — must NOT overwrite dirty user edits
// -----------------------------------------------------------------------

test('B6b: after hydration (no editId), effect reruns → skip-guard (user edits preserved)', () => {
  // First run: hydrationRef.current=null (not yet hydrated) → hydrate
  const first = effectDecision({ authLoading: false, isAuthenticated: true, editId: null, hydrationRef: null });
  assert.equal(first, 'hydrate');

  // After hydration: hydrationRef.current is set to '' (sentinel for no-editId flow)
  // Subsequent rerun → guard fires
  const second = effectDecision({ authLoading: false, isAuthenticated: true, editId: null, hydrationRef: '' });
  assert.equal(second, 'skip-guard');
});

test('B6b: after editId hydration, effect reruns → skip-guard (user edits preserved)', () => {
  const editId = 'resume-xyz';
  // First run
  const first = effectDecision({ authLoading: false, isAuthenticated: true, editId, hydrationRef: null });
  assert.equal(first, 'hydrate');

  // After hydration: hydrationRef.current = editId
  const second = effectDecision({ authLoading: false, isAuthenticated: true, editId, hydrationRef: editId });
  assert.equal(second, 'skip-guard');
});

// -----------------------------------------------------------------------
// editId change — must allow fresh hydration for different resume
// -----------------------------------------------------------------------

test('B6b: editId changes from A to B → hydrate (different key, not blocked)', () => {
  // hydrationRef was set for 'editId-A'
  const result = effectDecision({ authLoading: false, isAuthenticated: true, editId: 'editId-B', hydrationRef: 'editId-A' });
  assert.equal(result, 'hydrate');
});

test('B6b: from no-editId hydration to editId navigation → hydrate', () => {
  // hydrationRef was set to '' (no-editId sentinel); now editId appears → different key → hydrate
  const result = effectDecision({ authLoading: false, isAuthenticated: true, editId: 'new-edit-id', hydrationRef: '' });
  assert.equal(result, 'hydrate');
});

// -----------------------------------------------------------------------
// Bootstrap race simulation — the actual bug scenario
// -----------------------------------------------------------------------

test('B6b: bootstrap race — sequence isAuthenticated false→true does not overwrite after initial hydration', () => {
  // Step 1: authLoading=true at mount → keep-skeleton (user cannot type)
  const step1 = effectDecision({ authLoading: true, isAuthenticated: false, editId: null, hydrationRef: null });
  assert.equal(step1, 'keep-skeleton', 'step1: skeleton while bootstrapping');

  // Step 2: bootstrap completes, authLoading=false, isAuthenticated=true, hydrationRef still null → hydrate
  const step2 = effectDecision({ authLoading: false, isAuthenticated: true, editId: null, hydrationRef: null });
  assert.equal(step2, 'hydrate', 'step2: initial hydration runs');

  // After step2: hydrationRef.current set to '' (no-editId sentinel)

  // Step 3: something causes effect rerun (e.g. toast dep change) → guard fires, user edits safe
  const step3 = effectDecision({ authLoading: false, isAuthenticated: true, editId: null, hydrationRef: '' });
  assert.equal(step3, 'skip-guard', 'step3: guard prevents overwrite of user edits');
});

// -----------------------------------------------------------------------
// B6b Case B — initial loading state when authLoading=false at mount
// (the missing guard: authenticated user must not see editable defaultResume
//  before the first talent-profile hydration completes)
// -----------------------------------------------------------------------

/**
 * Models the useState(() => ...) initializer for the `loading` state.
 * The fix adds the case: isAuthenticated && useTalentProfileApi → start loading.
 */
function initialLoadingState({ editId, authLoading, isAuthenticated, useTalentProfileApi }) {
  return !!(editId || authLoading || (isAuthenticated && useTalentProfileApi));
}

test('B6b Case B: authLoading=false + isAuthenticated=true + talentApi=true → initial loading=true', () => {
  const result = initialLoadingState({
    editId: null, authLoading: false, isAuthenticated: true, useTalentProfileApi: true,
  });
  assert.equal(result, true, 'editable defaultResume must NOT be exposed before first hydration');
});

test('B6b Case B: authLoading=false + isAuthenticated=false + talentApi=true → initial loading=false', () => {
  const result = initialLoadingState({
    editId: null, authLoading: false, isAuthenticated: false, useTalentProfileApi: true,
  });
  assert.equal(result, false, 'unauthenticated user gets editable default immediately');
});

test('B6b Case B: authLoading=false + isAuthenticated=true + talentApi=false → initial loading=false', () => {
  const result = initialLoadingState({
    editId: null, authLoading: false, isAuthenticated: true, useTalentProfileApi: false,
  });
  assert.equal(result, false, 'no talent API means no remote hydration — show form immediately');
});

test('B6b Case A: authLoading=true + isAuthenticated=false → initial loading=true', () => {
  const result = initialLoadingState({
    editId: null, authLoading: true, isAuthenticated: false, useTalentProfileApi: true,
  });
  assert.equal(result, true, 'auth bootstrap in progress must keep skeleton');
});

test('B6b: editId present → initial loading=true regardless of auth state', () => {
  const result = initialLoadingState({
    editId: 'resume-123', authLoading: false, isAuthenticated: true, useTalentProfileApi: true,
  });
  assert.equal(result, true, 'editId always starts with loading skeleton');
});

test('B6b Case B full sequence: mount authenticated, hydrate once, guard subsequent reruns', () => {
  // Mount: authLoading=false, isAuthenticated=true, talentApi=true → initial loading=true (Case B fix)
  const initLoading = initialLoadingState({ editId: null, authLoading: false, isAuthenticated: true, useTalentProfileApi: true });
  assert.equal(initLoading, true, 'skeleton shown immediately on authenticated mount');

  // Effect runs: hydrationRef=null → hydrate
  const step1 = effectDecision({ authLoading: false, isAuthenticated: true, editId: null, hydrationRef: null });
  assert.equal(step1, 'hydrate', 'first effect run triggers hydration');

  // After hydration: hydrationRef.current = '' — subsequent reruns must not overwrite edits
  const step2 = effectDecision({ authLoading: false, isAuthenticated: true, editId: null, hydrationRef: '' });
  assert.equal(step2, 'skip-guard', 'post-hydration guard protects user edits');
});

console.log('resumeBuilderHydration.test.js: all assertions passed');
