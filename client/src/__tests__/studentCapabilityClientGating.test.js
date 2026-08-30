import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { USER_CAPABILITY_IDS } from '../../../shared/capability/userCapabilities.js';

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

// Mirror strict helpers (same logic as userCapabilityWorkspace.js; @shared alias blocks direct import in node).
function hasStudentCapability(user) {
  if (!user || !Array.isArray(user.capabilities)) return false;
  return user.capabilities.includes(USER_CAPABILITY_IDS.STUDENT);
}
function hasStudentCapabilityOrPending(user) {
  if (!user) return false;
  if (!Array.isArray(user.capabilities)) return true;
  return user.capabilities.includes(USER_CAPABILITY_IDS.STUDENT);
}

const ux = read('auth/userCapabilityWorkspace.js');
check(ux.includes('export function hasStudentCapability'), 'hasStudentCapability exported');
check(ux.includes('export function hasStudentCapabilityOrPending'), 'hasStudentCapabilityOrPending exported');
check(ux.includes('Never infers from role'), 'strict helper documents no role inference');
check(hasStudentCapability(null) === false, 'null user has no student capability');
check(hasStudentCapability({ role: 'User' }) === false, 'role User alone does not grant student');
check(hasStudentCapability({ role: 'Admin', capabilities: [] }) === false, 'Admin [] does not grant student');
check(hasStudentCapability({ role: 'User', capabilities: [] }) === false, 'User [] does not grant student');
check(
  hasStudentCapability({ role: 'User', capabilities: ['student'] }) === true,
  'User with student grant passes strict check'
);
check(
  hasStudentCapability({ role: 'Admin', capabilities: ['student'] }) === true,
  'explicit student grant honored regardless of role'
);
check(
  hasStudentCapabilityOrPending({ role: 'User' }) === true,
  'UX pending: missing capabilities array is optimistic for nav'
);
check(
  hasStudentCapabilityOrPending({ role: 'Admin', capabilities: [] }) === false,
  'UX pending: empty capabilities array is not student'
);

// --- Home: saved + recommendations gated ---
const home = read('pages/Home/Home.jsx');
check(home.includes('hasStudentCapability: studentCapable'), 'Home reads hasStudentCapability from auth');
check(
  /if \(!isAuthenticated \|\| authLoading \|\| !studentCapable\) return/.test(home),
  'Home guards student-product effects on capability'
);
check(
  /studentCapable[\s\S]{0,120}savedApi\.get/.test(home),
  'savedApi.get only reached when studentCapable'
);
check(
  /studentCapable[\s\S]{0,200}recommendationsApi\.get/.test(home),
  'recommendationsApi.get only reached when studentCapable'
);

// --- Shared profile completion hook ---
const profileHook = read('hooks/useProfileCompletion.js');
check(profileHook.includes('hasStudentCapability: studentCapable'), 'useProfileCompletion uses hasStudentCapability');
check(profileHook.includes('studentProductEnabled'), 'useProfileCompletion derives studentProductEnabled');
check(
  /if \(!studentProductEnabled\)/.test(profileHook),
  'useProfileCompletion skips talent API load without student capability'
);
check(
  /talentApi\.getMe/.test(profileHook),
  'talent APIs still used for enabled student users'
);

// --- Dashboard composition ---
const dashHook = read('dashboard/useDashboardComposition.js');
check(dashHook.includes('hasStudentCapability: studentCapable'), 'useDashboardComposition uses hasStudentCapability');
check(
  /if \(!isAuthenticated \|\| authLoading \|\| !studentCapable\)/.test(dashHook),
  'dashboard fetch skipped without student capability'
);
check(
  /careerDashboardApi/.test(dashHook),
  'career dashboard API remains for capable users'
);

// --- Auth context exposes helper ---
const authCtx = read('context/AuthContext.jsx');
check(authCtx.includes('hasStudentCapability: hasStudentCapability(user)'), 'AuthContext exposes hasStudentCapability');

// --- Personalization hub ---
const personalization = read('pages/Personalization/PersonalizationHub.jsx');
check(
  personalization.includes('hasStudentCapability: studentCapable'),
  'PersonalizationHub panels gate on hasStudentCapability'
);
check(
  /!studentCapable[\s\S]{0,80}personalizationApi\.gapAnalysis/.test(personalization),
  'gap analysis not fetched without student capability'
);

// --- Student nav still uses optimistic UX helper ---
const nav = read('components/student/StudentPortalNav.jsx');
check(nav.includes('hasStudentCapabilityOrPending'), 'StudentPortalNav keeps optimistic nav hydration');

// --- Admin portal unchanged ---
const adminShell = read('pages/Admin/ExecutiveDashboard.jsx');
check(!adminShell.includes('savedApi'), 'admin executive dashboard does not prefetch saved listings');

// --- Legacy dashboard ---
const legacyDash = read('pages/Dashboard/LegacyDashboard.jsx');
check(legacyDash.includes('hasStudentCapability: studentCapable'), 'LegacyDashboard uses hasStudentCapability');
check(
  /if \(!studentProductEnabled\)/.test(legacyDash),
  'LegacyDashboard skips student API fetches without capability'
);

// --- Shared student-product hook ---
const studentHook = read('hooks/useStudentProductEnabled.js');
check(studentHook.includes('studentProductEnabled: isAuthenticated && !loading && hasStudentCapability'), 'useStudentProductEnabled strict gate');

// --- Listing pages: Jobs + SaveButton ---
const jobs = read('pages/Jobs/Jobs.jsx');
check(jobs.includes('useStudentProductEnabled'), 'Jobs listing uses student product hook');
check(/if \(!studentProductEnabled\) return[\s\S]{0,80}savedApi\.get/.test(jobs), 'Jobs savedApi gated');

const jobDetail = read('pages/Jobs/JobDetail.jsx');
check(jobDetail.includes('studentProductEnabled'), 'JobDetail uses studentProductEnabled for student APIs');
check(/!studentProductEnabled[\s\S]{0,40}savedApi\.get/.test(jobDetail), 'JobDetail savedApi gated');

const saveBtn = read('components/listings/SaveButton.jsx');
check(saveBtn.includes('useStudentProductEnabled'), 'SaveButton uses student product hook');
check(/if \(!studentProductEnabled\)/.test(saveBtn), 'SaveButton blocks save mutation without capability');

const profile = read('pages/Profile/Profile.jsx');
check(/if \(studentProductEnabled\)[\s\S]{0,80}savedApi\.get/.test(profile), 'Profile saved tab gated');

// --- Public listing reads remain ---
check(jobs.includes('useListings(jobsApi.list'), 'Jobs public list fetch unchanged');
check(!/if \(studentProductEnabled\)[\s\S]{0,40}jobsApi\.list/.test(jobs), 'jobsApi.list not gated by capability');

const myApps = read('pages/Applications/MyApplications.jsx');
check(/!studentProductEnabled/.test(myApps), 'MyApplications skips load without capability');

console.log(`studentCapabilityClientGating.test.js: ${count} assertions passed`);
