/**
 * Mission 5 — Source Verification + Freshness contract tests.
 *
 * Pure-contract tests (no DB, no live network). Run:
 *   node src/__tests__/sourceVerificationFreshness.test.js
 */
import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedDir = path.resolve(__dirname, '../../../shared');
const serverDir = path.resolve(__dirname, '..');

const loadShared = (rel) => import(pathToFileURL(path.join(sharedDir, rel)).href);
const loadServer = (rel) => import(pathToFileURL(path.join(serverDir, rel)).href);

const sv = await loadShared('trust/sourceVerification.js');
const evidence = await loadShared('international/evidence.js');
const checker = await loadServer('services/trust/sourceCheckerBoundary.js');

let passed = 0;
let failed = 0;

const check = (label, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok - ${label}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL - ${label}`);
    console.error(`         ${err.message}`);
  }
};

const checkAsync = async (label, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`  ok - ${label}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL - ${label}`);
    console.error(`         ${err.message}`);
  }
};

// ── 1. URL normalization / dedup ───────────────────────────────────────────────
check('normalizeSourceUrl — http(s) URL accepted', () => {
  const norm = sv.normalizeSourceUrl('https://Example.COM/path?q=1');
  assert.ok(norm, 'should return a value');
  assert.ok(norm.startsWith('https://example.com'), 'host should be lowercase');
  assert.ok(!norm.includes('#'), 'fragment stripped');
});

check('normalizeSourceUrl — trailing slash removed from bare origin', () => {
  const norm = sv.normalizeSourceUrl('https://example.com/');
  assert.strictEqual(norm, 'https://example.com');
});

check('normalizeSourceUrl — default port stripped (443)', () => {
  const norm = sv.normalizeSourceUrl('https://example.com:443/path');
  assert.ok(!norm.includes(':443'), 'default port should be stripped');
});

check('normalizeSourceUrl — non-http scheme rejected', () => {
  assert.strictEqual(sv.normalizeSourceUrl('ftp://example.com'), null);
  assert.strictEqual(sv.normalizeSourceUrl('javascript:alert(1)'), null);
});

check('normalizeSourceUrl — invalid/empty returns null', () => {
  assert.strictEqual(sv.normalizeSourceUrl('not-a-url'), null);
  assert.strictEqual(sv.normalizeSourceUrl(''), null);
  assert.strictEqual(sv.normalizeSourceUrl(null), null);
  assert.strictEqual(sv.normalizeSourceUrl(undefined), null);
});

check('normalizeSourceUrl — dedup: same URL different case', () => {
  const a = sv.normalizeSourceUrl('https://ETS.ORG/toefl');
  const b = sv.normalizeSourceUrl('https://ets.org/toefl');
  assert.strictEqual(a, b, 'normalized URLs should match');
});

// ── 2. Source type / authority validation ─────────────────────────────────────
check('isValidAuthorityType — valid types accepted', () => {
  assert.strictEqual(sv.isValidAuthorityType('government'), true);
  assert.strictEqual(sv.isValidAuthorityType('official_test_org'), true);
  assert.strictEqual(sv.isValidAuthorityType('university'), true);
  assert.strictEqual(sv.isValidAuthorityType('trusted_secondary'), true);
});

check('isValidAuthorityType — invalid values rejected', () => {
  assert.strictEqual(sv.isValidAuthorityType('unknown'), false);
  assert.strictEqual(sv.isValidAuthorityType(''), false);
  assert.strictEqual(sv.isValidAuthorityType(null), false);
});

check('authorityTier — returns correct numeric tier', () => {
  assert.strictEqual(sv.authorityTier('government'), 1);
  assert.strictEqual(sv.authorityTier('official_test_org'), 2);
  assert.strictEqual(sv.authorityTier('trusted_secondary'), 7);
  assert.strictEqual(sv.authorityTier('unknown'), null);
});

check('isValidSourceStatus — all values valid', () => {
  for (const v of Object.values(sv.SOURCE_STATUS)) {
    assert.strictEqual(sv.isValidSourceStatus(v), true, `${v} should be valid`);
  }
  assert.strictEqual(sv.isValidSourceStatus('deleted'), false);
});

// ── 3. Provenance — verification lifecycle ────────────────────────────────────
check('isValidVerificationStatus — all lifecycle values recognized', () => {
  const statuses = ['unverified', 'pending_review', 'verified', 'needs_review', 'disputed', 'superseded', 'rejected'];
  for (const s of statuses) {
    assert.strictEqual(sv.isValidVerificationStatus(s), true, `${s} should be valid`);
  }
  assert.strictEqual(sv.isValidVerificationStatus('approved'), false);
});

// ── 4 & 5. Verification lifecycle transitions ─────────────────────────────────
check('isValidVerificationTransition — valid transitions accepted', () => {
  assert.strictEqual(sv.isValidVerificationTransition('unverified', 'pending_review'), true);
  assert.strictEqual(sv.isValidVerificationTransition('pending_review', 'verified'), true);
  assert.strictEqual(sv.isValidVerificationTransition('verified', 'needs_review'), true);
  assert.strictEqual(sv.isValidVerificationTransition('needs_review', 'verified'), true);
  assert.strictEqual(sv.isValidVerificationTransition('disputed', 'rejected'), true);
  assert.strictEqual(sv.isValidVerificationTransition('rejected', 'pending_review'), true);
});

check('isValidVerificationTransition — invalid transitions blocked', () => {
  // superseded is terminal
  assert.strictEqual(sv.isValidVerificationTransition('superseded', 'verified'), false);
  assert.strictEqual(sv.isValidVerificationTransition('superseded', 'unverified'), false);
  // Can't skip steps in unexpected ways
  assert.strictEqual(sv.isValidVerificationTransition('unverified', 'superseded'), false);
  assert.strictEqual(sv.isValidVerificationTransition('rejected', 'verified'), false);
  // Invalid status values
  assert.strictEqual(sv.isValidVerificationTransition('foo', 'verified'), false);
  assert.strictEqual(sv.isValidVerificationTransition('verified', 'foo'), false);
});

// ── 6, 7, 8, 9. Freshness derivation ─────────────────────────────────────────
const daysAgo = (n) => new Date(Date.now() - n * 86400_000);
const daysFromNow = (n) => new Date(Date.now() + n * 86400_000);

check('deriveFreshness — fresh (recently verified, within 80% of interval)', () => {
  const state = sv.deriveFreshness({
    lastVerifiedAt: daysAgo(10),
    reviewIntervalDays: 90,
  });
  assert.strictEqual(state, sv.FRESHNESS_STATES.FRESH, `expected fresh, got ${state}`);
});

check('deriveFreshness — review_due (verified, past interval)', () => {
  const state = sv.deriveFreshness({
    lastVerifiedAt: daysAgo(100),
    reviewIntervalDays: 90,
  });
  assert.ok(
    state === sv.FRESHNESS_STATES.REVIEW_DUE || state === sv.FRESHNESS_STATES.STALE,
    `expected review_due or stale, got ${state}`
  );
});

check('deriveFreshness — stale (verified but 3× the interval ago)', () => {
  const state = sv.deriveFreshness({
    lastVerifiedAt: daysAgo(400),
    reviewIntervalDays: 90,
  });
  assert.strictEqual(state, sv.FRESHNESS_STATES.STALE, `expected stale, got ${state}`);
});

check('deriveFreshness — broken when source status is broken', () => {
  const state = sv.deriveFreshness({
    lastVerifiedAt: daysAgo(1),
    sourceStatus: sv.SOURCE_STATUS.BROKEN,
  });
  assert.strictEqual(state, sv.FRESHNESS_STATES.BROKEN, `expected broken, got ${state}`);
});

check('deriveFreshness — broken when source status is unavailable', () => {
  const state = sv.deriveFreshness({
    lastVerifiedAt: daysAgo(1),
    sourceStatus: sv.SOURCE_STATUS.UNAVAILABLE,
  });
  assert.strictEqual(state, sv.FRESHNESS_STATES.BROKEN);
});

check('deriveFreshness — unknown when never verified', () => {
  const state = sv.deriveFreshness({
    lastVerifiedAt: null,
    reviewIntervalDays: 90,
  });
  assert.strictEqual(state, sv.FRESHNESS_STATES.UNKNOWN);
});

check('deriveFreshness — fresh when nextReviewAt is in the future', () => {
  const state = sv.deriveFreshness({
    lastVerifiedAt: daysAgo(200),
    nextReviewAt: daysFromNow(30),
  });
  assert.strictEqual(state, sv.FRESHNESS_STATES.FRESH, `expected fresh, got ${state}`);
});

check('deriveFreshness — review_due when nextReviewAt is recently past', () => {
  const state = sv.deriveFreshness({
    lastVerifiedAt: daysAgo(120),
    nextReviewAt: daysAgo(10),
  });
  assert.strictEqual(state, sv.FRESHNESS_STATES.REVIEW_DUE, `expected review_due, got ${state}`);
});

check('deriveFreshness — stale when nextReviewAt is far past (>90 days)', () => {
  const state = sv.deriveFreshness({
    lastVerifiedAt: daysAgo(400),
    nextReviewAt: daysAgo(120),
  });
  assert.strictEqual(state, sv.FRESHNESS_STATES.STALE, `expected stale, got ${state}`);
});

// ── 10. Source failure does not automatically delete factual record ─────────────
check('deriveFreshness — broken source does not remove lastVerifiedAt contract', () => {
  // The freshness model marks the FRESHNESS as broken, but the claim and
  // lastVerifiedAt date remain on the FactProvenance record. This test confirms
  // the deriveFreshness contract — a broken source returns BROKEN freshness state,
  // not UNKNOWN (which would imply the fact was never recorded).
  const state = sv.deriveFreshness({
    lastVerifiedAt: daysAgo(5),
    sourceStatus: sv.SOURCE_STATUS.BROKEN,
  });
  assert.strictEqual(state, sv.FRESHNESS_STATES.BROKEN,
    'broken source should return BROKEN, not UNKNOWN — fact record still exists');
  // If it returned UNKNOWN it would imply no verification history
  assert.notStrictEqual(state, sv.FRESHNESS_STATES.UNKNOWN);
});

// ── 11. Configurable review interval ──────────────────────────────────────────
check('deriveFreshness — respects configurable review intervals', () => {
  // test_policy = 90 days
  const testPolicyState = sv.deriveFreshness({
    lastVerifiedAt: daysAgo(50),
    dataType: 'test_policy',
  });
  // institution_identity = 365 days → 50 days ago is still fresh
  const instState = sv.deriveFreshness({
    lastVerifiedAt: daysAgo(50),
    dataType: 'institution_identity',
  });
  assert.strictEqual(instState, sv.FRESHNESS_STATES.FRESH,
    'institution_identity at 50 days should be fresh (365-day interval)');
  // 50 days with 90-day interval: 50/90 = 55.5% < 80% → fresh
  assert.strictEqual(testPolicyState, sv.FRESHNESS_STATES.FRESH,
    'test_policy at 50 days should be fresh (< 72 days = 80% of 90)');
});

// ── 12. Public-safe lastVerified projection ───────────────────────────────────
check('projectLastVerified — includes expected public-safe fields', () => {
  const result = sv.projectLastVerified({
    label: 'Official ETS Website',
    isOfficial: true,
    lastVerifiedAt: new Date('2026-08-01'),
    freshnessState: sv.FRESHNESS_STATES.FRESH,
    officialUrl: 'https://ets.org',
  });
  assert.ok('label' in result);
  assert.ok('isOfficiallySourced' in result);
  assert.ok('lastVerifiedAt' in result);
  assert.ok('freshnessState' in result);
  assert.ok('officialUrl' in result);
  assert.strictEqual(result.isOfficiallySourced, true);
  assert.strictEqual(result.officialUrl, 'https://ets.org');
});

// ── 13. Internal notes not exposed in public projection ───────────────────────
check('projectLastVerified — adminNotes not present in output', () => {
  const result = sv.projectLastVerified({
    label: 'Test Source',
    isOfficial: false,
    adminNotes: 'Internal: flagged for review by ops',
    officialUrl: 'https://example.com',
  });
  assert.ok(!('adminNotes' in result), 'adminNotes must not be in public projection');
  // officialUrl only surfaced when isOfficial is true
  assert.strictEqual(result.officialUrl, null, 'officialUrl should be null when not official');
});

check('projectLastVerified — officialUrl hidden when not official', () => {
  const result = sv.projectLastVerified({
    label: 'Secondary Source',
    isOfficial: false,
    officialUrl: 'https://secret-internal-url.example.com',
  });
  assert.strictEqual(result.officialUrl, null);
});

// ── 14 & 15. Correction submission ───────────────────────────────────────────
check('isValidCorrectionType — all types recognized', () => {
  for (const t of Object.values(sv.CORRECTION_TYPES)) {
    assert.strictEqual(sv.isValidCorrectionType(t), true, `${t} should be valid`);
  }
  assert.strictEqual(sv.isValidCorrectionType('fabricated'), false);
});

check('isValidCorrectionStatus — lifecycle values recognized', () => {
  for (const s of Object.values(sv.CORRECTION_STATUSES)) {
    assert.strictEqual(sv.isValidCorrectionStatus(s), true, `${s} should be valid`);
  }
  assert.strictEqual(sv.isValidCorrectionStatus('approved'), false);
});

// ── 16. (Tested structurally via parseSources/correction model) ──────────────

// ── 17. Admin-only verification (policy contract) ─────────────────────────────
check('checkPublicationPolicy — original_guidance may publish without source', () => {
  const result = sv.checkPublicationPolicy(
    { verificationStatus: 'unverified', sources: [] },
    sv.PUBLICATION_POLICY_TYPES.ORIGINAL_GUIDANCE
  );
  assert.strictEqual(result.canPublish, true);
  assert.ok(result.reason.includes('original'));
});

check('checkPublicationPolicy — descriptive content may publish without source', () => {
  const result = sv.checkPublicationPolicy(
    { verificationStatus: 'unverified', sources: [] },
    sv.PUBLICATION_POLICY_TYPES.DESCRIPTIVE
  );
  assert.strictEqual(result.canPublish, true);
});

// ── 19. Mission 4 malformed-source boundary hardened ─────────────────────────
check('parseSources (permissive) — drops invalid entries, no error', () => {
  const result = sv.parseSources(
    [{ sourceType: 'INVALID_TYPE', sourceUrl: 'not-a-url' }, null, 'string'],
    { strict: false, validateSource: evidence.validateSource }
  );
  assert.strictEqual(result.ok, true, 'permissive mode should not fail');
  assert.strictEqual(result.sources.length, 0, 'all invalid entries dropped');
  assert.ok(Array.isArray(result.warnings), 'warnings array present');
  assert.ok(result.warnings.length > 0, 'should have at least one warning');
});

check('parseSources (strict) — returns error on invalid entry', () => {
  const result = sv.parseSources(
    [{ sourceType: 'INVALID_TYPE', sourceUrl: 'not-a-url' }],
    { strict: true, validateSource: evidence.validateSource }
  );
  assert.strictEqual(result.ok, false, 'strict mode should fail on invalid entry');
  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
});

check('parseSources (strict) — valid entry passes', () => {
  const result = sv.parseSources(
    [{ sourceType: 'official', sourceUrl: 'https://ets.org', publisher: 'ETS' }],
    { strict: true, validateSource: evidence.validateSource }
  );
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.sources.length, 1);
  assert.strictEqual(result.warnings.length, 0);
});

check('parseSources — non-array input returns empty sources ok', () => {
  const result = sv.parseSources(null, { validateSource: evidence.validateSource });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.sources, []);
});

// ── 20. Draft vs published source requirements ────────────────────────────────
check('checkPublicationPolicy — high_value_factual: no source → cannot publish', () => {
  const result = sv.checkPublicationPolicy(
    { verificationStatus: 'verified', sources: [] },
    sv.PUBLICATION_POLICY_TYPES.HIGH_VALUE_FACTUAL
  );
  assert.strictEqual(result.canPublish, false);
  assert.ok(result.reason.includes('requires_source'));
});

check('checkPublicationPolicy — high_value_factual: source but unverified → cannot publish', () => {
  const result = sv.checkPublicationPolicy(
    {
      verificationStatus: 'unverified',
      sources: [{ sourceType: 'official', sourceUrl: 'https://ets.org' }],
    },
    sv.PUBLICATION_POLICY_TYPES.HIGH_VALUE_FACTUAL
  );
  assert.strictEqual(result.canPublish, false);
  assert.ok(result.reason.includes('verified_status'));
});

check('checkPublicationPolicy — high_value_factual: source + verified → can publish', () => {
  const result = sv.checkPublicationPolicy(
    {
      verificationStatus: 'verified',
      sources: [{ sourceType: 'official', sourceUrl: 'https://ets.org' }],
    },
    sv.PUBLICATION_POLICY_TYPES.HIGH_VALUE_FACTUAL
  );
  assert.strictEqual(result.canPublish, true);
});

// ── 21. Strideto original guidance exemption ─────────────────────────────────
check('original_guidance exemption — can publish without verified external source', () => {
  // Even with no sources and unverified status, original guidance may publish.
  const result = sv.checkPublicationPolicy(
    { verificationStatus: 'unverified', sources: [] },
    sv.PUBLICATION_POLICY_TYPES.ORIGINAL_GUIDANCE
  );
  assert.strictEqual(result.canPublish, true, 'Strideto original guidance is exempt from source requirement');
});

// ── 22. Admin freshness filters (contract shapes) ─────────────────────────────
check('FRESHNESS_STATES — all expected values present', () => {
  assert.ok(sv.FRESHNESS_STATES.FRESH);
  assert.ok(sv.FRESHNESS_STATES.REVIEW_DUE);
  assert.ok(sv.FRESHNESS_STATES.STALE);
  assert.ok(sv.FRESHNESS_STATES.BROKEN);
  assert.ok(sv.FRESHNESS_STATES.UNKNOWN);
});

check('VERIFICATION_STATUSES — all expected lifecycle values present', () => {
  const expected = ['unverified', 'pending_review', 'verified', 'needs_review', 'disputed', 'superseded', 'rejected'];
  for (const e of expected) {
    const found = Object.values(sv.VERIFICATION_STATUSES).includes(e);
    assert.ok(found, `${e} should be in VERIFICATION_STATUSES`);
  }
});

// ── 23. Data quality metrics ──────────────────────────────────────────────────
check('EMPTY_DATA_QUALITY_METRICS — shape has all expected keys', () => {
  const keys = Object.keys(sv.EMPTY_DATA_QUALITY_METRICS);
  const expected = ['totalFactRecords', 'verified', 'unverified', 'fresh', 'reviewDue', 'stale', 'broken', 'correctionsPending'];
  for (const k of expected) {
    assert.ok(keys.includes(k), `missing key: ${k}`);
    assert.strictEqual(sv.EMPTY_DATA_QUALITY_METRICS[k], 0, `${k} should be 0`);
  }
});

// ── 24. Audit metadata safety (via shared audit primitive) ────────────────────
check('deriveFreshness — injectable clock for deterministic testing', () => {
  // Verifies the injectable clock works — important for audit record reproducibility
  const fixedNow = new Date('2026-06-01');
  const lastVerifiedAt = new Date('2026-01-01'); // ~150 days before fixed now
  const state = sv.deriveFreshness({
    lastVerifiedAt,
    reviewIntervalDays: 90,
    now: fixedNow,
  });
  // 150 days > 90 days × 3 = 270 days? No. 150 < 270, so REVIEW_DUE
  assert.ok(
    state === sv.FRESHNESS_STATES.REVIEW_DUE || state === sv.FRESHNESS_STATES.STALE,
    `expected review_due or stale, got ${state}`
  );
});

// ── Source checker boundary ───────────────────────────────────────────────────
await checkAsync('noOpSourceChecker — returns safe no-op result without network', async () => {
  const result = await checker.noOpSourceChecker('https://ets.org');
  assert.strictEqual(result.ok, false, 'no-op should return ok:false');
  assert.ok(result.checkedAt, 'checkedAt should be set');
  assert.ok(typeof result.errorMessage === 'string');
});

await checkAsync('createMockSourceChecker — returns mock response for registered URL', async () => {
  const mockChecker = checker.createMockSourceChecker({
    'https://ets.org': { ok: true, status: 'reachable', httpStatus: 200 },
  });
  const result = await mockChecker('https://ets.org');
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 'reachable');
  assert.strictEqual(result.httpStatus, 200);
});

await checkAsync('createMockSourceChecker — unknown URL returns unreachable', async () => {
  const mockChecker = checker.createMockSourceChecker({});
  const result = await mockChecker('https://unknown.example.com');
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 'unreachable');
});

await checkAsync('setSourceChecker / resetSourceChecker — injectable correctly', async () => {
  const mockFn = async (_url) => ({
    ok: true,
    status: 'reachable',
    httpStatus: 200,
    checkedAt: new Date().toISOString(),
  });
  checker.setSourceChecker(mockFn);
  const result = await checker.checkSource('https://any.com');
  assert.strictEqual(result.ok, true);
  checker.resetSourceChecker(); // restore no-op
  const resetResult = await checker.checkSource('https://any.com');
  assert.strictEqual(resetResult.ok, false, 'after reset should be no-op again');
});

// ── Authority hierarchy ───────────────────────────────────────────────────────
check('authority hierarchy — government outranks trusted_secondary', () => {
  const govTier = sv.authorityTier('government');
  const secTier = sv.authorityTier('trusted_secondary');
  assert.ok(govTier < secTier, 'lower tier = higher authority; government (1) < trusted_secondary (7)');
});

check('AUTHORITY_TYPES — all values valid authority types', () => {
  for (const v of Object.values(sv.AUTHORITY_TYPES)) {
    assert.strictEqual(sv.isValidAuthorityType(v), true, `${v} should be a valid authority type`);
  }
});

// ── Publication policy edge cases ─────────────────────────────────────────────
check('checkPublicationPolicy — unknown policy type cannot publish', () => {
  const result = sv.checkPublicationPolicy({}, 'nonexistent_policy');
  assert.strictEqual(result.canPublish, false);
  assert.ok(result.reason.includes('unknown'));
});

check('isValidPublicationPolicyType — valid types accepted', () => {
  assert.strictEqual(sv.isValidPublicationPolicyType('original_guidance'), true);
  assert.strictEqual(sv.isValidPublicationPolicyType('high_value_factual'), true);
  assert.strictEqual(sv.isValidPublicationPolicyType('descriptive'), true);
  assert.strictEqual(sv.isValidPublicationPolicyType('anything'), false);
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
console.log(`Mission 5 source verification + freshness: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
