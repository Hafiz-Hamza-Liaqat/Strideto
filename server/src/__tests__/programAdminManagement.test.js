/**
 * PROGRAM-ADM — Admin Program management for Program Explorer.
 *
 * Contract/static tests (no DB). Run:
 *   node src/__tests__/programAdminManagement.test.js
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

const taxonomy = await loadShared('education/taxonomy.js');
const readiness = await loadShared('cms/publicReadiness.js');
const fixture = await loadShared('publicDiscovery/fixtureExclusion.js');

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

const adminCtrl = read(path.join(serverSrc, 'controllers/education/adminEducationController.js'));
const intelCtrl = read(path.join(serverSrc, 'controllers/education/adminScholarshipController.js'));
const adminRoutes = read(path.join(serverSrc, 'routes/adminEducation.js'));
const publicCtrl = read(path.join(serverSrc, 'controllers/education/programIntelligenceController.js'));
const programModel = read(path.join(serverSrc, 'models/education/Program.js'));
const portalSvc = read(path.join(serverSrc, 'services/institutionPortalService.js'));
const nav = read(path.join(clientSrc, 'config/adminNavConfig.js'));
const routes = read(path.join(clientSrc, 'routes/index.jsx'));
const page = read(path.join(clientSrc, 'pages/Admin/AdminPrograms.jsx'));
const api = read(path.join(clientSrc, 'services/adminEducationProgramsApi.js'));
const viewPublic = read(path.join(clientSrc, 'components/admin/AdminViewPublicLink.jsx'));
const acceptanceModel = read(path.join(serverSrc, 'models/education/TestAcceptance.js'));

console.log('\n── PROGRAM-ADM Admin Program management ──');

check('PROGRAM-ADM-01 Admin Programs route exists', () => {
  assert.ok(nav.includes("`/admin/programs`") || nav.includes("${ROUTES.ADMIN}/programs"), 'nav item missing');
  assert.ok(nav.includes("labelKey: 'programs'"), 'nav label missing');
  assert.ok(routes.includes("path: 'programs'"), 'client route missing');
  assert.ok(routes.includes('AdminPrograms'), 'AdminPrograms lazy import missing');
  assert.ok(fs.existsSync(path.join(clientSrc, 'pages/Admin/AdminPrograms.jsx')), 'page file missing');
});

check('PROGRAM-ADM-02 Program list loads canonical records', () => {
  assert.ok(adminRoutes.includes("adminListPrograms"), 'list route handler');
  assert.ok(adminRoutes.includes("'/education/programs'"), 'list path');
  assert.ok(adminCtrl.includes('adminListPrograms'), 'controller export');
  assert.ok(adminCtrl.includes("populate('institutionId'"), 'populates canonical institution');
  assert.ok(page.includes("useAdminList('/admin/education/programs'"), 'page uses canonical list endpoint');
  assert.ok(api.includes("/admin/education/programs"), 'API client base path');
});

check('PROGRAM-ADM-03 Search/filter parameters map correctly', () => {
  for (const key of ['search', 'status', 'country', 'region', 'city', 'institutionId', 'degreeLevel', 'field', 'studyMode']) {
    assert.ok(adminCtrl.includes(`q.${key}`) || adminCtrl.includes(`q.region`) || page.includes(`key: '${key}'`), `filter ${key}`);
  }
  assert.ok(adminCtrl.includes('q.search'), 'server search');
  assert.ok(adminCtrl.includes('q.country'), 'server country');
  assert.ok(adminCtrl.includes('q.studyMode'), 'server studyMode');
  assert.ok(adminCtrl.includes('q.region') || adminCtrl.includes("q.region || q.state"), 'server region');
  assert.ok(adminCtrl.includes('q.city'), 'server city');
  assert.ok(page.includes("key: 'search'"), 'UI search filter');
  assert.ok(page.includes("key: 'degreeLevel'"), 'UI degree filter');
  assert.ok(page.includes("key: 'studyMode'"), 'UI study mode filter');
});

check('PROGRAM-ADM-04 Draft/submitted program View Public disabled', () => {
  assert.strictEqual(readiness.isEducationProgramPublicReady({ status: 'draft', slug: 'x' }), false);
  assert.strictEqual(readiness.isEducationProgramPublicReady({ status: 'submitted', slug: 'x' }), false);
  assert.strictEqual(readiness.isEducationProgramPublicReady({ status: 'under_review', slug: 'x' }), false);
  assert.strictEqual(readiness.isEducationProgramPublicReady({ status: 'needs_changes', slug: 'x' }), false);
  assert.strictEqual(readiness.isEducationProgramPublicReady({ status: 'archived', slug: 'x' }), false);
  assert.ok(viewPublic.includes('program: isEducationProgramPublicReady'), 'AdminViewPublicLink wires program type');
  assert.ok(page.includes('type="program"'), 'page uses program View Public type');
});

check('PROGRAM-ADM-05 Published program View Public enabled only when public predicate matches', () => {
  assert.strictEqual(readiness.isEducationProgramPublicReady({ status: 'published', slug: 'mba' }), true);
  assert.strictEqual(readiness.isEducationProgramPublicReady({ status: 'published', slug: '' }), false);
  assert.strictEqual(readiness.isEducationProgramPublicReady({ status: 'published' }), false);
  assert.ok(publicCtrl.includes("status: 'published'"), 'public explorer requires published');
  assert.ok(page.includes('isEducationProgramPublicReady'), 'page uses shared readiness');
});

check('PROGRAM-ADM-06 Admin publish uses canonical server authority', () => {
  assert.ok(api.includes('publishIntelligence'), 'client publish helper');
  assert.ok(api.includes('/intelligence'), 'intelligence path');
  assert.ok(adminRoutes.includes('adminUpdateProgramIntelligence'), 'intelligence route');
  assert.ok(intelCtrl.includes("Published programs require at least one valid source"), 'source gate');
  assert.ok(intelCtrl.includes("audit(req, 'program.publish'"), 'publish audit');
  assert.ok(intelCtrl.includes('assignLaunchEligibleOnAuthorityPublish'), 'launchEligible on publish');
  assert.ok(page.includes('publishIntelligence'), 'UI calls intelligence publish');
  assert.ok(adminCtrl.includes("Published programs require at least one valid source"), 'core update also requires sources on publish');
});

check('PROGRAM-ADM-07 Archive removes public visibility', () => {
  assert.ok(adminCtrl.includes("body.status === 'archived'") || adminCtrl.includes("status === 'archived'"), 'archive handling');
  assert.ok(adminCtrl.includes('launchEligible = false') || adminCtrl.includes('launchEligible: false'), 'clears launchEligible');
  assert.strictEqual(readiness.isEducationProgramPublicReady({ status: 'archived', slug: 'mba' }), false);
  assert.ok(page.includes("PUB_STATUSES.ARCHIVED") || page.includes("'archived'"), 'UI archive action');
});

check('PROGRAM-ADM-08 Institution selection uses canonical institution ID', () => {
  assert.ok(page.includes('institutionId'), 'form institutionId');
  assert.ok(page.includes('CanonicalInstitutionPicker') || page.includes('listInstitutions'), 'searchable canonical picker');
  assert.ok(api.includes('/admin/education/institutions'), 'institutions API');
  assert.ok(adminCtrl.includes('CanonicalInstitution.findById') || adminCtrl.includes('CanonicalInstitution.exists'), 'validates institution');
  assert.ok(!page.includes('freeTextInstitution') && !page.includes('institutionName:'), 'no free-text institution identity field');
  assert.ok(programModel.includes('ref: \'CanonicalInstitution\''), 'model links CanonicalInstitution');
});

check('PROGRAM-ADM-09 Country/state/city values persist correctly', () => {
  assert.ok(programModel.includes('country:'), 'program country field');
  assert.ok(adminCtrl.includes('body.country') && adminCtrl.includes('normalizeCountryCode'), 'persists country');
  assert.ok(adminCtrl.includes('q.region') || adminCtrl.includes('q.state'), 'region filter via institution');
  assert.ok(adminCtrl.includes('q.city'), 'city filter via institution');
  assert.ok(page.includes('fieldRegion') || page.includes('State / Province / Region'), 'global region label');
  assert.ok(!page.includes('Punjab') && !page.includes('Pakistan-only'), 'no Pakistan hard-coding');
  assert.ok(page.includes('campus'), 'campus/location field');
});

check('PROGRAM-ADM-10 Existing Institution-submitted program can be reviewed and published by Admin', () => {
  assert.ok(Object.values(taxonomy.PUB_STATUSES).includes('submitted'), 'submitted status exists');
  assert.ok(portalSvc.includes('submitProgramForReview') || portalSvc.includes('SUBMITTED'), 'institution submit path');
  assert.ok(page.includes('Review') || page.includes('review'), 'review affordance');
  assert.ok(page.includes('PUB_STATUSES.SUBMITTED') || page.includes('submitted'), 'handles submitted');
  assert.ok(adminCtrl.includes('isValidPubStatus'), 'admin may set canonical statuses including published');
});

check('PROGRAM-ADM-11 Public Program Explorer returns Admin-published Program', () => {
  assert.ok(publicCtrl.includes("withFixtureExclusion({ status: 'published' })"), 'public list gate');
  assert.ok(publicCtrl.includes('listPrograms'), 'public list handler');
  assert.ok(page.includes('PROGRAM_EXPLORER'), 'admin links to explorer detail');
  assert.ok(fixture.assignLaunchEligibleOnAuthorityPublish({ isFixture: false }) === true, 'authority publish marks launchEligible');
});

check('PROGRAM-ADM-12 Existing Test Acceptance relationships remain intact', () => {
  assert.ok(acceptanceModel.includes('programId'), 'TestAcceptance.programId intact');
  assert.ok(adminCtrl.includes('TestAcceptance') && adminCtrl.includes('acceptedTestsCount'), 'admin surfaces acceptance summary');
  assert.ok(page.includes('acceptanceNote') || page.includes('program-acceptance-summary'), 'review shows acceptance');
  assert.ok(!page.includes('createAcceptance') && !page.includes('testAcceptanceForm'), 'does not merge TA authoring into program form');
  assert.ok(programModel.includes('TestAcceptance (Mission 6)') || programModel.includes('not duplicated'), 'program model does not own TA');
});

check('Existing Program status enum preserved', () => {
  const expected = ['draft', 'published', 'archived', 'submitted', 'under_review', 'needs_changes', 'discontinued'];
  for (const s of expected) {
    assert.ok(Object.values(taxonomy.PUB_STATUSES).includes(s), `missing status ${s}`);
  }
});

check('GET admin program by id route registered before nested requirements', () => {
  const getIdx = adminRoutes.indexOf("adminEducationRouter.get('/education/programs/:id'");
  const reqIdx = adminRoutes.indexOf("'/education/programs/:programId/requirements'");
  assert.ok(getIdx >= 0, 'get by id route');
  assert.ok(reqIdx > getIdx, 'requirements remains after get-by-id');
  assert.ok(adminCtrl.includes('adminGetProgram'), 'get handler');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
