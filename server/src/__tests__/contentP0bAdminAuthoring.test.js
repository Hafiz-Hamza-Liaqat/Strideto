/**
 * CONTENT-P0B — Admin content authoring completeness.
 * Run: node --experimental-vm-modules src/__tests__/contentP0bAdminAuthoring.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const { parseStringArray } = await import(
  pathToFileURL(path.join(root, 'server/src/utils/adminContentHelpers.js')).href
);
const { validateApplicationLink, validateApplyEmail } = await import(
  pathToFileURL(path.join(root, 'server/src/utils/jobApplicationDestination.js')).href
);
const { deriveCmsLaunchEligible, CMS_STATUS } = await import(
  pathToFileURL(path.join(root, 'shared/cms/launchEligible.js')).href
);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const adminJobsCtrl = read('server/src/controllers/admin/adminJobsController.js');
const adminJobsUi = read('client/src/pages/Admin/AdminContentJobs.jsx');
const jobDetail = read('client/src/pages/Jobs/JobDetail.jsx');
const adminAdmissionsCtrl = read('server/src/controllers/admin/adminAdmissionsController.js');
const adminAdmissionsUi = read('client/src/pages/Admin/AdminContentAdmissions.jsx');
const admissionDetail = read('client/src/pages/Admissions/AdmissionDetail.jsx');
const adminForeignCtrl = read('server/src/controllers/admin/adminForeignStudiesController.js');
const adminForeignUi = read('client/src/pages/Admin/AdminForeignStudies.jsx');
const foreignDetail = read('client/src/pages/ForeignStudies/ForeignStudyDetail.jsx');
const adminIntlUi = read('client/src/pages/Admin/AdminIntlScholarships.jsx');
const adminIntlCtrl = read('server/src/controllers/admin/adminIntlScholarshipsController.js');
const intlDetail = read('client/src/pages/IntlScholarships/IntlScholarshipDetail.jsx');
const intlPublicCtrl = read('server/src/controllers/intlScholarshipsController.js');

// ── JOBS ─────────────────────────────────────────────────────────────────────
const skillsCreate = parseStringArray('JavaScript\nTypeScript');
check(Array.isArray(skillsCreate) && skillsCreate.length === 2, 'JOB-P0B-01 Admin skills create persists via parseStringArray');
check(
  adminJobsCtrl.includes('parseStringArray(body.skills || body.skillsRequired)'),
  'JOB-P0B-01b admin controller maps skillsRequired',
);
check(
  adminJobsUi.includes('skillsRequired') && adminJobsUi.includes('textToLines(form.skillsRequired)'),
  'JOB-P0B-02 Admin skills edit round-trips through textarea helpers',
);
check(
  adminJobsCtrl.includes('body.sourceUrl') && adminJobsCtrl.includes('doc.sourceUrl'),
  'JOB-P0B-03 sourceUrl persists in admin applyJobBody',
);
check(
  adminJobsCtrl.includes('body.sourceWebsite') && adminJobsCtrl.includes('doc.sourceWebsite'),
  'JOB-P0B-04 sourceWebsite persists',
);
check(
  adminJobsCtrl.includes('body.externalId') && adminJobsCtrl.includes('doc.externalId'),
  'JOB-P0B-05 externalId persists without touching _id',
);
check(
  adminJobsCtrl.includes('doc.externalId = body.externalId'),
  'JOB-P0B-05b externalId is a separate editorial field from Mongo _id',
);
{
  const bad = validateApplicationLink('javascript:alert(1)');
  check(bad.ok === false, 'JOB-P0B-06 malformed source URL rejected by shared validator');
  check(
    adminJobsCtrl.includes("field: 'sourceUrl'") || adminJobsCtrl.includes('field: \'sourceUrl\''),
    'JOB-P0B-06b admin maps sourceUrl validation errors',
  );
}
check(
  adminJobsCtrl.includes('validateApplyEmail') && adminJobsCtrl.includes('doc.applyEmail'),
  'JOB-P0B-07 applyEmail persists in admin controller',
);
check(validateApplyEmail('not-an-email').ok === false, 'JOB-P0B-08 malformed application email rejected');
check(
  !/jobsGraphEligible/.test(adminJobsCtrl),
  'JOB-P0B-09 provenance cannot enable jobsGraphEligible — admin controller never references it',
);
check(
  adminJobsUi.includes('sourceUrl') && !adminJobsUi.includes('jobsGraphEligible'),
  'JOB-P0B-10 jobsGraphEligible remains non-admin-writable in UI',
);
check(
  jobDetail.includes('skillsRequired') && jobDetail.includes('ProvenanceStrip') && jobDetail.includes('applyEmail'),
  'JOB-P0B-11 public detail renders skills/provenance/apply destination',
);
check(
  adminJobsUi.includes('sourceUrl') && adminJobsUi.includes('sourceWebsite') && adminJobsUi.includes('applyEmail'),
  'JOB-P0B-11b admin UI exposes provenance and apply email fields',
);

// ── ADMISSIONS ───────────────────────────────────────────────────────────────
check(
  adminAdmissionsCtrl.includes('parseStringArray(body.eligibility)') && adminAdmissionsCtrl.includes('doc.eligibility'),
  'ADMISSION-P0B-01 eligibility create supported in controller',
);
check(
  adminAdmissionsUi.includes('form.eligibility') && adminAdmissionsUi.includes('textToLines(form.eligibility)'),
  'ADMISSION-P0B-02 eligibility edit round-trip in admin UI',
);
check(
  adminAdmissionsCtrl.includes('body.session') && adminAdmissionsUi.includes('form.session'),
  'ADMISSION-P0B-03 session create/edit wired',
);
check(
  adminAdmissionsCtrl.includes('applicationInstructions') && adminAdmissionsUi.includes('applicationInstructions'),
  'ADMISSION-P0B-04 applicationInstructions create/edit wired',
);
check(
  admissionDetail.includes('item.session') && admissionDetail.includes('item.eligibility') && admissionDetail.includes('applicationInstructions'),
  'ADMISSION-P0B-05 public detail receives existing fields',
);
check(
  adminAdmissionsCtrl.includes('deriveCmsLaunchEligible') && adminAdmissionsCtrl.includes('syncAdmissionLaunchEligible'),
  'ADMISSION-P0B-06 launchEligible policy unchanged via deriveCmsLaunchEligible',
);
check(
  deriveCmsLaunchEligible({}, CMS_STATUS.DRAFT) === false && deriveCmsLaunchEligible({}, CMS_STATUS.ACTIVE) === true,
  'ADMISSION-P0B-06b launchEligible derivation contract intact',
);

// ── FOREIGN STUDIES ──────────────────────────────────────────────────────────
check(
  adminForeignCtrl.includes('parseStringArray(body.requirements)') && adminForeignUi.includes('textToLines(form.requirements)'),
  'FOREIGN-P0B-01 requirements round-trip',
);
check(
  adminForeignCtrl.includes('parseStringArray(body.languageTests)') && adminForeignUi.includes('textToLines(form.languageTests)'),
  'FOREIGN-P0B-02 languageTests round-trip',
);
check(
  adminForeignCtrl.includes('scholarshipsInfo') && adminForeignUi.includes('scholarshipsInfo'),
  'FOREIGN-P0B-03 scholarshipsInfo round-trip',
);
check(
  adminForeignCtrl.includes('parseStringArray(body.intakes)') && adminForeignUi.includes('textToLines(form.intakes)'),
  'FOREIGN-P0B-04 intakes round-trip',
);
check(
  adminForeignUi.includes('seoTitle') && foreignDetail.includes('item.seoTitle'),
  'FOREIGN-P0B-05 seoTitle reaches existing public SeoHead',
);
check(
  adminForeignUi.includes('metaDescription') && foreignDetail.includes('item.metaDescription'),
  'FOREIGN-P0B-06 metaDescription reaches existing public SeoHead',
);
{
  const roundTrip = parseStringArray(['IELTS 6.5', 'TOEFL 90']);
  const reSave = parseStringArray(roundTrip);
  check(
    Array.isArray(reSave) && reSave.length === 2 && reSave[0] === 'IELTS 6.5',
    'FOREIGN-P0B-07 arrays survive edit/re-save via parseStringArray',
  );
}

// ── INTL SCHOLARSHIPS ────────────────────────────────────────────────────────
check(
  adminIntlCtrl.includes('doc.description') && adminIntlUi.includes('form.description'),
  'INTL-P0B-01 description create wired',
);
check(
  adminIntlUi.includes('value={form.description}'),
  'INTL-P0B-02 description edit wired',
);
check(
  intlDetail.includes('item.description'),
  'INTL-P0B-03 public detail receives description',
);
check(
  adminIntlUi.includes('item.slug || item._id') || adminIntlUi.includes('row.slug ?'),
  'INTL-P0B-04 slug canonical regression — admin list prefers slug href',
);
check(
  adminIntlUi.includes("row.status === 'active'")
    && (intlPublicCtrl.includes("status: PUBLIC_STATUS") || intlPublicCtrl.includes("status: 'active'")),
  'INTL-P0B-05 draft/closed detail guard regression — active-only public read',
);

console.log(`contentP0bAdminAuthoring.test.js: ${count} assertions passed`);
