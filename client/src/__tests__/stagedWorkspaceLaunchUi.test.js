/**
 * STRIDETO staged workspace launch — client route/home/footer contracts.
 * Run: node client/src/__tests__/stagedWorkspaceLaunchUi.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  WORKSPACE_LAUNCH_IDS,
  isWorkspaceLaunched,
} from '../../../shared/launch/workspaceLaunchGates.js';
import { orderedHomeSections, HOME_SECTION_KEYS } from '../personalization/layoutPersonalization.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const root = path.resolve(clientSrc, '../..');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');
const readRoot = (rel) => readFileSync(path.join(root, rel), 'utf8');

// Defaults (shared truth used by client config)
check(isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.STUDENT, {}) === true, 'LAUNCH-01 client default student');
check(isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EMPLOYER, {}) === true, 'LAUNCH-02 client default employer');
check(isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.INSTITUTION, {}) === false, 'LAUNCH-03 client default institution');
check(isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY, {}) === false, 'LAUNCH-04 client default education');
check(isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES, {}) === false, 'LAUNCH-05 client default business');

// ACTIVE-01 / ACTIVE-02
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.STUDENT, { WORKSPACE_LAUNCH_STUDENT: '0' }) === true,
  'ACTIVE-01: Student cannot be disabled by env'
);
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EMPLOYER, { WORKSPACE_LAUNCH_EMPLOYER: '0' }) === true,
  'ACTIVE-02: Employer cannot be disabled by env'
);

const clientCfg = read('config/workspaceLaunchGates.js');
check(
  clientCfg.includes('isStudentWorkspaceLaunched() {\n  return true') ||
    /export function isStudentWorkspaceLaunched\(\)\s*\{\s*return true/.test(clientCfg),
  'client student helper permanently true'
);
check(
  clientCfg.includes('isEmployerWorkspaceLaunched() {\n  return true') ||
    /export function isEmployerWorkspaceLaunched\(\)\s*\{\s*return true/.test(clientCfg),
  'client employer helper permanently true'
);
check(
  !clientCfg.includes('VITE_WORKSPACE_LAUNCH_STUDENT') &&
    !clientCfg.includes('VITE_WORKSPACE_LAUNCH_EMPLOYER'),
  'client does not read Student/Employer Vite launch flags'
);

const institutionGuard = read('components/institution/ProtectedInstitutionRoute.jsx');
check(
  institutionGuard.includes('isInstitutionWorkspaceLaunched') &&
    institutionGuard.includes('WorkspaceComingSoon'),
  'LAUNCH-06: Institution private URL gated before dashboard mount'
);
check(
  institutionGuard.indexOf('isInstitutionWorkspaceLaunched') <
    institutionGuard.indexOf('isAuthenticated'),
  'LAUNCH-06: launch check precedes auth/dashboard children'
);

const agentGuard = read('components/agent/ProtectedAgentRoute.jsx');
check(
  agentGuard.includes('isEducationMobilityWorkspaceLaunched') &&
    agentGuard.includes('isBusinessServicesWorkspaceLaunched') &&
    agentGuard.includes('WorkspaceComingSoon'),
  'LAUNCH-07: agent/provider private URLs gated before dashboard mount'
);
check(
  agentGuard.includes('getProviderDomainContext') &&
    agentGuard.includes('needsOnboarding'),
  'existing agent onboarding redirect preserved after launch gate'
);

const comingSoon = read('components/launch/WorkspaceComingSoon.jsx');
check(comingSoon.includes('Coming Soon'), 'Coming Soon copy present');
check(comingSoon.includes('noindex'), 'Coming Soon private surface is noindex');
check(!/Notify me|10,000|Only 2 days left/i.test(comingSoon), 'no dark-pattern scarcity copy');
check(comingSoon.includes('Back to Home') && comingSoon.includes('Explore Strideto'), 'safe CTAs present');
check(
  comingSoon.includes('We’re preparing this workspace for launch') ||
    comingSoon.includes("We're preparing this workspace for launch"),
  'public polished Coming Soon copy'
);
check(
  !comingSoon.includes('controlled launch configuration') &&
    !comingSoon.includes('not an automatic calendar release') &&
    !comingSoon.includes('unlock after QA'),
  'Coming Soon omits internal engineering language'
);

check(!existsSync(path.join(clientSrc, 'components/launch/RequireWorkspaceLaunch.jsx')), 'RequireWorkspaceLaunch removed (unused)');

// Public discovery routes remain defined
const routes = read('routes/index.jsx');
check(routes.includes('ROUTES.EDUCATION_INSTITUTIONS') || routes.includes('/institutions'), 'LAUNCH-08: institutions discovery route present');
check(routes.includes('AGENT_PUBLIC_DIRECTORY') || routes.includes('/agents'), 'LAUNCH-09: agents marketplace/directory routes present');
check(routes.includes('BUSINESS_SERVICES') || routes.includes('/business-services'), 'LAUNCH-10: business services public route present');

check(routes.includes('ProtectedRoute') && routes.includes('ROUTES.DASHBOARD'), 'LAUNCH-11: student dashboard route still defined');
check(
  /ProtectedEmployerRoute[\s\S]*EmployerLayout/.test(routes) || routes.includes('<ProtectedEmployerRoute>'),
  'LAUNCH-12: employer dashboard still protected normally'
);
check(routes.includes('EMPLOYER_POST_JOB') || routes.includes('jobs/new'), 'LAUNCH-13: Post a Job route retained');

// HOME section matrix
const homeBody = read('components/home/HomePersonalizedBody.jsx');
const workSection = read('components/home/HomeWorkWithStrideto.jsx');
check(homeBody.includes('workWithStrideto') && homeBody.includes('HomeWorkWithStrideto'), 'HOME-LAUNCH-01: Work with Strideto section wired');
check(HOME_SECTION_KEYS.includes('workWithStrideto'), 'HOME-LAUNCH-01b: section key registered');
check(!HOME_SECTION_KEYS.includes('employerCta'), 'HOME-LAUNCH-11: employerCta section removed from keys');
check(!homeBody.includes('Hire with Strideto'), 'HOME-LAUNCH-11b: Hire with Strideto presentation removed');

for (const persona of ['default', 'student', 'job_seeker', 'professional', 'employer']) {
  const order = orderedHomeSections(persona);
  const blogIdx = order.indexOf('blog');
  const workIdx = order.indexOf('workWithStrideto');
  const newsIdx = order.indexOf('newsletter');
  check(blogIdx !== -1 && workIdx !== -1 && newsIdx !== -1, `HOME order keys exist for ${persona}`);
  check(blogIdx < workIdx, `HOME-LAUNCH-02: workWithStrideto after blog (${persona})`);
  check(workIdx < newsIdx, `HOME-LAUNCH-03: workWithStrideto before newsletter (${persona})`);
}

check(workSection.includes('Available Now'), 'HOME-LAUNCH-04: Employer Available Now badge');
check(
  workSection.includes('ROUTES.EMPLOYER_DASHBOARD') && workSection.includes('Employer Dashboard'),
  'HOME-LAUNCH-05: Employer Dashboard CTA'
);
check(
  workSection.includes('ROUTES.EMPLOYER_POST_JOB') && workSection.includes('Post a Job'),
  'HOME-LAUNCH-06: Post a Job CTA'
);
check(workSection.includes('For Institutions') && workSection.includes('Coming Soon'), 'HOME-LAUNCH-07: Institution Coming Soon');
check(
  workSection.includes('Education & Mobility') && /Coming Soon/.test(workSection),
  'HOME-LAUNCH-08: Education & Mobility Coming Soon'
);
check(
  workSection.includes('Business Formation') && /Coming Soon/.test(workSection),
  'HOME-LAUNCH-09: Business Formation Coming Soon'
);

// HOME-UNLOCK-01 — locked cards have no private CTA (default env: staged off)
const institutionBlock = workSection.split('For Institutions')[1]?.split('For Education')[0] || '';
const educationBlock = workSection.split('For Education & Mobility Providers')[1]?.split('For Business')[0] || '';
const businessBlock = workSection.split('For Business Formation Providers')[1] || '';
check(
  institutionBlock.includes('institutionActive ?') &&
    educationBlock.includes('educationActive ?') &&
    businessBlock.includes('businessActive ?'),
  'HOME-UNLOCK-01: staged cards gate actions on launch helpers'
);
check(
  workSection.includes('ROUTES.INSTITUTION_LOGIN') &&
    workSection.includes('ROUTES.INSTITUTION_REGISTER'),
  'HOME-UNLOCK-02: Institution unlocked actions use canonical login/register'
);
check(
  workSection.includes('ROUTES.PROVIDERS_EDUCATION_MOBILITY'),
  'HOME-UNLOCK-03: Education unlocked action uses canonical provider entry'
);
check(
  workSection.includes('ROUTES.PROVIDERS_BUSINESS_FORMATION'),
  'HOME-UNLOCK-04: Business unlocked action uses canonical provider entry'
);
check(
  workSection.includes('isEmployerWorkspaceLaunched') &&
    workSection.includes('ROUTES.EMPLOYER_DASHBOARD'),
  'HOME-UNLOCK-05: Employer remains active with dashboard CTA'
);

const footer = read('components/layout/Footer.jsx');
check(
  footer.includes('isEmployerWorkspaceLaunched') && footer.includes('EMPLOYER_LOGIN'),
  'HOME-LAUNCH-12: footer employer link remains active when launched'
);
check(
  footer.includes('comingSoon: true') &&
    footer.includes('isInstitutionWorkspaceLaunched') &&
    footer.includes('isEducationMobilityWorkspaceLaunched') &&
    footer.includes('isBusinessServicesWorkspaceLaunched'),
  'HOME-LAUNCH-13: footer locked workspaces use Coming Soon non-link presentation'
);
check(!footer.includes('href="#"') && !footer.includes('javascript:void'), 'footer avoids fake anchors');

// ACTIVE-03 — Employer footer path is not staged-gated by institution/edu/biz flags in source
check(
  /isEmployerWorkspaceLaunched\(\)[\s\S]*?EMPLOYER_LOGIN/.test(footer),
  'ACTIVE-03: homepage/footer Employer remains active via employer helper'
);

// Gated role module preservation
const preserved = [
  'pages/Institution/InstitutionDashboard.jsx',
  'pages/Institution/InstitutionOnboarding.jsx',
  'pages/Agent/AgentDashboard.jsx',
  'pages/Agent/AgentOnboarding.jsx',
  'pages/Agent/business-services/GbsWorkspaceLayout.jsx',
  'onboarding/tour.js',
  'welcome/portalWelcome.js',
];
for (const rel of preserved) {
  check(existsSync(path.join(clientSrc, rel)), `gated preservation: ${rel} still exists`);
}

const tour = read('onboarding/tour.js');
check(
  /institution|employer|agent|student/.test(tour),
  'tour definitions retain role sequences'
);
const welcome = read('welcome/portalWelcome.js');
check(
  welcome.includes('student') && welcome.includes('employer') && welcome.includes('institution') && welcome.includes('agent'),
  'portal welcome actions retained for all portals'
);

// PUBLIC-ENTRY — public acquisition pages stay rendered/indexable when private workspaces are OFF
const eduEntry = read('pages/Public/EducationProviderEntry.jsx');
const bizEntry = read('pages/Public/BusinessProviderEntry.jsx');

check(
  !eduEntry.includes('WorkspaceComingSoon') &&
    eduEntry.includes('Education &amp; Mobility Providers') &&
    eduEntry.includes('isEducationMobilityWorkspaceLaunched'),
  'PUBLIC-ENTRY-01: Education provider entry remains rendered while Education workspace OFF'
);
check(
  eduEntry.includes('SeoHead') &&
    eduEntry.includes('canonical={ROUTES.PROVIDERS_EDUCATION_MOBILITY}') &&
    !/noindex/.test(eduEntry) &&
    !eduEntry.includes('WorkspaceComingSoon'),
  'PUBLIC-ENTRY-02: Education provider entry does not become noindex solely because workspace OFF'
);
check(
  /workspaceOpen \? \(/.test(eduEntry) &&
    eduEntry.includes('Coming Soon') &&
    eduEntry.includes('Register as Education Provider') &&
    eduEntry.includes('AGENT_REGISTER') &&
    eduEntry.includes('AGENT_LOGIN') &&
    !eduEntry.includes('href="#"') &&
    !eduEntry.includes('javascript:void'),
  'PUBLIC-ENTRY-03: Education locked state has no active private registration/login CTA (gated)'
);
check(
  eduEntry.includes('Available Now') &&
    eduEntry.includes("ROUTES.AGENT_REGISTER}?domain=${PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY}") &&
    eduEntry.includes("ROUTES.AGENT_LOGIN}?portal=education"),
  'PUBLIC-ENTRY-04: Education enabled state restores canonical actions'
);

check(
  !bizEntry.includes('WorkspaceComingSoon') &&
    bizEntry.includes('Business Formation Providers') &&
    bizEntry.includes('isBusinessServicesWorkspaceLaunched'),
  'PUBLIC-ENTRY-05: Business provider entry remains rendered while Business workspace OFF'
);
check(
  bizEntry.includes('SeoHead') &&
    bizEntry.includes('canonical={ROUTES.PROVIDERS_BUSINESS_FORMATION}') &&
    !/noindex/.test(bizEntry) &&
    !bizEntry.includes('WorkspaceComingSoon'),
  'PUBLIC-ENTRY-06: Business provider entry does not become noindex solely because workspace OFF'
);
check(
  /workspaceOpen \? \(/.test(bizEntry) &&
    bizEntry.includes('Coming Soon') &&
    bizEntry.includes('Register as Business Provider') &&
    bizEntry.includes('AGENT_REGISTER') &&
    bizEntry.includes('AGENT_LOGIN') &&
    !bizEntry.includes('href="#"') &&
    !bizEntry.includes('javascript:void'),
  'PUBLIC-ENTRY-07: Business locked state has no active private registration/login CTA (gated)'
);
check(
  bizEntry.includes('Available Now') &&
    bizEntry.includes("ROUTES.AGENT_REGISTER}?domain=${PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES}") &&
    bizEntry.includes("ROUTES.AGENT_LOGIN}?portal=business"),
  'PUBLIC-ENTRY-08: Business enabled state restores canonical actions'
);

check(
  comingSoon.includes('noindex') &&
    agentGuard.includes('WorkspaceComingSoon') &&
    institutionGuard.includes('WorkspaceComingSoon'),
  'PUBLIC-ENTRY-09: WorkspaceComingSoon remains noindex on private workspace routes'
);

const agentLogin = read('pages/Agent/AgentLogin.jsx');
const agentRegister = read('pages/Agent/AgentRegister.jsx');
check(
  agentLogin.includes('WorkspaceComingSoon') && agentRegister.includes('WorkspaceComingSoon'),
  'PUBLIC-ENTRY-09b: private agent login/register still launch-gated with Coming Soon'
);

check(
  (routes.includes('AGENT_PUBLIC_DIRECTORY') || routes.includes('/agents')) &&
    (routes.includes('AGENT_PUBLIC_MARKETPLACE') || routes.includes('/agents/marketplace')) &&
    (routes.includes('EDUCATION_INSTITUTIONS') || routes.includes('/institutions')) &&
    (routes.includes('BUSINESS_SERVICES') || routes.includes('/business-services')) &&
    !routes.includes('isEducationMobilityWorkspaceLaunched') &&
    !routes.includes('isBusinessServicesWorkspaceLaunched') &&
    !routes.includes('isInstitutionWorkspaceLaunched'),
  'PUBLIC-ENTRY-10: public marketplace/discovery routes remain independent of launch flags'
);

const plan = readRoot('docs/STRIDETO_STAGED_WORKSPACE_LAUNCH_PLAN.md');
check(plan.includes('No automatic') || plan.includes('does **not** auto-unlock'), 'launch plan documents no automatic unlock');
check(plan.includes('WORKSPACE_LAUNCH_INSTITUTION'), 'launch plan documents unlock env keys');
check(
  plan.includes('WORKSPACE_LAUNCH_EDUCATION_MOBILITY') &&
    plan.includes('WORKSPACE_LAUNCH_BUSINESS_SERVICES') &&
    plan.includes('There are **no** `WORKSPACE_LAUNCH_STUDENT`') &&
    plan.includes('permanently active'),
  'launch plan lists only three staged flags (Student/Employer permanently active)'
);
check(
  plan.includes('controlled launch configuration') || plan.includes('not an automatic calendar'),
  'ops unlock language lives in launch plan docs'
);

const envExample = readRoot('.env.example');
check(
  envExample.includes('WORKSPACE_LAUNCH_INSTITUTION') &&
    envExample.includes('VITE_WORKSPACE_LAUNCH_BUSINESS_SERVICES') &&
    !/#\s*WORKSPACE_LAUNCH_STUDENT=/.test(envExample),
  'env example documents three staged flags with safe defaults'
);

console.log(`stagedWorkspaceLaunchUi.test.js: ${count} assertions passed`);
