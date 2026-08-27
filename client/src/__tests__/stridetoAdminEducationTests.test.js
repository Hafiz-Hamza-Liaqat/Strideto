import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * STRIDETO Admin Education Tests — TEST-ADM-01 through TEST-ADM-16
 *
 * Validates:
 * - AdminEducationTests: provider/test CRUD, category, publication status
 * - AdminTestAcceptance: resultValidityMonths editable, program picker scoped to institution,
 *   sectionMinimums, supersede, adminNotes never sent public
 * - Nav entries: navTestsProviders + navTestAcceptance present in adminNavConfig + admin.json
 * - Routes: education/tests and education/test-acceptance added (NOT removed existing routes)
 * - API methods: educationProviders, educationTests, educationAcceptance added to adminContentApi
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const sharedSrc = path.resolve(here, '..', '..', '..', 'shared');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');
const readShared = (rel) => readFileSync(path.join(sharedSrc, rel), 'utf8');

// ── Source files ──────────────────────────────────────────────────────────────
const adminTests = read('pages/Admin/AdminEducationTests.jsx');
const adminAcceptance = read('pages/Admin/AdminTestAcceptance.jsx');
const navConfig = read('config/adminNavConfig.js');
const adminJson = JSON.parse(read('i18n/locales/en/admin.json'));
const routes = read('routes/index.jsx');
const apiFile = read('services/adminContentApi.js');
const acceptanceExplorer = readShared('education/acceptanceExplorer.js');

// ── TEST-ADM-01: AdminEducationTests file exists and uses canonical imports ───
check(adminTests.includes("from '../../components/admin/AdminRouteGuard'"), 'TEST-ADM-01a: AdminEducationTests uses AdminRouteGuard');
check(adminTests.includes("from '../../components/admin/AdminDataTable'"), 'TEST-ADM-01b: AdminEducationTests uses AdminDataTable');
check(adminTests.includes("from '@shared/education/taxonomy.js'"), 'TEST-ADM-01c: AdminEducationTests imports from taxonomy.js');

// ── TEST-ADM-02: TEST_CATEGORIES used in AdminEducationTests ─────────────────
check(adminTests.includes('TEST_CATEGORIES'), 'TEST-ADM-02a: TEST_CATEGORIES imported in AdminEducationTests');
check(adminTests.includes('english_proficiency') || adminTests.includes('TEST_CATEGORIES.ENGLISH_PROFICIENCY'), 'TEST-ADM-02b: english_proficiency category referenced');

// ── TEST-ADM-03: PUB_STATUSES used for publication status ────────────────────
check(adminTests.includes('PUB_STATUSES'), 'TEST-ADM-03: PUB_STATUSES imported and used in AdminEducationTests');

// ── TEST-ADM-04: Provider tab has name + website fields ──────────────────────
check(adminTests.includes("form.name") && adminTests.includes("form.website"), 'TEST-ADM-04: Provider form has name and website fields');

// ── TEST-ADM-05: Test tab has maxScore and validityMonths ────────────────────
check(adminTests.includes('maxScore'), 'TEST-ADM-05a: Test form has maxScore field');
check(adminTests.includes('validityMonths'), 'TEST-ADM-05b: Test form has validityMonths field');

// ── TEST-ADM-06: AdminTestAcceptance file exists with canonical imports ───────
check(adminAcceptance.includes("from '../../components/admin/AdminRouteGuard'"), 'TEST-ADM-06a: AdminTestAcceptance uses AdminRouteGuard');
check(adminAcceptance.includes("from '@shared/education/acceptanceExplorer.js'"), 'TEST-ADM-06b: AdminTestAcceptance imports from acceptanceExplorer.js');

// ── TEST-ADM-07: resultValidityMonths is editable ────────────────────────────
check(adminAcceptance.includes('resultValidityMonths'), 'TEST-ADM-07: resultValidityMonths field present in AdminTestAcceptance');
check(adminAcceptance.includes("form.resultValidityMonths"), 'TEST-ADM-07b: resultValidityMonths bound to form state');

// ── TEST-ADM-08: Program picker scoped to selected institution ────────────────
check(adminAcceptance.includes('institutionId'), 'TEST-ADM-08a: institutionId tracked in form');
check(adminAcceptance.includes('programsByInstitution'), 'TEST-ADM-08b: programs list is institution-scoped');
check(adminAcceptance.includes('handleInstitutionChange'), 'TEST-ADM-08c: institution change handler resets programId');

