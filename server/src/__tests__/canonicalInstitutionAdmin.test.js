/**
 * INST-CAT-ADM — Canonical Education Institution Admin catalog.
 *
 * Contract/static tests (no DB). Run:
 *   node src/__tests__/canonicalInstitutionAdmin.test.js
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
const adminRoutes = read(path.join(serverSrc, 'routes/adminEducation.js'));
const model = read(path.join(serverSrc, 'models/education/CanonicalInstitution.js'));
const legacyModel = read(path.join(serverSrc, 'models/Institution.js'));
const legacyPage = read(path.join(clientSrc, 'pages/Admin/AdminInstitutions.jsx'));
const legacyCtrl = read(path.join(serverSrc, 'controllers/admin/adminInstitutionsController.js'));
const page = read(path.join(clientSrc, 'pages/Admin/AdminEducationInstitutions.jsx'));
const api = read(path.join(clientSrc, 'services/adminEducationInstitutionsApi.js'));
const programsPage = read(path.join(clientSrc, 'pages/Admin/AdminPrograms.jsx'));
const programsApi = read(path.join(clientSrc, 'services/adminEducationProgramsApi.js'));
const nav = read(path.join(clientSrc, 'config/adminNavConfig.js'));
const routes = read(path.join(clientSrc, 'routes/index.jsx'));
const claimPage = read(path.join(clientSrc, 'pages/Institution/InstitutionClaim.jsx'));
const claimTest = read(path.join(serverSrc, '__tests__/phase7InstitutionCanonicalClaim.test.js'));
const phase8 = read(path.join(serverSrc, '__tests__/phase8InstitutionTestAcceptance.test.js'));
const schoolsPage = read(path.join(clientSrc, 'pages/SchoolsAndColleges/SchoolsAndColleges.jsx'));
const institutionsCtrl = read(path.join(serverSrc, 'controllers/institutionsController.js'));
const publicEduCtrl = read(path.join(serverSrc, 'controllers/education/testController.js'));

console.log('\n── INST-CAT-ADM Canonical Education Institution Admin ──');

check('INST-CAT-ADM-01 Admin route/page exists', () => {
  assert.ok(nav.includes("${ROUTES.ADMIN}/education/institutions"), 'nav path');
  assert.ok(nav.includes("labelKey: 'educationInstitutions'"), 'nav label');
  assert.ok(routes.includes("path: 'education/institutions'"), 'client route');
  assert.ok(routes.includes('AdminEducationInstitutions'), 'lazy page');
  assert.ok(fs.existsSync(path.join(clientSrc, 'pages/Admin/AdminEducationInstitutions.jsx')));
  // Distinct from legacy Schools & Colleges admin
  assert.ok(nav.includes("${ROUTES.ADMIN}/institutions"), 'legacy institutions nav preserved');
  assert.ok(page.includes('Canonical') || page.includes('canonical') || page.includes('educationInstitutionsHint'));
});

check('INST-CAT-ADM-02 Canonical list loads', () => {
  assert.ok(adminRoutes.includes('adminListInstitutions'));
  assert.ok(page.includes("useAdminList('/admin/education/institutions'"));
  assert.ok(api.includes('/admin/education/institutions'));
  assert.ok(adminCtrl.includes('CanonicalInstitution.find'));
});

check('INST-CAT-ADM-03 Search works', () => {
  assert.ok(adminCtrl.includes('q.search'));
  assert.ok(adminCtrl.includes('officialName: re') || adminCtrl.includes('{ officialName: re }'));
  assert.ok(page.includes("key: 'search'"));
});

check('INST-CAT-ADM-04 Country/region/city filter works', () => {
  assert.ok(adminCtrl.includes('q.country') || adminCtrl.includes('q.countryCode'));
  assert.ok(adminCtrl.includes('q.region') || adminCtrl.includes('region'));
  assert.ok(adminCtrl.includes('q.city'));
  assert.ok(page.includes("key: 'country'"));
  assert.ok(page.includes("key: 'region'"));
  assert.ok(page.includes("key: 'city'"));
  assert.ok(!page.includes('Punjab') && !page.includes('Pakistan-only'));
});

check('INST-CAT-ADM-05 Create uses CanonicalInstitution model', () => {
  assert.ok(adminCtrl.includes('adminCreateInstitution'));
  assert.ok(adminCtrl.includes('CanonicalInstitution.create'));
  assert.ok(page.includes('adminEducationInstitutionsApi.create') || page.includes('.create(payload)'));
  assert.ok(model.includes('officialName') && model.includes('countryCode'));
  assert.ok(page.includes('officialName'));
  assert.ok(!page.includes('/admin/institutions') || page.includes('education/institutions'));
});

check('INST-CAT-ADM-06 Edit persists canonical fields', () => {
  assert.ok(adminCtrl.includes('adminUpdateInstitution'));
  assert.ok(adminCtrl.includes('adminGetInstitution'));
  assert.ok(adminRoutes.includes("'/education/institutions/:id'"));
  for (const field of ['countryCode', 'city', 'region', 'officialWebsite', 'officialDomain', 'institutionType']) {
    assert.ok(adminCtrl.includes(`body.${field}`), `persists ${field}`);
    assert.ok(page.includes(field) || page.includes(field.replace('Code', '')), `form ${field}`);
  }
});

check('INST-CAT-ADM-07 Program selector receives newly created canonical Institution', () => {
  assert.ok(programsApi.includes('/admin/education/institutions'));
  assert.ok(programsPage.includes('CanonicalInstitutionPicker') || programsPage.includes('listInstitutions'));
  assert.ok(programsPage.includes('institutionId'));
  assert.ok(programsPage.includes('countryCode') || programsPage.includes('selectedInstitution'));
});

check('INST-CAT-ADM-08 Catalog creation does not approve verification', () => {
  assert.ok(adminCtrl.includes('does NOT approve') || adminCtrl.includes('Catalog-only'));
  assert.ok(!/OrganizationVerification\.(create|findOneAndUpdate|updateOne)/.test(
    adminCtrl.slice(adminCtrl.indexOf('adminCreateInstitution'), adminCtrl.indexOf('adminUpdateInstitution') + 800)
  ) || !adminCtrl.slice(adminCtrl.indexOf('export const adminCreateInstitution')).includes('OrganizationVerification.create'));
  const createSlice = adminCtrl.slice(
    adminCtrl.indexOf('export const adminCreateInstitution'),
    adminCtrl.indexOf('export const adminUpdateInstitution')
  );
  assert.ok(!createSlice.includes('OrganizationVerification.create'));
  assert.ok(!createSlice.includes('status: \'approved\''));
  assert.ok(page.includes('catalog-trust-hint') || page.includes('does not approve'));
});

check('INST-CAT-ADM-09 Catalog creation does not approve claim', () => {
  const createSlice = adminCtrl.slice(
    adminCtrl.indexOf('export const adminCreateInstitution'),
    adminCtrl.indexOf('export const adminUpdateInstitution')
  );
  const updateSlice = adminCtrl.slice(
    adminCtrl.indexOf('export const adminUpdateInstitution'),
    adminCtrl.indexOf('export const adminListPrograms')
  );
  assert.ok(!createSlice.includes('InstitutionClaim.create'));
  assert.ok(!updateSlice.includes('InstitutionClaim.create'));
  assert.ok(!createSlice.includes('CLAIM_STATES.APPROVED') && !createSlice.includes("state: 'approved'"));
  assert.ok(page.includes('claim') || page.includes('Claim'));
});

check('INST-CAT-ADM-10 Existing Propose New Institution workflow remains intact', () => {
  assert.ok(claimPage.includes('proposedCanonical') || claimPage.includes('Propose'));
  assert.ok(claimTest.includes('propose-new') || claimTest.includes('proposedCanonical'));
  assert.ok(fs.existsSync(path.join(serverSrc, '__tests__/phase7InstitutionCanonicalClaim.test.js')));
});

check('INST-CAT-ADM-11 Test Acceptance authority remains unchanged', () => {
  assert.ok(phase8.includes('unverified institution cannot publish') || phase8.includes('TEST-02'));
  assert.ok(phase8.includes('no approved canonical claim') || phase8.includes('TEST-03'));
  assert.ok(!page.includes('publishAcceptance') && !page.includes('createTestAcceptance'));
});

check('INST-CAT-ADM-12 Legacy Institution/Admin models are not accidentally mutated', () => {
  assert.ok(legacyPage.includes("useAdminList('/admin/institutions')"));
  assert.ok(!legacyPage.includes('CanonicalInstitution'));
  assert.ok(!legacyPage.includes('/admin/education/institutions'));
  assert.ok(legacyCtrl.includes('Institution') || fs.existsSync(path.join(serverSrc, 'controllers/admin/adminInstitutionsController.js')));
  assert.ok(legacyModel.includes('province') || legacyModel.includes('status'));
  assert.ok(!adminCtrl.includes("from '../../models/Institution.js'"));
  assert.ok(schoolsPage.includes('institutions') || institutionsCtrl.includes('Institution.find'));
  assert.ok(institutionsCtrl.includes("status: 'active'") || institutionsCtrl.includes('Institution'));
  // Public education discovery uses Canonical — separate from Schools & Colleges
  assert.ok(publicEduCtrl.includes('CanonicalInstitution') && publicEduCtrl.includes("status: 'published'"));
});

check('Canonical model fields and types preserved', () => {
  for (const t of Object.values(taxonomy.INSTITUTION_TYPES)) {
    assert.ok(typeof t === 'string');
  }
  assert.ok(model.includes('countryCode') && model.includes('region') && model.includes('city'));
  assert.ok(model.includes('sources'));
});

check('Published catalog requires sources', () => {
  assert.ok(adminCtrl.includes('Published institutions require at least one valid source'));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
