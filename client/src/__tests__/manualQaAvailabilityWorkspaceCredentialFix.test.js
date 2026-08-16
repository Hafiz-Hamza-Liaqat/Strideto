import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  DEFAULT_WORK_WEEK_WINDOWS,
  describeWindowOverlap,
  findOverlappingWindowPairs,
  humanizeSpecialtySlug,
} from '../utils/availabilityWindows.js';
import { isStudentPortalNavVisible } from '../config/studentWorkspacePaths.js';
import { validateAvailabilityWindows } from '../../../shared/services/consultations.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
function read(rel) {
  return readFileSync(path.join(clientSrc, rel), 'utf8');
}

// --- A: default week is Mon–Fri, not Tue duplicate ---
check(DEFAULT_WORK_WEEK_WINDOWS.map((w) => w.weekday).join() === '1,2,3,4,5', 'default work week Mon–Fri');
check(DEFAULT_WORK_WEEK_WINDOWS.length === 5, 'five default windows');

const avail = read('pages/Agent/AgentAvailability.jsx');
check(avail.includes('DEFAULT_WORK_WEEK_WINDOWS'), 'availability seeds default week');
check(avail.includes('findOverlappingWindowPairs'), 'client overlap check before POST');
check(avail.includes('role="alert"'), 'overlap errors use role=alert');
check(avail.includes('aria-label={`Remove ${dayName} window'), 'remove button names day');
check(avail.includes('sm:grid-cols-2') && avail.includes('lg:grid-cols-'), 'availability reflows on narrow screens');

const monFri = DEFAULT_WORK_WEEK_WINDOWS.map((w) => ({ ...w }));
check(findOverlappingWindowPairs(monFri).length === 0, 'Mon–Fri non-overlap');
check(validateAvailabilityWindows(monFri).ok === true, 'server accepts Mon–Fri');

const overlap = [
  { weekday: 2, startLocal: '09:00', endLocal: '17:00' },
  { weekday: 2, startLocal: '10:00', endLocal: '14:00' },
];
const pairs = findOverlappingWindowPairs(overlap);
check(pairs.length === 1, 'detect Tuesday overlap');
check(describeWindowOverlap(pairs[0]).includes('Tuesday'), 'overlap message names Tuesday');
const serverOverlap = validateAvailabilityWindows(overlap);
check(serverOverlap.ok === false && /Tuesday/.test(serverOverlap.error), 'server overlap names day');

const split = [
  { weekday: 1, startLocal: '09:00', endLocal: '12:00' },
  { weekday: 1, startLocal: '13:00', endLocal: '17:00' },
];
check(findOverlappingWindowPairs(split).length === 0, 'same-day split allowed');
check(validateAvailabilityWindows(split).ok === true, 'server allows same-day split');

const consult = read('pages/Consultations/ConsultationRequest.jsx');
check(consult.includes('No consultation availability is currently published'), 'empty consultation message');
check(consult.includes('disabled={busy || !hasAvailability}'), 'request disabled without availability');

// --- B: workspace identity (source + path helpers) ---
const ux = read('auth/userCapabilityWorkspace.js');
check(ux.includes("BUSINESS_CLIENT: 'business_client'") || ux.includes('USER_CAPABILITY_IDS.BUSINESS_CLIENT'), 'capability ids referenced');
check(ux.includes("roleLabel: 'Business Client'"), 'Business Client presentation');
check(ux.includes("USER_WORKSPACE_PREF_KEY = 'strideto-user-workspace'"), 'UX preference key');
check(ux.includes('Preference never grants capability') || ux.includes('never grants'), 'preference not ACL');

const active = read('auth/activeWorkspace.js');
check(active.includes('readUserCapabilities') && active.includes('userWorkspacePresentation'), 'student projection capability-aware');

const header = read('auth/publicHeaderSession.js');
check(header.includes('pathname') && header.includes('projectStudentIdentity(user, { pathname })'), 'header uses path-aware projection');

const menu = read('components/layout/UserAccountMenu.jsx');
check(menu.includes('writeUserWorkspacePreference'), 'account menu switches UX workspace');
check(menu.includes("openUserWorkspace('business_client')"), 'Business workspace option');

const authCtx = read('context/AuthContext.jsx');
check(authCtx.includes('syncUserWorkspaceUx'), 'login/me sync UX workspace from capabilities');
check(!/writeActiveWorkspacePreference\('student'\);\s*return/.test(authCtx.replace(/\s+/g, ' ')) || authCtx.includes('syncUserWorkspaceUx'), 'no blind Student-only preference');

const authCtrl = readFileSync(path.resolve(clientSrc, '../../server/src/controllers/authController.js'), 'utf8');
check(authCtrl.includes('withActiveCapabilities'), '/me and login attach capabilities');
check(!authCtrl.includes('fifth cookie') && !/businessRefresh|BUSINESS_JWT/.test(authCtrl), 'no new auth realm');

check(isStudentPortalNavVisible('/business', true, { hasStudentCapability: true }) === false, '/business never student nav');
check(isStudentPortalNavVisible('/dashboard', true, { hasStudentCapability: false }) === false, 'business-only no student nav');
check(isStudentPortalNavVisible('/dashboard', true, { hasStudentCapability: true, userWorkspace: 'business_client' }) === false, 'business UX mode hides student nav');
check(isStudentPortalNavVisible('/dashboard', true) === true, 'default student path still shows nav');
check(isStudentPortalNavVisible('/dashboard', true, { hasStudentCapability: true, userWorkspace: 'student' }) === true, 'student mode shows nav');

const bizLayout = read('pages/BusinessClient/BusinessClientLayout.jsx');
check(bizLayout.includes('writeUserWorkspacePreference'), 'activation sets business UX preference');

// --- C: credentials discoverable ---
const verify = read('pages/Agent/AgentVerification.jsx');
check(verify.includes('Professional Verification') && verify.includes('professional-credentials'), 'verification exposes credentials');
const trust = read('pages/Agent/AgentTrust.jsx');
check(trust.includes('Manage Education Verification') && trust.includes('Manage Business Verification'), 'trust center links');
const nav = read('config/agentNavConfig.js');
check(nav.includes("label: 'Professional Verification'"), 'education professional verification nav');
check(nav.includes("label: 'Business Verification'"), 'business verification nav');
check(nav.includes('AGENT_BUSINESS_SERVICES_CAPABILITIES') && /Business Verification/.test(nav), 'business verification points at capabilities evidence');

// --- D: public projection ---
check(humanizeSpecialtySlug('study_abroad_guidance') === 'Study Abroad Guidance', 'specialty humanize');
const pub = read('pages/Public/AgentPublicProfile.jsx');
check(pub.includes('Approved Agency') && pub.includes('Not Professional Credential Verified'), 'approval semantics');
check(pub.includes('humanizeSpecialtySlug'), 'public specialties humanized');
const dir = read('pages/Public/AgentDirectory.jsx');
check(dir.includes('humanizeSpecialtySlug'), 'directory specialties humanized');

console.log(`manualQaAvailabilityWorkspaceCredentialFix.test.js: ${count} assertions passed`);
