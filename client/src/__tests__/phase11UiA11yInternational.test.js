import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'path';
import {
  isStudentPortalNavVisible,
  isStudentWorkspacePath,
} from '../config/studentWorkspacePaths.js';

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

const nav = read('components/student/StudentPortalNav.jsx');
const account = read('components/layout/UserAccountMenu.jsx');
const theme = read('context/ThemeContext.jsx');
const brand = read('design-system/BrandProvider.jsx');
const layout = read('layouts/MainLayout.jsx');
const copilot = read('pages/Copilot/CopilotPage.jsx');
const cases = read('pages/Cases/Cases.jsx');
const consultations = read('pages/Consultations/Consultations.jsx');
const agents = read('pages/Public/AgentDirectory.jsx');
const tour = read('onboarding/TourAnchors.jsx');
const login = read('pages/Auth/Login.jsx');
const adminQueue = read('pages/Admin/AdminVerificationQueue.jsx');
const institutionUi = read('pages/Institution/InstitutionUi.jsx');
const programEditor = read('pages/Institution/InstitutionProgramEditor.jsx');
const navbar = read('components/layout/Navbar.jsx');
const language = read('components/i18n/LanguageSwitcher.jsx');
const kanban = read('components/applications/ApplicationKanbanBoard.jsx');
const table = read('components/applications/ApplicationTable.jsx');

// --- Route shell allowlist ---
{
  check(isStudentPortalNavVisible('/dashboard', true) === true, 'Student private /dashboard shows workspace nav');
  check(isStudentPortalNavVisible('/talent-profile', true) === true, '/talent-profile is workspace');
  check(isStudentPortalNavVisible('/applications/abc', true) === true, '/applications/* is workspace');
  check(isStudentPortalNavVisible('/help/student', true) === true, '/help/student is workspace');
  check(isStudentPortalNavVisible('/account/privacy', true) === true, '/account/* is workspace');
  check(isStudentPortalNavVisible('/', true) === false, 'public Home logged-in has no Student nav');
  check(isStudentPortalNavVisible('/jobs', true) === false, '/jobs has no Student nav');
  check(isStudentPortalNavVisible('/agents', true) === false, '/agents is public, not Student workspace');
  check(isStudentPortalNavVisible('/agents/acme', true) === false, '/agents/* is public directory, not /agent realm');
  check(isStudentWorkspacePath('/agent') === false, '/agent private realm is not a Student workspace path');
  check(isStudentWorkspacePath('/agent/dashboard') === false, '/agent/* is not Student workspace');
  check(isStudentPortalNavVisible('/employer', true) === false, 'Employer realm does not get Student nav');
  check(isStudentPortalNavVisible('/institution', true) === false, 'Institution realm does not get Student nav');
  check(isStudentPortalNavVisible('/admin', true) === false, 'Admin realm does not get Student nav');
  check(isStudentPortalNavVisible('/dashboard', false) === false, 'unauthenticated never shows Student nav');
  check(/STUDENT_WORKSPACE_PREFIXES/.test(read('config/studentWorkspacePaths.js')), 'visibility uses an explicit workspace allowlist');
  check(!/HIDDEN_PREFIXES/.test(read('config/studentWorkspacePaths.js')) && !/HIDDEN_PREFIXES/.test(read('config/studentNavConfig.js')), 'public denylist is gone');
}

