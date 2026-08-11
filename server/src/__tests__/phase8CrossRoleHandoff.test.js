/**
 * Phase 8 — Cross-role handoff closure.
 * Run: node src/__tests__/phase8CrossRoleHandoff.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const source = (rel) => readFileSync(path.join(root, rel), 'utf8');

const returnPath = await import(pathToFileURL(path.join(root, 'shared/platform/returnPathPolicy.js')).href);
const consent = await import(pathToFileURL(path.join(root, 'shared/platform/consentContract.js')).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const login = source('client/src/pages/Auth/Login.jsx');
const employerLogin = source('client/src/pages/Employer/EmployerLogin.jsx');
const agentLogin = source('client/src/pages/Agent/AgentLogin.jsx');
const institutionLogin = source('client/src/pages/Institution/InstitutionLogin.jsx');
const loginUtil = source('client/src/utils/loginReturn.js');
const appSvc = source('server/src/services/career/OpportunityApplicationService.js');
const consultSvc = source('server/src/services/consultationService.js');
const caseSvc = source('server/src/services/caseManagementService.js');
const vaultSvc = source('server/src/services/vault/VaultDocumentService.js');
const vaultPolicy = source('server/src/services/vault/vaultAccessPolicy.js');
const admissionSvc = source('server/src/services/institutionAdmissionService.js');
const portalSvc = source('server/src/services/institutionPortalService.js');
const automation = source('server/src/services/automationService.js');
const careerBridge = source('server/src/services/career/careerNotificationBridge.js');
const orgBridge = source('server/src/services/orgVerificationNotificationBridge.js');
const consentSvc = source('server/src/services/consentGrantService.js');
const consentModel = source('server/src/models/platform/ConsentGrant.js');
const messageThread = source('client/src/components/consultations/MessageThread.jsx');
const protectedRoute = source('client/src/components/auth/ProtectedRoute.jsx');
const empProtect = source('client/src/components/employer/ProtectedEmployerRoute.jsx');
const agentProtect = source('client/src/components/agent/ProtectedAgentRoute.jsx');
const instProtect = source('client/src/components/institution/ProtectedInstitutionRoute.jsx');
const privacySvc = source('server/src/services/accountPrivacyRequestService.js');

// --- Return paths ---
{
  const { LOGIN_REALMS, resolveRealmReturnPath, isRealmReturnPath } = returnPath;
  check(
    resolveRealmReturnPath({ pathname: '/admin/sc/overview' }, '/', LOGIN_REALMS.STUDENT) === '/',
    'Student is not returned to Admin'
  );
  check(
    resolveRealmReturnPath({ pathname: '/admin/sc/overview' }, '/', LOGIN_REALMS.STAFF_OR_STUDENT) === '/admin/sc/overview',
    'Staff may return to Admin'
  );
  check(
    resolveRealmReturnPath({ pathname: '/employer/jobs' }, '/', LOGIN_REALMS.STUDENT) === '/',
    'Student is not returned to Employer portal'
  );
  check(
    resolveRealmReturnPath({ pathname: '/employer/acme' }, '/jobs', LOGIN_REALMS.STUDENT) === '/employer/acme',
    'Student may return to public Employer profile'
  );
  check(
    resolveRealmReturnPath({ pathname: '/agent/cases/1' }, '/employer', LOGIN_REALMS.EMPLOYER) === '/employer',
    'Employer is not returned to Agent'
  );
  check(
    resolveRealmReturnPath({ pathname: '/admin/sc/overview' }, '/agent', LOGIN_REALMS.AGENT) === '/agent',
    'Agent is not returned to Admin'
  );
  check(
    resolveRealmReturnPath({ pathname: '/institution/applications' }, '/agent', LOGIN_REALMS.AGENT) === '/agent',
    'Agent is not returned to Institution'
  );
  check(
    resolveRealmReturnPath({ pathname: '/employer/jobs' }, '/institution', LOGIN_REALMS.INSTITUTION) === '/institution',
    'Institution is not returned to Employer'
  );
  check(
    resolveRealmReturnPath({ pathname: '/institution/data-quality' }, '/institution', LOGIN_REALMS.INSTITUTION)
      === '/institution/data-quality',
    'Institution may return to same-realm Data Quality'
  );
  check(
    resolveRealmReturnPath('https://evil.example/phish', '/jobs', LOGIN_REALMS.STUDENT) === '/jobs',
    'Open redirect with scheme is rejected'
  );
  check(
    resolveRealmReturnPath('//evil.example', '/jobs', LOGIN_REALMS.STUDENT) === '/jobs',
    'Protocol-relative open redirect is rejected'
  );
  check(
    resolveRealmReturnPath({ pathname: '/applications/1', search: '?token=secret' }, '/', LOGIN_REALMS.STUDENT)
      === '/applications/1',
    'Return path strips token query'
  );
  check(!isRealmReturnPath('/auth/login', LOGIN_REALMS.STUDENT), 'Login loop path rejected');
  check(login.includes('LOGIN_REALMS.STUDENT') && login.includes('STAFF_ROLES'), 'Student login resolves realm after auth');
  check(employerLogin.includes("LOGIN_REALMS.EMPLOYER"), 'Employer login uses employer realm');
  check(agentLogin.includes("LOGIN_REALMS.AGENT"), 'Agent login uses agent realm');
  check(institutionLogin.includes("LOGIN_REALMS.INSTITUTION"), 'Institution login uses institution realm');
  check(loginUtil.includes('resolveRealmReturnPath'), 'client loginReturn delegates to shared policy');
}

// --- Student ↔ Employer application ---
{
  check(appSvc.includes("STUDENT_CANNOT_SET_EMPLOYER_STATE"), 'Student cannot set Employer pipeline via update');
  check(appSvc.includes("assertStudentMayTransition"), 'Student transitions use accepted student vocabulary');
  check(appSvc.includes("err.status = 409") && appSvc.includes('Application already exists'), 'duplicate application 409');
  check(appSvc.includes("toStage === 'withdrawn'") && appSvc.includes('revokeHandoffConsent'), 'withdrawal revokes employer-application consent only');
  check(appSvc.includes('CONSENT_PURPOSES.EMPLOYER_APPLICATION'), 'employer application consent recorded');
  check(!/skillSnapshot\s*=/.test(appSvc), 'application service does not rewrite skill snapshots');
}

// --- Interviews / notifications ---
{
  check(careerBridge.includes('InterviewScheduled') && careerBridge.includes('createUserNotificationOnce'), 'interview notifies via deduped in-app');
  check(careerBridge.includes('formatAppointmentTime'), 'interview copy uses stored timezone');
  check(automation.includes("createUserNotificationOnce") && automation.includes('dedupeKey: dedupKey'), 'queueNotification persists in-app without worker');
  check(!/type: 'notification'/.test(automation.slice(automation.indexOf('export async function queueNotification'), automation.indexOf('export async function onUserRegistered'))), 'in-app no longer depends on notification BackgroundJob');
}

// --- Student ↔ Agent ---
{
  check(consultSvc.includes("recipientActorType === 'student'") && consultSvc.includes("link: `/consultations/${record._id}`"), 'Student consultation inbox deep link');
  check(consultSvc.includes("recipientActorType === 'agent'") && consultSvc.includes("link: `/agent/consultations/${record._id}`"), 'Agent consultation inbox deep link');
  check(consultSvc.includes('CONSENT_PURPOSES.AGENT_CONSULTATION'), 'consultation consent recorded');
  check(consultSvc.includes("fail('Requested slot conflicts with another consultation', 409)"), 'double-booking 409');
  check(messageThread.includes('disabled={busy}') && messageThread.includes('Write a consultation message'), 'consultation composer disables input while busy');
  check(caseSvc.includes("recipientType === 'student'") && caseSvc.includes("link: `/cases/${record._id}`"), 'Student case inbox deep link');
  check(caseSvc.includes('vaultGrantsTransferred:false'), 'case transfer does not inherit Vault grants');
  check(caseSvc.includes("visibility: 'shared'") && caseSvc.includes("actorType === 'student' ? { visibility: 'shared' }"), 'private Agent notes hidden from Student');
  check(caseSvc.includes('Exact Student-approved transfer required'), 'Agent cannot self-approve transfer');
  check(caseSvc.includes('CONSENT_PURPOSES.AGENT_CASE'), 'case consent recorded on Student accept');
  check(caseSvc.includes("An exact active case-scoped Vault grant is required"), 'relationship alone does not grant Vault');
}

// --- Vault ---
{
  check(vaultSvc.includes('CONSENT_PURPOSES.VAULT_GRANT') && vaultSvc.includes('revokeHandoffConsent'), 'Vault grant/revoke write independent consent');
  check(vaultPolicy.includes('Only the ownerUserId can revoke') && vaultPolicy.includes('Unrelated grants are untouched'), 'Vault revoke is grant-scoped');
  check(!/storageKey|publicUrl/.test(vaultSvc.slice(vaultSvc.indexOf('export async function createGrant'), vaultSvc.indexOf('export async function listGrants'))), 'grant create does not leak storage keys');
}

// --- Institution ---
{
  check(admissionSvc.includes('CONSENT_REQUIRED') && admissionSvc.includes('CONSENT_PURPOSES.INSTITUTION_ADMISSION'), 'internal admission requires explicit consent');
  check(admissionSvc.includes('EXTERNAL_ONLY'), 'external intake cannot create fake internal application');
  check(admissionSvc.includes('createUserNotificationOnce') && admissionSvc.includes("link: '/applications/institution'"), 'Student admission state notification');
  check(admissionSvc.includes('VAULT_DENIED'), 'Institution Vault browse denied');
  check(admissionSvc.includes('revokeHandoffConsent') && admissionSvc.includes('INSTITUTION_ADMISSION'), 'admission withdrawal revokes only admission consent');
  check(portalSvc.includes('institution_data_quality.conflict_requires_action'), 'DQ conflict fans out Institution inbox');
  check(portalSvc.includes("link: '/institution/data-quality'"), 'DQ notification deep link');
  check(portalSvc.includes('does not mark data fresh'), 'DQ copy does not imply freshness mutation');
}

// --- Verification / Admin ---
{
  check(orgBridge.includes('createUserNotificationOnce'), 'org verification uses deduped inbox');
  check(orgBridge.includes('/employer/verification') || orgBridge.includes("link: '/employer/verification'"), 'Employer verification deep link present in org bridge or adjacent');
}

// --- Consent independence ---
{
  check(consent.CONSENT_PURPOSES.EMPLOYER_APPLICATION === 'employer_application', 'employer purpose');
  check(consent.CONSENT_PURPOSES.AGENT_CONSULTATION === 'agent_consultation', 'consultation purpose');
  check(consent.CONSENT_PURPOSES.AGENT_CASE === 'agent_case', 'case purpose');
  check(consent.CONSENT_PURPOSES.INSTITUTION_ADMISSION === 'institution_admission', 'institution purpose');
  check(consent.CONSENT_PURPOSES.VAULT_GRANT === 'vault_grant', 'vault purpose');
  check(consentSvc.includes('revokedAt: null') && consentSvc.includes('purpose'), 'revoke filter is purpose+scope scoped');
  check(!consentSvc.includes('updateMany({})') && !consentSvc.includes('purpose: { $in'), 'revoke does not blanket other purposes');
  check(consentModel.includes('consent_grants'), 'independent consent collection');
}

// --- Deep-link re-auth ---
{
  check(protectedRoute.includes('Navigate to={ROUTES.LOGIN}') && protectedRoute.includes('requireStaff'), 'Student/Admin destinations re-authorize');
  check(empProtect.includes('EMPLOYER_LOGIN'), 'Employer destinations re-authorize');
  check(agentProtect.includes('AGENT_LOGIN'), 'Agent destinations re-authorize');
  check(instProtect.includes('INSTITUTION_LOGIN'), 'Institution destinations re-authorize');
}

// --- Privacy / deletion ---
{
  check(privacySvc.includes("status: 'requested'") || privacySvc.includes('requested'), 'privacy requests stay requested');
  check(!/hardDelete|findByIdAndDelete/.test(privacySvc), 'privacy service does not hard-delete');
}

// --- Notification URLs have no secrets ---
{
  for (const [name, src] of [
    ['consultation', consultSvc],
    ['case', caseSvc],
    ['admission', admissionSvc],
    ['career', careerBridge],
    ['portal-dq', portalSvc],
  ]) {
    check(!/[?&]token=/.test(src.match(/link:\s*[`'"][^`'"]+/g)?.join(' ') || ''), `${name} notification links have no token query`);
  }
}

console.log(`phase8CrossRoleHandoff.test.js: ${count} assertions passed`);
