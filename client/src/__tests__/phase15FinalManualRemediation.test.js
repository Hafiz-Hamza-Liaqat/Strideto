import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Phase 15 final manual-remediation focused contracts.
 * Source-text checks (no jsdom). Not launch certification.
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const repoRoot = path.resolve(clientSrc, '..', '..');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');
const readRoot = (rel) => readFileSync(path.join(repoRoot, rel), 'utf8');

// A. Shell persistence / no route auth reset
{
  const auth = read('context/AuthContext.jsx');
  const employer = read('context/EmployerAuthContext.jsx');
  const agent = read('context/AgentAuthContext.jsx');
  const institution = read('context/InstitutionAuthContext.jsx');
  const protectedUser = read('components/auth/ProtectedRoute.jsx');
  check(/userRealmActive/.test(auth) && /\[userRealmActive\]/.test(auth), 'A. Auth bootstrap is realm-boundary, not every pathname');
  check(/alreadyHydrated/.test(auth) && /if \(!alreadyHydrated\) setLoading\(true\)/.test(auth), 'A. Auth does not flash loading when already hydrated');
  check(/employerRouteActive/.test(employer) && /\[employerRouteActive\]/.test(employer), 'A. Employer bootstrap is realm-boundary');
  check(/agentRouteActive/.test(agent) && /\[agentRouteActive\]/.test(agent), 'A. Agent bootstrap is realm-boundary');
  check(/alreadyHydrated/.test(institution), 'A. Institution skips loading flash when hydrated');
  check(/loading && !isAuthenticated/.test(protectedUser), 'A. ProtectedRoute keeps shell mounted while authenticated');
  check(!/key=\{pathname\}/.test(read('routes/index.jsx')), 'A. Router does not remount the tree on pathname key');
}

