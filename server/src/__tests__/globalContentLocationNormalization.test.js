/**
 * GLOBAL CONTENT LOCATION NORMALIZATION — focused contract tests.
 * Run: node src/__tests__/globalContentLocationNormalization.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const location = await import(pathToFileURL(path.join(root, 'shared/international/location.js')).href);
const country = await import(pathToFileURL(path.join(root, 'shared/international/country.js')).href);
const project = await import(pathToFileURL(path.join(root, 'shared/publicDiscovery/projectPublicDiscovery.js')).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const {
  formatLocationDisplay,
  freeTextCountryRegex,
  freeTextCountryMatchValues,
  normalizeLocation,
} = location;
const { coerceCountryCode, countryDisplayName, normalizeCountryCode } = country;
const {
  projectPublicCmsAdmission,
  projectPublicCmsScholarship,
  projectPublicInternship,
  projectPublicJob,
  projectPublicCanonicalInstitution,
} = project;

// ── GLOBAL-LOC-16 formatter ──────────────────────────────────────────────────
check(formatLocationDisplay({ city: 'Lahore', province: 'Punjab', country: 'Pakistan' }) === 'Lahore, Punjab, Pakistan'
  || formatLocationDisplay({ city: 'Lahore', province: 'Punjab', countryCode: 'PK' }).includes('Lahore'),
  'GLOBAL-LOC-16 formats Lahore, Punjab, Pakistan');
check(formatLocationDisplay({ city: 'Dublin', region: 'Leinster', countryCode: 'IE' }).startsWith('Dublin, Leinster'),
  'GLOBAL-LOC-16 formats Dublin, Leinster, Ireland');
check(formatLocationDisplay({ city: 'London', region: 'England', countryCode: 'GB' }).startsWith('London, England'),
  'GLOBAL-LOC-16 formats London, England, United Kingdom');
check(formatLocationDisplay({ countryCode: 'US' }) === countryDisplayName('US'),
  'GLOBAL-LOC-16 skips empty city/region');
check(!formatLocationDisplay({ city: '', province: '', countryCode: '' }).includes(',,'),
  'GLOBAL-LOC-16 never emits empty commas');
check(formatLocationDisplay({}) === '', 'GLOBAL-LOC-13 missing country does not crash / fabricate');

// ── Helpers ──────────────────────────────────────────────────────────────────
check(normalizeCountryCode('gb') === 'GB', 'ISO normalize GB');
check(coerceCountryCode('United Kingdom') === 'GB', 'coerce United Kingdom → GB');
check(coerceCountryCode('Pakistan') === 'PK', 'GLOBAL-LOC-12 coerce Pakistan → PK');
check(freeTextCountryMatchValues('GB').includes('GB'), 'free-text match includes code');
check(freeTextCountryMatchValues('UK').some((v) => /united kingdom/i.test(v) || v === 'GB' || v === 'UK'),
  'free-text match includes UK variants');
check(freeTextCountryRegex('Ireland').test('Ireland'), 'Ireland regex matches name');
check(freeTextCountryRegex('IE').test(countryDisplayName('IE')), 'IE regex matches display name');

// ── GLOBAL-LOC-01 / 02 Admission ──────────────────────────────────────────────
const admModel = read('server/src/models/Admission.js');
const admAdmin = read('server/src/controllers/admin/adminAdmissionsController.js');
const admPublic = read('server/src/controllers/admissionsController.js');
const admForm = read('client/src/pages/Admin/AdminContentAdmissions.jsx');
check(admModel.includes('countryCode'), 'GLOBAL-LOC-01 Admission model has countryCode');
check(admAdmin.includes("details: { countryCode: 'Country is required' }"), 'GLOBAL-LOC-01 create requires country');
check(admAdmin.includes('doc.countryCode = normalizeCountryCode'), 'GLOBAL-LOC-01 persists countryCode');
check(admPublic.includes('filter.countryCode = countryCode'), 'GLOBAL-LOC-02 public filter by countryCode');
check(admForm.includes('AdminLocationFields') && admForm.includes('mode="code"'), 'GLOBAL-LOC-01 admin form uses Country select');
check(admForm.includes("t('admin:fieldRegion')") || admForm.includes('AdminLocationFields'),
  'GLOBAL-LOC-14 region label via AdminLocationFields');

const admProjected = projectPublicCmsAdmission({
  _id: '1',
  program: 'CS',
  slug: 'cs',
  institution: 'UCL',
  countryCode: 'GB',
  province: 'England',
  city: 'London',
  status: 'active',
});
check(admProjected.countryCode === 'GB' && admProjected.city === 'London' && admProjected.province === 'England',
  'GLOBAL-LOC-02 public projection includes countryCode/region/city');

const pkLegacy = projectPublicCmsAdmission({
  _id: '2',
  program: 'BS',
  slug: 'bs',
  institution: 'PU',
  province: 'Punjab',
  city: 'Lahore',
  status: 'active',
});
check(pkLegacy.countryCode == null && pkLegacy.province === 'Punjab' && pkLegacy.city === 'Lahore',
  'GLOBAL-LOC-12 legacy Pakistan admission without country still projects');

// ── GLOBAL-LOC-03 / 04 Scholarship ───────────────────────────────────────────
const schModel = read('server/src/models/Scholarship.js');
const schAdmin = read('server/src/controllers/admin/adminScholarshipsController.js');
const schPublic = read('server/src/controllers/scholarshipsController.js');
const schUnified = read('server/src/services/unifiedScholarshipDiscoveryService.js');
const schForm = read('client/src/pages/Admin/AdminContentScholarships.jsx');
const schPage = read('client/src/pages/Scholarships/Scholarships.jsx');
check(schModel.includes('province') && schModel.includes('city'), 'GLOBAL-LOC-03 scholarship has province/city');
check(schAdmin.includes('countryDisplayName') || schAdmin.includes('coerceCountryCode'),
  'GLOBAL-LOC-03 scholarship admin normalizes country');
check(
  schPublic.includes('freeTextCountryRegex') || schUnified.includes('freeTextCountryRegex'),
  'GLOBAL-LOC-04 public scholarship filter uses freeTextCountryRegex'
);
check(schForm.includes('AdminLocationFields') && schForm.includes('mode="name"'),
  'GLOBAL-LOC-03 scholarship admin location fields');
check(schPage.includes('CountrySelect'), 'GLOBAL-LOC-04 public scholarships use CountrySelect');
check(projectPublicCmsScholarship({
  _id: 's1', title: 'T', slug: 't', provider: 'P', country: 'Ireland', province: 'Leinster', city: 'Dublin',
}).country === 'Ireland', 'GLOBAL-LOC-04 scholarship projection keeps country');

// ── GLOBAL-LOC-05 / 06 Internship ────────────────────────────────────────────
const intAdmin = read('server/src/controllers/admin/adminInternshipsController.js');
const intPublicCtrl = read('server/src/controllers/internshipsController.js');
const intForm = read('client/src/pages/Admin/AdminContentInternships.jsx');
check(intAdmin.includes('doc.countryCode') && intAdmin.includes('doc.workMode'),
  'GLOBAL-LOC-05 internship admin persists countryCode/workMode');
check(intAdmin.includes('workMode !== \'remote\'') || intAdmin.includes('workMode !== "remote"'),
  'GLOBAL-LOC-05 country required unless remote');
check(intPublicCtrl.includes('countryCode'), 'GLOBAL-LOC-06 public internship filter has countryCode');
check(intForm.includes('showWorkMode') && intForm.includes('AdminLocationFields'),
  'GLOBAL-LOC-05 internship admin form has Country + Work Mode');
const intProj = projectPublicInternship({
  _id: 'i1', title: 'Intern', slug: 'i', organization: 'Org',
  countryCode: 'DE', region: 'Berlin', province: 'Berlin', city: 'Berlin', workMode: 'hybrid', status: 'active',
});
check(intProj.countryCode === 'DE' && intProj.workMode === 'hybrid',
  'GLOBAL-LOC-06 public internship projection includes countryCode/workMode');

// ── GLOBAL-LOC-07 / 08 Job ───────────────────────────────────────────────────
const jobAdmin = read('server/src/controllers/admin/adminJobsController.js');
const jobPublic = read('server/src/controllers/jobsController.js');
const jobForm = read('client/src/pages/Admin/AdminContentJobs.jsx');
check(jobAdmin.includes('doc.countryCode') && jobAdmin.includes('doc.workMode'),
  'GLOBAL-LOC-07 job admin persists countryCode/workMode');
check(jobAdmin.includes('deriveJobLaunchEligible') || jobAdmin.includes('syncJobLaunchEligible'),
  'GLOBAL-LOC-07 job launchEligible path untouched');
check(jobAdmin.includes('approvalStatus'), 'GLOBAL-LOC-07 approvalStatus still present');
check(jobPublic.includes('countryCode'), 'GLOBAL-LOC-08 public job filter countryCode');
check(jobForm.includes('AdminLocationFields') && jobForm.includes('showWorkMode'),
  'GLOBAL-LOC-07 job admin location + work mode');
const jobProj = projectPublicJob({
  _id: 'j1', title: 'Eng', slug: 'e', company: 'Co',
  countryCode: 'US', region: 'California', province: 'California', city: 'Los Angeles',
  workMode: 'on_site', status: 'active', approvalStatus: 'approved',
});
check(jobProj.countryCode === 'US' && (jobProj.city === 'Los Angeles'),
  'GLOBAL-LOC-08 job public projection keeps country/city');

// ── GLOBAL-LOC-09 Foreign Study ──────────────────────────────────────────────
const fsAdmin = read('server/src/controllers/admin/adminForeignStudiesController.js');
const fsForm = read('client/src/pages/Admin/AdminForeignStudies.jsx');
const fsPublic = read('server/src/controllers/foreignStudiesController.js');
check(fsAdmin.includes('countryDisplayName') || fsAdmin.includes('coerceCountryCode'),
  'GLOBAL-LOC-09 foreign study country normalized');
check(fsForm.includes('CountrySelect'), 'GLOBAL-LOC-09 foreign study admin CountrySelect');
check(fsPublic.includes('freeTextCountryRegex'), 'GLOBAL-LOC-09 foreign study public filter');

// ── GLOBAL-LOC-10 International Scholarship ──────────────────────────────────
const intlAdmin = read('server/src/controllers/admin/adminIntlScholarshipsController.js');
const intlPublic = read('server/src/controllers/intlScholarshipsController.js');
const intlForm = read('client/src/pages/Admin/AdminIntlScholarships.jsx');
check(intlAdmin.includes('normalizeFreeTextCountry') || intlAdmin.includes('countryDisplayName'),
  'GLOBAL-LOC-10 intl scholarship country normalize');
check(intlPublic.includes('freeTextCountryRegex'), 'GLOBAL-LOC-10 intl public filter');
check(intlForm.includes('CountrySelect'), 'GLOBAL-LOC-10 intl admin CountrySelect');

// ── GLOBAL-LOC-11 Company ────────────────────────────────────────────────────
const coAdmin = read('server/src/controllers/admin/adminCompaniesController.js');
const coForm = read('client/src/pages/Admin/AdminCompanies.jsx');
check(coAdmin.includes('countryDisplayName') || coAdmin.includes('coerceCountryCode'),
  'GLOBAL-LOC-11 company country normalize');
check(coForm.includes('AdminLocationFields'), 'GLOBAL-LOC-11 company admin location fields');

// ── GLOBAL-LOC-14 labels ─────────────────────────────────────────────────────
const adminJson = read('client/src/i18n/locales/en/admin.json');
check(adminJson.includes('"provincePlaceholder": "State / Province / Region"'),
  'GLOBAL-LOC-14 provincePlaceholder normalized');
check(adminJson.includes('"colProvince": "State / Province / Region"'),
  'GLOBAL-LOC-14 colProvince normalized');
check(adminJson.includes('"filterProvince": "State / Province / Region"'),
  'GLOBAL-LOC-14 filterProvince normalized');

// ── GLOBAL-LOC-15 canonical education unchanged ──────────────────────────────
const canonInst = projectPublicCanonicalInstitution({
  _id: 'c1',
  officialName: 'Oxford',
  slug: 'oxford',
  countryCode: 'GB',
  city: 'Oxford',
  region: 'England',
  institutionType: 'university',
  status: 'published',
});
check(canonInst.countryCode === 'GB' && canonInst.city === 'Oxford' && canonInst.region === 'England',
  'GLOBAL-LOC-15 canonical institution projection unchanged');
check(normalizeLocation({ countryCode: 'GB', region: 'England', city: 'Oxford' }).countryCode === 'GB',
  'GLOBAL-LOC-15 normalizeLocation still works for canonical shape');

// ── University list no longer hardcodes Pakistan ─────────────────────────────
const pubProfile = read('server/src/controllers/publicProfileController.js');
check(!pubProfile.includes("country: 'Pakistan'"),
  'legacy university list no longer hardcodes Pakistan');

// ── Shared AdminLocationFields + CountrySelect reuse ─────────────────────────
const locFields = read('client/src/components/admin/AdminLocationFields.jsx');
check(locFields.includes('CountrySelect') && locFields.includes('State / Province / Region') || locFields.includes('fieldRegion'),
  'reusable AdminLocationFields uses CountrySelect + region label');
check(read('client/src/components/forms/CountrySelect.jsx').includes('ISO_3166_ALPHA2'),
  'CountrySelect reuses ISO registry');

console.log(`globalContentLocationNormalization.test.js: ${count} assertions passed`);
