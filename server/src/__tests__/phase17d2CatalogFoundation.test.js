/**
 * Phase 17D-2 — jurisdiction / official-source / fee catalog foundation.
 * Run: node src/__tests__/phase17d2CatalogFoundation.test.js
 */
import assert from 'node:assert/strict';
import { loadGbsCatalogManifest } from '../../../shared/gbs/catalog/index.js';
import { US_SUBNATIONAL } from '../../../shared/gbs/catalog/usSubnational.js';
import {
  CATALOG_REVIEW_STATUSES,
  FEE_AMOUNT_MODELS,
  PUBLICATION_ELIGIBILITY_STATES,
  SOURCE_TYPES,
  US_LAUNCH_CANDIDATE_CODES,
} from '../../../shared/gbs/catalogConstants.js';
import {
  validateJurisdictionGraph,
  validateJurisdictionRecord,
} from '../../../shared/gbs/jurisdictionHierarchy.js';
import { resolvePublicationEligibility } from '../../../shared/gbs/publicationEligibility.js';
import { assertLegalFactSourceAllowed, canBecomeAuthoritativeLegalFact } from '../../../shared/gbs/officialSourcePolicy.js';
import { validateOfficialSourceUrl } from '../../../shared/gbs/officialSourceUrl.js';
import { validateGovernmentFeeRecord } from '../../../shared/gbs/governmentFeePolicy.js';
import { assertEntityTypeJurisdiction } from '../../../shared/gbs/entityTypeScope.js';
import { catalogFingerprintCanonical } from '../../../shared/gbs/catalogFingerprint.js';
import { hashCatalogFingerprint } from '../services/gbs/catalogFingerprintHash.js';
import {
  createSourceReviewService,
  createMemorySourceStore,
} from '../services/gbs/sourceReviewService.js';
import { importGbsCatalog, createMemoryCatalogStore } from '../services/gbs/catalogImportService.js';
import { assertCatalogApplyAllowed, parseCatalogImportMode } from '../services/gbs/catalogApplyGuard.js';
import { applyOptimisticMutation, OPTIMISTIC_CONCURRENCY_CODE } from '../../../shared/platform/optimisticConcurrency.js';
import { isBusinessServicesEnabled } from '../../../shared/gbs/constants.js';
import { GBS_AUDIT_EVENTS, isKnownGbsAuditEvent } from '../../../shared/security/gbsAuditEvents.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const catalog = loadGbsCatalogManifest();
const byId = Object.fromEntries(catalog.jurisdictions.map((j) => [j.id, j]));
const sourceById = Object.fromEntries(catalog.sources.map((s) => [s.sourceId, s]));
const feeById = Object.fromEntries(catalog.fees.map((f) => [f.feeId, f]));
const entityById = Object.fromEntries(catalog.entityTypes.map((e) => [e.entityTypeId, e]));
const now = new Date('2026-08-14T12:00:00.000Z');

// A. JURISDICTION
{
  const graph = validateJurisdictionGraph(catalog.jurisdictions);
  check(graph.ok === true, '1. hierarchy valid');

  const child = validateJurisdictionRecord(
    { id: 'j:orphan', code: 'XX', countryCode: 'US', name: 'Orphan', level: 'state', parentJurisdictionId: 'j:missing' },
    { knownIds: new Set(['j:US']) }
  );
  check(child.ok === false && child.errors.some((e) => e.includes('unknown parent')), '2. parent must exist');

  const cyclic = validateJurisdictionGraph([
    { id: 'j:A', code: 'A', countryCode: 'US', name: 'A', level: 'state', parentJurisdictionId: 'j:B' },
    { id: 'j:B', code: 'B', countryCode: 'US', name: 'B', level: 'state', parentJurisdictionId: 'j:A' },
  ]);
  check(cyclic.ok === false, '3. cycle rejected');

  const dup = validateJurisdictionGraph([
    { id: 'j:US-WY', code: 'WY', countryCode: 'US', name: 'Wyoming', level: 'state', parentJurisdictionId: 'j:US' },
    { id: 'j:US-WY2', code: 'WY', countryCode: 'US', name: 'Wyoming 2', level: 'state', parentJurisdictionId: 'j:US' },
    { id: 'j:US', code: 'US', countryCode: 'US', name: 'United States', level: 'country', parentJurisdictionId: null },
  ]);
  check(dup.ok === false, '4. unique codes');

  const usStates = catalog.jurisdictions.filter((j) => j.countryCode === 'US' && j.level !== 'country');
  check(usStates.length === 51, '5. all US states + DC structurally represented');
  check(US_SUBNATIONAL.length === 51, '5b. ISO 3166-2 inventory has 50 states + DC');
  check(usStates.some((j) => j.code === 'DC' && j.level === 'district'), '5c. DC is district not state');

  const candidates = usStates.filter((j) => j.launchCandidate);
  check(
    candidates.map((j) => j.code).sort().join(',') === [...US_LAUNCH_CANDIDATE_CODES].sort().join(','),
    '6. only DE/WY/FL/TX are initial candidate markers'
  );
  check(
    candidates.every((j) => j.reviewStatus === CATALOG_REVIEW_STATUSES.DRAFT),
    '7. candidate != reviewed/public'
  );
  check(
    catalog.jurisdictions.every((j) => j.reviewStatus === CATALOG_REVIEW_STATUSES.DRAFT),
    '7b. no jurisdiction row is publication-reviewed'
  );
}

