#!/usr/bin/env node
/**
 * Mission 26 — final multi-role acceptance orchestrator.
 *
 * Runs the curated acceptance pack sequentially and reports a truthful summary.
 * Every command below is local and offline: no network, no Docker, no live
 * database, no worker, no provider, no deployment.
 *
 *   node scripts/verify-mission-26-final-acceptance.mjs            # everything
 *   node scripts/verify-mission-26-final-acceptance.mjs --group trust
 *   node scripts/verify-mission-26-final-acceptance.mjs --no-browser
 *   node scripts/verify-mission-26-final-acceptance.mjs --list
 *
 * Exits non-zero if any command fails. Nothing is skipped silently: every
 * command that does not run is listed in the summary with its reason.
 */
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'server');

/** A curated acceptance pack. Each entry names the invariant it protects. */
const PACK = [
  // 1 — role / auth matrix
  ['auth', 'cross-realm auth matrix', 'server', 'src/__tests__/mission26FinalMultiRoleAcceptance.test.js'],
  ['auth', 'auth realm path rules', 'server', 'src/__tests__/authRealm.test.js'],
  ['auth', 'secure access authorization', 'server', 'src/__tests__/secureAccessAuthorization.test.js'],
  ['auth', 'access authorization coordinator', 'server', 'src/__tests__/accessAuthorizationCoordinator.test.js'],
  ['auth', 'session family revocation', 'server', 'src/__tests__/sessionFamilyRevocation.test.js'],
  ['auth', 'auth cookie policy', 'server', 'src/__tests__/authCookiePolicy.test.js'],
  ['auth', 'user secure auth flows', 'server', 'src/__tests__/userSecureAuthFlows.test.js'],

  // 2 — Student core
  ['student', 'universal Student profile', 'server', 'src/__tests__/universalStudentProfile.test.js'],
  ['student', 'education intelligence', 'server', 'src/__tests__/educationIntelligence.test.js'],
  ['student', 'scholarship / program intelligence', 'server', 'src/__tests__/scholarshipProgramIntelligence.test.js'],
  ['student', 'TestAcceptance explorer', 'server', 'src/__tests__/testAcceptanceExplorer.test.js'],
  ['student', 'eligibility + matching (Mission 8)', 'server', 'src/__tests__/personalizationEligibilityMatching.test.js'],
  ['student', 'Action engine / Journey planner', 'server', 'src/__tests__/actionEngineJourneyPlanner.test.js'],
  ['student', 'secure document Vault', 'server', 'src/__tests__/vaultDocumentVault.test.js'],

  // 3 — Employer baseline
  ['employer', 'employer auth realm isolation', 'server', 'src/__tests__/employerAuthRealmIsolation.test.js'],
  ['employer', 'employer portal integration', 'server', 'src/__tests__/employerPortalIntegration.test.js'],
  ['employer', 'employer application authorization', 'server', 'src/__tests__/employerApplicationAuthz.test.js'],
  ['employer', 'employer secure auth flows', 'server', 'src/__tests__/employerSecureAuthFlows.test.js'],

  // 4 — Agent / professional services chain
  ['agent', 'Agent / Agency portal', 'server', 'src/__tests__/agentAgencyPortal.test.js'],
  ['agent', 'Agent opportunity marketplace', 'server', 'src/__tests__/agentOpportunityMarketplace.test.js'],
  ['agent', 'consultations + contextual messaging', 'server', 'src/__tests__/consultationsContextualMessaging.test.js'],
  ['agent', 'professional case management', 'server', 'src/__tests__/professionalCaseManagement.test.js'],

  // 5 — Institution
  ['institution', 'Institution portal', 'server', 'src/__tests__/institutionPortal.test.js'],
  ['institution', 'organization verification foundation', 'server', 'src/__tests__/organizationVerificationFoundation.test.js'],
  ['institution', 'source verification + freshness', 'server', 'src/__tests__/sourceVerificationFreshness.test.js'],

  // 6 — Admin
  ['admin', 'Admin super-control center', 'server', 'src/__tests__/adminSuperControlCenter.test.js'],
  ['admin', 'Admin export formula-injection safety', 'server', 'src/__tests__/adminExportFormulaInjectionSecurity.test.js'],

  // 7 — trust / privacy
  ['trust', 'professional trust (Mission 15)', 'server', 'src/__tests__/professionalTrustMission15.test.js'],
  ['trust', 'opportunity trust remediation', 'server', 'src/__tests__/opportunityTrustRemediation.test.js'],
  ['trust', 'platform security + abuse audit (Mission 23)', 'server', 'src/__tests__/mission23PlatformSecurityAbuseAudit.test.js'],
  ['trust', 'access denylist', 'server', 'src/__tests__/accessDenylist.test.js'],

  // 8 — Commerce / provider simulation
  ['commerce', 'commerce foundation (Mission 16)', 'server', 'src/__tests__/commerceFoundationMission16.test.js'],
  ['commerce', 'marketplace payments (Mission 17)', 'server', 'src/__tests__/marketplacePaymentsMission17.test.js'],

  // 9 — Copilot / Budget
  ['ai', 'evidence-grounded Copilot', 'server', 'src/__tests__/copilot.test.js'],
  ['budget', 'budget + cost planner', 'server', 'src/__tests__/budgetCostPlanner.test.js'],

  // 10 — international + verified data
  ['international', 'international foundation', 'server', 'src/__tests__/internationalFoundation.test.js'],
  ['international', 'international hardening (Mission 22)', 'server', 'src/__tests__/internationalHardening.test.js'],
  ['data', 'verified-data launch pipeline (Mission 25)', 'server', 'src/__tests__/verifiedDataLaunch.test.js'],
  ['data', 'verified-data launch dry run', 'root', 'scripts/verified-data-launch.mjs --manifest initial-launch-pack.v1.json'],

  // 11 — browser acceptance
  ['browser', 'Institution portal UX closure', 'root', 'scripts/verify-institution-portal-ux.mjs'],
  ['browser', 'Mission 24 responsive/accessibility regression', 'root', 'scripts/verify-mission-24-ux.mjs'],
  ['browser', 'Mission 26 cross-role browser acceptance', 'root', 'scripts/verify-mission-26-cross-role-ux.mjs'],
];

