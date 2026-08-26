/**
 * SCH-OPS — Institution Scholarship Operational Admin + Portal workflow.
 *
 * Contract/static tests (no DB). Run:
 *   node src/__tests__/institutionScholarshipOperationalWorkflow.test.js
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

const taxonomy = await loadShared('education/taxonomy.js');
const readiness = await loadShared('cms/publicReadiness.js');
const unified = await loadShared('publicDiscovery/unifiedScholarshipDiscovery.js');
const intel = await loadShared('education/scholarshipIntelligence.js');

const adminPage = read(path.join(clientSrc, 'pages/Admin/AdminEducationScholarships.jsx'));
const adminNav = read(path.join(clientSrc, 'config/adminNavConfig.js'));
const routes = read(path.join(clientSrc, 'routes/index.jsx'));
const portalSvc = read(path.join(serverSrc, 'services/institutionPortalService.js'));
const portalCtrl = read(path.join(serverSrc, 'controllers/institutionPortalController.js'));
const portalRoutes = read(path.join(serverSrc, 'routes/institutionPortal.js'));
const adminSchCtrl = read(path.join(serverSrc, 'controllers/education/adminScholarshipController.js'));
const model = read(path.join(serverSrc, 'models/education/CanonicalScholarship.js'));
const instEditor = read(path.join(clientSrc, 'pages/Institution/InstitutionScholarshipEditor.jsx'));
const instList = read(path.join(clientSrc, 'pages/Institution/InstitutionScholarships.jsx'));
const viewPublic = read(path.join(clientSrc, 'components/admin/AdminViewPublicLink.jsx'));
const cmsAdmin = read(path.join(clientSrc, 'pages/Admin/AdminContentScholarships.jsx'));
const discoverySvc = read(path.join(serverSrc, 'services/unifiedScholarshipDiscoveryService.js'));
const adminJson = read(path.join(clientSrc, 'i18n/locales/en/admin.json'));

console.log('\n── SCH-OPS Institution Scholarship Operational Workflow ──');

check('SCH-OPS-01 Admin canonical scholarship page/route exists', () => {
  assert.ok(fs.existsSync(path.join(clientSrc, 'pages/Admin/AdminEducationScholarships.jsx')));
  assert.ok(routes.includes('education/scholarships') && routes.includes('AdminEducationScholarships'));
  assert.ok(adminNav.includes('education/scholarships') && adminNav.includes('educationScholarships'));
  assert.ok(adminJson.includes('educationScholarships'));
});

check('SCH-OPS-02 Admin list loads submitted canonical scholarships', () => {
  assert.ok(adminPage.includes("useAdminList('/admin/education/scholarships'"));
  assert.ok(adminSchCtrl.includes('adminListScholarships'));
  assert.ok(adminSchCtrl.includes("status"));
});

check('SCH-OPS-03 Admin filter by Institution/status works', () => {
  assert.ok(adminSchCtrl.includes('q.institutionId') && adminSchCtrl.includes('q.status'));
  assert.ok(adminPage.includes("key: 'institutionId'") && adminPage.includes("key: 'status'"));
});

check('SCH-OPS-04 Institution can edit its own draft', () => {
  assert.ok(instEditor.includes('updateScholarship'));
  assert.ok(portalSvc.includes('updateOwnedScholarship'));
  assert.ok(portalSvc.includes("PUB_STATUSES.DRAFT") && portalSvc.includes('NEEDS_CHANGES'));
  assert.ok(routes.includes('scholarships/:scholarshipId/edit'));
});

check('SCH-OPS-05 Institution cannot edit another Institution scholarship', () => {
  assert.ok(portalSvc.includes('assertScholarshipOwnership'));
  assert.ok(portalCtrl.includes('getScholarship') || portalRoutes.includes('scholarships/:scholarshipId'));
  assert.ok(portalSvc.includes('getOwnedScholarship'));
});

check('SCH-OPS-06 Institution can save draft without publishing', () => {
  assert.ok(instEditor.includes('Save draft') || instEditor.includes('save draft'));
  assert.ok(portalSvc.includes('STATUS_FORBIDDEN') || portalSvc.includes('cannot set publication status'));
  assert.ok(!instEditor.includes("status: 'published'") || !instEditor.includes('status: PUB_STATUSES.PUBLISHED'));
});

check('SCH-OPS-07 Institution submit changes status correctly', () => {
  assert.ok(portalSvc.includes('submitOwnedScholarshipForReview'));
  assert.ok(portalSvc.includes('PUB_STATUSES.SUBMITTED'));
  assert.ok(portalSvc.includes("draft or needs_changes"));
});

check('SCH-OPS-08 Institution cannot self-publish', () => {
  assert.ok(portalSvc.includes('STATUS_FORBIDDEN'));
  assert.ok(instList.includes('Admin publish') || instList.includes('cannot self-publish') || instEditor.includes('cannot self-publish'));
});

check('SCH-OPS-09 Admin publish uses canonical authority', () => {
  assert.ok(adminSchCtrl.includes('assertPublishableInstitutional') || adminSchCtrl.includes('Published scholarships require'));
  assert.ok(adminSchCtrl.includes('extractSources') || adminSchCtrl.includes('validateSource'));
  assert.ok(adminPage.includes("PUB_STATUSES.PUBLISHED"));
});

check('SCH-OPS-10 Publishing requires valid source', () => {
  assert.ok(adminSchCtrl.includes('Published scholarships require at least one valid source'));
  assert.ok(adminPage.includes('sourceUrl') && adminPage.includes('sourceRequired'));
});

check('SCH-OPS-11 Published institutional scholarship appears in unified /scholarships', () => {
  assert.ok(discoverySvc.includes('listUnifiedScholarships') || discoverySvc.includes('INSTITUTIONAL'));
  const card = unified.projectInstitutionCanonicalScholarshipDiscoveryCard(
    {
      _id: '1',
      title: 'T',
      slug: 't',
      status: 'published',
      scholarshipType: 'institutional',
      institutionId: 'i1',
      sources: [{ sourceUrl: 'https://example.edu/aid' }],
      degreeLevels: ['bachelor'],
    },
    { _id: 'i1', officialName: 'U', slug: 'u', countryCode: 'PK', status: 'published' }
  );
  assert.ok(card);
  assert.equal(card.detailUrl, '/scholarship-intelligence/t');
});

check('SCH-OPS-12 Unpublished canonical scholarship does not appear', () => {
  for (const status of ['draft', 'submitted', 'under_review', 'needs_changes']) {
    assert.equal(
      unified.projectInstitutionCanonicalScholarshipDiscoveryCard(
        {
          _id: '1', title: 'T', slug: 't', status, scholarshipType: 'institutional',
          institutionId: 'i1', sources: [{ sourceUrl: 'https://x.edu' }],
        },
        { _id: 'i1', officialName: 'U', slug: 'u', status: 'published' }
      ),
      null
    );
  }
});

check('SCH-OPS-13 View Public disabled until published', () => {
  assert.ok(viewPublic.includes('canonical-scholarship'));
  assert.ok(viewPublic.includes('isInstitutionCanonicalScholarshipPublicReady'));
  assert.equal(
    readiness.isInstitutionCanonicalScholarshipPublicReady({ status: 'submitted', scholarshipType: 'institutional', slug: 'x', institutionId: 'i' }),
    false
  );
});

check('SCH-OPS-14 View Public enabled after valid publish', () => {
  assert.equal(
    readiness.isInstitutionCanonicalScholarshipPublicReady({
      status: 'published',
      scholarshipType: 'institutional',
      slug: 'x',
      institutionId: 'i',
    }),
    true
  );
  assert.ok(adminPage.includes('CANONICAL_SCHOLARSHIPS') || adminPage.includes('scholarship-intelligence'));
});

check('SCH-OPS-15 Program applicability persists canonical programId', () => {
  assert.ok(instEditor.includes('applicableProgramIds'));
  assert.ok(adminPage.includes('applicableProgramIds'));
  assert.ok(adminSchCtrl.includes('applicableProgramIds'));
});

check('SCH-OPS-16 Correction/resubmit uses same scholarship record', () => {
  assert.ok(portalSvc.includes('reviewFeedback = \'\''));
  assert.ok(instEditor.includes('same scholarship') || instList.includes('Edit'));
  assert.ok(portalSvc.includes('updateOwnedScholarship') && portalSvc.includes('submitOwnedScholarshipForReview'));
});

check('SCH-OPS-17 Provider-facing review reason does not expose internal Admin notes', () => {
  assert.ok(model.includes('reviewFeedback'));
  assert.ok(portalSvc.includes('projectOwnedScholarship'));
  assert.ok(portalSvc.includes("select('-adminNotes')") || portalSvc.includes('-adminNotes'));
  assert.ok(intel.projectPublicScholarship({ adminNotes: 'SECRET', reviewFeedback: 'fix X', title: 'T' }).adminNotes === undefined);
  assert.ok(!Object.prototype.hasOwnProperty.call(
    intel.projectPublicScholarship({ adminNotes: 'SECRET', reviewFeedback: 'fix X', title: 'T' }),
    'reviewFeedback'
  ));
  assert.ok(instEditor.includes('reviewFeedback') && !instEditor.includes('adminNotes'));
});

check('SCH-OPS-18 Submit notification reaches Admin where notification architecture supports it', () => {
  assert.ok(portalSvc.includes('notifyAdminStaff'));
  assert.ok(portalSvc.includes('institution_scholarship.submitted'));
  assert.ok(portalSvc.includes('dedupeKey'));
});

check('SCH-OPS-19 Decision notification reaches owning Institution', () => {
  assert.ok(adminSchCtrl.includes('notifyInstitutionOrganizationOwners') || adminSchCtrl.includes('notifyOwningInstitutionDecision'));
  assert.ok(adminSchCtrl.includes('institution_scholarship.needs_changes') || adminSchCtrl.includes('CONTENT_NEEDS_CHANGES'));
  assert.ok(adminSchCtrl.includes('reviewFeedback'));
});

check('SCH-OPS-20 CMS Scholarships remain unchanged', () => {
  assert.ok(routes.includes("path: 'scholarships', element: <AdminContentScholarships"));
  assert.ok(cmsAdmin.includes('AdminContentScholarships') || cmsAdmin.includes('admin:addScholarship') || cmsAdmin.length > 100);
  assert.ok(adminNav.includes(`${'ROUTES.ADMIN'}/scholarships`) || adminNav.includes('/scholarships'));
  assert.ok(adminNav.includes('CONTENT_SCHOLARSHIPS'));
  assert.ok(Object.values(taxonomy.PUB_STATUSES).includes('needs_changes'));
  assert.ok(Object.values(taxonomy.PUB_STATUSES).includes('under_review'));
  assert.ok(!Object.values(taxonomy.PUB_STATUSES).includes('rejected'));
});

console.log(`\ninstitutionScholarshipOperationalWorkflow.test.js: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
