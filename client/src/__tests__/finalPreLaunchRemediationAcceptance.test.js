import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Final pre-launch remediation engineering acceptance pack (NOT launch certification).
 * Runs focused mission contract suites once after Missions A–F.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const suites = [
  'finalPreLaunchSharedFoundation.test.js',
  'finalPreLaunchDiscovery.test.js',
  'finalPreLaunchHiringAuthority.test.js',
  'finalPreLaunchAgentTrust.test.js',
  'finalPreLaunchInstitution.test.js',
  'finalPreLaunchAdminAnnouncements.test.js',
  'adminConfirmDialogContract.test.js',
  'phase15FinalManualRemediation.test.js',
];

let failed = 0;
for (const name of suites) {
  const file = path.join(here, name);
  const r = spawnSync(process.execPath, [file], { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) {
    failed += 1;
    console.error(`FAIL: ${name}`);
  } else {
    console.log(`OK: ${name}`);
  }
}

assert.equal(failed, 0, `${failed} acceptance suite(s) failed`);
console.log(`finalPreLaunchRemediationAcceptance.test.js: ${suites.length} suites passed`);
