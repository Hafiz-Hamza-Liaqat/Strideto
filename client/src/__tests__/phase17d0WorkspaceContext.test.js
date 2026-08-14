import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Phase 17D-0 — dashboard identity separation / public workspace context.
 * Source-contract tests (no jsdom). Preference is not security authority.
 */

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
function readRepo(rel) {
  return readFileSync(path.join(repoRoot, rel), 'utf8');
}

const ws = read('auth/activeWorkspace.js');
const provider = read('context/ActiveWorkspaceContext.jsx');
const menu = read('components/layout/UserAccountMenu.jsx');
const portalBrand = read('components/brand/PortalBrand.jsx');
const navbar = read('components/layout/Navbar.jsx');
const layout = read('layouts/MainLayout.jsx');
const main = read('main.jsx');
const auth = read('context/AuthContext.jsx');
const employer = read('context/EmployerAuthContext.jsx');
const agent = read('context/AgentAuthContext.jsx');
const institution = read('context/InstitutionAuthContext.jsx');
const notice = read('components/auth/StudentAuthorityNotice.jsx');
const jobDetail = read('pages/Jobs/JobDetail.jsx');
const saveBtn = read('components/listings/SaveButton.jsx');
const bell = read('components/notifications/NotificationBell.jsx');
const cookies = readRepo('server/src/services/auth/AuthCookiePolicy.js');
const institutionMe = readRepo('server/src/controllers/institutionAuthController.js');

{
  check(
    /ACTIVE_WORKSPACE_STORAGE_KEY = 'strideto-active-workspace'/.test(ws),
    'preference key is the non-sensitive strideto-active-workspace'
  );
  check(
    /WORKSPACE_REALMS = Object\.freeze\(\['student', 'employer', 'agent', 'institution'\]\)/.test(ws),
    'supported public realms exclude admin'
  );
  check(!/accessToken|refreshToken|sessionId/.test(ws), 'preference module never mentions tokens or session ids');
  check(
    /isWorkspaceRealm\(raw\) \? raw : null/.test(ws),
    'stored preference is rejected unless it is an exact realm slug'
  );
  check(
    /workspace: ROUTES\.DASHBOARD/.test(ws) &&
      /workspace: ROUTES\.EMPLOYER_DASHBOARD/.test(ws) &&
      /workspace: ROUTES\.AGENT_DASHBOARD/.test(ws) &&
      /workspace: ROUTES\.INSTITUTION_DASHBOARD/.test(ws),
    'single role mapping: workspace destinations'
  );
  check(
    /settings: ROUTES\.EMPLOYER_SETTINGS/.test(ws) &&
      /settings: ROUTES\.AGENT_SETTINGS/.test(ws) &&
      /settings: ROUTES\.INSTITUTION_SETTINGS/.test(ws),
    'single role mapping: settings destinations'
  );
  check(
    /notifications: ROUTES\.EMPLOYER_NOTIFICATIONS/.test(ws) &&
      /help: ROUTES\.EMPLOYER_HELP/.test(ws),
    'employer notifications and help stay realm-specific'
  );
  check(!/user\._id|organizationId|email/.test(ws.split('projectStudentIdentity')[1] || ''), 'student projection source starts from name/avatar helpers');
  check(/guestWorkspaceIdentity/.test(ws) && /realm: 'guest'/.test(ws), 'guest identity is explicit');
  check(
    /employer\.verified === true/.test(ws),
    'Verified Employer requires server-derived verified flag, not completeness'
  );
  check(
    /agent\.profileStatus === 'approved'/.test(ws),
    'Verified Agent requires approved profileStatus, not completenessScore'
  );
  check(
    !/completenessScore/.test(ws),
    'verification wording is not inferred from profile completion'
  );
}

