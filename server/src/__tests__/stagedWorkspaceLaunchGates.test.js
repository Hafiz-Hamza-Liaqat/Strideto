/**
 * STRIDETO staged workspace launch — shared defaults + override safety.
 * Run: node server/src/__tests__/stagedWorkspaceLaunchGates.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  WORKSPACE_LAUNCH_IDS,
  WORKSPACE_LAUNCH_ERROR_CODE,
  WORKSPACE_LAUNCH_ENV_KEYS,
  isWorkspaceLaunched,
  getWorkspaceLaunchState,
  workspaceComingSoonBody,
  normalizeWorkspaceLaunchEnv,
} from '../../../shared/launch/workspaceLaunchGates.js';
import { assertAgentRegistrationDomainsLaunched } from '../middleware/requireWorkspaceLaunched.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

// LAUNCH-01 / LAUNCH-02 — student + employer permanently active
check(isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.STUDENT, {}) === true, 'LAUNCH-01: student enabled by default');
check(isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EMPLOYER, {}) === true, 'LAUNCH-02: employer enabled by default');

// ACTIVE-01 / ACTIVE-02 — env cannot disable Student/Employer
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.STUDENT, { WORKSPACE_LAUNCH_STUDENT: '0' }) === true,
  'ACTIVE-01: Student cannot be disabled by env'
);
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EMPLOYER, {
    WORKSPACE_LAUNCH_EMPLOYER: '0',
    VITE_WORKSPACE_LAUNCH_EMPLOYER: '0',
  }) === true,
  'ACTIVE-02: Employer cannot be disabled by env'
);
check(
  WORKSPACE_LAUNCH_ENV_KEYS[WORKSPACE_LAUNCH_IDS.STUDENT] === undefined &&
    WORKSPACE_LAUNCH_ENV_KEYS[WORKSPACE_LAUNCH_IDS.EMPLOYER] === undefined,
  'Student/Employer have no staged env keys'
);

// LAUNCH-03 / 04 / 05 — gated defaults
check(isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.INSTITUTION, {}) === false, 'LAUNCH-03: institution disabled by default');
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY, {}) === false,
  'LAUNCH-04: education_mobility disabled by default'
);
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES, {}) === false,
  'LAUNCH-05: business_services disabled by default'
);

// Explicit unlock for staged workspaces only
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.INSTITUTION, { WORKSPACE_LAUNCH_INSTITUTION: '1' }) === true,
  'institution unlocks with WORKSPACE_LAUNCH_INSTITUTION=1'
);
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY, {
    VITE_WORKSPACE_LAUNCH_EDUCATION_MOBILITY: '1',
  }) === true,
  'VITE_ alias unlocks education_mobility'
);

// ACTIVE-04 — staged flags do not affect Student/Employer
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.STUDENT, {
    WORKSPACE_LAUNCH_INSTITUTION: '0',
    WORKSPACE_LAUNCH_EDUCATION_MOBILITY: '0',
    WORKSPACE_LAUNCH_BUSINESS_SERVICES: '0',
  }) === true &&
    isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.EMPLOYER, {
      WORKSPACE_LAUNCH_INSTITUTION: '0',
      WORKSPACE_LAUNCH_EDUCATION_MOBILITY: '0',
      WORKSPACE_LAUNCH_BUSINESS_SERVICES: '0',
    }) === true,
  'ACTIVE-04: staged flags off still leave Student/Employer active'
);

// SERVER-LAUNCH-07 — request-shaped bags cannot invent unknown override channels;
// only WORKSPACE_LAUNCH_* / VITE_WORKSPACE_LAUNCH_* staged keys are read.
const poisoned = {
  workspace: 'institution',
  launch: '1',
  'x-workspace-launch': '1',
  body: { WORKSPACE_LAUNCH_INSTITUTION: '1' },
};
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.INSTITUTION, poisoned) === false,
  'SERVER-LAUNCH-07: unrelated request-shaped keys do not unlock institution'
);
const normalized = normalizeWorkspaceLaunchEnv({
  WORKSPACE_LAUNCH_INSTITUTION: '1',
  WORKSPACE_LAUNCH_STUDENT: '0',
  junk: '1',
});
check(
  normalized.WORKSPACE_LAUNCH_INSTITUTION === '1' &&
    normalized.junk === undefined &&
    normalized.WORKSPACE_LAUNCH_STUDENT === undefined,
  'normalize keeps only staged launch keys'
);

const state = getWorkspaceLaunchState({});
check(state.student === true && state.employer === true, 'state matrix: active workspaces');
check(
  state.institution === false && state.education_mobility === false && state.business_services === false,
  'state matrix: gated workspaces'
);

const body = workspaceComingSoonBody(WORKSPACE_LAUNCH_IDS.INSTITUTION);
check(body.code === WORKSPACE_LAUNCH_ERROR_CODE, 'stable WORKSPACE_COMING_SOON code');
check(body.workspace === WORKSPACE_LAUNCH_IDS.INSTITUTION, 'body includes workspace id');
check(typeof body.error === 'string' && body.error.length > 0, 'human-readable error present');

// No automatic Date.now unlock in the launch module
const launchSrc = read('shared/launch/workspaceLaunchGates.js');
check(!/Date\.now\(/.test(launchSrc), 'no Date.now auto-unlock in launch module');
check(!/setTimeout|setInterval/.test(launchSrc), 'no timer unlock in launch module');

// Env key map completeness for staged workspaces only
for (const id of [
  WORKSPACE_LAUNCH_IDS.INSTITUTION,
  WORKSPACE_LAUNCH_IDS.EDUCATION_MOBILITY,
  WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES,
]) {
  check(Boolean(WORKSPACE_LAUNCH_ENV_KEYS[id]), `env key mapped for ${id}`);
}

// Middleware + route wiring
const mw = read('server/src/middleware/requireWorkspaceLaunched.js');
check(mw.includes('WORKSPACE_COMING_SOON') || mw.includes('workspaceComingSoonBody'), 'middleware uses stable coming-soon body');
check(mw.includes('process.env'), 'middleware reads process.env only');
check(mw.includes('assertAgentRegistrationDomainsLaunched'), 'invite/domain assert helper present');
check(
  mw.includes('ids.length === 0') && /ok:\s*false/.test(mw),
  'empty domain list fails closed for registration assert'
);

const institutionRoutes = read('server/src/routes/institutionPortal.js');
check(
  institutionRoutes.includes('requireInstitutionWorkspaceLaunched'),
  'SERVER-LAUNCH-01: institution private portal gated'
);
check(
  /\/auth\/institution\/register[\s\S]*requireInstitutionWorkspaceLaunched|requireInstitutionWorkspaceLaunched[\s\S]*\/auth\/institution\/register/.test(
    institutionRoutes
  ) || institutionRoutes.includes("'/auth/institution/register',\n  requireInstitutionWorkspaceLaunched"),
  'institution register gated'
);
check(
  institutionRoutes.includes("'/institutions/directory'") &&
    !/directory[\s\S]{0,80}requireInstitutionWorkspaceLaunched/.test(institutionRoutes),
  'SERVER-LAUNCH-04: public institutions directory not launch-gated'
);

const agentRoutes = read('server/src/routes/agent.js');
check(
  agentRoutes.includes('requireEducationMobilityWorkspaceLaunched') &&
    agentRoutes.includes('...educationPrivate'),
  'SERVER-LAUNCH-02: education agent private APIs gated'
);
check(
  agentRoutes.includes('providerPrivate') &&
    agentRoutes.includes('requireAnyProviderWorkspaceLaunched'),
  'shared provider gate present'
);
check(
  /\/agent\/team'[\s\S]{0,80}\.\.\.providerPrivate/.test(agentRoutes) ||
    agentRoutes.includes("'/agent/team',\n  ...providerPrivate"),
  'team routes classified shared provider'
);
check(
  agentRoutes.includes("'/agent/messages'") && agentRoutes.includes('...providerPrivate'),
  'messages classified shared provider'
);
check(
  agentRoutes.includes("'/agent/usage-billing'") && agentRoutes.includes('providerPrivate'),
  'usage-billing classified shared provider'
);
check(
  agentRoutes.includes("'/agent/commerce/readiness'") && agentRoutes.includes('providerPrivate'),
  'commerce/readiness classified shared provider'
);
check(
  agentRoutes.includes("'/agent/vault/grants'") && agentRoutes.includes('providerPrivate'),
  'vault/grants classified shared provider'
);
check(
  agentRoutes.includes("'/agent/dashboard'") && agentRoutes.includes('educationPrivate'),
  'dashboard remains education-specific'
);
check(
  agentRoutes.includes("'/agent/marketplace'") && agentRoutes.includes('educationPrivate'),
  'marketplace remains education-specific'
);
check(
  agentRoutes.includes('businessPrivate') || agentRoutes.includes('requireBusinessServicesWorkspaceLaunched'),
  'business-specific launch gate present'
);
check(
  agentRoutes.includes("'/agents'") && agentRoutes.includes('listPublicAgents'),
  'SERVER-LAUNCH-04: public agents directory remains mounted'
);
check(
  agentRoutes.includes('/agents/marketplace/posts'),
  'SERVER-LAUNCH-04: public agent marketplace remains mounted'
);

const authCtrl = read('server/src/controllers/agentAuthController.js');
check(
  authCtrl.includes('assertAgentRegistrationDomainsLaunched') &&
    authCtrl.includes('pendingInvite.domainAccess') &&
    authCtrl.includes('workspaceComingSoonBody'),
  'invite registration enforces server-resolved invite domains'
);
check(
  /Authoritative domains come from the invitation|inviteDomainIds/.test(authCtrl),
  'invite path documents body-domain non-authority'
);

const gbsMw = read('server/src/middleware/requireBusinessServices.js');
check(
  gbsMw.includes('WORKSPACE_LAUNCH_IDS.BUSINESS_SERVICES') || gbsMw.includes('business_services'),
  'SERVER-LAUNCH-03: business services private gate includes launch check'
);

const employerRoutes = read('server/src/routes/employer.js');
check(
  !employerRoutes.includes('requireWorkspaceLaunched') &&
    !employerRoutes.includes('WORKSPACE_COMING_SOON'),
  'SERVER-LAUNCH-05: employer routes not launch-blocked'
);

const authRoutes = read('server/src/routes/auth.js');
check(
  !authRoutes.includes('requireWorkspaceLaunched'),
  'SERVER-LAUNCH-06: student/user auth routes not launch-blocked'
);

// Invite-domain assert behavioral matrix (unit, env-injected)
const prevEdu = process.env.WORKSPACE_LAUNCH_EDUCATION_MOBILITY;
const prevBiz = process.env.WORKSPACE_LAUNCH_BUSINESS_SERVICES;
try {
  process.env.WORKSPACE_LAUNCH_EDUCATION_MOBILITY = '0';
  process.env.WORKSPACE_LAUNCH_BUSINESS_SERVICES = '1';
  check(
    assertAgentRegistrationDomainsLaunched(['education_mobility']).ok === false,
    'INVITE-GATE: education invite blocked when edu off / biz on'
  );
  check(
    assertAgentRegistrationDomainsLaunched(['business_services']).ok === true,
    'INVITE-GATE: business invite allowed when biz on'
  );
  check(
    assertAgentRegistrationDomainsLaunched([]).ok === false,
    'INVITE-GATE: empty resolved domains fail closed (omit-body cannot bypass)'
  );

  process.env.WORKSPACE_LAUNCH_EDUCATION_MOBILITY = '1';
  process.env.WORKSPACE_LAUNCH_BUSINESS_SERVICES = '0';
  check(
    assertAgentRegistrationDomainsLaunched(['business_services']).ok === false,
    'INVITE-GATE: business invite blocked when biz off / edu on'
  );
  check(
    assertAgentRegistrationDomainsLaunched(['education_mobility']).ok === true,
    'INVITE-GATE: education invite allowed when edu on'
  );

  process.env.WORKSPACE_LAUNCH_EDUCATION_MOBILITY = '0';
  process.env.WORKSPACE_LAUNCH_BUSINESS_SERVICES = '0';
  check(
    assertAgentRegistrationDomainsLaunched(['education_mobility', 'business_services']).ok === false,
    'INVITE-GATE: both off blocks any provider domain registration'
  );
} finally {
  if (prevEdu === undefined) delete process.env.WORKSPACE_LAUNCH_EDUCATION_MOBILITY;
  else process.env.WORKSPACE_LAUNCH_EDUCATION_MOBILITY = prevEdu;
  if (prevBiz === undefined) delete process.env.WORKSPACE_LAUNCH_BUSINESS_SERVICES;
  else process.env.WORKSPACE_LAUNCH_BUSINESS_SERVICES = prevBiz;
}

console.log(`stagedWorkspaceLaunchGates.test.js: ${count} assertions passed`);
