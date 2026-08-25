/**
 * CMS publication parity consolidation — post-deploy hotfix.
 * Run: node src/__tests__/cmsPublicationParityHotfix.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const launch = await import(pathToFileURL(path.join(root, 'shared/cms/launchEligible.js')).href);
const readiness = await import(pathToFileURL(path.join(root, 'shared/cms/publicReadiness.js')).href);
const fixture = await import(pathToFileURL(path.join(root, 'shared/publicDiscovery/fixtureExclusion.js')).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const { deriveCmsLaunchEligible, deriveJobLaunchEligible, CMS_STATUS } = launch;
const {
  isAdmissionPublicReady,
  isScholarshipPublicReady,
  isInternshipPublicReady,
  isJobPublicReady,
  isBlogPublicReady,
  isLegacyActiveSlugPublicReady,
  isPublishedSlugPublicReady,
} = readiness;
const { withFixtureExclusion, isFixtureRecord } = fixture;

function cmsLiveSuite(prefix) {
  check(deriveCmsLaunchEligible({ status: CMS_STATUS.DRAFT, launchEligible: false }, CMS_STATUS.ACTIVE) === true, `${prefix}-LIVE-01 draft false publish`);
  check(deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, launchEligible: false }, CMS_STATUS.ACTIVE) === true, `${prefix}-LIVE-02 historical active false re-save`);
  check(deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, isFixture: true }, CMS_STATUS.ACTIVE) === false, `${prefix}-LIVE-03 fixture active blocked`);
  check(deriveCmsLaunchEligible({ status: CMS_STATUS.ACTIVE, launchEligible: false }, CMS_STATUS.ACTIVE) === true, `${prefix}-LIVE-04 server wins over client false`);
  check(deriveCmsLaunchEligible({ status: CMS_STATUS.DRAFT, launchEligible: true }, CMS_STATUS.DRAFT) === false, `${prefix}-LIVE-05 draft stays false`);
  check(deriveCmsLaunchEligible({ status: CMS_STATUS.DRAFT, launchEligible: false }, CMS_STATUS.DRAFT) === false, `${prefix}-LIVE-06 duplicate draft pattern`);
}

function cmsViewParity(type, readyFn, adminPage) {
  check(readyFn({ status: CMS_STATUS.ACTIVE, launchEligible: false, slug: 'x' }) === false, `${type}-VIEW-01 active false disabled`);
  check(readyFn({ status: CMS_STATUS.ACTIVE, launchEligible: true, slug: 'x' }) === true, `${type}-VIEW-02 active true enabled`);
  check(readyFn({ status: CMS_STATUS.DRAFT, slug: 'x' }) === false, `${type}-VIEW-03 draft disabled`);
  check(adminPage.includes('isAdminSlugPreviewReady'), `${type}-VIEW-07 edit form wired`);
  check(adminPage.includes('publicPreviewReady={isAdminSlugPreviewReady'), `${type}-VIEW-07b slug field explicit readiness`);
}

// ── Admission (preserve hotfix) ───────────────────────────────────────────────
cmsLiveSuite('ADM');
check(isAdmissionPublicReady({ status: CMS_STATUS.ACTIVE, launchEligible: true, slug: 'a' }) === true, 'ADM-LIVE-07 public detail ready');
check(isAdmissionPublicReady({ status: CMS_STATUS.ACTIVE, launchEligible: false, slug: 'a' }) === false, 'ADM-LIVE-08 public detail rejects false');
cmsViewParity('ADM', isAdmissionPublicReady, read('client/src/pages/Admin/AdminContentAdmissions.jsx'));

// ── Scholarship CMS ───────────────────────────────────────────────────────────
cmsLiveSuite('SCH');
cmsViewParity('SCH', isScholarshipPublicReady, read('client/src/pages/Admin/AdminContentScholarships.jsx'));
const schCtrl = read('server/src/controllers/admin/adminScholarshipsController.js');
check(!schCtrl.includes('body.launchEligible'), 'SCH-LIVE-04 client launchEligible ignored');
check(schCtrl.includes('syncScholarshipLaunchEligible(doc, before)'), 'SCH update reconciles with before snapshot');
check(schCtrl.includes('source.launchEligible = false') && schCtrl.includes('source.status = CMS_STATUS.DRAFT'), 'SCH-LIVE-06 duplicate non-public');

// ── Internship ────────────────────────────────────────────────────────────────
cmsLiveSuite('INT');
cmsViewParity('INT', isInternshipPublicReady, read('client/src/pages/Admin/AdminContentInternships.jsx'));
const intCtrl = read('server/src/controllers/admin/adminInternshipsController.js');
check(intCtrl.includes('syncInternshipLaunchEligible(doc, before)'), 'INT update reconciles historical false');

// ── Admin Job ─────────────────────────────────────────────────────────────────
check(
  deriveJobLaunchEligible({ status: CMS_STATUS.ACTIVE, approvalStatus: 'approved', launchEligible: false }) === true,
  'JOB-LIVE-01 historical approved active false reconciles'
);
check(deriveJobLaunchEligible({ status: CMS_STATUS.ACTIVE, approvalStatus: 'pending' }) === false, 'JOB-LIVE-02 pending false');
check(deriveJobLaunchEligible({ status: CMS_STATUS.ACTIVE, approvalStatus: 'rejected' }) === false, 'JOB-LIVE-03 rejected false');
check(deriveJobLaunchEligible({ status: CMS_STATUS.CLOSED, approvalStatus: 'approved' }) === false, 'JOB-LIVE-04 closed false');
check(isJobPublicReady({ status: CMS_STATUS.ACTIVE, approvalStatus: 'approved', launchEligible: true, slug: 'j' }) === true, 'JOB-LIVE-08 public predicate');
const jobPage = read('client/src/pages/Admin/AdminContentJobs.jsx');
check(jobPage.includes('isAdminSlugPreviewReady'), 'JOB-LIVE-07 edit slug wired');
check(jobPage.includes('AdminViewPublicLink'), 'JOB-LIVE-07 table uses shared link');

// ── Blog parity ───────────────────────────────────────────────────────────────
const blogPage = read('client/src/pages/Admin/AdminContentBlogs.jsx');
check(isBlogPublicReady({ status: 'published', slug: 'b' }) === true, 'BLOG published ready');
check(isBlogPublicReady({ status: 'draft', slug: 'b' }) === false, 'BLOG draft not ready');
check(isBlogPublicReady({ status: 'archived', slug: 'b' }) === false, 'BLOG archived not ready');
check(blogPage.includes("publicPreviewReady={isAdminSlugPreviewReady('blog'"), 'BLOG edit slug explicit readiness');

// ── AdminSlugField strict opt-in ──────────────────────────────────────────────
const slugField = read('client/src/components/admin/AdminSlugField.jsx');
check(slugField.includes('publicPreviewReady === true'), 'SLUG-VIEW-04 requires explicit true for anonymous link');

// ── Legacy CMS surfaces ───────────────────────────────────────────────────────
check(isLegacyActiveSlugPublicReady({ status: CMS_STATUS.ACTIVE, slug: 'x' }) === true, 'legacy active+slug');
check(isLegacyActiveSlugPublicReady({ status: CMS_STATUS.DRAFT, slug: 'x' }) === false, 'legacy draft disabled');
check(isPublishedSlugPublicReady({ status: 'published', slug: 'x' }) === true, 'published slug ready');
check(read('client/src/pages/Admin/AdminForeignStudies.jsx').includes("type=\"legacy-active\""), 'foreign studies table parity');
check(read('client/src/pages/Admin/AdminCareerGuidance.jsx').includes("type=\"published-slug\""), 'career articles table parity');

// ── Fixture preservation ──────────────────────────────────────────────────────
check(isFixtureRecord({ program: 'Demo Preview', institution: 'Test University' }) === false, 'fixture never from title');
check(deriveCmsLaunchEligible({ isFixture: true, launchEligible: false }, CMS_STATUS.ACTIVE) === false, 'fixture stays ineligible');

// ── Public API predicate parity ───────────────────────────────────────────────
const prodSch = withFixtureExclusion({ status: CMS_STATUS.ACTIVE }, { NODE_ENV: 'production' });
check(JSON.stringify(prodSch).includes('"launchEligible":true'), 'scholarship public API requires launchEligible');
const blogsPublic = read('server/src/controllers/blogsController.js');
check(blogsPublic.includes("status: 'published'"), 'blog public API published filter');

// ── Exam prep regression (source only) ────────────────────────────────────────
const examAdmin = read('client/src/pages/Admin/AdminExamPreparation.jsx');
check(examAdmin.includes('quizId') && examAdmin.includes('Select quiz'), 'EXAM quizId wiring present');

console.log(`cmsPublicationParityHotfix.test.js: ${count} assertions passed`);
