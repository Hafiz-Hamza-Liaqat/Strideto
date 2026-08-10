/**
 * Mission 25 — Controlled Verified Data Launch tests.
 *
 * Pure-contract tests: no DB connection, no network, no worker, no provider or
 * AI call, no filesystem write. Run:
 *   node src/__tests__/verifiedDataLaunch.test.js
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const sharedDir = path.join(repoRoot, 'shared');
const serverDir = path.resolve(__dirname, '..');

const loadShared = (rel) => import(pathToFileURL(path.join(sharedDir, rel)).href);
const loadServer = (rel) => import(pathToFileURL(path.join(serverDir, rel)).href);

const vl = await loadShared('data/verifiedLaunch.js');
const manifestSvc = await loadServer('services/data/verifiedLaunchManifest.js');
const planner = await loadServer('services/data/verifiedLaunchPlanner.js');
const gate = await loadServer('services/data/verifiedLaunchGate.js');
const pack = await loadServer('services/data/verifiedLaunchPack.js');
const sourceVerification = await loadShared('trust/sourceVerification.js');

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

// ── Fixed clock + freshness anchors ──────────────────────────────────────────

const NOW = new Date('2026-08-10T00:00:00.000Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();

// test_policy interval = 90d → fresh <72d, review_due 72–90d, stale >270d
const FRESH_AT = daysAgo(10);
const REVIEW_DUE_AT = daysAgo(80);
const STALE_AT = daysAgo(400);

// ── Manifest builders ────────────────────────────────────────────────────────

function source(overrides = {}) {
  return {
    sourceKey: 'src-testorg',
    url: 'https://www.example-testorg.org/policy',
    sourceType: 'official',
    authorityType: 'official_test_org',
    publisher: 'Example Test Organisation',
    status: 'active',
    dataType: 'test_policy',
    lastVerifiedAt: FRESH_AT,
    ...overrides,
  };
}

function institutionSource(overrides = {}) {
  return source({
    sourceKey: 'src-university',
    url: 'https://www.example-university.edu/about',
    authorityType: 'university',
    publisher: 'Example University',
    dataType: 'institution_identity',
    ...overrides,
  });
}

function govSource(overrides = {}) {
  return source({
    sourceKey: 'src-gov',
    url: 'https://www.example-ministry.gov.example/policy',
    authorityType: 'government',
    publisher: 'Example Ministry of Education',
    ...overrides,
  });
}

function record(overrides = {}) {
  return {
    recordKey: 'test.example-proficiency',
    entityType: 'test',
    operation: 'upsert',
    provenance: {
      origin: 'real_source_backed',
      sourceKeys: ['src-testorg'],
      facts: {},
    },
    payload: {
      stableId: 'example-proficiency',
      name: 'Example Proficiency Test',
      category: 'english_proficiency',
    },
    ...overrides,
  };
}

function institutionRecord(overrides = {}) {
  return {
    recordKey: 'institution.example-university',
    entityType: 'canonical_institution',
    operation: 'upsert',
    provenance: {
      origin: 'real_source_backed',
      sourceKeys: ['src-university'],
      facts: {},
    },
    payload: {
      officialName: 'Example University',
      countryCode: 'GB',
      officialDomain: 'example-university.edu',
      institutionType: 'university',
    },
    ...overrides,
  };
}

function manifest(overrides = {}) {
  return {
    manifestVersion: 1,
    batchId: 'test-batch-000001',
    createdAt: '2026-08-10T00:00:00.000Z',
    createdByProcess: 'mission-25-tests',
    environmentIntent: 'test',
    reviewState: 'draft',
    scope: { label: 'test scope', countries: ['GB'] },
    sourceSnapshot: [source()],
    records: [record()],
    ...overrides,
  };
}

const validate = (m) => manifestSvc.validateManifest(m, { now: NOW });
const plan = (m, state = {}) =>
  planner.planLaunchBatch(validate(m), planner.createCanonicalStateSnapshot(state));

function firstEntry(p, recordKey) {
  return p.entries.find((e) => e.recordKey === recordKey);
}

function structureError(fn) {
  try {
    fn();
    return null;
  } catch (err) {
    return err;
  }
}

// ── 1–2. Schema version ──────────────────────────────────────────────────────

console.log('\nManifest schema version');

check('1. manifest schema version is required', () => {
  const m = manifest();
  delete m.manifestVersion;
  const err = structureError(() => validate(m));
  assert.ok(err, 'should throw');
  assert.strictEqual(err.code, 'manifest_version_required');
});

check('2. unknown/future schema version fails closed', () => {
  const err = structureError(() => validate(manifest({ manifestVersion: 99 })));
  assert.strictEqual(err.code, 'manifest_version_unsupported');
  const err2 = structureError(() => validate(manifest({ manifestVersion: '1' })));
  assert.strictEqual(err2.code, 'manifest_version_unsupported', 'string version rejected');
});

// ── 3–8. Batch identity + fingerprint ────────────────────────────────────────

console.log('\nBatch identity and fingerprint');

check('3. batch id is stable and validated', () => {
  assert.strictEqual(validate(manifest()).batchId, 'test-batch-000001');
  const err = structureError(() => validate(manifest({ batchId: 'no' })));
  assert.strictEqual(err.code, 'manifest_batch_id_invalid');
});

check('4. manifest fingerprint is a deterministic sha256', () => {
  const fp = validate(manifest()).fingerprint;
  assert.match(fp, /^[a-f0-9]{64}$/);
});

check('5. same manifest content produces the same fingerprint', () => {
  const a = manifestSvc.manifestFingerprint(manifest());
  const b = manifestSvc.manifestFingerprint(manifest());
  assert.strictEqual(a, b);

  // Key and array insertion order must not matter.
  const reordered = manifest({
    records: [record()],
    sourceSnapshot: [source()],
  });
  reordered.records = [
    {
      payload: { category: 'english_proficiency', name: 'Example Proficiency Test', stableId: 'example-proficiency' },
      operation: 'upsert',
      entityType: 'test',
      recordKey: 'test.example-proficiency',
      provenance: { facts: {}, sourceKeys: ['src-testorg'], origin: 'real_source_backed' },
    },
  ];
  assert.strictEqual(manifestSvc.manifestFingerprint(reordered), a, 'key order must not change fingerprint');
});

check('6. a different normalized payload changes the fingerprint', () => {
  const a = manifestSvc.manifestFingerprint(manifest());
  const changed = manifest({
    records: [record({ payload: { stableId: 'example-proficiency', name: 'Renamed Test', category: 'english_proficiency' } })],
  });
  assert.notStrictEqual(manifestSvc.manifestFingerprint(changed), a);
});

check('6b. batchId/createdAt/reviewState do not affect the content fingerprint', () => {
  const a = manifestSvc.manifestFingerprint(manifest());
  const b = manifestSvc.manifestFingerprint(
    manifest({ batchId: 'other-batch-000002', createdAt: '2020-01-01T00:00:00.000Z', reviewState: 'validated' })
  );
  assert.strictEqual(a, b);
});

check('7. same batch id + same fingerprint is idempotent', () => {
  const fp = manifestSvc.manifestFingerprint(manifest());
  const ledger = new Map([['test-batch-000001', fp]]);
  const result = gate.checkBatchIdempotency(ledger, 'test-batch-000001', fp);
  assert.strictEqual(result.outcome, gate.BATCH_IDEMPOTENCY_OUTCOMES.IDEMPOTENT_REPEAT);
});

check('8. same batch id + different fingerprint is a conflict', () => {
  const ledger = new Map([['test-batch-000001', 'a'.repeat(64)]]);
  const result = gate.checkBatchIdempotency(ledger, 'test-batch-000001', 'b'.repeat(64));
  assert.strictEqual(result.outcome, gate.BATCH_IDEMPOTENCY_OUTCOMES.FINGERPRINT_CONFLICT);
  const unseen = gate.checkBatchIdempotency(ledger, 'fresh-batch-000003', 'c'.repeat(64));
  assert.strictEqual(unseen.outcome, gate.BATCH_IDEMPOTENCY_OUTCOMES.FIRST_APPLICATION);
});

// ── 9–16. Origin, source and authority ───────────────────────────────────────

console.log('\nProvenance, origin and authority');

check('9. unsupported entity type is rejected', () => {
  const v = validate(manifest({ records: [record({ entityType: 'university_ranking' })] }));
  assert.strictEqual(v.summary.validRecords, 0);
  assert.ok(v.invalidRecords[0].errors.some((e) => e.reason === 'entity_type_unsupported'));
});

check('10. a synthetic/test record can never become a verified launch record', () => {
  const v = validate(manifest({ records: [record({ provenance: { origin: 'synthetic_fixture', sourceKeys: ['src-testorg'], facts: {} } })] }));
  assert.strictEqual(v.summary.validRecords, 0);
  assert.ok(
    v.invalidRecords[0].errors.some((e) => e.reason === 'provenance_origin_not_launchable:synthetic_fixture')
  );
});

check('11. demo/placeholder and legacy/unknown origins are rejected', () => {
  for (const origin of ['demo_placeholder', 'legacy_unknown', 'insufficiently_sourced']) {
    const v = validate(manifest({ records: [record({ provenance: { origin, sourceKeys: ['src-testorg'], facts: {} } })] }));
    assert.strictEqual(v.summary.validRecords, 0, origin);
    assert.ok(
      v.invalidRecords[0].errors.some((e) => e.reason === `provenance_origin_not_launchable:${origin}`),
      origin
    );
  }
});

check('12. a record with no source is rejected', () => {
  const v = validate(manifest({ records: [record({ provenance: { origin: 'real_source_backed', sourceKeys: [], facts: {} } })] }));
  assert.ok(v.invalidRecords[0].errors.some((e) => e.reason === 'source_required'));
});

check('13. unsafe source URLs are rejected', () => {
  const cases = [
    ['javascript:alert(1)', 'source_url_forbidden_scheme:javascript'],
    ['data:text/html,<b>x', 'source_url_forbidden_scheme:data'],
    ['file:///etc/passwd', 'source_url_forbidden_scheme:file'],
    ['http://localhost:3000/x', 'source_url_internal_or_non_public_host'],
    ['http://127.0.0.1/x', 'source_url_internal_or_non_public_host'],
    ['http://10.0.0.5/internal', 'source_url_internal_or_non_public_host'],
    ['http://169.254.169.254/latest/meta-data', 'source_url_internal_or_non_public_host'],
  ];
  for (const [url, reason] of cases) {
    const result = vl.validateLaunchSourceUrl(url);
    assert.strictEqual(result.ok, false, url);
    assert.strictEqual(result.reason, reason, url);
  }
  assert.strictEqual(vl.validateLaunchSourceUrl('https://www.example-testorg.org/a').ok, true);
});

check('14. source authority is preserved on the planned record', () => {
  const v = validate(manifest());
  assert.strictEqual(v.records[0].sourceAuthority, 'official_test_org');
  assert.strictEqual(v.records[0].sourceAuthorityTier, vl.authorityTier('official_test_org'));
});

check('15. an agent statement cannot become canonical verified authority', () => {
  const v = validate(manifest({ sourceSnapshot: [source({ authorityType: 'agent_statement' })] }));
  assert.strictEqual(v.summary.validSources, 0);
  assert.ok(
    v.invalidSources[0].errors.some((e) => e.reason === 'authority_type_cannot_be_canonical_verified')
  );
  assert.strictEqual(vl.isLaunchableAuthorityType('agent_statement'), false);
});

check('16. AI synthesis and student input cannot become verified sources', () => {
  for (const token of ['ai_synthesis', 'student_input', 'user_submitted', 'copilot']) {
    assert.strictEqual(vl.isLaunchableAuthorityType(token), false, token);
    assert.strictEqual(vl.isNonCanonicalAuthorityToken(token), true, token);
  }
});

// ── 17–22. Freshness and effective dates ─────────────────────────────────────

console.log('\nFreshness and effective dates');

check('17. a fresh record is eligible', () => {
  const v = validate(manifest());
  assert.strictEqual(v.records[0].freshnessState, 'fresh');
  assert.strictEqual(v.records[0].freshnessDecision, vl.LAUNCH_FRESHNESS_DECISIONS.ELIGIBLE);
  assert.strictEqual(firstEntry(plan(manifest()), 'test.example-proficiency').planState, 'create');
});

check('18. review_due requires an explicit review decision', () => {
  const m = manifest({ sourceSnapshot: [source({ lastVerifiedAt: REVIEW_DUE_AT })] });
  const v = validate(m);
  assert.strictEqual(v.records[0].freshnessState, 'review_due');
  assert.strictEqual(v.records[0].freshnessDecision, vl.LAUNCH_FRESHNESS_DECISIONS.REVIEW_REQUIRED);
  assert.strictEqual(firstEntry(plan(m), 'test.example-proficiency').planState, 'manual_review');

  const reviewed = manifest({
    sourceSnapshot: [source({ lastVerifiedAt: REVIEW_DUE_AT })],
    records: [record({ review: { decision: 'approved' } })],
  });
  assert.strictEqual(firstEntry(plan(reviewed), 'test.example-proficiency').planState, 'create');
});

check('19. a stale record is not launchable as current', () => {
  const m = manifest({ sourceSnapshot: [source({ lastVerifiedAt: STALE_AT })] });
  const v = validate(m);
  assert.strictEqual(v.records[0].freshnessState, 'stale');
  assert.strictEqual(firstEntry(plan(m), 'test.example-proficiency').planState, 'skip_stale');
});

check('19b. an approved stale exception routes to manual review, never straight to create', () => {
  const m = manifest({
    sourceSnapshot: [source({ lastVerifiedAt: STALE_AT })],
    records: [record({ review: { staleExceptionApproved: true } })],
  });
  assert.strictEqual(firstEntry(plan(m), 'test.example-proficiency').planState, 'manual_review');
});

check('20. a broken source is rejected', () => {
  const m = manifest({ sourceSnapshot: [source({ status: 'broken' })] });
  const v = validate(m);
  assert.strictEqual(v.records[0].freshnessState, 'broken');
  assert.strictEqual(firstEntry(plan(m), 'test.example-proficiency').planState, 'skip_invalid');
});

check('21. unknown freshness is rejected as a verified-current fact', () => {
  const m = manifest({ sourceSnapshot: [source({ lastVerifiedAt: undefined })] });
  const v = validate(m);
  assert.strictEqual(v.records[0].freshnessState, 'unknown');
  assert.strictEqual(firstEntry(plan(m), 'test.example-proficiency').planState, 'skip_invalid');
});

check('21b. a record inherits the weakest freshness among its sources', () => {
  const m = manifest({
    sourceSnapshot: [source(), institutionSource({ lastVerifiedAt: STALE_AT, dataType: 'test_policy' })],
    records: [record({ provenance: { origin: 'real_source_backed', sourceKeys: ['src-testorg', 'src-university'], facts: {} } })],
  });
  assert.strictEqual(validate(m).records[0].freshnessState, 'stale');
});

check('22. effective dates are preserved', () => {
  const m = manifest({
    sourceSnapshot: [source(), institutionSource()],
    records: [
      institutionRecord(),
      record(),
      {
        recordKey: 'acceptance.example-university-proficiency',
        entityType: 'test_acceptance',
        operation: 'upsert',
        provenance: { origin: 'real_source_backed', sourceKeys: ['src-testorg'], facts: { acceptanceStatus: 'src-testorg' } },
        dependencies: { testKey: 'test.example-proficiency', institutionKey: 'institution.example-university' },
        payload: {
          acceptanceStatus: 'accepted',
          acceptanceScope: 'institution',
          countryCode: 'GB',
          effectiveFrom: '2026-09-01',
          effectiveTo: '2027-08-31',
        },
      },
    ],
  });
  const v = validate(m);
  const acceptance = v.records.find((r) => r.entityType === 'test_acceptance');
  assert.strictEqual(acceptance.effectiveFrom, '2026-09-01');
  assert.strictEqual(acceptance.effectiveTo, '2027-08-31');
});

check('22b. an inverted effective window is rejected', () => {
  const m = manifest({
    records: [record({ payload: { stableId: 'x1', name: 'X', category: 'admissions', effectiveFrom: '2027-01-01', effectiveTo: '2026-01-01' } })],
  });
  assert.ok(validate(m).invalidRecords[0].errors.some((e) => e.reason === 'effective_window_inverted'));
});

// ── 23–30. Duplicates, supersession and conflicts ────────────────────────────

console.log('\nDuplicates, supersession and conflicts');

const acceptanceManifest = (payloadOverrides = {}, sourceOverrides = {}) =>
  manifest({
    sourceSnapshot: [source(sourceOverrides), institutionSource()],
    records: [
      institutionRecord(),
      record(),
      {
        recordKey: 'acceptance.example-university-proficiency',
        entityType: 'test_acceptance',
        operation: 'upsert',
        provenance: {
          origin: 'real_source_backed',
          sourceKeys: ['src-testorg'],
          facts: { acceptanceStatus: 'src-testorg', minimumOverallScore: 'src-testorg' },
        },
        dependencies: { testKey: 'test.example-proficiency', institutionKey: 'institution.example-university' },
        payload: {
          acceptanceStatus: 'accepted',
          acceptanceScope: 'institution',
          countryCode: 'GB',
          minimumOverallScore: 6.5,
          ...payloadOverrides,
        },
      },
    ],
  });

check('23. a material change to a history-preserving entity plans supersede, not blind overwrite', () => {
  const m = acceptanceManifest({ minimumOverallScore: 7 });
  const state = {
    test_acceptance: [
      {
        canonicalKey: 'acceptance.example-university-proficiency',
        payload: { acceptanceStatus: 'accepted', acceptanceScope: 'institution', countryCode: 'GB', minimumOverallScore: 6.5 },
        valueFingerprint: 'old-fingerprint',
        sourceAuthority: 'official_test_org',
        sourceAuthorityTier: vl.authorityTier('official_test_org'),
        lastVerifiedAt: daysAgo(200),
        freshnessState: 'review_due',
      },
    ],
  };
  const entry = firstEntry(plan(m, state), 'acceptance.example-university-proficiency');
  assert.strictEqual(entry.planState, 'supersede');
  assert.ok(entry.supersedes.priorValueFingerprint, 'prior version referenced');
});

check('24. a duplicate canonical institution is detected', () => {
  const m = manifest({
    sourceSnapshot: [institutionSource()],
    records: [institutionRecord({ recordKey: 'institution.example-university-copy' })],
  });
  const state = {
    canonical_institution: [
      {
        canonicalKey: 'institution.example-university',
        payload: { officialName: 'Example University', countryCode: 'GB', officialDomain: 'example-university.edu' },
        valueFingerprint: 'x',
      },
    ],
  };
  const entry = firstEntry(plan(m, state), 'institution.example-university-copy');
  assert.strictEqual(entry.planState, 'skip_duplicate');
  assert.strictEqual(entry.duplicateOf.canonicalKey, 'institution.example-university');
});

check('25. a duplicate program is detected', () => {
  const m = manifest({
    sourceSnapshot: [institutionSource()],
    records: [
      institutionRecord(),
      {
        recordKey: 'program.example-msc-copy',
        entityType: 'program',
        operation: 'upsert',
        provenance: { origin: 'real_source_backed', sourceKeys: ['src-university'], facts: {} },
        dependencies: { institutionKey: 'institution.example-university' },
        payload: { name: 'MSc Computing', degreeLevel: 'master', country: 'GB', campus: 'Main' },
      },
    ],
  });
  const state = {
    canonical_institution: [{ canonicalKey: 'institution.example-university', payload: { officialName: 'Example University', countryCode: 'GB', officialDomain: 'example-university.edu' }, valueFingerprint: 'x' }],
    program: [
      {
        canonicalKey: 'program.example-msc',
        payload: { name: 'MSc Computing', degreeLevel: 'master', country: 'GB', campus: 'Main' },
        dependencies: { institutionKey: 'institution.example-university' },
        valueFingerprint: 'y',
      },
    ],
  };
  assert.strictEqual(firstEntry(plan(m, state), 'program.example-msc-copy').planState, 'skip_duplicate');
});

check('26. a duplicate scholarship is detected', () => {
  const m = manifest({
    sourceSnapshot: [govSource()],
    records: [
      {
        recordKey: 'scholarship.example-award-copy',
        entityType: 'canonical_scholarship',
        operation: 'upsert',
        provenance: { origin: 'real_source_backed', sourceKeys: ['src-gov'], facts: {} },
        payload: { title: 'Example National Award', provider: { name: 'Example Ministry of Education' }, cycleLabel: '2026-27', countryCode: 'GB' },
      },
    ],
  });
  const state = {
    canonical_scholarship: [
      {
        canonicalKey: 'scholarship.example-award',
        payload: { title: 'Example National Award', provider: { name: 'Example Ministry of Education' }, cycleLabel: '2026-27', countryCode: 'GB' },
        valueFingerprint: 'z',
      },
    ],
  };
  assert.strictEqual(firstEntry(plan(m, state), 'scholarship.example-award-copy').planState, 'skip_duplicate');
});

check('27. a duplicate test identity is detected', () => {
  const m = manifest({ records: [record({ recordKey: 'test.example-proficiency-copy' })] });
  const state = {
    test: [
      {
        canonicalKey: 'test.example-proficiency',
        payload: { stableId: 'example-proficiency', name: 'Example Proficiency Test', category: 'english_proficiency' },
        valueFingerprint: 'q',
      },
    ],
  };
  assert.strictEqual(firstEntry(plan(m, state), 'test.example-proficiency-copy').planState, 'skip_duplicate');
});

check('28. an uncertain duplicate enters manual review instead of a silent merge', () => {
  // Same institution name + country, no shared domain → weak match only.
  const m = manifest({
    sourceSnapshot: [institutionSource()],
    records: [institutionRecord({ recordKey: 'institution.example-university-alt', payload: { officialName: 'Example University', countryCode: 'GB', officialDomain: 'example-university-alt.edu', institutionType: 'university' } })],
  });
  const state = {
    canonical_institution: [
      {
        canonicalKey: 'institution.example-university',
        payload: { officialName: 'Example University', countryCode: 'GB', officialDomain: 'example-university.edu' },
        valueFingerprint: 'x',
      },
    ],
  };
  const entry = firstEntry(plan(m, state), 'institution.example-university-alt');
  assert.strictEqual(entry.planState, 'manual_review');
  assert.strictEqual(entry.reason, 'uncertain_duplicate_requires_manual_review');
});

check('29. a conflicting canonical fact is not silently overwritten', () => {
  const m = acceptanceManifest({ minimumOverallScore: 7 });
  const state = {
    test_acceptance: [
      {
        canonicalKey: 'acceptance.example-university-proficiency',
        payload: { acceptanceStatus: 'accepted', acceptanceScope: 'institution', countryCode: 'GB', minimumOverallScore: 6.5 },
        valueFingerprint: 'old',
        sourceAuthority: 'government',
        sourceAuthorityTier: vl.authorityTier('government'),
        lastVerifiedAt: daysAgo(1),
        freshnessState: 'fresh',
      },
    ],
  };
  const entry = firstEntry(plan(m, state), 'acceptance.example-university-proficiency');
  assert.strictEqual(entry.planState, 'conflict');
  assert.strictEqual(entry.reason, 'proposed_source_authority_weaker_than_existing');
});

check('30. a conflict exposes existing/proposed source, authority, freshness and window', () => {
  const m = acceptanceManifest({ minimumOverallScore: 7 });
  const state = {
    test_acceptance: [
      {
        canonicalKey: 'acceptance.example-university-proficiency',
        payload: { acceptanceStatus: 'accepted', acceptanceScope: 'institution', countryCode: 'GB', minimumOverallScore: 6.5 },
        valueFingerprint: 'old',
        sourceAuthority: 'government',
        sourceAuthorityTier: vl.authorityTier('government'),
        lastVerifiedAt: daysAgo(1),
        freshnessState: 'fresh',
        effectiveFrom: '2025-09-01',
      },
    ],
  };
  const entry = firstEntry(plan(m, state), 'acceptance.example-university-proficiency');
  const c = entry.conflict;
  assert.ok(c.changedFacts.includes('minimumOverallScore'));
  assert.strictEqual(c.existing.sourceAuthority, 'government');
  assert.strictEqual(c.existing.freshnessState, 'fresh');
  assert.strictEqual(c.existing.effectiveFrom, '2025-09-01');
  assert.strictEqual(c.existing.values.minimumOverallScore, 6.5);
  assert.strictEqual(c.proposed.sourceAuthority, 'official_test_org');
  assert.strictEqual(c.proposed.values.minimumOverallScore, 7);
});

// ── 31–38. Planner states and dependencies ───────────────────────────────────

console.log('\nPlanner states and dependencies');

check('31. a new valid entity plans create', () => {
  assert.strictEqual(firstEntry(plan(manifest()), 'test.example-proficiency').planState, 'create');
});

check('32. an identical existing entity plans no_change (idempotent repeat)', () => {
  const v = validate(manifest());
  const state = {
    test: [
      {
        canonicalKey: 'test.example-proficiency',
        payload: v.records[0].payload,
        valueFingerprint: v.records[0].valueFingerprint,
      },
    ],
  };
  const first = firstEntry(plan(manifest(), state), 'test.example-proficiency');
  const second = firstEntry(plan(manifest(), state), 'test.example-proficiency');
  assert.strictEqual(first.planState, 'no_change');
  assert.strictEqual(second.planState, 'no_change', 'repeat dry run converges');
});

check('33. a changed fact on a non-history entity plans update with stronger/newer evidence', () => {
  const m = manifest({ records: [record({ payload: { stableId: 'example-proficiency', name: 'Example Proficiency Test v2', category: 'english_proficiency' } })] });
  const state = {
    test: [
      {
        canonicalKey: 'test.example-proficiency',
        payload: { stableId: 'example-proficiency', name: 'Example Proficiency Test', category: 'english_proficiency' },
        valueFingerprint: 'old',
        sourceAuthority: 'official_test_org',
        sourceAuthorityTier: vl.authorityTier('official_test_org'),
        lastVerifiedAt: daysAgo(300),
      },
    ],
  };
  const entry = firstEntry(plan(m, state), 'test.example-proficiency');
  assert.strictEqual(entry.planState, 'update');
  assert.ok(entry.updates.includes('name'));
  assert.strictEqual(vl.preservesHistory('test'), false);
  assert.strictEqual(vl.preservesHistory('test_acceptance'), true);
});

check('34. an invalid record plans skip_invalid without corrupting the rest of the plan', () => {
  const m = manifest({
    records: [record(), record({ recordKey: 'test.broken', entityType: 'not_a_real_entity' })],
  });
  const p = plan(m);
  assert.strictEqual(firstEntry(p, 'test.example-proficiency').planState, 'create');
  assert.strictEqual(firstEntry(p, 'test.broken').planState, 'skip_invalid');
  assert.strictEqual(p.counts.create, 1);
  assert.strictEqual(p.counts.skip_invalid, 1);
});

check('35. a stale record plans skip_stale', () => {
  const m = manifest({ sourceSnapshot: [source({ lastVerifiedAt: STALE_AT })] });
  assert.strictEqual(plan(m).counts.skip_stale, 1);
});

check('36. an unresolved dependency is rejected', () => {
  const m = manifest({
    sourceSnapshot: [institutionSource()],
    records: [
      {
        recordKey: 'program.orphan',
        entityType: 'program',
        operation: 'upsert',
        provenance: { origin: 'real_source_backed', sourceKeys: ['src-university'], facts: {} },
        dependencies: { institutionKey: 'institution.does-not-exist' },
        payload: { name: 'Orphan Program', degreeLevel: 'master', country: 'GB' },
      },
    ],
  });
  const entry = firstEntry(plan(m), 'program.orphan');
  assert.strictEqual(entry.planState, 'skip_dependency_failed');
  assert.strictEqual(entry.dependencyErrors[0].reason, 'dependency_not_found');
});

check('37. dependency ordering is deterministic across runs and input order', () => {
  const base = manifest({
    sourceSnapshot: [source(), institutionSource()],
    records: [
      {
        recordKey: 'program.example-msc',
        entityType: 'program',
        operation: 'upsert',
        provenance: { origin: 'real_source_backed', sourceKeys: ['src-university'], facts: {} },
        dependencies: { institutionKey: 'institution.example-university' },
        payload: { name: 'MSc Computing', degreeLevel: 'master', country: 'GB' },
      },
      institutionRecord(),
      record(),
    ],
  });
  const order1 = plan(base).entries.map((e) => e.recordKey);
  const shuffled = manifest({
    sourceSnapshot: [institutionSource(), source()],
    records: [record(), institutionRecord(), base.records[0]],
  });
  const order2 = plan(shuffled).entries.map((e) => e.recordKey);
  assert.deepStrictEqual(order1, order2);
  assert.ok(
    order1.indexOf('institution.example-university') < order1.indexOf('program.example-msc'),
    'institution planned before program'
  );
});

check('38. a program cannot reference a missing institution', () => {
  const m = manifest({
    sourceSnapshot: [institutionSource()],
    records: [
      {
        recordKey: 'program.no-institution',
        entityType: 'program',
        operation: 'upsert',
        provenance: { origin: 'real_source_backed', sourceKeys: ['src-university'], facts: {} },
        payload: { name: 'Program', degreeLevel: 'master', country: 'GB' },
      },
    ],
  });
  assert.ok(validate(m).invalidRecords[0].errors.some((e) => e.reason === 'program_requires_institution'));
});

// ── 39–42. Domain scope and unknown values ───────────────────────────────────

console.log('\nDomain scope and unknown values');

check('39. TestAcceptance scope is preserved', () => {
  const v = validate(acceptanceManifest());
  const acceptance = v.records.find((r) => r.entityType === 'test_acceptance');
  assert.strictEqual(acceptance.payload.acceptanceScope, 'institution');
  assert.deepStrictEqual(
    Object.values(vl.LAUNCH_ENTITY_TYPES).includes('test_acceptance'),
    true
  );
});

check('40. a country-level acceptance cannot be created from institution-owned authority', () => {
  const m = acceptanceManifest({ acceptanceScope: 'country' }, { authorityType: 'university' });
  const v = validate(m);
  const bad = v.invalidRecords.find((r) => r.recordKey === 'acceptance.example-university-proficiency');
  assert.ok(bad, 'country-scope claim from university authority must be rejected');
  assert.ok(bad.errors.some((e) => e.reason.startsWith('scope_not_assertable_by_authority')));

  // Government authority may assert a country-scope rule.
  assert.strictEqual(vl.canAssertScope('country', 'government'), true);
  assert.strictEqual(vl.canAssertScope('country', 'university'), false);
});

check('41. unknown scholarship funding stays unknown and is not required', () => {
  const m = manifest({
    sourceSnapshot: [govSource()],
    records: [
      {
        recordKey: 'scholarship.example-award',
        entityType: 'canonical_scholarship',
        operation: 'upsert',
        provenance: { origin: 'real_source_backed', sourceKeys: ['src-gov'], facts: {} },
        payload: { title: 'Example National Award', provider: { name: 'Example Ministry' }, countryCode: 'GB' },
      },
    ],
  });
  const v = validate(m);
  assert.strictEqual(v.summary.validRecords, 1);
  assert.strictEqual(v.records[0].payload.funding, undefined, 'unknown funding stays absent');
  assert.deepStrictEqual(v.records[0].unsourcedFacts, []);
});

check('42. optional program fields left unknown remain unknown and launchable', () => {
  const m = manifest({
    sourceSnapshot: [institutionSource()],
    records: [
      institutionRecord(),
      {
        recordKey: 'program.minimal',
        entityType: 'program',
        operation: 'upsert',
        provenance: { origin: 'real_source_backed', sourceKeys: ['src-university'], facts: {} },
        dependencies: { institutionKey: 'institution.example-university' },
        payload: { name: 'MSc Minimal', degreeLevel: 'master', country: 'GB' },
      },
    ],
  });
  const v = validate(m);
  assert.strictEqual(v.summary.invalidRecords, 0);
  const program = v.records.find((r) => r.entityType === 'program');
  assert.strictEqual(program.payload.tuition, undefined);
  assert.deepStrictEqual(program.unsourcedFacts, []);
});

check('42b. a material fact present without fact-level provenance is rejected', () => {
  const m = manifest({
    sourceSnapshot: [institutionSource()],
    records: [
      institutionRecord(),
      {
        recordKey: 'program.tuition-unsourced',
        entityType: 'program',
        operation: 'upsert',
        provenance: { origin: 'real_source_backed', sourceKeys: ['src-university'], facts: {} },
        dependencies: { institutionKey: 'institution.example-university' },
        payload: { name: 'MSc Priced', degreeLevel: 'master', country: 'GB', tuition: { amountMinor: 1200000, currency: 'GBP' } },
      },
    ],
  });
  const bad = validate(m).invalidRecords.find((r) => r.recordKey === 'program.tuition-unsourced');
  assert.ok(bad.errors.some((e) => e.reason === 'material_fact_unsourced'));
});

// ── 43–49. Money, international, dates ───────────────────────────────────────

console.log('\nMoney, international and dates');

check('43. Money minor units must be a safe integer', () => {
  assert.strictEqual(manifestSvc.validateLaunchMoney({ amountMinor: 1050, currency: 'GBP' }).ok, true);
  assert.strictEqual(manifestSvc.validateLaunchMoney({ amountMinor: 10.5, currency: 'GBP' }).reason, 'money_amount_not_integer_minor_units');
  assert.strictEqual(manifestSvc.validateLaunchMoney({ amountMinor: '1050', currency: 'GBP' }).reason, 'money_amount_not_integer_minor_units');
  assert.strictEqual(manifestSvc.validateLaunchMoney({ amountMinor: Number.MAX_SAFE_INTEGER + 2, currency: 'GBP' }).reason, 'money_amount_unsafe_integer');
  assert.strictEqual(manifestSvc.validateLaunchMoney({ amountMinor: 1, currency: 'ZZZ' }).reason, 'money_currency_invalid');
});

check('44. JPY precision behaves as zero-decimal', () => {
  const jpy = manifestSvc.validateLaunchMoney({ amountMinor: 1500000, currency: 'JPY' });
  assert.strictEqual(jpy.ok, true);
  assert.strictEqual(jpy.value.minorUnits, 0, 'JPY has no minor unit — no universal /100');
});

check('45. KWD precision behaves as three-decimal', () => {
  const kwd = manifestSvc.validateLaunchMoney({ amountMinor: 1500000, currency: 'KWD' });
  assert.strictEqual(kwd.ok, true);
  assert.strictEqual(kwd.value.minorUnits, 3);
});

check('46. ISO country codes are validated', () => {
  const m = manifest({
    sourceSnapshot: [institutionSource()],
    records: [institutionRecord({ payload: { officialName: 'X University', countryCode: 'XX', officialDomain: 'x.edu', institutionType: 'university' } })],
  });
  assert.ok(validate(m).invalidRecords[0].errors.some((e) => e.reason === 'country_code_invalid'));
  assert.strictEqual(validate(manifest({ sourceSnapshot: [institutionSource()], records: [institutionRecord()] })).summary.invalidRecords, 0);
});

check('47. Unicode institution names are accepted safely', () => {
  const m = manifest({
    sourceSnapshot: [institutionSource()],
    records: [
      institutionRecord({
        recordKey: 'institution.universite-example',
        payload: { officialName: 'Université de l’Exemple — 例大学', countryCode: 'FR', officialDomain: 'universite-example.fr', institutionType: 'university' },
      }),
    ],
  });
  const v = validate(m);
  assert.strictEqual(v.summary.invalidRecords, 0);
  assert.strictEqual(v.records[0].payload.officialName, 'Université de l’Exemple — 例大学');
});

check('48. a date-only value never acquires a time of day', () => {
  assert.strictEqual(manifestSvc.parseDateOnly('2026-09-01'), '2026-09-01');
  assert.strictEqual(manifestSvc.parseDateOnly('2026-02-30'), null, 'rolled-over date rejected');
  assert.strictEqual(manifestSvc.parseDateOnly('2026-09-01T00:00:00Z'), null);
  const m = manifest({
    sourceSnapshot: [govSource()],
    records: [
      {
        recordKey: 'scholarship.deadline-typed',
        entityType: 'canonical_scholarship',
        operation: 'upsert',
        provenance: { origin: 'real_source_backed', sourceKeys: ['src-gov'], facts: {} },
        payload: { title: 'Award', provider: { name: 'Ministry' }, deadlineDate: '2026-12-01T09:00:00Z' },
      },
    ],
  });
  assert.ok(validate(m).invalidRecords[0].errors.some((e) => e.reason === 'deadline_must_be_date_only'));
});

check('49. no cross-currency conversion is performed anywhere in the pipeline', () => {
  const svcSrc = fs.readFileSync(path.join(serverDir, 'services/data/verifiedLaunchManifest.js'), 'utf8');
  const planSrc = fs.readFileSync(path.join(serverDir, 'services/data/verifiedLaunchPlanner.js'), 'utf8');
  for (const src of [svcSrc, planSrc]) {
    assert.ok(!/exchangeRate|convertCurrency|fxRate|\/\s*100\b/.test(src), 'no conversion or universal /100');
  }
  const money = manifestSvc.validateLaunchMoney({ amountMinor: 1000, currency: 'USD' });
  assert.strictEqual(money.value.currency, 'USD', 'currency travels with the amount unchanged');
});

// ── 50–54. Dry run and apply gate ────────────────────────────────────────────

console.log('\nDry run and apply gate');

check('50. a dry run causes zero persistence', () => {
  const before = fs.readFileSync(path.join(repoRoot, 'data/verified-launch/initial-launch-pack.v1.json'), 'utf8');
  const p = plan(manifest());
  planner.buildRollbackPlan(p);
  planner.buildLaunchReport(validate(manifest()), p);
  const after = fs.readFileSync(path.join(repoRoot, 'data/verified-launch/initial-launch-pack.v1.json'), 'utf8');
  assert.strictEqual(before, after, 'launch pack untouched');

  const plannerSrc = fs.readFileSync(path.join(serverDir, 'services/data/verifiedLaunchPlanner.js'), 'utf8');
  assert.ok(!/mongoose|\.save\(|updateOne|insertMany|deleteOne/.test(plannerSrc), 'planner performs no persistence');
});

check('51. a dry run reports create/update/conflict/skip counts', () => {
  const p = plan(manifest());
  for (const state of Object.values(vl.PLAN_STATES)) {
    assert.strictEqual(typeof p.counts[state], 'number', state);
  }
  const report = planner.buildLaunchReport(validate(manifest()), p);
  assert.strictEqual(report.conflicts, 0);
  assert.strictEqual(report.duplicates, 0);
  assert.strictEqual(report.hardDeletesPlanned, 0);
});

check('52. the CLI default mode is dry run', () => {
  const cli = fs.readFileSync(path.join(repoRoot, 'scripts/verified-data-launch.mjs'), 'utf8');
  assert.match(cli, /const mode = 'dry-run'/, 'dry-run is the default mode');
  assert.match(cli, /--apply/);
  assert.match(cli, /REFUSED: apply mode is not available in Mission 25/);
});

check('53. apply requires every explicit gate', () => {
  const fingerprint = 'a'.repeat(64);
  const goodEnv = { STRIDETO_LAUNCH_ENV: 'local' };
  const base = {
    applyRequested: true,
    env: goodEnv,
    environmentIntent: 'local',
    batchReviewState: 'approved_for_nonproduction',
    expectedFingerprint: fingerprint,
    actualFingerprint: fingerprint,
    operatorAcknowledgement: 'i-understand-this-mutates-canonical-data',
    actor: { role: 'admin' },
  };
  assert.doesNotThrow(() => gate.assertApplyAllowed(base));

  const failures = [
    [{ applyRequested: false }, 'apply_not_requested'],
    [{ batchReviewState: 'draft' }, 'apply_batch_not_approved'],
    [{ expectedFingerprint: null }, 'apply_expected_fingerprint_required'],
    [{ expectedFingerprint: 'b'.repeat(64) }, 'apply_fingerprint_mismatch'],
    [{ operatorAcknowledgement: 'yes' }, 'apply_operator_acknowledgement_required'],
    [{ actor: { role: 'institution' } }, 'apply_actor_not_authorized'],
    [{ env: {} }, 'apply_environment_denied:launch_environment_not_declared'],
  ];
  for (const [override, code] of failures) {
    let thrown = null;
    try {
      gate.assertApplyAllowed({ ...base, ...override });
    } catch (err) {
      thrown = err;
    }
    assert.ok(thrown, JSON.stringify(override));
    assert.strictEqual(thrown.code, code, JSON.stringify(override));
  }
});

check('54. a production/staging environment fails closed and NODE_ENV never authorizes', () => {
  for (const value of ['production', 'staging', 'prod', 'preprod']) {
    const resolved = gate.resolveLaunchEnvironment({ STRIDETO_LAUNCH_ENV: value });
    assert.strictEqual(resolved.ok, false, value);
    assert.strictEqual(resolved.reason, 'launch_environment_forbidden_in_mission_25', value);
  }
  // NODE_ENV alone grants nothing, in either direction.
  const inferred = gate.resolveLaunchEnvironment({ NODE_ENV: 'development' });
  assert.strictEqual(inferred.ok, false);
  assert.strictEqual(inferred.reason, 'launch_environment_not_declared');

  const manifestGuard = structureError(() => validate(manifest({ environmentIntent: 'production' })));
  assert.strictEqual(manifestGuard.code, 'manifest_environment_intent_forbidden');
});

// ── 55–59. Input safety and determinism ──────────────────────────────────────

console.log('\nInput safety and determinism');

check('55. batch input is bounded', () => {
  const big = manifest({
    records: Array.from({ length: vl.LAUNCH_LIMITS.MAX_RECORDS_PER_BATCH + 1 }, (_, i) =>
      record({ recordKey: `test.bulk-${i}` })
    ),
  });
  assert.strictEqual(structureError(() => validate(big)).code, 'manifest_too_many_records');
  assert.ok(vl.LAUNCH_LIMITS.MAX_RECORDS_PER_BATCH <= 500);
});

check('56. malformed manifest input is rejected safely', () => {
  assert.strictEqual(structureError(() => manifestSvc.parseManifestJson('{not json')).code, 'manifest_malformed_json');
  assert.strictEqual(structureError(() => manifestSvc.parseManifestJson('[]')).code, 'manifest_not_an_object');
  assert.strictEqual(structureError(() => manifestSvc.parseManifestJson(null)).code, 'manifest_not_a_string');
  assert.strictEqual(
    structureError(() => manifestSvc.parseManifestJson('{"a":{"__proto__":{"x":1}}}')).code,
    'manifest_reserved_key'
  );
  const huge = 'x'.repeat(vl.LAUNCH_LIMITS.MAX_MANIFEST_BYTES + 1);
  assert.strictEqual(structureError(() => manifestSvc.parseManifestJson(huge)).code, 'manifest_too_large');
});

check('57. oversized arrays and strings inside a record are rejected', () => {
  const longArray = manifest({
    records: [record({ payload: { stableId: 'x', name: 'X', category: 'admissions', purposes: Array.from({ length: vl.LAUNCH_LIMITS.MAX_ARRAY_LENGTH + 1 }, () => 'p') } })],
  });
  assert.ok(validate(longArray).invalidRecords[0].errors.some((e) => e.reason === 'array_too_long'));

  const longString = manifest({
    records: [record({ payload: { stableId: 'x', name: 'X', category: 'admissions', description: 'y'.repeat(vl.LAUNCH_LIMITS.MAX_STRING_LENGTH + 1) } })],
  });
  assert.ok(validate(longString).invalidRecords[0].errors.some((e) => e.reason === 'string_too_long'));
});

check('58. duplicate record keys and duplicate source keys are rejected', () => {
  const dupRecords = manifest({ records: [record(), record()] });
  assert.strictEqual(structureError(() => validate(dupRecords)).code, 'manifest_duplicate_record_key');

  const dupSources = manifest({ sourceSnapshot: [source(), source()] });
  assert.strictEqual(structureError(() => validate(dupSources)).code, 'manifest_duplicate_source_key');

  // Duplicate keys inside the raw JSON text are caught before JSON.parse hides them.
  assert.strictEqual(
    structureError(() => manifestSvc.parseManifestJson('{"batchId":"a","batchId":"b"}')).code,
    'manifest_duplicate_json_key'
  );

  // Two distinct source keys pointing at the same normalized URL are flagged.
  const dupUrl = manifest({ sourceSnapshot: [source(), source({ sourceKey: 'src-other', url: 'https://WWW.Example-Testorg.ORG/policy#frag' })] });
  const v = validate(dupUrl);
  assert.ok(v.invalidSources.some((s) => s.errors.some((e) => e.reason.startsWith('duplicate_normalized_url_of'))));
});

check('59. plan ordering and fingerprints are deterministic across repeated runs', () => {
  const runs = Array.from({ length: 3 }, () => plan(manifest()));
  const signature = JSON.stringify(runs[0].entries.map((e) => [e.recordKey, e.planState]));
  for (const run of runs) {
    assert.strictEqual(JSON.stringify(run.entries.map((e) => [e.recordKey, e.planState])), signature);
    assert.strictEqual(run.manifestFingerprint, runs[0].manifestFingerprint);
  }
});

// ── 60–62. History and recovery ──────────────────────────────────────────────

console.log('\nHistory and recovery');

check('60. absence from a manifest never plans a delete', () => {
  const state = {
    test: [
      { canonicalKey: 'test.legacy-not-in-manifest', payload: { name: 'Legacy' }, valueFingerprint: 'l' },
      { canonicalKey: 'test.example-proficiency', payload: {}, valueFingerprint: 'other' },
    ],
  };
  const p = plan(manifest(), state);
  assert.ok(!Object.keys(p.counts).some((k) => k.includes('delete')), 'no delete plan state exists');
  const absent = p.absentFromManifest.find((a) => a.canonicalKey === 'test.legacy-not-in-manifest');
  assert.strictEqual(absent.recommendation, 'retain_no_delete');
});

check('61. a rollback plan is generated before any mutation', () => {
  const p = plan(manifest());
  const rollback = planner.buildRollbackPlan(p);
  assert.strictEqual(rollback.generatedBeforeApply, true);
  assert.strictEqual(rollback.operations.length, 1);
  assert.strictEqual(rollback.operations[0].appliedOperation, 'create');
  assert.strictEqual(rollback.operations[0].compensatingOperation, 'archive_created_record');
});

check('62. rollback preserves immutable history and never hard-deletes', () => {
  const m = acceptanceManifest({ minimumOverallScore: 7 });
  const state = {
    test_acceptance: [
      {
        canonicalKey: 'acceptance.example-university-proficiency',
        payload: { acceptanceStatus: 'accepted', acceptanceScope: 'institution', countryCode: 'GB', minimumOverallScore: 6.5 },
        valueFingerprint: 'old',
        sourceAuthority: 'official_test_org',
        sourceAuthorityTier: vl.authorityTier('official_test_org'),
        lastVerifiedAt: daysAgo(200),
      },
    ],
  };
  const rollback = planner.buildRollbackPlan(plan(m, state));
  assert.strictEqual(rollback.preservesImmutableHistory, true);
  assert.strictEqual(rollback.hardDeletes, 0);
  const supersede = rollback.operations.find((o) => o.appliedOperation === 'supersede');
  assert.strictEqual(supersede.compensatingOperation, 'clear_supersession_pointer_and_archive_replacement');
  assert.strictEqual(supersede.destructive, false);
  for (const op of rollback.operations) assert.strictEqual(op.destructive, false);
});

// ── 63–66. Publication, authorization and audit ──────────────────────────────

console.log('\nPublication, authorization and audit');

check('63. importing into canonical storage does not grant publication', () => {
  const entry = firstEntry(plan(manifest()), 'test.example-proficiency');
  assert.strictEqual(entry.publicationState, 'draft_pending_publication_policy');
  const report = planner.buildLaunchReport(validate(manifest()), plan(manifest()));
  assert.match(report.publicationSeparation, /does_not_grant_publication/);
});

check('64. admin approval identity is server-derived, never taken from the body', () => {
  const controller = fs.readFileSync(
    path.join(serverDir, 'controllers/data/adminVerifiedLaunchController.js'),
    'utf8'
  );
  assert.ok(/req\.user\?\.role/.test(controller), 'actor role read from the session');
  assert.ok(!/req\.body/.test(controller), 'no actor identity read from the request body');
  assert.ok(/auditFromRequest\(req\)/.test(controller), 'audit actor derived from the request');
});

check('65. a non-Admin cannot approve a launch batch', () => {
  for (const role of ['student', 'employer', 'agent', 'institution', 'editor', 'moderator', '']) {
    assert.strictEqual(vl.canApproveLaunchBatch({ role }), false, role || '(empty)');
  }
  assert.strictEqual(vl.canApproveLaunchBatch({ role: 'admin' }), true);
  assert.strictEqual(vl.canApproveLaunchBatch({ role: 'superadmin' }), true);
  assert.strictEqual(vl.canApproveLaunchBatch({}), false);
});

check('65b. the batch lifecycle has no production_launched state', () => {
  assert.ok(!Object.values(vl.BATCH_REVIEW_STATES).includes('production_launched'));
  assert.strictEqual(vl.isValidBatchTransition('draft', 'applied_nonproduction_future'), false);
  assert.strictEqual(vl.isValidBatchTransition('approved_for_nonproduction', 'applied_nonproduction_future'), true);
  assert.strictEqual(vl.isValidBatchTransition('archived', 'draft'), false);
});

check('66. the audit payload carries no manifest body or secrets', () => {
  const controller = fs.readFileSync(
    path.join(serverDir, 'controllers/data/adminVerifiedLaunchController.js'),
    'utf8'
  );
  const auditBlock = controller.slice(
    controller.indexOf('await logAudit'),
    controller.lastIndexOf('res.json({')
  );
  assert.ok(auditBlock.length > 0, 'audit block located');
  assert.ok(!/manifest:/.test(auditBlock), 'no manifest body in the audit metadata');
  assert.ok(!/records:/.test(auditBlock), 'no record payloads in the audit metadata');
  assert.ok(/manifestFingerprint/.test(auditBlock), 'fingerprint is recorded instead');
});

// ── 67–70. Report, fixture separation, isolation ─────────────────────────────

console.log('\nReport, fixture separation and isolation');

check('67. the launch report source/freshness counts are truthful', () => {
  const m = manifest({
    sourceSnapshot: [source(), institutionSource()],
    records: [institutionRecord(), record()],
  });
  const report = planner.buildLaunchReport(validate(m), plan(m));
  assert.deepStrictEqual(report.bySourceAuthority, { university: 1, official_test_org: 1 });
  assert.deepStrictEqual(report.byFreshness, { fresh: 2 });
  assert.deepStrictEqual(report.byCountry, { GB: 1, unspecified: 1 });
  assert.strictEqual(report.totalRecords, 2);
  assert.ok(!('qualityScore' in report), 'no synthesized quality percentage');
});

check('68. the test fixture directory cannot be treated as a launch pack', () => {
  const fixtureRelative = path.relative(
    pack.LAUNCH_PACK_ROOT,
    path.join(serverDir, '__tests__/fixtures/verifiedLaunch/synthetic-fixture-pack.json')
  );
  const escape = structureError(() => pack.loadLaunchPack(fixtureRelative));
  assert.ok(escape, 'must refuse');
  assert.strictEqual(escape.code, 'launch_pack_path_outside_root');

  // Even pointed directly at the fixture directory as its root, it is refused.
  const direct = structureError(() =>
    pack.loadLaunchPack('synthetic-fixture-pack.json', {
      root: path.join(serverDir, '__tests__/fixtures/verifiedLaunch'),
    })
  );
  assert.strictEqual(direct.code, 'launch_pack_path_is_test_fixture');

  assert.strictEqual(structureError(() => pack.loadLaunchPack('../../etc/passwd')).code, 'launch_pack_path_outside_root');
  assert.strictEqual(structureError(() => pack.loadLaunchPack('pack.txt')).code, 'launch_pack_not_json');

  // And the fixture would be rejected on content anyway: it declares itself synthetic.
  const fixture = JSON.parse(
    fs.readFileSync(path.join(serverDir, '__tests__/fixtures/verifiedLaunch/synthetic-fixture-pack.json'), 'utf8')
  );
  assert.strictEqual(validate(fixture).summary.validRecords, 0);
});

check('69. no external HTTP/DNS/source checking exists in the launch pipeline', () => {
  const files = [
    'services/data/verifiedLaunchManifest.js',
    'services/data/verifiedLaunchPlanner.js',
    'services/data/verifiedLaunchGate.js',
    'services/data/verifiedLaunchPack.js',
    'controllers/data/adminVerifiedLaunchController.js',
  ].map((rel) => fs.readFileSync(path.join(serverDir, rel), 'utf8'));
  files.push(fs.readFileSync(path.join(sharedDir, 'data/verifiedLaunch.js'), 'utf8'));
  files.push(fs.readFileSync(path.join(repoRoot, 'scripts/verified-data-launch.mjs'), 'utf8'));

  for (const src of files) {
    assert.ok(!/\bfetch\s*\(/.test(src), 'no fetch');
    assert.ok(!/\brequire\(['"]https?['"]\)|from ['"]node:?https?['"]/.test(src), 'no http client import');
    assert.ok(!/axios|node-fetch|puppeteer|playwright|dns\.|cheerio/.test(src), 'no network/scraping dependency');
    assert.ok(!/sourceCheckerBoundary|checkSourceLive/.test(src), 'no live source checking');
  }
});

check('70. no live DB mutation, worker, provider, payment or AI call is reachable', () => {
  const files = [
    'services/data/verifiedLaunchManifest.js',
    'services/data/verifiedLaunchPlanner.js',
    'services/data/verifiedLaunchGate.js',
    'services/data/verifiedLaunchPack.js',
  ].map((rel) => fs.readFileSync(path.join(serverDir, rel), 'utf8'));

  for (const src of files) {
    assert.ok(!/mongoose|mongodb/.test(src), 'no database driver');
    assert.ok(!/stripe|nodemailer|twilio|sendgrid|openai|anthropic/i.test(src), 'no provider/AI/payment client');
    assert.ok(!/jobQueueService|worker\.js|bullmq|Queue\(/.test(src), 'no worker/queue');
  }

  const controller = fs.readFileSync(
    path.join(serverDir, 'controllers/data/adminVerifiedLaunchController.js'),
    'utf8'
  );
  assert.ok(!/\.save\(|updateOne|insertMany|findOneAndUpdate|deleteOne|deleteMany/.test(controller), 'controller performs no writes');
});

// ── 71–75. Boundaries preserved ──────────────────────────────────────────────

console.log('\nPreserved boundaries');

check('71. the launch router is read-only and Admin-gated', () => {
  const routes = fs.readFileSync(path.join(serverDir, 'routes/adminVerifiedLaunch.js'), 'utf8');
  assert.ok(!/\.post\(|\.patch\(|\.put\(|\.delete\(/.test(routes), 'no mutating routes');
  assert.match(routes, /requirePermission\(PERMISSIONS\.DATA_QUALITY_MANAGE\)/);
  const adminRoutes = fs.readFileSync(path.join(serverDir, 'routes/admin.js'), 'utf8');
  assert.match(adminRoutes, /adminVerifiedLaunchRouter/);
});

check('72. no public route exposes launch data', () => {
  const routesDir = path.join(serverDir, 'routes');
  for (const file of fs.readdirSync(routesDir)) {
    if (file === 'adminVerifiedLaunch.js' || file === 'admin.js') continue;
    const full = path.join(routesDir, file);
    if (!fs.statSync(full).isFile() || !file.endsWith('.js')) continue;
    const src = fs.readFileSync(full, 'utf8');
    assert.ok(!/verified-launch|verifiedLaunch/.test(src), `${file} must not expose launch data`);
  }
});

check('73. canonical public APIs keep their own authority — no parallel launch endpoint', () => {
  const controller = fs.readFileSync(
    path.join(serverDir, 'controllers/data/adminVerifiedLaunchController.js'),
    'utf8'
  );
  // The launch pipeline feeds canonical models; it never becomes a second read path.
  assert.ok(!/models\/education|models\/trust/.test(controller), 'no direct canonical model read path here');
  const testController = fs.readFileSync(path.join(serverDir, 'controllers/education/testController.js'), 'utf8');
  assert.ok(!/verifiedLaunch/.test(testController), 'public test API untouched by the launch pipeline');
});

check('74. Mission 5 authority/freshness semantics are reused, not redefined', () => {
  const src = fs.readFileSync(path.join(sharedDir, 'data/verifiedLaunch.js'), 'utf8');
  assert.match(src, /from '\.\.\/trust\/sourceVerification\.js'/);
  assert.ok(!/AUTHORITY_TIERS = |FRESHNESS_STATES = Object\.freeze/.test(src), 'hierarchy not redefined');
  assert.strictEqual(vl.AUTHORITY_TYPES, sourceVerification.AUTHORITY_TYPES);
  assert.strictEqual(vl.FRESHNESS_STATES, sourceVerification.FRESHNESS_STATES);
});

check('75. the two protected historical docs are untouched', () => {
  for (const doc of [
    'docs/POST_RELEASE_PRODUCTION_ACCEPTANCE_REPORT.md',
    'docs/STRIDETO_AUDIT_01_COMPLETE_PLATFORM_SECURITY_AUDIT.md',
  ]) {
    assert.ok(fs.existsSync(path.join(repoRoot, doc)), `${doc} must still exist`);
  }
});

check('76. the shipped initial launch pack is loadable, valid and empty', () => {
  const { validation } = pack.loadLaunchPack('initial-launch-pack.v1.json', { now: NOW });
  assert.strictEqual(validation.ok, true);
  assert.strictEqual(validation.manifestVersion, vl.MANIFEST_SCHEMA_VERSION);
  assert.strictEqual(validation.summary.totalRecords, 0, 'zero real records — evidence was insufficient');
  assert.strictEqual(validation.summary.totalSources, 0);
  assert.strictEqual(validation.environmentIntent, 'local');
  const p = planner.planLaunchBatch(validation, planner.createCanonicalStateSnapshot({}));
  assert.strictEqual(p.entries.length, 0);
  assert.strictEqual(planner.buildRollbackPlan(p).operations.length, 0);
});

check('77. atomicity is described honestly, never overclaimed', () => {
  const nonTx = gate.describeApplyAtomicity({ transactionsAvailable: false });
  assert.strictEqual(nonTx.mode, 'ordered_non_transactional');
  assert.ok(nonTx.partialFailureStates.includes('partially_applied'));
  assert.ok(nonTx.partialFailureStates.includes('manual_recovery_required'));
  const tx = gate.describeApplyAtomicity({ transactionsAvailable: true });
  assert.strictEqual(tx.mode, 'transactional');
});

check('78. institution-official submissions keep their attribution', () => {
  const m = manifest({
    sourceSnapshot: [institutionSource()],
    records: [
      institutionRecord({
        provenance: {
          origin: 'institution_official',
          submittedByInstitutionKey: 'institution.example-university',
          sourceKeys: ['src-university'],
          facts: {},
        },
      }),
    ],
  });
  const v = validate(m);
  assert.strictEqual(v.records[0].provenance.attribution, 'institution_official');
  assert.notStrictEqual(v.records[0].provenance.attribution, 'strideto_verified');

  // Institution-official origin without attribution is rejected.
  const unattributed = manifest({
    sourceSnapshot: [institutionSource()],
    records: [institutionRecord({ provenance: { origin: 'institution_official', sourceKeys: ['src-university'], facts: {} } })],
  });
  assert.ok(
    validate(unattributed).invalidRecords[0].errors.some(
      (e) => e.reason === 'institution_official_requires_institution_attribution'
    )
  );
});

check('79. validation errors identify record, field and reason without leaking payload', () => {
  const m = manifest({
    records: [record({ recordKey: 'test.bad', payload: { name: '', category: '' } })],
  });
  const bad = validate(m).invalidRecords[0];
  assert.strictEqual(bad.recordKey, 'test.bad');
  assert.strictEqual(bad.entityType, 'test');
  for (const err of bad.errors) {
    assert.ok(typeof err.field === 'string' && err.field.length);
    assert.ok(typeof err.reason === 'string' && err.reason.length);
    assert.ok(!('value' in err), 'raw values are never echoed back');
  }
});

check('80. no startup or boot path triggers a launch import', () => {
  const candidates = ['index.js', 'worker.js', 'seed/index.js'];
  for (const rel of candidates) {
    const full = path.join(serverDir, rel);
    if (!fs.existsSync(full)) continue;
    const src = fs.readFileSync(full, 'utf8');
    assert.ok(!/verifiedLaunch|verified-launch/.test(src), `${rel} must not run a launch import`);
  }
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\nMission 25 — Controlled Verified Data Launch: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
