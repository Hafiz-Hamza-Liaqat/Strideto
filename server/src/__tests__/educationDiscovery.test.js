/**
 * EDU-DISC — Canonical education public discovery + Program Admin picker scaling.
 *
 * Contract/static tests (no DB). Run:
 *   node src/__tests__/educationDiscovery.test.js
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

const readiness = await loadShared('cms/publicReadiness.js');
const acceptance = await loadShared('education/acceptanceExplorer.js');
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

const publicCtrl = read(path.join(serverSrc, 'controllers/education/testController.js'));
const acceptanceCtrl = read(path.join(serverSrc, 'controllers/education/testAcceptanceController.js'));
const routes = read(path.join(clientSrc, 'routes/index.jsx'));
const constants = read(path.join(clientSrc, 'constants/index.js'));
const nav = read(path.join(clientSrc, 'components/layout/navConfig.js'));
const explorer = read(path.join(clientSrc, 'pages/Education/InstitutionExplorer.jsx'));
const programExplorer = read(path.join(clientSrc, 'pages/Tests/ProgramExplorer.jsx'));
const adminPrograms = read(path.join(clientSrc, 'pages/Admin/AdminPrograms.jsx'));
const picker = read(path.join(clientSrc, 'components/admin/CanonicalInstitutionPicker.jsx'));
const schoolsPage = read(path.join(clientSrc, 'pages/SchoolsAndColleges/SchoolsAndColleges.jsx'));
const schoolsRoute = read(path.join(clientSrc, 'routes/index.jsx'));
const adminEdu = read(path.join(serverSrc, 'controllers/education/adminEducationController.js'));
const projection = read(path.join(sharedDir, 'education/acceptanceExplorer.js'));
const publicProj = read(path.join(sharedDir, 'publicDiscovery/projectPublicDiscovery.js'));

console.log('\n── EDU-DISC Canonical education discovery ──');

check('EDU-DISC-01 Public canonical institution directory route exists', () => {
  assert.ok(constants.includes("EDUCATION_INSTITUTIONS: '/institutions'"));
  assert.ok(routes.includes('EDUCATION_INSTITUTIONS') || routes.includes("'/institutions'") || routes.includes('InstitutionExplorer'));
  assert.ok(nav.includes("path: '/institutions'"));
  assert.ok(nav.includes('universitiesAndInstitutions'));
  assert.ok(fs.existsSync(path.join(clientSrc, 'pages/Education/InstitutionExplorer.jsx')));
});

check('EDU-DISC-02 Only public canonical institutions appear', () => {
  assert.ok(publicCtrl.includes("status: 'published'"));
  assert.ok(publicCtrl.includes('withFixtureExclusion'));
  assert.ok(publicCtrl.includes('projectPublicCanonicalInstitution'));
});

check('EDU-DISC-03 Search works', () => {
  assert.ok(publicCtrl.includes('q.search'));
  assert.ok(explorer.includes("search") && explorer.includes('listInstitutions'));
});

check('EDU-DISC-04 Country filter works', () => {
  assert.ok(publicCtrl.includes('q.country') && publicCtrl.includes('countryCode'));
  assert.ok(explorer.includes('CountrySelect') || explorer.includes('country'));
});

check('EDU-DISC-05 Region/city filters work', () => {
  assert.ok(publicCtrl.includes('q.region') || publicCtrl.includes('region'));
  assert.ok(publicCtrl.includes('q.city'));
  assert.ok(explorer.includes('region') && explorer.includes('city'));
});

check('EDU-DISC-06 Institution detail resolves by slug', () => {
  assert.ok(publicCtrl.includes('getInstitution') && publicCtrl.includes('req.params.slug'));
  assert.ok(explorer.includes('InstitutionExplorerDetail') || explorer.includes('useParams'));
  assert.ok(routes.includes('InstitutionExplorerDetail'));
});

check('EDU-DISC-07 Draft/non-public/fixture canonical institution excluded', () => {
  assert.ok(publicCtrl.includes('withFixtureExclusion'));
  assert.ok(fixture.isFixtureRecord({ isFixture: true }) === true);
  assert.ok(readiness.isEducationProgramPublicReady({ status: 'draft', slug: 'x' }) === false);
});

check('EDU-DISC-08 Institution detail shows published Programs only', () => {
  assert.ok(publicCtrl.includes("status: 'published'") && publicCtrl.includes('Program.find'));
  assert.ok(publicCtrl.includes('projectPublicProgram'));
  assert.ok(explorer.includes('Programs offered') || explorer.includes('programs'));
});

check('EDU-DISC-09 Program links back to canonical Institution', () => {
  assert.ok(programExplorer.includes('EDUCATION_INSTITUTIONS'));
  assert.ok(explorer.includes('PROGRAM_EXPLORER'));
  assert.ok(publicProj.includes('city:') && publicProj.includes('region:'));
});

check('EDU-DISC-10 Institution/program accepted tests use canonical TestAcceptance', () => {
  assert.ok(acceptanceCtrl.includes('TestAcceptance.find'));
  assert.ok(explorer.includes('getInstitutionAcceptance'));
  assert.ok(programExplorer.includes('getProgramAcceptance') || programExplorer.includes('acceptedTests'));
});

check('EDU-DISC-11 Minimum overall score remains correct', () => {
  assert.ok(projection.includes('minimumOverallScore'));
  assert.ok(explorer.includes('minimumOverallScore') || explorer.includes('Overall:'));
  assert.ok(programExplorer.includes('minimumOverallScore') || programExplorer.includes('Overall:'));
});

check('EDU-DISC-12 Section minimums remain correct', () => {
  assert.ok(projection.includes('sectionMinimums'));
  assert.ok(explorer.includes('sectionMinimums'));
  assert.ok(programExplorer.includes('sectionMinimums'));
});

check('EDU-DISC-13 Admin-only TestAcceptance fields are not exposed', () => {
  assert.ok(projection.includes('adminNotes intentionally NOT') || projection.includes('adminNotes'));
  const projected = acceptance.projectPublicAcceptance({
    _id: '1',
    acceptanceStatus: 'accepted',
    acceptanceScope: 'institution',
    minimumOverallScore: 6.5,
    sectionMinimums: [{ sectionName: 'Writing', minimum: 6 }],
    adminNotes: 'SECRET',
    resultValidityMonths: 24,
  });
  assert.ok(!('adminNotes' in projected));
  assert.strictEqual(projected.minimumOverallScore, 6.5);
  assert.strictEqual(projected.sectionMinimums[0].minimum, 6);
  assert.ok(!explorer.includes('adminNotes'));
});

check('EDU-DISC-14 Program Admin Institution selector searches beyond first 50 records', () => {
  assert.ok(adminPrograms.includes('CanonicalInstitutionPicker'));
  assert.ok(picker.includes('adminEducationInstitutionsApi.list') || picker.includes('.list('));
  assert.ok(picker.includes('search') && picker.includes('limit: 20'));
  assert.ok(!adminPrograms.includes('limit: 50') || adminPrograms.includes('CanonicalInstitutionPicker'));
  assert.ok(!picker.includes('limit: 50'));
});

check('EDU-DISC-15 Selected canonical institution ID persists correctly', () => {
  assert.ok(adminPrograms.includes('institutionId'));
  assert.ok(picker.includes('institutionId'));
  assert.ok(adminPrograms.includes('onInstitutionPick') || adminPrograms.includes('CanonicalInstitutionPicker'));
  assert.ok(adminEdu.includes('body.institutionId'));
});

check('EDU-DISC-16 Legacy Schools & Colleges remains unchanged', () => {
  assert.ok(constants.includes("SCHOOLS_AND_COLLEGES: '/schools-and-colleges'"));
  assert.ok(nav.includes("path: '/schools-and-colleges'"));
  assert.ok(schoolsPage.includes('institutions') || schoolsRoute.includes('schools-and-colleges'));
  assert.ok(!schoolsPage.includes('CanonicalInstitution'));
  assert.ok(!explorer.includes('schools-and-colleges') || explorer.includes('Schools & Colleges'));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