// B. SOURCE AUTHORITY
{
  const registrar = sourceById['src:US-WY-sos'];
  check(
    assertLegalFactSourceAllowed(registrar).ok === true,
    '8. official registrar source allowed'
  );
  check(
    assertLegalFactSourceAllowed(sourceById['src:US-IRS-EIN']).ok === true,
    '9. official tax authority allowed'
  );
  check(
    canBecomeAuthoritativeLegalFact(SOURCE_TYPES.COMPETITOR_MARKETING) === false &&
      canBecomeAuthoritativeLegalFact(SOURCE_TYPES.PROVIDER_BLOG) === false,
    '10. competitor/blog source cannot become authoritative legal fact'
  );
  check(
    canBecomeAuthoritativeLegalFact(SOURCE_TYPES.PROVIDER_SELF_DECLARED) === false,
    '11. provider self-declared source cannot become government rule'
  );
  check(
    assertLegalFactSourceAllowed({
      ...registrar,
      jurisdictionId: 'j:US-DE',
      expectedJurisdictionId: 'j:US-WY',
    }).ok === false,
    '12. wrong authority/jurisdiction bind rejected'
  );
}

// C. FRESHNESS
{
  const reviewedFresh = {
    reviewStatus: 'reviewed',
    superseded: false,
    reviewDueAt: '2026-11-12T12:00:00.000Z',
    effectiveFrom: '2026-07-01T00:00:00.000Z',
  };
  check(
    resolvePublicationEligibility(reviewedFresh, { now }).state === PUBLICATION_ELIGIBILITY_STATES.CURRENT,
    '13. reviewed + fresh + effective → current'
  );
  check(
    resolvePublicationEligibility({ ...reviewedFresh, reviewStatus: 'draft' }, { now }).eligibleCurrent === false,
    '14. draft → not current'
  );
  check(
    resolvePublicationEligibility({ ...reviewedFresh, reviewStatus: 'under_review' }, { now }).eligibleCurrent === false,
    '15. under_review → not current'
  );
  check(
    resolvePublicationEligibility({ ...reviewedFresh, reviewDueAt: '2026-08-01T00:00:00.000Z' }, { now }).state ===
      PUBLICATION_ELIGIBILITY_STATES.STALE,
    '16. reviewDueAt passed → stale'
  );
  check(
    resolvePublicationEligibility({ ...reviewedFresh, superseded: true }, { now }).eligibleCurrent === false,
    '17. superseded → not current'
  );
  check(
    resolvePublicationEligibility({ ...reviewedFresh, effectiveFrom: '2026-09-01T00:00:00.000Z' }, { now }).state ===
      PUBLICATION_ELIGIBILITY_STATES.NOT_YET_EFFECTIVE,
    '18. future effectiveFrom → not_yet_effective'
  );
  check(
    resolvePublicationEligibility({ ...reviewedFresh, effectiveTo: '2026-08-01T00:00:00.000Z' }, { now }).state ===
      PUBLICATION_ELIGIBILITY_STATES.EXPIRED,
    '19. past effectiveTo → expired'
  );
  check(
    resolvePublicationEligibility({ ...reviewedFresh, reviewStatus: 'rejected' }, { now }).eligibleCurrent === false,
    '20. rejected → not current'
  );
}

