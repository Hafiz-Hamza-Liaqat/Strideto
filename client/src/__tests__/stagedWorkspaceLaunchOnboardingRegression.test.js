/**
 * STRIDETO staged launch — Student/Employer onboarding + tour regression (source contracts).
 * Behavioral auth flows remain covered by existing portal tests; this suite proves
 * launch gating did not rewrite active Student/Employer onboarding/tour paths.
 *
 * Run: node client/src/__tests__/stagedWorkspaceLaunchOnboardingRegression.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');

const studentFiles = [
  'pages/Auth/Register.jsx',
  'pages/Auth/Login.jsx',
  'pages/Dashboard/LegacyDashboard.jsx',
  'components/auth/ProtectedRoute.jsx',
  'onboarding/OnboardingProvider.jsx',
  'onboarding/tour.js',
  'onboarding/actions.js',
];
for (const rel of studentFiles) {
  check(existsSync(path.join(clientSrc, rel)), `student path intact: ${rel}`);
}

const studentProtected = read('components/auth/ProtectedRoute.jsx');
check(
  !studentProtected.includes('WorkspaceComingSoon') &&
    !studentProtected.includes('isWorkspaceLaunched'),
  'Student ProtectedRoute is not launch-gated'
);

const tour = read('onboarding/tour.js');
check(/student|default/.test(tour), 'student tour sequence still defined');
check(/employer/.test(tour), 'employer tour sequence still defined');
check(/institution/.test(tour), 'institution tour sequence preserved for later unlock');
check(/agent/.test(tour), 'agent tour sequence preserved for later unlock');

const employerFiles = [
  'pages/Employer/EmployerRegister.jsx',
  'pages/Employer/EmployerLogin.jsx',
  'pages/Employer/EmployerDashboard.jsx',
  'pages/Employer/EmployerPostJob.jsx',
  'components/employer/ProtectedEmployerRoute.jsx',
];
for (const rel of employerFiles) {
  check(existsSync(path.join(clientSrc, rel)), `employer path intact: ${rel}`);
}

const employerGuard = read('components/employer/ProtectedEmployerRoute.jsx');
check(
  !employerGuard.includes('WorkspaceComingSoon') &&
    !employerGuard.includes('isWorkspaceLaunched'),
  'Employer ProtectedEmployerRoute is not launch-gated'
);

const employerLogin = read('pages/Employer/EmployerLogin.jsx');
check(
  employerLogin.includes('onboarding') || employerLogin.includes('portalWelcome') || employerLogin.includes('mark'),
  'employer login still participates in onboarding/welcome flow'
);

const employerDashboard = read('pages/Employer/EmployerDashboard.jsx');
check(
  employerDashboard.includes('PortalWelcomeBanner') || employerDashboard.includes('welcome'),
  'employer dashboard welcome/tour surface retained'
);

const postJob = read('pages/Employer/EmployerPostJob.jsx');
check(postJob.includes('export default'), 'Post a Job page module retained');

const institutionDash = read('pages/Institution/InstitutionDashboard.jsx');
const institutionOnboarding = read('pages/Institution/InstitutionOnboarding.jsx');
const agentDash = read('pages/Agent/AgentDashboard.jsx');
const agentOnboarding = read('pages/Agent/AgentOnboarding.jsx');
const gbsLayout = read('pages/Agent/business-services/GbsWorkspaceLayout.jsx');
check(institutionDash.includes('export default'), 'institution dashboard module preserved');
check(institutionOnboarding.includes('export default'), 'institution onboarding module preserved');
check(agentDash.includes('export default'), 'education agent dashboard module preserved');
check(agentOnboarding.includes('export default'), 'agent onboarding module preserved');
check(gbsLayout.includes('export default'), 'business services workspace layout preserved');

const institutionGuard = read('components/institution/ProtectedInstitutionRoute.jsx');
check(
  institutionGuard.indexOf('WorkspaceComingSoon') < institutionGuard.indexOf('children'),
  'institution launch gate intercepts before dashboard children'
);
const agentGuard = read('components/agent/ProtectedAgentRoute.jsx');
check(
  agentGuard.indexOf('WorkspaceComingSoon') < agentGuard.indexOf('return children'),
  'agent launch gate intercepts before dashboard children'
);

console.log(`stagedWorkspaceLaunchOnboardingRegression.test.js: ${count} assertions passed`);
