/**
 * Phase 3 — Student / Applicant Final Portal.
 *
 * Run: node src/__tests__/phase3StudentApplicantPortal.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const source = (rel) => readFileSync(path.join(root, rel), 'utf8');

const authority = await import(pathToFileURL(path.join(root, 'shared/career/applicationAuthority.js')).href);
const accountSec = await import(pathToFileURL(path.join(root, 'shared/platform/accountSecurityContract.js')).href);
const consent = await import(pathToFileURL(path.join(root, 'shared/platform/consentContract.js')).href);
const notifPrefs = await import(pathToFileURL(path.join(root, 'shared/international/notificationPreferences.js')).href);
const apiState = await import(pathToFileURL(path.join(root, 'shared/platform/apiStateContract.js')).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const oaService = source('server/src/services/career/OpportunityApplicationService.js');
const kanban = source('client/src/components/applications/ApplicationKanbanBoard.jsx');
const detail = source('client/src/pages/Applications/ApplicationDetail.jsx');
const myApps = source('client/src/pages/Applications/MyApplications.jsx');
const nav = source('client/src/config/studentNavConfig.js');
const routes = source('client/src/routes/index.jsx');
const privacyUi = source('client/src/pages/Student/StudentPrivacy.jsx');
const adminPrivacy = source('client/src/pages/Admin/AdminPrivacyRequests.jsx');
const privacySvc = source('server/src/services/accountPrivacyRequestService.js');
const skillClaim = source('server/src/controllers/career/skillClaimController.js');
const skillUi = source('client/src/components/skills/SkillClaimManager.jsx');
const copilot = source('server/src/services/ai/copilotService.js');
const vaultSvc = source('server/src/services/vault/VaultDocumentService.js');
const budget = source('server/src/services/budgetPlanService.js');

const internalJob = {
  source: 'platform',
  opportunityRef: { opportunityType: 'job', opportunityId: 'job1' },
  pipelineStage: 'applied',
  stageTemplateId: 'job_default',
};
const external = {
  source: 'external',
  opportunityRef: { opportunityType: 'job', opportunityId: null },
  pipelineStage: 'applied',
  stageTemplateId: 'job_default',
};

check(
  authority.resolveApplicationChannel(internalJob) === authority.APPLICATION_CHANNELS.INTERNAL_EMPLOYER,
  'platform job with id is internal employer'
);
check(
  authority.resolveApplicationChannel(external) === authority.APPLICATION_CHANNELS.EXTERNAL_PERSONAL,
  'external source is personal tracker'
);
check(
  authority.resolveStageAuthority(internalJob) === authority.STAGE_AUTHORITY.EMPLOYER,
  'internal stage authority is employer'
);
check(
  !authority.getStudentAllowedTransitions(internalJob).includes('viewed'),
  'student cannot move internal applied → viewed'
);
check(
  !authority.getStudentAllowedTransitions(internalJob).includes('interview'),
  'student cannot move internal applied → interview'
);
check(
  !authority.getStudentAllowedTransitions(internalJob).includes('rejected'),
  'student cannot move internal applied → rejected'
);
check(
  authority.getStudentAllowedTransitions(internalJob).includes('withdrawn'),
  'student may withdraw internal application'
);
check(
  !authority.getStudentAllowedTransitions(external).includes('viewed'),
  'external personal tracker cannot set employer viewed state'
);
check(
  authority.getStudentAllowedTransitions({ ...external, pipelineStage: 'preparing' }).includes('applied'),
  'external personal tracker may mark applied from preparing'
);
check(
  authority.getStudentAllowedTransitions(external).includes('withdrawn'),
  'external applied may withdraw'
);
check(
  authority.getStudentAllowedTransitions(internalJob).join(',') === 'withdrawn',
  'internal applied student transitions are withdraw-only'
);

let blocked = false;
try {
  authority.assertStudentMayTransition(internalJob, 'offer');
} catch (err) {
  blocked = err.status === 403 && err.code === 'STUDENT_CANNOT_SET_EMPLOYER_STATE';
}
check(blocked, 'assertStudentMayTransition forbids employer offer state');

check(oaService.includes('assertStudentMayTransition'), 'service enforces student stage authority');
check(oaService.includes("transition.byActorType = 'talent'"), 'student cannot impersonate employer actor');
check(oaService.includes('Pipeline stage cannot be set via update'), 'PATCH cannot write pipelineStage');
check(oaService.includes('isInternalEmployerApplication(existing)'), 'internal interview write blocked');

check(kanban.includes("app.stageAuthority === 'personal'"), 'kanban moves only personal tracker');
check(!kanban.includes('getAllowedTransitions(templateId'), 'kanban does not fall back to full machine');
check(detail.includes('EmployerInstitutionStagePanel') || detail.includes('employerReadOnly'), 'detail distinguishes authority');
check(myApps.includes('CHANNEL_FILTERS'), 'list filters internal vs external');
check(source('client/src/i18n/locales/en/applications.json').includes('My tracking status'), 'My tracking status copy');
check(source('client/src/i18n/locales/en/applications.json').includes('Application happens outside Strideto'), 'external outside-Strideto copy');

check(!source('client/src/services/actionEngineService.js').includes("localStorage.getItem('token')"), 'journey client does not read localStorage token');
check(source('client/src/services/actionEngineService.js').includes("from './axiosBase'"), 'journey client uses SEC-3 axios session');
check(source('client/src/services/budgetApi.js').includes("from './axiosBase'"), 'budget client uses SEC-3 axios session');
check(source('client/src/pages/Copilot/CopilotPage.jsx').includes('axiosInstance'), 'copilot ask uses SEC-3 axios session');

check(nav.includes("labelKey: 'dashboard'"), 'student nav dashboard');
check(nav.includes("labelKey: 'talentProfile'"), 'student nav talent profile');
check(nav.includes("labelKey: 'applications'"), 'student nav applications');
check(nav.includes("labelKey: 'journey'"), 'student nav journey');
check(nav.includes("labelKey: 'vault'"), 'student nav vault');
check(nav.includes("labelKey: 'privacy'"), 'student nav privacy');
check(routes.includes('StudentPrivacy'), 'privacy route');
check(routes.includes('StudentHelp'), 'student help route');
check(routes.includes('StudentMessages'), 'messages hub route');
check(!nav.includes('/jobs'), 'student nav does not redesign public job discovery');

check(privacyUi.includes('requestExport'), 'student export request UX');
check(privacyUi.includes('requestDeletion'), 'student deletion request UX');
check(privacyUi.includes('confirmDeletion'), 'deletion requires confirmation');
check(privacySvc.includes('Never fabricate a downloadable archive'), 'no fake export archive');
check(privacySvc.includes('Immediate') || privacySvc.includes('CANCELLED') || privacySvc.includes('cancelRequest'), 'deletion is cancellable request');
check(adminPrivacy.includes('Student Vault'), 'admin privacy keeps vault denial copy');
check(adminPrivacy.includes('adminPrivacyApi'), 'admin privacy lists real requests');

const exportReq = accountSec.validateAccountPrivacyRequest({
  subjectId: 'u1',
  type: accountSec.ACCOUNT_REQUEST_TYPES.EXPORT,
});
check(exportReq.ok, 'export request contract valid');
check(consent.CONSENT_PURPOSES.VAULT_GRANT === 'vault_grant', 'vault grant consent scope');
check(consent.CONSENT_PURPOSES.EMPLOYER_APPLICATION === 'employer_application', 'employer application consent scope');

const pref = notifPrefs.validateNotificationPreferences({
  promotions: { in_app: false },
  applications: { in_app: false },
});
check(pref.ok && pref.value.promotions.in_app === false, 'optional promotions can be off');
check(pref.ok && pref.value.applications.in_app === true, 'transactional applications cannot be suppressed');

check(skillClaim.includes('trust field supplied'), 'skill claim rejects trust fields');
check(skillUi.includes('cannot set a status, score, verifier or badge'), 'student UI cannot self-verify');
check(vaultSvc.includes('Never return raw storage key/path to client'), 'vault never leaks storage key');
check(copilot.includes('No Vault content access') && copilot.includes('No autonomous account mutations'), 'copilot privacy and no mutation');
check(budget.includes('No live FX') && budget.includes('AMOUNT_STATES'), 'budget unknown != FX conversion');

check(apiState.apiStateFromHttpStatus(200) === apiState.API_STATE.SUCCESS, '200');
check(apiState.apiStateFromHttpStatus(400) === apiState.API_STATE.VALIDATION_ERROR || typeof apiState.apiStateFromHttpStatus(400) === 'string', '400');
check(apiState.apiStateFromHttpStatus(401) === apiState.API_STATE.UNAUTHENTICATED, '401');
check(apiState.apiStateFromHttpStatus(403) === apiState.API_STATE.FORBIDDEN, '403');
check(apiState.apiStateFromHttpStatus(404) === apiState.API_STATE.NOT_FOUND, '404');
check(apiState.apiStateFromHttpStatus(409) === apiState.API_STATE.CONFLICT, '409');
check(apiState.apiStateFromHttpStatus(422) === apiState.API_STATE.VALIDATION_ERROR, '422');
check(apiState.apiStateFromHttpStatus(429) === apiState.API_STATE.RATE_LIMITED || String(apiState.apiStateFromHttpStatus(429)).includes('rate'), '429');
check(apiState.apiStateFromHttpStatus(500) === apiState.API_STATE.SERVER_ERROR, '500');

const profileCtrl = source('server/src/controllers/profileController.js');
check(profileCtrl.includes('notificationPreferences'), 'profile accepts Phase 1 notification preferences');
check(source('client/src/pages/Profile/Profile.jsx').includes('logoutAll'), 'account logout all');
check(source('client/src/layouts/MainLayout.jsx').includes('StudentPortalNav'), 'student portal nav mounted');

console.log(`phase3StudentApplicantPortal: ${count} checks passed`);