{
  check(/ActiveWorkspaceProvider/.test(main) && /InstitutionAuthProvider/.test(main), 'provider is mounted inside realm auth providers');
  check(
    /<ActiveWorkspaceProvider>/.test(main) && /<\/ActiveWorkspaceProvider>/.test(main),
    'ActiveWorkspaceProvider wraps the public app shell'
  );
  check(
    !/if \(isHydrating\) return/.test(layout) && /<Navbar \/>/.test(layout) && /<Footer \/>/.test(layout),
    'MainLayout is not gated on workspace hydration; Navbar/Footer stay mounted'
  );
  check(
    !/\[pathname\]/.test(provider) && !/useLocation/.test(provider),
    'ActiveWorkspace hydration does not re-run on every pathname change'
  );
  check(
    /discoverOtherRealms/.test(provider) && /WORKSPACE_REALMS/.test(provider),
    'multi-realm discovery exists and is explicit'
  );
  check(
    /projectLive\(realm\)/.test(provider) && /validateRealm\(realm\)/.test(provider),
    'discovery reuses live hydrated state before probing another /me'
  );
  check(
    /clearActiveWorkspacePreference\(\)/.test(provider) && /setIdentity\(guestWorkspaceIdentity/.test(provider),
    'logout of the active realm returns public context to guest'
  );
  check(
    !/activateRealm\(discovered/.test(provider.split('logoutActive')[1] || ''),
    'logout does not auto-activate another discovered realm'
  );
  check(/canActAsStudent = identity\.realm === 'student' && identity\.isAuthenticated/.test(provider), 'Student write authority requires active student workspace');
  check(/ensureSession/.test(provider), 'preferred B2B realm hydrates via ensureSession, not all four /me on navigation');
}

{
  check(/writeActiveWorkspacePreference\(role\)/.test(portalBrand), 'PortalBrand sets the matching non-sensitive preference before home');
  check(/to=\{ROUTES\.HOME\}/.test(portalBrand), 'PortalBrand still SPA-navigates to /');
  check(!/logout|target="_blank"|window\.open/.test(portalBrand), 'logo click does not logout or open a new window');
  check(
    /isStudentWorkspacePath\(pathname\)\) writeActiveWorkspacePreference\('student'\)/.test(navbar),
    'Student workspace logo click prefers student'
  );
}

{
  check(/useActiveWorkspace/.test(menu), 'public account menu reads ActiveWorkspace, not Student-only');
  check(/signedInAs/.test(menu) && /openWorkspace/.test(menu), 'SIGNED IN AS + Open workspace sections exist');
  check(/employerWorkspace/.test(menu) && /agentWorkspace/.test(menu) && /institutionWorkspace/.test(menu), 'B2B workspace labels exist');
  check(/switchWorkspace/.test(menu) && /discoverOtherRealms/.test(menu), 'Switch workspace is explicit and lazy');
  check(/common:logout/.test(menu) && /handleLogout/.test(menu), 'Logout remains visible');
  check(/await logout\(\)/.test(menu) && /navigate\(ROUTES\.HOME/.test(menu), 'Student logout still uses accepted logout + Home');
  check(/logoutActive/.test(menu), 'B2B public logout uses active-realm logout only');
  check(!/user\?\._id|truncateId|copyUserId|navbar:userId/.test(menu), 'raw user/org IDs are absent from the account menu');
  check(/role="dialog"/.test(menu) && /aria-expanded=\{open\}/.test(menu), 'account trigger exposes expanded + dialog semantics');
  check(/aria-haspopup="dialog"/.test(menu), 'account trigger has aria-haspopup');
  check(/max-h-\[min\(32rem,calc\(100dvh-5rem\)\)\]/.test(menu) && /fixed inset-x-2/.test(menu), 'menu stays viewport-contained on narrow screens');
  check(/break-words/.test(menu), 'organization/display names wrap rather than truncating unreadably in the panel');
  check(/text-slate-200/.test(menu) && /hover:bg-white\/10/.test(menu), 'public trigger is light-on-navy, not black-on-dark');
  check(/dark:bg-gray-800/.test(menu) && /dark:text-white/.test(menu), 'dropdown surface is theme-correct in dark mode');
  check(/appearanceSystem/.test(menu) && /LanguageSwitcher/.test(menu), 'Appearance and Language are preserved');
  check(/ROUTES\.STUDENT_HELP/.test(menu) && /studentHelp/.test(menu), 'Student Help remains for Student session');
  check(!/Impersonate|View as Employer|universal-dashboard/.test(menu), 'no admin impersonation or merged dashboard');
}

{
  check(/A Student account is required for this action/.test(notice), 'wrong-realm student action copy is explicit');
  check(/Sign in as Student/.test(notice) && /ROUTES\.LOGIN/.test(notice), 'offers Student sign-in, does not mint a User');
  check(/StudentAuthorityNotice/.test(jobDetail) && /studentWriteBlocked/.test(jobDetail), 'job apply is blocked in B2B context');
  check(/if \(!canActAsStudent\) return/.test(jobDetail), 'internal apply handler refuses non-student workspace');
  check(/canActAsStudent/.test(saveBtn), 'Save as Student is gated by active student workspace');
  check(/canActAsStudent/.test(bell), 'public student notification bell does not run in B2B context');
}

{
  check(/writeActiveWorkspacePreference\('student'\)/.test(auth), 'student login/register sets student preference');
  check(/writeActiveWorkspacePreference\('employer'\)/.test(employer), 'employer login/register sets employer preference');
  check(/writeActiveWorkspacePreference\('agent'\)/.test(agent), 'agent login/register sets agent preference');
  check(/writeActiveWorkspacePreference\('institution'\)/.test(institution), 'institution login/register sets institution preference');
  check(/ensureSession/.test(employer) && /ensureSession/.test(agent) && /ensureSession/.test(institution), 'B2B contexts expose quiet public hydration');
  check(/refreshQuietly/.test(employer) && /refreshQuietly/.test(agent) && /refreshQuietly/.test(institution), 'active B2B realm can quietly refresh on public pages');
  for (const [name, src] of [
    ['AuthContext.jsx', auth],
    ['EmployerAuthContext.jsx', employer],
    ['AgentAuthContext.jsx', agent],
    ['InstitutionAuthContext.jsx', institution],
    ['activeWorkspace.js', ws],
    ['ActiveWorkspaceContext.jsx', provider],
  ]) {
    check(
      !/localStorage\.(set|get|remove)Item\(\s*['"`](edurozgaar-token|edurozgaar-refresh-token)/.test(src),
      `${name}: no access/refresh token localStorage keys`
    );
    check(!/sessionStorage\./.test(src), `${name}: no sessionStorage`);
  }
}

{
  check(/path: '\/api\/auth\/refresh-token'/.test(cookies), 'user refresh cookie path unchanged');
  check(/path: '\/api\/auth\/employer\/refresh-token'/.test(cookies), 'employer refresh cookie path unchanged');
  check(/path: '\/api\/auth\/agent\/refresh-token'/.test(cookies), 'agent refresh cookie path unchanged');
  check(/path: '\/api\/auth\/institution\/refresh-token'/.test(cookies), 'institution refresh cookie path unchanged');
  check(
    /organizationName/.test(institutionMe) && /select\('displayName legalName'\)/.test(institutionMe),
    'institution /me adds public-safe organizationName without a universal auth endpoint'
  );
  check(!/\/auth\/universal|\/auth\/whoami|active-workspace/.test(institutionMe), 'no universal principal endpoint');
}

console.log(`phase17d0WorkspaceContext.test.js: ${count} assertions passed`);