const argv = process.argv.slice(2);
const arg = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1] ?? null;
};
const groupFilter = arg('--group');
const noBrowser = argv.includes('--no-browser');

if (argv.includes('--list')) {
  for (const [group, label, , command] of PACK) console.log(`${group.padEnd(14)} ${label.padEnd(46)} ${command}`);
  process.exit(0);
}

function runCommand(cwd, command) {
  const [script, ...rest] = command.split(' ');
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [script, ...rest], {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, JWT_SECRET: process.env.JWT_SECRET || 'z'.repeat(32), REFRESH_SECRET: process.env.REFRESH_SECRET || 'y'.repeat(32) },
    });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { out += chunk; });
    child.on('close', (code) => resolve({ code, out, ms: Date.now() - started }));
  });
}

const results = [];
const skipped = [];

for (const [group, label, where, command] of PACK) {
  if (groupFilter && group !== groupFilter) {
    skipped.push([label, `not in --group ${groupFilter}`]);
    continue;
  }
  if (noBrowser && group === 'browser') {
    skipped.push([label, '--no-browser was passed']);
    continue;
  }
  const cwd = where === 'server' ? serverDir : root;
  // Each browser harness starts its own Vite dev server against the same
  // client. A previous run leaves an optimized-dependency cache whose hash the
  // next cold page load rejects, so the app never mounts and the harness fails
  // on a stale cache rather than on a real defect. Clearing the local cache
  // directory (a build artifact, never source) keeps every run deterministic.
  if (group === 'browser') {
    if (!results.some((r) => r.group === 'browser')) {
      await rm(path.join(root, 'client', 'node_modules', '.vite'), { recursive: true, force: true });
    } else {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  process.stdout.write(`▸ ${group}/${label} … `);
  const { code, out, ms } = await runCommand(cwd, command);
  const seconds = (ms / 1000).toFixed(1);
  if (code === 0) {
    console.log(`ok (${seconds}s)`);
    results.push({ group, label, ok: true });
  } else {
    console.log(`FAILED (${seconds}s)`);
    console.log(out.split(/\r?\n/).filter(Boolean).slice(-25).map((l) => `    ${l}`).join('\n'));
    results.push({ group, label, ok: false });
  }
}

const failed = results.filter((r) => !r.ok);
console.log('\n── Mission 26 acceptance summary ──');
console.log(`commands run:    ${results.length}`);
console.log(`passed:          ${results.length - failed.length}`);
console.log(`failed:          ${failed.length}`);
if (skipped.length) {
  console.log(`not run:         ${skipped.length}`);
  for (const [label, reason] of skipped) console.log(`  - ${label} (${reason})`);
}
if (failed.length) {
  for (const r of failed) console.log(`  ✗ ${r.group}/${r.label}`);
  process.exit(1);
}
console.log('No network, no Docker, no live database, no worker, no provider call, no deployment.');