// B. Navbar IA / hover / current / dropdown
{
  const nav = read('components/layout/navConfig.js');
  const navbar = read('components/layout/Navbar.jsx');
  const css = read('index.css');
  check(/programExplorer/.test(nav) && /schoolsAndColleges/.test(nav) && /foreignStudies/.test(nav) && /intlScholarships/.test(nav), 'B. Study & Institutions mega IA');
  check(/testHub/.test(nav) && /examPrep/.test(nav), 'B. Tests & Prep mega is Test Hub + Exam Prep');
  check(/agentsDirectory/.test(nav) && /professionalMarketplace/.test(nav) && /careerGuidance/.test(nav) && /resumeBuilder/.test(nav), 'B. Services mega IA');
  check(!/helpCenter/.test(nav) && !/\/help-center/.test(nav), 'B. Help Center is not in Services mega');
  check(/isNavItemCurrent/.test(navbar) && /aria-current=\{current \? 'page'/.test(navbar), 'B. Current page uses aria-current');
  check(/mousedown/.test(navbar) && /registerOverlayEscape/.test(navbar), 'B. Mega closes on outside click and Escape');
  check(/nav-item/.test(css) && /focus-visible/.test(css), 'B. Shared nav hover/focus-visible styles exist');
}

// C. Footer IA
{
  const footer = read('components/layout/Footer.jsx');
  check(/footer:discover/.test(footer) && /footer:studyPrepare/.test(footer), 'C. Discover + Study & Prepare groups');
  check(/ROUTES\.BLOG/.test(footer) && /footer:helpCenter/.test(footer), 'C. Blog and Help Center under Resources & Support');
  check(!/ROUTES\.LICENSE/.test(footer) && !/github\.com/.test(footer) && !/\/admin/.test(footer), 'C. Footer does not expose Admin/License/GitHub');
  check(/ROUTES\.SCHOOLS_AND_COLLEGES/.test(footer), 'C. Schools & Colleges uses the public route');
}

// D. Hero search
{
  const home = read('pages/Home/Home.jsx');
  const homeEn = read('i18n/locales/en/home.json');
  check(/allOpportunities/.test(home) && /programs/.test(home) && /showCountryFilter/.test(home), 'D. Hero opportunity type + country selector');
  check(!/All provinces|All Provinces/.test(home), 'D. Hero does not render Pakistan province selector');
  check(homeEn.includes('worldwide') || /worldwide/.test(homeEn), 'D. Hero copy is international');
  check(!/govJobs/.test(home) || /Government Jobs/.test(home) === false, 'D. Government Jobs is not a global hero shortcut in Home.jsx');
}

// E. Country → region → city cascade
{
  const cascade = read('components/forms/LocationCascadeFilter.jsx');
  const regions = readRoot('shared/international/regions.js');
  check(/regionsForCountry/.test(cascade), 'E. Cascade uses shared region catalog');
  check(/countryCode: code \|\| '', region: '', city: ''/.test(cascade), 'E. Country change clears region and city');
  check(/region: event\.target\.value, city: ''/.test(cascade), 'E. Region change clears city');
  check(/US|DE|PK|GB/.test(regions), 'E. Catalog includes US/DE/PK/GB');
}

// F. Job location filters
{
  const jobs = read('pages/Jobs/Jobs.jsx');
  const jobsCtrl = readRoot('server/src/controllers/jobsController.js');
  check(/LocationCascadeFilter/.test(jobs), 'F. Jobs listing uses location cascade');
  check(/workMode/.test(jobs) && /workMode/.test(jobsCtrl), 'F. Jobs work mode filter is wired client+server');
  check(/withFixtureExclusion/.test(jobsCtrl), 'F. Jobs public list applies fixture exclusion');
  check(!/across Pakistan/.test(jobs), 'F. Jobs copy is not Pakistan-only');
}

// G. Program Explorer global Country
{
  const explorer = read('pages/Tests/ProgramExplorer.jsx');
  check(/CountrySelect/.test(explorer), 'G. Program Explorer uses global CountrySelect');
  check(/No programs found/.test(explorer), 'G. Truthful empty state when a country has zero programs');
}

// H. Institution application privacy sidebar
{
  const apply = read('pages/Student/StudentInstitutionApply.jsx');
  check(/WHAT YOU SHARE|What you share|privacy boundary|does not grant/i.test(apply), 'H. Apply page states privacy boundary');
  check(/WHAT HAPPENS NEXT|What happens next|Institution reviews/i.test(apply), 'H. Apply page states next steps');
  check(/PhoneInput/.test(apply) && /CountrySelect/.test(apply), 'H. International country + phone');
  check(!/AdHost/.test(apply), 'H. No ordinary ads on institution apply');
}

// I. Internship location filters
{
  const internships = read('pages/Internships/Internships.jsx');
  const internCtrl = readRoot('server/src/controllers/internshipsController.js');
  check(/LocationCascadeFilter/.test(internships), 'I. Internships use location cascade');
  check(/workMode/.test(internships) && /compensation|isPaid/.test(internships), 'I. Internships expose work mode and compensation filters');
  check(/withFixtureExclusion/.test(internCtrl), 'I. Internship public list applies fixture exclusion');
}

// J. Student application Employer-state authority
{
  const detail = read('pages/Applications/ApplicationDetail.jsx');
  check(/stageAuthority === 'employer'/.test(detail) && /EmployerInstitutionStagePanel/.test(detail), 'J. Employer/Institution stages are a read-only panel');
  check(/toStage: 'withdrawn'/.test(detail), 'J. Student withdrawal remains a dedicated action');
  check(/myTrackingStatus/.test(detail), 'J. Personal tracker is labelled My tracking status');
  check(!/toStage: 'screening'/.test(detail) && !/toStage: 'offer'/.test(detail), 'J. Student UI does not send employer stages');
}

// K. Consultation request errors
{
  const handler = readRoot('server/src/middleware/errorHandler.js');
  const svc = readRoot('server/src/services/consultationService.js');
  const page = read('pages/Consultations/ConsultationRequest.jsx');
  check(/status !== 422 && status !== 409/.test(handler), 'K. 422/409 messages are not sanitized to Request failed');
  check(/function fail\(message, status/.test(svc) && /SLOT_UNAVAILABLE|SLOT_CONFLICT|INVALID_START/.test(svc), 'K. Consultation service returns coded conflicts');
  check(/err\.response\?\.data\?\.error/.test(page) || /setError/.test(page), 'K. Consultation request surfaces server error');
}

// L. Notification mobile containment
{
  const bell = read('components/notifications/NotificationBell.jsx');
  check(/fixed inset-x-2/.test(bell), 'L. Notification popover uses viewport-safe horizontal insets');
  check(/break-words/.test(bell), 'L. Long notification titles wrap');
}

// M. Verification needs_information handling
{
  const svc = readRoot('server/src/services/verificationService.js');
  const queue = read('pages/Admin/AdminVerificationQueue.jsx');
  check(/record.status === VS\.NEEDS_INFORMATION/.test(svc) && /noStatusChange: true/.test(svc), 'M. Already needs_information updates history without a fake transition');
  check(/Waiting for organization response/.test(queue), 'M. Admin shows waiting copy instead of invalid same-state transition');
}

// N. Revoked → new re-verification attempt
{
  const machine = readRoot('shared/international/verification.js');
  const svc = readRoot('server/src/services/verificationService.js');
  check(/\[VS\.REVOKED\]: new Set\(\[VS\.VERIFICATION_PENDING\]\)/.test(machine), 'N. Revoked may start verification_pending');
  check(/isNewAttempt = fromStatus === VS\.REVOKED/.test(svc), 'N. Submit from revoked starts a new attempt, not a resurrection');
}

// O. Admin Alerts provider truth
{
  const alerts = read('pages/Admin/AlertsAdmin.jsx');
  check(/status: 'not_configured'/.test(alerts) && /Telegram/.test(alerts), 'O. Telegram/WhatsApp/LinkedIn are labelled not configured');
  check(/canSend = selected.status === 'available'/.test(alerts), 'O. Send is limited to available channels');
  check(!/Send Telegram alert/.test(alerts), 'O. Does not present Send Telegram alert as an available action');
}

// P. Announcements route regression
{
  const admin = read('pages/Admin/AdminAnnouncements.jsx');
  check(/openCreate/.test(admin) || /New announcement/.test(admin), 'P. New Announcement still opens editor');
  check(/Publish now|Publish Now|publish/i.test(admin), 'P. Publish Now remains');
}

// Q. AdminConfirmDialog
{
  const dialog = read('components/admin/AdminConfirmDialog.jsx');
  check(/open = false/.test(dialog), 'Q. AdminConfirmDialog defaults closed');
}

// R. Fixture exclusion projection
{
  const policy = readRoot('shared/publicDiscovery/fixtureExclusion.js');
  check(/isFixtureRecord/.test(policy) && /launchEligible/.test(policy) && /dataClass/.test(policy), 'R. Fixture classification is explicit, not title matching');
  check(/NODE_ENV === 'production'/.test(policy), 'R. Production projection excludes fixtures');
  const seed = readRoot('server/src/scripts/seedLocalQaInternships.js');
  check(/isFixture: true/.test(seed) && /launchEligible: false/.test(seed), 'R. Local QA internships are classified fixtures');
  check(/APP_ENV === 'staging'/.test(seed), 'R. QA internship seed refuses staging');
}

// S. Milestone popup dedupe
{
  const welcome = read('welcome/portalWelcome.js');
  const delight = read('components/welcome/MilestoneDelight.jsx');
  check(/consumeMilestoneOnce/.test(welcome) && /strideto-milestone-seen/.test(welcome), 'S. Milestone keys are persisted once per user');
  check(/consumeMilestoneOnce/.test(delight) && /prefers-reduced-motion|motion-safe/.test(delight), 'S. Milestone UI is one-shot and motion-safe');
}

// Saved opportunities unify jobs/internships
{
  const saved = read('pages/Journey/SavedOpportunitiesPage.jsx');
  check(/savedApi\.get/.test(saved) && /entityType: 'job'/.test(saved) && /entityType: 'internship'/.test(saved), 'Saved page unifies listing saves with journey saves');
}

console.log(`phase15FinalManualRemediation.test.js: ${count} assertions passed`);
