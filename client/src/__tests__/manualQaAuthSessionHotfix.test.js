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
const clientSrc = path.resolve(here, '..');
const repoRoot = path.resolve(clientSrc, '..', '..');

function read(rel) {
  return readFileSync(path.join(clientSrc, rel), 'utf8');
}
function readRoot(rel) {
  return readFileSync(path.join(repoRoot, rel), 'utf8');
}

const axiosBase = read('services/axiosBase.js');
const employerService = read('services/employerService.js');
const agentService = read('services/agentService.js');
const institutionService = read('services/institutionPortalService.js');
const authContext = read('context/AuthContext.jsx');
const agentAuth = read('context/AgentAuthContext.jsx');
const employerAuth = read('context/EmployerAuthContext.jsx');
const institutionAuth = read('context/InstitutionAuthContext.jsx');
const tabIdentity = read('auth/tabIdentity.js');
const verificationDraft = read('auth/verificationDraft.js');
const headerSession = read('auth/publicHeaderSession.js');
const userMenu = read('components/layout/UserAccountMenu.jsx');
const sessionScreen = read('components/auth/SessionChangeScreen.jsx');
const registerPage = read('pages/Agent/AgentRegister.jsx');
const authLayout = read('layouts/AuthLayout.jsx');
const domainCards = read('components/provider/ProviderDomainCards.jsx');
const profilePage = read('pages/Agent/AgentProfile.jsx');
const verifyPage = read('pages/Agent/AgentVerification.jsx');
const errorHandler = readRoot('server/src/middleware/errorHandler.js');
const profileSvc = readRoot('server/src/services/agentProfileService.js');

check(/createRefreshFlight/.test(axiosBase), 'user refresh uses shared flight');
check(/refreshUserAccessToken/.test(axiosBase), 'user interceptor and bootstrap share refreshUserAccessToken');
check(/refreshEmployerAccessToken/.test(employerService), 'employer refresh is coalesced');
check(/refreshAgentAccessToken/.test(agentService), 'agent refresh is coalesced');
check(/refreshInstitutionAccessToken/.test(institutionService), 'institution refresh is coalesced');

for (const [name, src] of [
  ['axiosBase.js', axiosBase],
  ['employerService.js', employerService],
  ['agentService.js', agentService],
  ['institutionPortalService.js', institutionService],
]) {
  check(!/localStorage\.(set|get)Item\([^)]*token/i.test(src), `${name}: no token localStorage`);
  check(!/sessionStorage\.(set|get|remove)Item/.test(src), `${name}: no sessionStorage token store`);
}

check(!/sessionStorage/.test(authContext), 'AuthContext does not touch sessionStorage directly');
check(/bindTabIdentity/.test(authContext) && /identityConflict/.test(authContext), 'user tab identity guard');
check(/bindTabIdentity/.test(agentAuth) && /identityConflict/.test(agentAuth), 'agent tab identity guard');
check(/bindTabIdentity/.test(employerAuth), 'employer tab identity guard');
check(/bindTabIdentity/.test(institutionAuth), 'institution tab identity guard');
check(/sessionStorage/.test(tabIdentity) && /strideto-tab-identity:/.test(tabIdentity), 'tab identity is sessionStorage metadata only');
check(!/accessToken|refreshToken|password|jwt/i.test(tabIdentity), 'tab identity stores no secrets');

check(/Your browser session changed in another tab/.test(sessionScreen), 'session-change heading copy');
check(/Continue with the current session/.test(sessionScreen), 'session-change continue action');
check(/Sign in again/.test(sessionScreen), 'session-change sign-in-again action');
check(/alertdialog/.test(sessionScreen), 'session-change is an alertdialog');

check(/resolvePublicHeaderSession/.test(userMenu), 'public header uses canonical user session helper');
check(/headerSession\.kind === 'hydrating'/.test(userMenu), 'header hydrates before Login/Register');
check(/kind: 'student'/.test(headerSession), 'header helper can surface User session without workspace race');

check(/size="wide"/.test(registerPage), 'provider registration uses wide AuthCard');
check(/size === 'wide'/.test(authLayout) && /max-w-3xl/.test(authLayout), 'wide AuthCard is opt-in, not global');
check(/lg:grid-cols-2/.test(domainCards) && !/md:grid-cols-2/.test(domainCards), 'domain cards two-column only at desktop');

check(/role="alert"/.test(profilePage) && /aria-busy/.test(profilePage), 'profile save a11y');
check(/role="status"/.test(profilePage), 'profile success status');
check(/coerceYearsOfExperience/.test(profileSvc), 'profile years coerced before save');
check(/ValidationError/.test(errorHandler) && /status = 400/.test(errorHandler), 'mongoose validation is 400 not 500');
check(/PROFILE_WRITE/.test(profileSvc), 'org-owned profile fields require PROFILE_WRITE');

check(/verificationDraftKey/.test(verifyPage), 'verification drafts are keyed');
check(/sessionStorage/.test(verificationDraft), 'safe drafts use sessionStorage');
check(/SAFE_VERIFICATION_DRAFT_FIELDS/.test(verificationDraft), 'safe field allowlist');
check(/Never stores secrets/.test(verificationDraft) || /never tokens/.test(verificationDraft), 'draft module forbids secrets');
check(/licenseNumber/.test(verificationDraft) && /SENSITIVE_VERIFICATION_FIELDS/.test(verificationDraft), 'license numbers classified sensitive');
check(/You have unsaved verification changes/.test(verifyPage), 'sensitive navigation warning');
check(/Discard draft/.test(verifyPage), 'explicit discard');
check(/Draft saved for this browser tab/.test(verifyPage), 'draft is not submitted verification');
check(/clearVerificationDraft/.test(verifyPage) && /submit/.test(verifyPage), 'successful submit clears draft');

console.log(`manualQaAuthSessionHotfix.test.js: ${count} assertions passed`);