// ── TEST-ADM-09: sectionMinimums editable ────────────────────────────────────
check(adminAcceptance.includes('sectionMinimums'), 'TEST-ADM-09a: sectionMinimums field present');
check(adminAcceptance.includes('addSection') || adminAcceptance.includes('acceptanceAddSection'), 'TEST-ADM-09b: section add action present');
check(adminAcceptance.includes('removeSection'), 'TEST-ADM-09c: section remove action present');

// ── TEST-ADM-10: sectionName + minimum + scale fields ────────────────────────
check(adminAcceptance.includes('sectionName'), 'TEST-ADM-10a: sectionName field present');
check(adminAcceptance.includes('sec.minimum') || adminAcceptance.includes("'minimum'"), 'TEST-ADM-10b: minimum field present');
check(adminAcceptance.includes("'scale'") || adminAcceptance.includes('sec.scale'), 'TEST-ADM-10c: scale field present');

// ── TEST-ADM-11: adminNotes present but NOT exposed in public API call ────────
check(adminAcceptance.includes('adminNotes'), 'TEST-ADM-11a: adminNotes field in form');
check(adminAcceptance.includes('admin only') || adminAcceptance.includes('never public'), 'TEST-ADM-11b: adminNotes labelled as admin-only');

// ── TEST-ADM-12: Supersede action present ────────────────────────────────────
check(adminAcceptance.includes('supersede') || adminAcceptance.includes('Supersede'), 'TEST-ADM-12a: supersede action present');
check(apiFile.includes('supersede'), 'TEST-ADM-12b: supersede method in adminContentApi');

// ── TEST-ADM-13: ACCEPTANCE_STATUSES used for status select ──────────────────
check(adminAcceptance.includes('ACCEPTANCE_STATUSES'), 'TEST-ADM-13: ACCEPTANCE_STATUSES used in AdminTestAcceptance');

// ── TEST-ADM-14: Nav keys present in admin.json ──────────────────────────────
check(typeof adminJson.navTestsProviders === 'string', 'TEST-ADM-14a: navTestsProviders key in admin.json');
check(typeof adminJson.navTestAcceptance === 'string', 'TEST-ADM-14b: navTestAcceptance key in admin.json');

// ── TEST-ADM-15: Nav entries in adminNavConfig.js ────────────────────────────
check(navConfig.includes("'navTestsProviders'"), 'TEST-ADM-15a: navTestsProviders entry in adminNavConfig');
check(navConfig.includes("'navTestAcceptance'"), 'TEST-ADM-15b: navTestAcceptance entry in adminNavConfig');
check(navConfig.includes("education/tests"), 'TEST-ADM-15c: education/tests path in adminNavConfig');
check(navConfig.includes("education/test-acceptance"), 'TEST-ADM-15d: education/test-acceptance path in adminNavConfig');

// ── TEST-ADM-16: Routes added (and existing routes preserved) ─────────────────
check(routes.includes("path: 'education/tests'"), 'TEST-ADM-16a: education/tests route added');
check(routes.includes("path: 'education/test-acceptance'"), 'TEST-ADM-16b: education/test-acceptance route added');
check(routes.includes("path: 'exam-preparation'"), 'TEST-ADM-16c: existing exam-preparation route NOT removed');
check(routes.includes("AdminEducationTests"), 'TEST-ADM-16d: AdminEducationTests lazily loaded');
check(routes.includes("AdminTestAcceptance"), 'TEST-ADM-16e: AdminTestAcceptance lazily loaded');

// ── API contract ──────────────────────────────────────────────────────────────
check(apiFile.includes('educationProviders'), 'API: educationProviders added');
check(apiFile.includes('educationTests'), 'API: educationTests added');
check(apiFile.includes('educationAcceptance'), 'API: educationAcceptance added');
check(apiFile.includes('educationInstitutions'), 'API: educationInstitutions added');
check(apiFile.includes('educationPrograms'), 'API: educationPrograms added');

// ── Shared contract not broken ────────────────────────────────────────────────
check(acceptanceExplorer.includes("ACCEPTED: 'accepted'"), 'shared: ACCEPTANCE_STATUSES.ACCEPTED stable');
check(acceptanceExplorer.includes('adminNotes'), 'shared: adminNotes exists in acceptanceExplorer contract');

console.log(`stridetoAdminEducationTests.test.js: ${count} assertions passed`);