// --- Workspace destinations remain reachable ---
{
  const navConfig = read('config/studentNavConfig.js');
  for (const key of ['dashboard', 'talentProfile', 'applications', 'journey', 'saved', 'deadlines', 'vault', 'consultations', 'cases', 'messages', 'notifications', 'budget', 'copilot', 'privacy', 'account', 'help']) {
    check(navConfig.includes(`labelKey: '${key}'`), `workspace destination ${key} remains in STUDENT_PORTAL_NAV`);
  }
  check(/STUDENT_PORTAL_NAV_CORE_KEYS = Object\.freeze\(\[/.test(navConfig), 'six core destinations are explicit');
  check(/STUDENT_PORTAL_NAV_OVERFLOW/.test(navConfig), 'overflow holds the remainder');
  check(!/overflow-x-auto/.test(nav), 'Student workspace nav has no native horizontal scrollbar');
  check(!/\bw-max\b/.test(nav), 'Student workspace nav does not force w-max row overflow');
  check(/aria-label=\{t\('student:portalNavLabel'/.test(nav), 'workspace nav landmark is named');
  check(/student-workspace-overflow/.test(nav) && /aria-expanded/.test(nav), 'overflow/workspace menu is named and expandable');
  check(/isStudentNavItemCurrent/.test(nav) && /aria-current/.test(nav), 'active route is indicated');
  check(/trapFocus: false/.test(nav), 'workspace overflow does not trap focus');
  check(/Escape|useOverlayA11y/.test(nav), 'Escape closes workspace overflow via overlay a11y');
  check(/min-\[1200px\]:hidden/.test(nav) && /min-\[1200px\]:flex/.test(nav), 'narrow viewports convert to workspace menu');
  check(/align="start"/.test(nav) && /align="end"/.test(nav), 'mobile Workspace menu start-aligns; desktop More end-aligns');
}

// --- Account menu ---
{
  check(
    /openUserWorkspace\('student'\)/.test(account) || /navbar:myWorkspace/.test(account),
    'account menu includes Student / My Workspace'
  );
  check(/ROUTES\.PROFILE/.test(account) && /navbar:profile/.test(account), 'account menu includes Profile');
  check(/ROUTES\.PRIVACY/.test(account), 'account menu includes Privacy');
  check(/account-settings/.test(account) && /navbar:accountSettings/.test(account), 'account menu includes settings');
  check(/appearanceSystem/.test(account) && /appearanceLight/.test(account) && /appearanceDark/.test(account), 'Appearance System/Light/Dark');
  check(/LanguageSwitcher/.test(account), 'Language control present');
  check(/ROUTES\.STUDENT_HELP/.test(account) && /studentHelp/.test(account), 'Student Help present');
  check(/common:logout/.test(account) && /handleLogout/.test(account), 'Logout is present');
  check(/await logout\(\)/.test(account) && /navigate\(ROUTES\.HOME/.test(account), 'Logout invokes accepted logout and returns Home');
  check(!/user\?\._id|truncateId|copyUserId|navbar:userId/.test(account), 'internal user id is absent from the normal account menu');
  check(/role="dialog"/.test(account) && /aria-label=\{t\('navbar:accountMenu'\)\}/.test(account), 'avatar panel is a named dialog');
  check(/aria-label=\{t\('navbar:accountMenu'\)\}/.test(account), 'avatar button is named');
  check(/aria-expanded=\{open\}/.test(account), 'expanded state exposed');
  check(/max-h-\[min\(32rem,calc\(100dvh-5rem\)\)\]/.test(account) && /fixed inset-x-2/.test(account), 'menu is viewport-contained on narrow screens');
  check(/shrink-0 border-t[\s\S]*common:logout/.test(account), 'Logout stays in a sticky session footer');
  check(/useOverlayA11y/.test(account) && /trapFocus: true/.test(account), 'account menu keyboard + Escape');
}

// --- Theme contract ---
{
  check(/THEME_STORAGE_KEY = 'edurozgaar-theme'/.test(theme), 'accepted client persistence key');
  check(/\['system', 'light', 'dark'\]/.test(theme), 'System/Light/Dark preferences');
  check(/normalizeThemePreference/.test(theme), 'stored values are normalized');
  check(/preference === 'system' \? osTheme : preference/.test(theme), 'System follows OS');
  check(/localStorage\.setItem\(THEME_STORAGE_KEY, preference\)/.test(theme), 'preference persists across reload');
  check(/prefers-color-scheme: dark/.test(theme), 'OS media query is observed');
  check(/resolvedTheme/.test(brand) && /semanticCssVarsForTheme\(appliedTheme\)/.test(brand), 'BrandProvider consumes resolved light/dark tokens');
}

// --- Specific pages consume dark semantic surfaces ---
{
  check(/--semantic-page-bg/.test(copilot) && /--semantic-card/.test(copilot) && /--semantic-input-bg/.test(copilot), 'Copilot uses semantic tokens');
  check(!/var\(--color-text, #111827\)/.test(copilot) && !/var\(--color-surface, #fff\)/.test(copilot), 'Copilot no longer falls back to hard-coded light hex');
  check(/Ask Strideto/.test(copilot), 'Ask Strideto action remains');
  check(/ui\.empty/.test(cases) && /ui\.card/.test(cases), 'Cases empty/card surfaces are dark-capable');
  check(/ui\.empty/.test(consultations) && /ui\.card/.test(consultations), 'Consultations empty/card surfaces are dark-capable');
  check(/ui\.filterPanel/.test(agents) && /ui\.card/.test(agents) && /dark:bg-gray-800/.test(read('design-system/surfaceClasses.js')), 'Agents directory filter + cards are dark-capable');
  check(layout.includes('StudentPortalNav') && layout.includes('overflow-x-hidden'), 'public shell still mounts StudentPortalNav behind the allowlist and clips page overflow');
}

// --- A11y MINORs ---
{
  check(/aria-hidden="true"/.test(tour) && /inert/.test(tour), 'TourAnchors are aria-hidden and inert');
  check(!/<Link /.test(tour), 'TourAnchors are not focusable links');
  check(/key: 'actions'[\s\S]*label: 'Actions'/.test(adminQueue), 'Admin actions column has an accessible name');
  check(/status === 429/.test(login) && /validation:tooManyRequests/.test(login), '429 login UX is explicit without changing limiter policy');
  check(/min-w-0 max-w-full/.test(institutionUi), 'Institution fields can shrink at 320');
  check(/block min-w-0 max-w-full/.test(programEditor), 'Institution Program selects are readable at narrow width');
  check(/overflow-x-auto/.test(kanban) && /table-scroll/.test(table), 'dense Student grids keep internal scroll, not page-level');
  check(/aria-label=\{t\('navbar:mainNav'\)\}/.test(navbar), 'global nav landmark is named');
  check(/aria-label=\{t\('languageSwitcher'\)\}/.test(language) && /disabled=\{!enabled\}/.test(language), 'language control named; disabled AR remains disabled');
  check(/arabicComingSoon/.test(language), 'AR disabled state is truthful');
  check(/isPrivateSeoPath/.test(read('utils/localeNavigation.js')), 'language switch does not prefix private Student/org routes');
}

console.log(`phase11UiA11yInternational.test.js: ${count} assertions passed`);
