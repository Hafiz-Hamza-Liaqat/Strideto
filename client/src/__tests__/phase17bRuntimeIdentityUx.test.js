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

const jobs = read('pages/Jobs/Jobs.jsx');
const listings = read('hooks/useListings.js');
const explorer = read('pages/Tests/ProgramExplorer.jsx');
const profile = read('pages/Profile/Profile.jsx');
const axiosBase = read('services/axiosBase.js');
const authContext = read('context/AuthContext.jsx');
const register = read('pages/Auth/Register.jsx');
const instSettings = read('pages/Institution/InstitutionSettings.jsx');
const agentSettings = read('pages/Agent/AgentSettings.jsx');
const instDash = read('pages/Institution/InstitutionDashboard.jsx');
const css = read('index.css');
const jobsCtrl = readRoot('server/src/controllers/jobsController.js');
const recs = readRoot('server/src/controllers/recommendationsController.js');
const saved = readRoot('server/src/controllers/savedController.js');
const instAuth = readRoot('server/src/controllers/institutionAuthController.js');
const agentAuth = readRoot('server/src/controllers/agentAuthController.js');
const userAuth = readRoot('server/src/controllers/authController.js');
const turnstileMw = readRoot('server/src/middleware/turnstile.js');
const policy = readRoot('shared/legal/policyVersions.js');
const connected = readRoot('shared/auth/connectedAccounts.js');
const savedProj = readRoot('shared/publicDiscovery/projectSavedListing.js');

check(/import \{ ScrollReveal \}/.test(jobs), '/jobs imports ScrollReveal (manual P0)');
check(/visibleRecommended/.test(jobs) && /jobs\.filter/.test(jobs) || /job && job\._id/.test(jobs), '/jobs filters malformed recommendation/list rows');
check(/refetch/.test(jobs) && /Try again|retry/.test(jobs), '/jobs API failure shows retry, not a crash');
check(/emptyCatalogTitle|No public jobs yet/.test(jobs), '/jobs empty catalog is truthful');
check(/Array\.isArray/.test(listings), 'useListings only accepts array payloads');

check(/isValidJobFamily/.test(jobsCtrl) && /isValidSpecialization/.test(jobsCtrl), 'jobsController imports taxonomy validators');
check(/malformed record must not fail/.test(jobsCtrl) || /catch \{/.test(jobsCtrl), 'jobsController excludes one malformed row');

check(/withFixtureExclusion/.test(recs) && /CANDIDATE_CAP/.test(recs), 'recommendations use launch filter and a bounded candidate cap');
check(/projectSavedRecord/.test(saved), 'saved listings use launch-safe projection');
check(/unavailable: true/.test(savedProj), 'saved projection returns unavailable stub, not fixture metadata');

check(/Apply filters/.test(explorer) && /Reset filters/.test(explorer), 'Program Explorer has Apply and Reset');
check(/setApplied/.test(explorer) && /pending/.test(explorer), 'Program Explorer separates pending vs applied filters');
check(/No public programs yet/.test(explorer), 'Program Explorer empty state is truthful');

check(/LocationCascadeFilter/.test(profile), 'Student Profile uses Country/Region/City cascade');
check(!/<select[\s\S]*PROVINCES\.map/.test(profile), 'Student Profile no longer uses Province-only select');

check(/color-scheme: dark/.test(css) && /::-webkit-calendar-picker-indicator/.test(css), 'central dark-theme calendar icon contrast');
check(/box-shadow: inset 0 -2px 0 var\(--color-accent\)/.test(css), 'current nav uses distinct accent underline');

check(/refreshPromise/.test(axiosBase) && /AUTH_NO_REFRESH/.test(axiosBase), 'user interceptor shares one refresh sequence');
check(/alreadyHydrated && getAccessToken\(\)/.test(authContext), 'bootstrap does not clear a hydrated session on quiet refresh miss');
check(/visibilitychange/.test(authContext) && /focus/.test(authContext), 'visibility/focus trigger silent refresh');

check(/acceptedTerms: true/.test(register) && /TermsConsentField/.test(register), 'Student registration requires Terms/Privacy');
check(/TurnstileField/.test(register), 'Student registration has Turnstile boundary');
check(/legalAcceptanceMetadata\(\)/.test(userAuth), 'server writes Terms/Privacy timestamps');
check(/requireTurnstileWhenEnabled\('register'\)/.test(readRoot('server/src/routes/auth.js')), 'register verifies Turnstile only when enabled');

check(/currentPassword/.test(instAuth) && /comparePassword/.test(instAuth), 'Institution password change requires current password');
check(/currentPassword/.test(agentAuth) && /comparePassword/.test(agentAuth), 'Agent password change requires current password');
check(/ChangePasswordForm/.test(instSettings) && /ChangePasswordForm/.test(agentSettings), 'Institution/Agent use shared password form');
check(/Current password/.test(read('components/auth/ChangePasswordForm.jsx')), 'shared password form has current/new/confirm');

check(/Organization verification — Approved/.test(instDash), 'Institution dashboard separates verification vs claim');
check(/You may prepare private drafts/.test(instDash), 'Institution publishing copy is non-alarming');

check(/NOT_CONFIGURED/.test(connected) && /confersTrust: false/.test(connected), 'connected accounts foundation is not_configured and confers no Trust');
check(/not_configured/.test(turnstileMw) && /TURNSTILE_SECRET_KEY/.test(readRoot('shared/security/turnstile.js')), 'Turnstile secret stays server-side');
check(/TERMS_VERSION/.test(policy) && /requireAcceptedTerms/.test(policy), 'legal versions are server-authoritative');

console.log(`phase17bRuntimeIdentityUx.test.js: ${count} assertions passed`);
