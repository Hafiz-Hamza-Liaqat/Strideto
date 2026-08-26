/**
 * SCH-UNI — Unified Institution Scholarship Discovery (main /scholarships).
 *
 * Contract/static tests (no DB). Run:
 *   node src/__tests__/unifiedInstitutionScholarshipDiscovery.test.js
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const sharedDir = path.resolve(root, 'shared');
const clientSrc = path.resolve(root, 'client/src');
const serverSrc = path.resolve(root, 'server/src');

const loadShared = (rel) => import(pathToFileURL(path.join(sharedDir, rel)).href);
const read = (abs) => fs.readFileSync(abs, 'utf8');

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

const unified = await loadShared('publicDiscovery/unifiedScholarshipDiscovery.js');
const readiness = await loadShared('cms/publicReadiness.js');
const schCtrl = read(path.join(serverSrc, 'controllers/scholarshipsController.js'));
const discoverySvc = read(path.join(serverSrc, 'services/unifiedScholarshipDiscoveryService.js'));
const portalSvc = read(path.join(serverSrc, 'services/institutionPortalService.js'));
const portalRoutes = read(path.join(serverSrc, 'routes/institutionPortal.js'));
const canSchCtrl = read(path.join(serverSrc, 'controllers/education/scholarshipController.js'));
const scholarshipsPage = read(path.join(clientSrc, 'pages/Scholarships/Scholarships.jsx'));
const intelDetail = read(path.join(clientSrc, 'pages/Scholarships/ScholarshipIntelligenceDetail.jsx'));
const institutionSchPage = read(path.join(clientSrc, 'pages/Institution/InstitutionScholarships.jsx'));
const adminSchCtrl = read(path.join(serverSrc, 'controllers/admin/adminScholarshipsController.js'));
const phase9 = read(path.join(serverSrc, '__tests__/phase9CmsPublication.test.js'));
const intlCtrl = read(path.join(serverSrc, 'controllers/intlScholarshipsController.js'));

console.log('\n── SCH-UNI Unified Institution Scholarship Discovery ──');

const cmsDoc = {
  _id: 'cms1',
  title: 'CMS Merit Award',
  slug: 'cms-merit-award',
  provider: 'Strideto CMS',
  university: 'Demo U',
  country: 'Pakistan',
  province: 'Punjab',
  city: 'Lahore',
  level: 'Undergraduate',
  amount: 'Full tuition',
  fundingType: 'Fully Funded',
  status: 'active',
  deadline: new Date('2027-01-15'),
  createdAt: new Date('2026-01-01'),
  logoUrl: 'https://example.com/logo.png',
};

const institution = {
  _id: 'inst1',
  officialName: 'Canonical Tech University',
  slug: 'canonical-tech-university',
  countryCode: 'PK',
  region: 'Punjab',
  city: 'Lahore',
  status: 'published',
  isFixture: false,
};

const publishedInstitutional = {
  _id: 'can1',
  title: 'CTU Excellence Scholarship',
  slug: 'ctu-excellence',
  status: 'published',
  scholarshipType: 'institutional',
  institutionId: 'inst1',
  provider: { name: 'CTU', providerType: 'university' },
  degreeLevels: ['bachelor'],
  fields: ['computing'],
  funding: { type: 'partial', amountMinor: 500000, currency: 'PKR' },
  deadlineDate: '2027-03-01',
  cycleLabel: 'Fall 2027',
  sources: [{ sourceType: 'institution', sourceUrl: 'https://ctu.example.edu/aid' }],
  createdAt: new Date('2026-02-01'),
  adminNotes: 'SECRET — must not leak',
};

check('SCH-UNI-01 Main /scholarships still returns CMS scholarship', () => {
  assert.ok(schCtrl.includes('listUnifiedScholarships'));
  assert.ok(discoverySvc.includes('Scholarship.find') || discoverySvc.includes('projectCmsScholarshipDiscoveryCard'));
  const card = unified.projectCmsScholarshipDiscoveryCard(cmsDoc);
  assert.equal(card.sourceType, unified.UNIFIED_SCHOLARSHIP_SOURCE.CMS);
  assert.equal(card.title, 'CMS Merit Award');
  assert.equal(card.detailUrl, '/scholarships/cms-merit-award');
  assert.equal(card.savable, true);
});

check('SCH-UNI-02 Published canonical Institution scholarship appears in main discovery', () => {
  const card = unified.projectInstitutionCanonicalScholarshipDiscoveryCard(
    publishedInstitutional,
    institution
  );
  assert.ok(card);
  assert.equal(card.sourceType, unified.UNIFIED_SCHOLARSHIP_SOURCE.INSTITUTION_CANONICAL);
  assert.equal(card.title, 'CTU Excellence Scholarship');
  assert.ok(discoverySvc.includes('scholarshipType') && discoverySvc.includes('INSTITUTIONAL'));
  assert.ok(discoverySvc.includes("status: 'published'"));
});

check('SCH-UNI-03 Draft/submitted/non-public canonical scholarship does not appear', () => {
  for (const status of ['draft', 'submitted', 'under_review', 'needs_changes', 'archived']) {
    const card = unified.projectInstitutionCanonicalScholarshipDiscoveryCard(
      { ...publishedInstitutional, status },
      institution
    );
    assert.equal(card, null, `status ${status} must not project`);
  }
  assert.equal(
    readiness.isInstitutionCanonicalScholarshipPublicReady({ ...publishedInstitutional, status: 'draft' }),
    false
  );
});

check('SCH-UNI-04 Fixture/test canonical scholarship excluded', () => {
  const fixtureInst = { ...institution, isFixture: true };
  const card = unified.projectInstitutionCanonicalScholarshipDiscoveryCard(
    publishedInstitutional,
    fixtureInst
  );
  assert.equal(card, null);
  assert.ok(discoverySvc.includes('withFixtureExclusion'));
});

check('SCH-UNI-05 Canonical Institution attribution is correct', () => {
  const card = unified.projectInstitutionCanonicalScholarshipDiscoveryCard(
    publishedInstitutional,
    institution
  );
  assert.equal(card.institution, 'Canonical Tech University');
  assert.equal(card.countryCode, 'PK');
  assert.ok(card.authorityKind === 'institution_scholarship');
  assert.ok(!card.adminNotes);
});

check('SCH-UNI-06 Institution detail link uses canonical slug', () => {
  const card = unified.projectInstitutionCanonicalScholarshipDiscoveryCard(
    publishedInstitutional,
    institution
  );
  assert.equal(card.institutionSlug, 'canonical-tech-university');
  assert.ok(scholarshipsPage.includes('institutionSlug'));
  assert.ok(scholarshipsPage.includes('EDUCATION_INSTITUTION_DETAIL') || scholarshipsPage.includes('/institutions/'));
  assert.ok(intelDetail.includes('/institutions/') || intelDetail.includes('institutionHref'));
});

check('SCH-UNI-07 Program-scoped scholarship retains Program scope', () => {
  const scope = unified.buildApplicabilityScopeSummary({
    applicability: [{ scope: 'program', programId: { name: 'BS Computer Science' } }],
  });
  assert.equal(scope.kind, 'program');
  assert.ok(scope.label.includes('BS Computer Science'));
  assert.ok(scope.label.startsWith('Available for:'));
  assert.ok(!scope.label.includes('institution-wide'));
});

check('SCH-UNI-08 Intake-scoped scholarship retains Intake scope', () => {
  const scope = unified.buildApplicabilityScopeSummary({
    cycleLabel: 'Fall 2027',
    cycles: [{ intake: 'Fall 2027', cycleLabel: 'Fall 2027' }],
  });
  assert.equal(scope.kind, 'intake');
  assert.ok(scope.label.includes('Fall 2027'));
  assert.ok(scope.label.startsWith('Available for:'));
});

check('SCH-UNI-09 Country filter works across CMS + canonical source', () => {
  assert.ok(discoverySvc.includes('freeTextCountryRegex') || discoverySvc.includes('passesCountryFilter'));
  assert.ok(discoverySvc.includes('coerceCountryCode'));
  const cmsCard = unified.projectCmsScholarshipDiscoveryCard(cmsDoc);
  const canCard = unified.projectInstitutionCanonicalScholarshipDiscoveryCard(
    publishedInstitutional,
    institution
  );
  assert.ok(cmsCard.countryCode === 'PK' || cmsCard.country === 'Pakistan');
  assert.equal(canCard.countryCode, 'PK');
});

check('SCH-UNI-10 Study-level/field filters do not silently drop canonical source', () => {
  assert.ok(discoverySvc.includes('passesLevelFilter'));
  assert.ok(discoverySvc.includes('mapCmsLevelFilterToCanonical') || discoverySvc.includes('degreeLevels'));
  // Empty degreeLevels must not invent exclusion
  const card = unified.projectInstitutionCanonicalScholarshipDiscoveryCard(
    { ...publishedInstitutional, degreeLevels: [] },
    institution,
  );
  assert.ok(card);
  assert.ok(Array.isArray(unified.mapCmsLevelFilterToCanonical('Undergraduate')));
  assert.ok(unified.mapCmsLevelFilterToCanonical('Undergraduate').includes('bachelor'));
});

check('SCH-UNI-11 No internal/admin fields leak', () => {
  const card = unified.projectInstitutionCanonicalScholarshipDiscoveryCard(
    publishedInstitutional,
    institution
  );
  assert.ok(unified.assertNoInternalScholarshipLeak(card));
  assert.equal(Object.prototype.hasOwnProperty.call(card, 'adminNotes'), false);
  assert.ok(canSchCtrl.includes("select('-adminNotes") || canSchCtrl.includes("'-adminNotes"));
  assert.ok(discoverySvc.includes("'-adminNotes") || discoverySvc.includes('-adminNotes'));
});

check('SCH-UNI-12 CMS detail routing remains unchanged', () => {
  assert.ok(schCtrl.includes('getScholarshipByIdOrSlug'));
  assert.ok(schCtrl.includes('projectPublicCmsScholarship'));
  const card = unified.projectCmsScholarshipDiscoveryCard(cmsDoc);
  assert.equal(card.detailUrl, '/scholarships/cms-merit-award');
  assert.ok(!card.detailUrl.includes('scholarship-intelligence'));
});

check('SCH-UNI-13 Canonical detail routing resolves correctly', () => {
  const card = unified.projectInstitutionCanonicalScholarshipDiscoveryCard(
    publishedInstitutional,
    institution
  );
  assert.equal(card.detailUrl, '/scholarship-intelligence/ctu-excellence');
  assert.ok(scholarshipsPage.includes('detailUrl') || scholarshipsPage.includes('detailTo'));
  assert.ok(canSchCtrl.includes('applicabilityScope') || canSchCtrl.includes('buildApplicabilityScopeSummary'));
});

check('SCH-UNI-14 No title-string/fuzzy deduplication', () => {
  assert.ok(!discoverySvc.includes('fuzzy'));
  assert.ok(!discoverySvc.includes('title.toLowerCase() ==='));
  assert.ok(!unified.mergeUnifiedScholarshipCards.toString().includes('title'));
  const merged = unified.mergeUnifiedScholarshipCards(
    [unified.projectCmsScholarshipDiscoveryCard(cmsDoc)],
    [unified.projectInstitutionCanonicalScholarshipDiscoveryCard(publishedInstitutional, institution)],
    'newest'
  );
  assert.equal(merged.length, 2);
  assert.ok(merged.some((c) => c.sourceType === 'cms'));
  assert.ok(merged.some((c) => c.sourceType === 'institution_canonical'));
});

check('SCH-UNI-15 Institution authority remains enforced', () => {
  assert.ok(portalSvc.includes('submitOwnedScholarshipForReview'));
  assert.ok(portalSvc.includes('STATUS_FORBIDDEN') || portalSvc.includes('cannot set publication status'));
  assert.ok(portalRoutes.includes('/scholarships/:scholarshipId/submit'));
  assert.ok(institutionSchPage.includes('submitScholarship') || institutionSchPage.includes('Submit for review'));
  assert.ok(!unified.isInstitutionCanonicalScholarshipDiscoverable(
    { ...publishedInstitutional, status: 'published' },
    null
  ));
  assert.ok(portalSvc.includes('assertOfficialInstitutionWrite') || institutionSchPage.includes('canSubmitOrPublish'));
});

check('SCH-UNI-16 Existing Phase 9 Scholarship publication behavior unchanged', () => {
  assert.ok(fs.existsSync(path.join(serverSrc, '__tests__/phase9CmsPublication.test.js')));
  assert.ok(adminSchCtrl.includes('deriveCmsLaunchEligible') || adminSchCtrl.includes('syncScholarshipLaunchEligible'));
  assert.ok(schCtrl.includes('getScholarshipByIdOrSlug'));
  assert.ok(phase9.length > 0);
  // Intl remains separate product
  assert.ok(intlCtrl.includes('status') && intlCtrl.includes('active'));
  assert.ok(!discoverySvc.includes('IntlScholarship'));
});

console.log(`\nunifiedInstitutionScholarshipDiscovery.test.js: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
