/**
 * Phase 7 — Public Discovery & Content Finalization.
 * Run: node src/__tests__/phase7PublicDiscovery.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const source = (rel) => readFileSync(path.join(root, rel), 'utf8');

const truth = await import(pathToFileURL(path.join(root, 'shared/publicDiscovery/publicTruth.js')).href);
const project = await import(pathToFileURL(path.join(root, 'shared/publicDiscovery/projectPublicDiscovery.js')).href);
const urls = await import(pathToFileURL(path.join(root, 'shared/publicDiscovery/safePublicUrl.js')).href);
const searchPrivacy = await import(pathToFileURL(path.join(root, 'shared/platform/searchPrivacyPolicy.js')).href);
const openings = await import(pathToFileURL(path.join(root, 'shared/employer/openingsCount.js')).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const jobsCtrl = source('server/src/controllers/jobsController.js');
const jobsPage = source('client/src/pages/Jobs/Jobs.jsx');
const jobDetail = source('client/src/pages/Jobs/JobDetail.jsx');
const internCtrl = source('server/src/controllers/internshipsController.js');
const internDetail = source('client/src/pages/Internships/InternshipDetail.jsx');
const internList = source('client/src/pages/Internships/Internships.jsx');
const scholCtrl = source('server/src/controllers/scholarshipsController.js');
const scholDetail = source('client/src/pages/Scholarships/ScholarshipDetail.jsx');
const scholList = source('client/src/pages/Scholarships/Scholarships.jsx');
const admCtrl = source('server/src/controllers/admissionsController.js');
const admDetail = source('client/src/pages/Admissions/AdmissionDetail.jsx');
const admList = source('client/src/pages/Admissions/Admissions.jsx');
const searchCtrl = source('server/src/controllers/searchController.js');
const searchSvc = source('server/src/services/search/SearchIndexService.js');
const testsRoutes = source('server/src/routes/tests.js');
const programIntel = source('server/src/controllers/education/programIntelligenceController.js');
const acceptCtrl = source('server/src/controllers/education/testAcceptanceController.js');
const testCtrl = source('server/src/controllers/education/testController.js');
const vacancy = source('server/src/services/career/JobVacancyService.js');
const saveBtn = source('client/src/components/listings/SaveButton.jsx');
const login = source('client/src/pages/Auth/Login.jsx');
const routes = source('client/src/routes/index.jsx');
const programUi = source('client/src/pages/Tests/ProgramExplorer.jsx');
const testDetail = source('client/src/pages/Tests/TestDetail.jsx');
const agentProfile = source('client/src/pages/Public/AgentPublicProfile.jsx');
const agentDir = source('client/src/pages/Public/AgentDirectory.jsx');
const marketplace = source('client/src/pages/Public/AgentMarketplaceDetail.jsx');
const agentProfSvc = source('server/src/services/agentProfileService.js');

// ── Openings ────────────────────────────────────────────────────────────────
check(truth.formatPublicOpenings(1).phrase === '1 opening', '1 opening');
check(truth.formatPublicOpenings(2).phrase === '2 openings', '2 openings');
check(truth.formatPublicOpenings(25).phrase === '25 openings', '25 openings');
check(truth.formatPublicOpenings(null).phrase === 'Openings: Not specified', 'legacy missing openings');
check(truth.formatPublicOpenings(undefined).phrase === 'Openings: Not specified', 'undefined openings');
check(!openings.parseOpeningsCount(0).ok, 'zero openings rejected by canonical parser');
check(truth.formatPublicOpenings(0).specified === false, '0 never displayed as specified');
check(jobDetail.includes('openings.phrase') || jobDetail.includes('formatPublicOpenings'), 'Job Detail shows openings');
check(!jobDetail.includes('remaining =') && !jobDetail.includes('openings - applications'), 'no remaining = openings - applications');
check(!jobsCtrl.includes('getVacancyStats'), 'public job detail does not attach vacancy remaining seats');

// ── Public job projection ───────────────────────────────────────────────────
const projected = project.projectPublicJob({
  _id: '1',
  title: 'Engineer',
  company: 'Acme',
  applyType: 'internal',
  openingsCount: 3,
  status: 'active',
  approvalStatus: 'approved',
  planId: 'secret-plan',
  chargedSubmissionAt: ['x'],
  postedBy: 'user1',
  applicationsCount: 99,
  rejectionSummary: { ownerMessage: 'no' },
  description: 'About',
});
check(projected.openingsCount === 3, 'projected openings');
check(projected.applicationsTracked === true, 'internal tracked');
check(projected.planId === undefined, 'planId stripped');
check(projected.chargedSubmissionAt === undefined, 'billing stripped');
check(projected.postedBy === undefined, 'postedBy stripped');
check(projected.applicationsCount === undefined, 'application count not public');
check(projected.rejectionSummary === undefined, 'rejection stripped');
check(projected.authorityKind === truth.AUTHORITY_KINDS.UNKNOWN || projected.authorityKind, 'authority kind set');

const externalJob = project.projectPublicJob({
  title: 'Ext',
  company: 'Co',
  applyType: 'external',
  applicationLink: 'javascript:alert(1)',
  sourceUrl: 'https://employer.example/apply',
  employerId: 'e1',
  source: 'employer',
  applicationsCount: 12,
});
check(externalJob.applicationsTracked === false, 'external not tracked');
check(externalJob.applicationLink === null, 'javascript URL rejected');
check(externalJob.authorityKind === truth.AUTHORITY_KINDS.EMPLOYER_POSTED, 'employer-posted authority');

const listItem = project.projectPublicJobListItem({
  title: 'L',
  company: 'C',
  applyType: 'external',
  openingsCount: null,
  applicationsCount: 5,
});
check(listItem.openingsCount === null, 'list item unspecified openings');
check(listItem.applicationsCount === undefined, 'list item no applicant count');

check(jobsCtrl.includes('projectPublicJob') && jobsCtrl.includes('projectPublicJobListItem'), 'jobs controller projects');
check(jobsCtrl.includes('buildPublicJobFilter'), 'public filter helper');
check(jobsCtrl.includes('PUBLIC_APPROVAL_OR') || jobsCtrl.includes('approvalStatus'), 'approval required');
check(jobsCtrl.includes('extraAnd'), 'organization filter does not clobber approval');

check(!truth.isPubliclyListableJob({ status: 'draft' }), 'draft hidden');
check(!truth.isPubliclyListableJob({ status: 'active', approvalStatus: 'pending' }), 'pending hidden');
check(!truth.isPubliclyListableJob({ status: 'active', approvalStatus: 'rejected' }), 'rejected hidden');
check(!truth.isPubliclyListableJob({ status: 'active', publicationState: 'expired' }), 'expired publication hidden');
check(truth.isPubliclyListableJob({ status: 'active' }), 'legacy active listable');
check(truth.deriveJobAvailability({ status: 'active', deadline: '2000-01-01' }) === truth.JOB_AVAILABILITY.DEADLINE_PASSED, 'deadline passed');
check(vacancy.includes('DEADLINE_PASSED'), 'apply path blocks deadline');
check(vacancy.includes("approvalStatus !== 'approved'"), 'apply path blocks unpublished');

// ── Job listing preserved ───────────────────────────────────────────────────
check(jobsPage.includes('<article'), 'listing uses article cards');
check(jobsPage.includes('job.organization || job.company'), 'card company field');
check(jobsPage.includes('SaveButton'), 'card save');
check(!jobsPage.includes('openings.phrase'), 'listing cards omit openings (compact accepted design)');
check(jobsPage.includes('break-words-safe'), 'listing wraps long titles');
check(jobsPage.includes('resetFilters') || jobsPage.includes('Reset filters'), 'reset filters');
check(jobsPage.includes('applyType'), 'application mode filter');
check(jobsPage.includes("value=\"full-time\""), 'employment type filter');

// ── Job detail layout ───────────────────────────────────────────────────────
check(jobDetail.includes('lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]'), 'desktop two-area layout');
check(jobDetail.includes('lg:hidden'), 'mobile actions in header flow');
check(jobDetail.includes('hidden lg:block'), 'desktop sidebar');
check(jobDetail.includes('aboutTheRole') || jobDetail.includes('About the role'), 'About section');
check(jobDetail.includes('responsibilities'), 'responsibilities section');
check(jobDetail.includes('requirements'), 'requirements section');
check(jobDetail.includes('educationRequirement'), 'education');
check(jobDetail.includes('experience'), 'experience');
check(jobDetail.includes('break-words-safe'), 'long content wrapping');
check(jobDetail.includes('overflow-x-hidden'), 'no page overflow');
check(jobDetail.includes('min-h-[44px]'), 'touch targets');
check(!jobDetail.includes('dangerouslySetInnerHTML'), 'no HTML injection on job detail');
check(jobDetail.includes('EXTERNAL_APPLY_DISCLOSURE') || jobDetail.includes('externalApplyLeavesStrideto'), 'external disclosure');
check(jobDetail.includes('loginLocationState'), 'login return for apply');
check(jobDetail.includes('publicHttpUrlOrNull'), 'unsafe URL gated on client');

// ── Internships ─────────────────────────────────────────────────────────────
const intern = project.projectPublicInternship({
  title: 'Intern',
  organization: 'Org',
  postedBy: 'secret',
  paidUntil: new Date(),
  applyInPlatform: false,
  applicationLink: 'https://example.com/apply',
  status: 'active',
});
check(intern.postedBy === undefined, 'internship postedBy stripped');
check(intern.applyType === 'external', 'internship external mode');
check(internCtrl.includes('projectPublicInternship'), 'internship projection');
check(internCtrl.includes("status: 'active'") && internCtrl.includes('applyInPlatform'), 'internship apply gated');
check(internDetail.includes('EXTERNAL_APPLY_DISCLOSURE'), 'internship external disclosure');
check(internDetail.includes('NO_GUARANTEE_DISCLAIMER'), 'internship no guarantee');
check(internList.includes('SaveButton'), 'internship save');
check(!internList.includes('guaranteed placement'), 'no fake guarantee copy');

// ── Scholarships / admissions ───────────────────────────────────────────────
const cmsSchol = project.projectPublicCmsScholarship({
  title: 'Grant',
  provider: 'Gov',
  link: 'https://gov.example/apply',
  views: 9,
  isSponsored: true,
});
check(cmsSchol.authorityKind === truth.AUTHORITY_KINDS.SOURCE_BACKED, 'CMS scholarship source-backed not institution-owned');
check(cmsSchol.views === undefined, 'scholarship views not required publicly');
check(scholCtrl.includes('projectPublicCmsScholarship'), 'scholarship projection');
check(scholDetail.includes('AGENT_NON_AUTHORITY_DISCLAIMER'), 'agent is not scholarship authority');
check(scholList.includes('OfficialScholarshipsRail'), 'canonical scholarship rail');
check(admList.includes('OfficialIntakesRail'), 'official intakes rail');
check(admCtrl.includes('projectPublicCmsAdmission'), 'admission projection');
check(admDetail.includes('applicationMode'), 'admission application mode');

// ── Programs / institutions / tests ─────────────────────────────────────────
const inst = project.projectPublicCanonicalInstitution({
  officialName: 'Uni',
  slug: 'uni',
  organizationId: 'org-private',
  sources: [{ sourceType: 'university', sourceUrl: 'https://uni.example', evidenceRef: 'secret-ref' }],
});
check(inst.organizationId === undefined, 'canonical institution organizationId stripped');
check(inst.sources[0].evidenceRef === undefined, 'evidenceRef stripped');
check(testCtrl.includes('projectPublicCanonicalInstitution'), 'institution GET projected');
check(programIntel.includes('projectPublicProgram'), 'program projection');
check(testsRoutes.indexOf("'/education/programs/compare'") < testsRoutes.indexOf("'/education/programs/:slug'"), 'compare before slug');
check(acceptCtrl.includes('currentAcceptanceMongoFilter'), 'expired acceptance filtered');
check(programUi.includes('formatPublicDateOnly') || programUi.includes('applicationOpenDate'), 'date-only intakes');
check(programUi.includes('fallbackScopeLabel'), 'institution fallback labeled');
check(testDetail.includes('fallbackScopeLabel'), 'test detail scope caution');
check(testDetail.includes('Country — not institution-wide') || testDetail.includes('COUNTRY'), 'no country escalation');

const draftIntake = project.projectPublicIntake({ status: 'draft', cycleLabel: 'Fall' });
check(draftIntake === null, 'draft intake hidden');
const pubIntake = project.projectPublicIntake({
  status: 'published',
  applicationOpenDate: '2026-09-01',
  applicationMode: 'external',
  applicationUrl: 'https://uni.example/apply',
});
check(pubIntake.applicationOpenDate === '2026-09-01', 'date-only preserved');
check(pubIntake.applicationMode === 'external', 'intake application mode');

check(truth.isCurrentAcceptanceClaim({ status: 'published', supersededById: 'x' }) === false, 'superseded excluded');
check(truth.isCurrentAcceptanceClaim({ status: 'published', effectiveUntil: '2000-01-01' }) === false, 'expired excluded');
check(truth.isCurrentAcceptanceClaim({ status: 'published' }) === true, 'current claim included');

// ── Agents ──────────────────────────────────────────────────────────────────
check(agentProfSvc.includes('canExercisePrivilegedCapability'), 'unverified agent 404');
check(agentProfile.includes('AGENT_NON_AUTHORITY_DISCLAIMER'), 'agent statement labeled');
check(agentProfile.includes('loginLocationState'), 'consultation login return');
check(marketplace.includes('Agent / Agency statement') || marketplace.includes('agentStatement'), 'marketplace agent statement');
check(marketplace.includes('Official / source-backed') || marketplace.includes('canonicalReferences'), 'marketplace official facts separate');
check(agentDir.includes('listPublicAgents') || source('client/src/pages/Public/AgentDirectory.jsx').includes('agents'), 'directory page exists');
const trustCtrl = source('server/src/controllers/professionalTrustController.js');
check(trustCtrl.includes('getPublicProfileBySlug'), 'public reviews use same visibility as public profile');
check(!/profileStatus:'published'/.test(trustCtrl.replace(/\s/g, '')) || trustCtrl.includes('getPublicProfileBySlug'), 'reviews not gated on unpublished profileStatus alone');
check(agentProfile.includes('getProfile(slug)'), 'profile loads independently of reviews');
check(!agentProfile.includes('Promise.all([agentPublicApi.getProfile'), 'reviews 404 cannot hide approved profile');

// ── Search privacy ──────────────────────────────────────────────────────────
check(!searchPrivacy.isSearchDomainAllowed('vault'), 'vault denied');
check(!searchPrivacy.isSearchDomainAllowed('private_message'), 'messages denied');
check(!searchPrivacy.isSearchDomainAllowed('case_private_note'), 'cases denied');
check(!searchPrivacy.isSearchDomainAllowed('budget'), 'budget denied');
check(!searchPrivacy.isSearchDomainAllowed('copilot_conversation'), 'copilot denied');
check(!searchPrivacy.isSearchDomainAllowed('internal_review_note'), 'admin review denied');
check(searchPrivacy.isSearchDomainAllowed('job'), 'job allowed');
const clamped = searchPrivacy.clampPublicSearchTypes(['job', 'vault', 'talent-profile']);
check(clamped.allowed.includes('job') && clamped.denied.includes('vault') && clamped.denied.includes('talent-profile'), 'public search clamp');
check(searchCtrl.includes('clampPublicSearchTypes'), 'search controller clamps');
check(searchCtrl.includes('includeDraft = false'), 'public search ignores includeDraft');
check(searchSvc.includes('publicSearchMetadata'), 'adminEditUrl stripped on public DTO');
check(project.publicSearchMetadata({ adminEditUrl: '/admin/jobs', icon: 'job' }).adminEditUrl === undefined, 'admin URL stripped');

// ── Safe URLs / open redirect / XSS ─────────────────────────────────────────
check(!urls.sanitizePublicHttpUrl('javascript:alert(1)').ok, 'javascript rejected');
check(!urls.sanitizePublicHttpUrl('data:text/html,x').ok, 'data rejected');
check(urls.sanitizePublicHttpUrl('https://ok.example/a').ok, 'https accepted');
check(!urls.isSafeInternalReturnPath('https://evil.example'), 'open redirect rejected');
check(!urls.isSafeInternalReturnPath('//evil.example'), 'protocol-relative rejected');
check(urls.isSafeInternalReturnPath('/jobs/foo'), 'internal path allowed');
check(saveBtn.includes('loginLocationState'), 'save login return');
check(login.includes('resolveLoginReturnPath'), 'login validates return');
check(jobDetail.includes('whitespace-pre-wrap'), 'job description as text');

// ── Routes inventory ────────────────────────────────────────────────────────
check(routes.includes('ROUTES.JOBS') && routes.includes('<JobDetail'), 'jobs routes');
check(routes.includes('ROUTES.INTERNSHIPS'), 'internships route');
check(routes.includes('ROUTES.SCHOLARSHIPS'), 'scholarships route');
check(routes.includes('ROUTES.ADMISSIONS'), 'admissions route');
check(routes.includes('PROGRAM_EXPLORER') || routes.includes('program-explorer'), 'programs route');
check(routes.includes('TEST_HUB') || routes.includes('/tests'), 'tests route');
check(routes.includes('AGENT_PUBLIC_DIRECTORY'), 'agent directory route');
check(routes.includes('AGENT_PUBLIC_MARKETPLACE'), 'marketplace route');

// ── Responsive / a11y markers ───────────────────────────────────────────────
check(jobDetail.includes('lg:sticky'), 'optional sticky summary on desktop');
check(jobDetail.includes('role="status"'), 'status not color-only');
check(jobsPage.includes('EmptyState') || jobsPage.includes('noJobsAdjust'), 'jobs empty state');
check(internList.includes('EmptyState'), 'internships empty state');

console.log(`phase7PublicDiscovery: ${count} checks passed`);