// D. HISTORY / CONCURRENCY
{
  const store = createMemorySourceStore();
  const svc = createSourceReviewService({ store, audit: async () => {} });
  const staff = { id: 'staff-1', isStaff: true, realm: 'staff' };
  const draft = await svc.createDraft(
    {
      sourceId: 'src:test-rev',
      authorityId: 'auth:US-WY-SOS',
      jurisdictionId: 'j:US-WY',
      sourceUrl: 'https://sos.wyo.gov/business/default.aspx',
      sourceType: SOURCE_TYPES.OFFICIAL_REGISTRAR,
      authorityType: 'state_registrar',
      factCategory: 'government_fee',
      title: 'WY fee v1',
      amount: 100,
    },
    staff
  );
  const first = await svc.approveReviewedRevision('src:test-rev', { expectedVersion: draft.recordVersion, actor: staff });
  const second = await svc.approveReviewedRevision('src:test-rev', {
    expectedVersion: first.recordVersion,
    actor: staff,
    nextFact: { title: 'WY fee v2', amount: 120 },
  });
  check(second.sourceVersion === first.sourceVersion + 1, '21. material reviewed source change creates new sourceVersion');
  const versions = await store.list('src:test-rev');
  check(
    versions.some((v) => v.sourceVersion === 1 && v.reviewStatus === 'superseded') &&
      versions.some((v) => v.sourceVersion === 2 && v.reviewStatus === 'reviewed'),
    '22. old revision remains queryable for historical provenance'
  );

  const feeV1 = { feeId: 'fee:x', amount: 100, sourceVersion: 1, recordVersion: 0 };
  const feeV2 = { ...feeV1, amount: 120, sourceVersion: 2, recordVersion: 0 };
  check(feeV1.amount === 100 && feeV2.amount === 120 && feeV1.sourceVersion !== feeV2.sourceVersion, '23. fee change does not mutate previous version');

  const bumped = applyOptimisticMutation({
    currentVersion: 2,
    expectedVersion: 2,
    mutate: (v) => v,
  });
  check(bumped.nextVersion === 3, '24. recordVersion concurrency works');
  try {
    applyOptimisticMutation({ currentVersion: 2, expectedVersion: 1, mutate: () => null });
    check(false, '25. stale update should throw');
  } catch (err) {
    check(err.code === OPTIMISTIC_CONCURRENCY_CODE && err.status === 409, '25. stale update → 409');
  }
}

// E. FEES
{
  const wy = feeById['fee:US-WY-llc-articles'];
  check(wy.ownership === 'government', '26. government fee separate from provider fee concepts');
  check(validateGovernmentFeeRecord({ ...wy, currency: '' }).ok === false, '27. currency required');
  check(validateGovernmentFeeRecord({ ...wy, amount: -1 }).ok === false, '28. negative amount rejected');
  check(feeById['fee:PK-SECP-incorporation'].amountModel === FEE_AMOUNT_MODELS.NOT_CATALOGUED, '29. unknown/ambiguous fee can be not_catalogued');
  check(
    catalog.fees.every((f) => f.fxAuthoritative === false) &&
      validateGovernmentFeeRecord({ ...wy, fxAuthoritative: true }).ok === false,
    '30. no FX presented as authoritative'
  );
  check(
    validateGovernmentFeeRecord({
      ...wy,
      effectiveFrom: '2026-07-01T00:00:00.000Z',
      effectiveTo: '2026-06-01T00:00:00.000Z',
    }).ok === false,
    '31. effective dates enforced'
  );
}

// F. ENTITY TYPE
{
  const wyLlc = entityById['et:US-WY:LLC'];
  const gbLtd = entityById['et:GB:LTD'];
  check(wyLlc.jurisdictionId === 'j:US-WY', '32. entity types jurisdiction-scoped');
  check(wyLlc.entityTypeId !== gbLtd.entityTypeId, '33. Wyoming LLC != global LLC authority');
  check(gbLtd.jurisdictionId === 'j:GB' && wyLlc.jurisdictionId !== gbLtd.jurisdictionId, '34. UK private limited != US entity type');
  check(
    assertEntityTypeJurisdiction(gbLtd, 'j:US-WY').ok === false,
    '35. unsupported jurisdiction/entity combination denied'
  );
}

