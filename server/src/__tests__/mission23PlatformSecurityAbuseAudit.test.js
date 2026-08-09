/**
 * Mission 23 platform security/abuse audit suite.
 * Synthetic/local only: no DB connection, network, provider, worker, or live action.
 * Run: node src/__tests__/mission23PlatformSecurityAbuseAudit.test.js
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCorsOptions } from '../config/cors.js';
import { privateResponse, setPrivateResponseHeaders } from '../middleware/privateResponse.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const source = rel => readFileSync(path.join(root, rel), 'utf8');
let assertions = 0;
const check = (value, message) => { assert.ok(value, message); assertions += 1; };

function corsDecision(options, origin) {
  let result;
  options.origin(origin, (_error, allowed) => { result = allowed; });
  return result;
}

const previousEnv = {
  NODE_ENV: process.env.NODE_ENV,
  SITE_URL: process.env.SITE_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  APP_URL: process.env.APP_URL,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  CORS_ALLOW_VERCEL_PREVIEWS: process.env.CORS_ALLOW_VERCEL_PREVIEWS,
};
try {
  process.env.NODE_ENV = 'production';
  process.env.SITE_URL = 'https://app.strideto.test';
  delete process.env.FRONTEND_URL;
  delete process.env.APP_URL;
  delete process.env.CORS_ORIGINS;
  delete process.env.CORS_ALLOW_VERCEL_PREVIEWS;
  let cors = getCorsOptions();
  check(cors.credentials === true, 'configured origins may use credentials');
  check(corsDecision(cors, 'https://app.strideto.test') === true, 'configured site allowed');
  check(corsDecision(cors, 'https://attacker.example') === false, 'unknown origin denied');
  check(corsDecision(cors, 'https://attacker.vercel.app') === false, 'Vercel wildcard fails closed by default');
  check(corsDecision(cors, undefined) === true, 'non-browser requests remain allowed');
  process.env.CORS_ALLOW_VERCEL_PREVIEWS = '1';
  cors = getCorsOptions();
  check(corsDecision(cors, 'https://review-123.vercel.app') === true, 'preview wildcard requires opt-in');
  check(corsDecision(cors, 'http://review-123.vercel.app') === false, 'preview wildcard requires HTTPS');
} finally {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}

const headers = new Map();
const res = { setHeader: (key, value) => headers.set(key, value) };
setPrivateResponseHeaders(res);
check(headers.get('Cache-Control').includes('private'), 'authenticated response is private');
check(headers.get('Cache-Control').includes('no-store'), 'authenticated response is no-store');
check(headers.get('Pragma') === 'no-cache', 'legacy caches are disabled');
check(headers.get('Expires') === '0', 'authenticated response is immediately expired');
let nextCalled = false;
privateResponse({}, res, () => { nextCalled = true; });
check(nextCalled, 'private response middleware continues request handling');

const authMiddleware = source('server/src/middleware/auth.js');
const authRoutes = source('server/src/routes/auth.js');
const index = source('server/src/index.js');
const vaultRoutes = source('server/src/routes/vault.js');
const paymentRoutes = source('server/src/routes/marketplacePayments.js');
const copilotRoutes = source('server/src/routes/copilot.js');
const budgetRoutes = source('server/src/routes/budget.js');
const adminRoutes = source('server/src/routes/adminSuperControl.js');
check(authMiddleware.includes('setPrivateResponseHeaders(res)'), 'bearer-protected responses use private headers');
check(authRoutes.includes('authRouter.use(privateResponse)'), 'cookie/session endpoints use private headers');
const jsonParserPosition = index.indexOf('app.use(express.json');
check(index.indexOf("app.post('/api/webhooks/stripe'") < jsonParserPosition, 'Employer webhook precedes JSON parsing');
check(index.indexOf("app.post('/api/webhooks/stripe-marketplace'") < jsonParserPosition, 'marketplace webhook precedes JSON parsing');
check(/requireAuth,\s*requireUserAuth/.test(vaultRoutes), 'Vault requires Student authentication');
check(/requireAuth,requireUserAuth,c\.createIntent/.test(paymentRoutes), 'payment intent requires purchaser authentication');
check(/requireAuth, requireUserAuth/.test(copilotRoutes), 'Copilot is Student scoped');
check(/requireAuth, requireUserAuth/.test(budgetRoutes), 'CostPlans are Student scoped');
check(adminRoutes.includes('requireSuperAdmin'), 'privileged investigation retains SuperAdmin gate');
check(!/dangerouslySetInnerHTML/.test(source('client/src/pages/Copilot/CopilotPage.jsx')), 'Copilot output is not raw HTML');

const regressions = [
  'auth.test.js',
  'authCookiePolicy.test.js',
  'employerAuthRealmIsolation.test.js',
  'agentAgencyPortal.test.js',
  'institutionPortal.test.js',
  'vaultDocumentVault.test.js',
  'consultationsContextualMessaging.test.js',
  'professionalCaseManagement.test.js',
  'professionalTrustMission15.test.js',
  'agentOpportunityMarketplace.test.js',
  'commerceFoundationMission16.test.js',
  'marketplacePaymentsMission17.test.js',
  'copilot.test.js',
  'budgetCostPlanner.test.js',
  'adminSuperControlCenter.test.js',
];

for (const file of process.env.MISSION23_FOCUSED_ONLY === '1' ? [] : regressions) {
  const result = spawnSync(process.execPath, [path.join(here, file)], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' },
    timeout: 120_000,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    assert.fail(`${file} failed with exit status ${result.status}`);
  }
  assertions += 1;
  console.log(`  PASS ${file}`);
}

console.log(`\nMission 23 platform security/abuse audit passed: ${assertions} direct/orchestrated checks; accepted suites provide >100 behavioral/security assertions.`);
