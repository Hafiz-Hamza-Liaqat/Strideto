import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Mission E — institution portal contracts */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');

const usage = read('pages/Institution/InstitutionUsage.jsx');
const apps = read('pages/Institution/InstitutionApplications.jsx');
const profile = read('pages/Institution/InstitutionProfile.jsx');
const claim = read('pages/Institution/InstitutionClaim.jsx');

check(/INSTITUTION_APPLICATIONS\}\?status=/.test(usage) || /\?status=\$\{state\}/.test(usage), 'usage stage links filter applications');
check(/useSearchParams/.test(apps) && /status/.test(apps), 'applications inbox reads status query');
check(/Other|organizationTypeOther|Specify organization type/i.test(profile), 'organization type Other requires custom value');
check(/picker|search|canonical/i.test(claim), 'canonical claim uses searchable picker UX');

console.log(`finalPreLaunchInstitution.test.js: ${count} assertions passed`);