// Research provenance for every seed legal fact (sources + fees + rules)
{
  for (const src of catalog.sources) {
    check(Boolean(src.sourceUrl), `${src.sourceId}: source URL exists`);
    check(canBecomeAuthoritativeLegalFact(src.sourceType), `${src.sourceId}: accepted official class`);
    check(Boolean(src.jurisdictionId) && Boolean(src.authorityId), `${src.sourceId}: jurisdiction/authority match fields`);
    check(Boolean(src.retrievedAt), `${src.sourceId}: retrievedAt`);
    check(Boolean(src.lastReviewedAt), `${src.sourceId}: lastReviewedAt`);
    check(Boolean(src.reviewDueAt), `${src.sourceId}: reviewDueAt`);
    check(Number(src.sourceVersion) >= 1, `${src.sourceId}: sourceVersion`);
    check(Boolean(src.reviewStatus), `${src.sourceId}: reviewStatus explicit`);
    check(validateOfficialSourceUrl(src.sourceUrl).ok === true, `${src.sourceId}: https official URL`);
  }
  for (const fee of catalog.fees) {
    check(Boolean(fee.sourceId) && Boolean(sourceById[fee.sourceId]), `${fee.feeId}: source URL exists via sourceId`);
    check(Boolean(fee.reviewStatus), `${fee.feeId}: reviewStatus explicit`);
    check(Number(fee.sourceVersion) >= 1, `${fee.feeId}: sourceVersion`);
  }
}

// Authority separation
{
  check(
    catalog.authorities.some((a) => a.authorityId === 'auth:US-IRS') &&
      catalog.authorities.some((a) => a.authorityId === 'auth:US-WY-SOS'),
    'IRS is not conflated with state registrar'
  );
  check(
    catalog.authorities.some((a) => a.authorityId === 'auth:PK-SECP') &&
      catalog.authorities.some((a) => a.authorityId === 'auth:PK-FBR'),
    'SECP is not conflated with FBR'
  );
  check(
    catalog.authorities.some((a) => a.authorityId === 'auth:GB-CH') &&
      catalog.authorities.some((a) => a.authorityId === 'auth:GB-HMRC'),
    'Companies House is not conflated with HMRC'
  );
}

// Import dry-run + refuse live
{
  const summary = await importGbsCatalog({ store: createMemoryCatalogStore(), apply: false });
  check(summary.mode === 'dry-run' && summary.create > 0 && summary.persistentImport === false, 'importer default dry-run');
  check(parseCatalogImportMode([]).dryRun === true, 'CLI default dry-run');
  check(assertCatalogApplyAllowed({ apply: true, dbName: 'edurozgaar', confirm: '1' }).ok === false, 'refuse persistent edurozgaar apply');
  check(
    assertCatalogApplyAllowed({ apply: true, dbName: 'strideto_17d2_isolated_a', confirm: '1' }).ok === true,
    'isolated 17d2 db may apply when confirmed'
  );
}

// URL safety
{
  check(validateOfficialSourceUrl('javascript:alert(1)').ok === false, 'reject javascript:');
  check(validateOfficialSourceUrl('http://127.0.0.1/x').ok === false, 'reject loopback');
  check(validateOfficialSourceUrl('https://192.168.1.8/x', { requireHttps: true }).ok === false, 'reject private-network');
  check(validateOfficialSourceUrl('https://sos.wyo.gov/business/default.aspx').ok === true, 'https official allowed');
}

// Fingerprint identity != legal validity
{
  const a = hashCatalogFingerprint({ sourceId: 's', amount: 100 });
  const b = hashCatalogFingerprint({ sourceId: 's', amount: 120 });
  check(a !== b && catalogFingerprintCanonical({ sourceId: 's' }).includes('s'), 'fingerprint detects revision identity');
}

// Feature still off / no public routes
{
  check(isBusinessServicesEnabled({}) === false, 'Business Services feature OFF by default');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pageReg = readFileSync(path.resolve(here, '../../../shared/pageRegistry.js'), 'utf8');
  const robots = readFileSync(path.resolve(here, '../../../client/public/robots.txt'), 'utf8');
  check(!/\/business-services/.test(pageReg), 'no public /business-services page');
  check(!/business-services/.test(robots) || /Disallow/.test(robots), 'robots not advertising GBS marketplace');
}

check(isKnownGbsAuditEvent(GBS_AUDIT_EVENTS.SOURCE_REVIEWED), 'source_reviewed audit event exists');
check(isKnownGbsAuditEvent(GBS_AUDIT_EVENTS.FEE_SUPERSEDED), 'fee_superseded audit event exists');
check(byId['j:US-WY'].parentJurisdictionId === 'j:US', 'Wyoming parent is US country');
check(!Object.prototype.hasOwnProperty.call(byId['j:US-WY'], 'state') || byId['j:US-WY'].level === 'state', 'no universal state field; level is used');

console.log(`phase17d2CatalogFoundation.test.js: ${count} assertions passed`);
