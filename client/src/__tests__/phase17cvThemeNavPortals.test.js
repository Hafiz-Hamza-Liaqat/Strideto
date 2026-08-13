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
function read(rel) {
  return readFileSync(path.join(clientSrc, rel), 'utf8');
}

const navbar = read('components/layout/Navbar.jsx');
const css = read('index.css');
const portalBrand = read('components/brand/PortalBrand.jsx');
const employer = read('pages/Employer/EmployerLayout.jsx');
const agent = read('pages/Agent/AgentLayout.jsx');
const institution = read('pages/Institution/InstitutionLayout.jsx');
const portalNav = read('components/layout/portalNavClasses.js');
const onboarding = read('pages/Agent/AgentOnboarding.jsx');
const dashboard = read('pages/Institution/InstitutionDashboard.jsx');
const help = read('pages/Institution/InstitutionHelp.jsx');

check(/PortalBrand/.test(portalBrand) && /to=\{ROUTES\.HOME\}/.test(portalBrand), 'C. shared PortalBrand links to /');
check(/role="employer\|agent\|institution"|ROLE_SUBTITLE/.test(portalBrand), 'PortalBrand is role-parameterized');
check(/<PortalBrand role="employer"/.test(employer), 'D. Employer uses PortalBrand');
check(/<PortalBrand role="agent"/.test(agent), 'D. Agent uses PortalBrand');
check(/<PortalBrand role="institution"/.test(institution), 'D. Institution uses PortalBrand');
check(/<PortalBrand role="employer"/.test(employer) && !/<Logo/.test(employer), 'Employer sidebar uses PortalBrand, not a hand-rolled logo');

check(/portalNavLinkClass/.test(employer) && /portalNavLinkClass/.test(agent) && /portalNavLinkClass/.test(institution), 'E. role sidebars share current-state helper');
check(/aria-current=\{path === activePath \? 'page'/.test(employer), 'Employer current is route-derived');
check(/aria-current=\{path === activePath \? 'page'/.test(agent), 'Agent current is route-derived');
check(/aria-current=\{path === activePath \? 'page'/.test(institution), 'Institution current is route-derived');
check(/accent-orange/.test(portalNav) && /hover:bg-gray-100/.test(portalNav), 'selected uses accent border; hover is a separate class');
check(/focus-visible:outline/.test(portalNav), 'focus-visible is distinct');

check(/public-navbar/.test(navbar) && /tone="light"/.test(navbar), 'I. public Navbar is the dark shell with light wordmark');
check(!/bg-surface\/98/.test(navbar), 'public Navbar is not theme-surface white');
check(/\.public-navbar/.test(css) && /background-color: #0f172a/.test(css), 'I. public navbar CSS stays navy in both appearances');
check(/isNavItemCurrent/.test(navbar) && /aria-current=\{current \? 'page'/.test(navbar), 'public nav current state remains route-derived');
check(/variant="full" tone="light"/.test(navbar), 'full wordmark is used on the public shell');

check(/validateAgentOnboardingStep/.test(onboarding) && /Skip for now/.test(onboarding), 'Agent onboarding validation + skip');
check(/InstitutionGettingStartedGuide/.test(dashboard) && /InstitutionGettingStartedGuide/.test(help), 'Institution guide on dashboard and help');
check(/--surface/.test(css) && /--icon/.test(css) && /--accent-orange/.test(css), 'shared theme tokens exist');

console.log(`phase17cvThemeNavPortals.test.js: ${count} assertions passed`);
