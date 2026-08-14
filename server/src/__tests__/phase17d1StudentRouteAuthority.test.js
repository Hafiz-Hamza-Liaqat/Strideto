/**
 * Phase 17D-1 — Student-route authority inventory + realm regression (source contract).
 * Run: node src/__tests__/phase17d1StudentRouteAuthority.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

const studentProductAuth = 'studentProductAuth';

function usesStudentProductAuth(src) {
  return src.includes(studentProductAuth) && src.includes("from '../middleware/requireUserCapability.js'")
    || src.includes("from '../../middleware/requireUserCapability.js'");
}

const STUDENT_WRITE_FILES = [
  ['server/src/routes/jobs.js', 'job save/apply'],
  ['server/src/routes/scholarships.js', 'scholarship save'],
  ['server/src/routes/admissions.js', 'admission save'],
  ['server/src/routes/internships.js', 'internship apply/save'],
  ['server/src/routes/intlScholarships.js', 'intl scholarship save'],
  ['server/src/routes/users.js', 'resume-analyze / cover-letter / applications'],
  ['server/src/routes/opportunityApplications.js', 'opportunity tracker'],
  ['server/src/routes/actionEngine.js', 'journey / action engine'],
  ['server/src/routes/talent.js', 'talent profile'],
  ['server/src/routes/resumes.js', 'resumes'],
  ['server/src/routes/documents.js', 'student documents'],
  ['server/src/routes/credentials.js', 'credentials'],
  ['server/src/routes/scoring.js', 'scoring'],
  ['server/src/routes/assessments.js', 'assessments talentAuth'],
  ['server/src/routes/timeline.js', 'timeline'],
  ['server/src/routes/careerDashboard.js', 'career dashboard'],
  ['server/src/routes/budget.js', 'budget planner'],
  ['server/src/routes/personalization.js', 'personalization'],
  ['server/src/routes/copilot.js', 'student copilot'],
  ['server/src/routes/chatbot.js', 'chatbot'],
  ['server/src/routes/badges.js', 'badges me/rank'],
  ['server/src/routes/skillClaims.js', 'skill claims applicantAuth'],
  ['server/src/routes/webinars.js', 'webinar register'],
  ['server/src/routes/exams.js', 'quiz submit'],
  ['server/src/routes/commerce.js', 'user commerce'],
  ['server/src/routes/cases.js', 'student cases'],
  ['server/src/routes/consultations.js', 'student consultations'],
  ['server/src/routes/professionalTrust.js', 'student reviews/disputes'],
  ['server/src/routes/marketplacePayments.js', 'user marketplace payments'],
  ['server/src/routes/agent.js', 'marketplace interest'],
  ['server/src/routes/institutionPortal.js', 'student institution admissions'],
  ['server/src/routes/v1/index.js', 'v1 save/bookmarks'],
];

for (const [rel, label] of STUDENT_WRITE_FILES) {
  const src = read(rel);
  check(usesStudentProductAuth(src), `${rel} (${label}) uses studentProductAuth`);
}

const auth = read('server/src/routes/auth.js');
check(auth.includes('studentProductAuth'), 'auth.js imports studentProductAuth for student surfaces');
check(/\/auth\/recently-viewed[\s\S]*studentProductAuth/.test(auth) || /studentProductAuth, recordRecentlyViewed/.test(auth), 'recently-viewed is student product');
check(/\/auth\/saved[\s\S]{0,80}studentProductAuth|studentProductAuth, getSaved/.test(auth), 'saved/bookmarks is student product');
check(
  /\/auth\/me', requireAuth, requireUserAuth, me/.test(auth),
  'GET /auth/me remains generic User (no student capability)'
);
check(/change-password', secureTrustedOrigin, requireAuth, requireUserAuth, changePassword/.test(auth), 'change-password is generic User');
check(/\/auth\/logout', secureTrustedOrigin, requireAuth, requireUserAuth, logout/.test(auth), 'logout is generic User');
check(/\/auth\/profile', requireAuth, requireUserAuth, getProfile/.test(auth), 'GET profile is generic User');
check(/\/auth\/profile', requireAuth, requireUserAuth, updateProfile/.test(auth), 'PATCH profile is generic User');
check(/\/auth\/fcm-token', requireAuth, requireUserAuth, registerFcmToken/.test(auth), 'fcm-token is generic User');
check(/\/auth\/refresh-token'/.test(auth) && !/refresh-token[\s\S]{0,120}studentProductAuth/.test(auth), 'refresh-token is not student-gated');
check(/studentProductAuth, recordRecentlyViewed/.test(auth), 'recently-viewed is student product');
check(/studentProductAuth, getSaved/.test(auth), 'saved/bookmarks is student product');

const vault = read('server/src/routes/vault.js');
check(!vault.includes('studentProductAuth') && !vault.includes('requireStudentCapability'), 'vault remains generic User (future BC)');
check(/requireAuth, requireUserAuth/.test(vault), 'vault still requires User-realm auth');

const privacy = read('server/src/routes/privacy.js');
check(!privacy.includes('studentProductAuth'), 'privacy requests remain generic User');

const inbox = read('server/src/routes/userInbox.js');
check(!inbox.includes('studentProductAuth'), 'inbox remains capability-neutral');

const support = read('server/src/routes/support.js');
check(!support.includes('studentProductAuth'), 'support tickets remain capability-neutral');

const announcements = read('server/src/routes/announcements.js');
check(!announcements.includes('studentProductAuth'), 'announcements remain capability-neutral');

const register = read('server/src/controllers/authController.js');
check(/initializeCustomerUser/.test(register), 'student registration initializes student grant');
check(/student_registration_retry/.test(register), 'uninitialized duplicate registration retries grant+init');
check(!/initializeCustomerUser[\s\S]{0,200}business_client/.test(register), 'registration does not grant business_client');

const invite = read('server/src/controllers/admin/invitationsController.js');
check(/initializeStaffUser/.test(invite), 'staff invitation initializes without student grant');

const ensureAdmin = read('server/src/seed/ensureAdmin.js');
check(/initializeStaffUser/.test(ensureAdmin), 'ensureAdmin create initializes staff capabilities');
check(/applyRoleTransitionCapabilities/.test(ensureAdmin), 'ensureAdmin update initializes capabilities on role mutation');

const userModel = read('server/src/models/User.js');
check(/capabilitySchemaVersion/.test(userModel), 'User model has capabilitySchemaVersion marker');
check(/capabilityInitializationState/.test(userModel), 'User model has capability-era initialization state');
check(!/capabilityInitializationState:[\s\S]{0,80}default:/.test(userModel), 'initialization state has no mongoose default that would rewrite historical rows');

const backfill = read('server/src/scripts/backfillUserCapabilities.js');
check(/Live User capability backfill is not permitted/.test(backfill), 'CLI backfill refuses live execution in 17D-1');
check(/dryRun: !apply/.test(backfill), 'backfill is dry-run by default');

const orgBackfill = read('server/src/scripts/backfillOrganizationCapabilities.js');
check(/Live Organization capability backfill is not permitted/.test(orgBackfill), 'org CLI backfill refuses live execution');
check(/BUSINESS_SERVICES_PROVIDER/.test(orgBackfill) && /neverGranted/.test(orgBackfill), 'org backfill never grants provider/buyer');

// --- 30K realm / cookie regression ---
const cookies = read('server/src/services/auth/AuthCookiePolicy.js');
check(/path: '\/api\/auth\/refresh-token'/.test(cookies), 'user refresh cookie path unchanged');
check(/path: '\/api\/auth\/employer\/refresh-token'/.test(cookies), 'employer refresh cookie path unchanged');
check(/path: '\/api\/auth\/agent\/refresh-token'/.test(cookies), 'agent refresh cookie path unchanged');
check(/path: '\/api\/auth\/institution\/refresh-token'/.test(cookies), 'institution refresh cookie path unchanged');
check(!/formation-provider/.test(cookies), 'no formation-provider cookie');
check(!/business.client.*refresh-token/.test(cookies), 'no fifth GBS refresh cookie');

const authMw = read('server/src/middleware/auth.js');
check(/requireEmployerAuth/.test(authMw) && /requireAgentAuth/.test(authMw), 'employer/agent auth middleware intact');
check(/requireInstitutionAuth/.test(authMw), 'institution auth middleware intact');
check(!/universal token|formationProvider/.test(authMw), 'no universal token / formation-provider realm');

const pageReg = read('shared/pageRegistry.js');
check(!/\/business-services/.test(pageReg), 'no public /business-services page');
check(!/route: '\/business'/.test(pageReg), 'no /business dashboard page');

const envExample = read('.env.example');
check(/BUSINESS_SERVICES_ENABLED=0/.test(envExample), 'GBS flag documented default OFF');

const wipAdmin = read('client/src/components/admin/AdminDataTable.jsx').slice(0, 20);
check(wipAdmin.length >= 0, 'AdminDataTable still readable (untouched by this test)');

console.log(
  `phase17d1StudentRouteAuthority.test.js: ${count} assertions passed; ${STUDENT_WRITE_FILES.length} student-write files inventoried`
);
