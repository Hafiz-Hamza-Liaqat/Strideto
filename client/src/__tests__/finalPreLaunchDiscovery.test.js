import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Mission B — international public discovery contracts */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const repoRoot = path.resolve(clientSrc, '..', '..');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');
const readRoot = (rel) => readFileSync(path.join(repoRoot, rel), 'utf8');

const jobs = read('pages/Jobs/Jobs.jsx');
const taxonomy = readRoot('shared/career/jobTaxonomy.js');
const career = read('pages/CareerGuidance/CareerGuidance.jsx');
const robots = read('../public/robots.txt');
check(!/defaultCountry\s*=\s*['"]PK['"]/.test(jobs) && !/countryCode:\s*['"]PK['"]/.test(jobs), 'Jobs has no hidden Pakistan default');
check(/Country|countryCode|State \/ Province|region|city/i.test(jobs), 'Jobs exposes country/region/city filters');
check(/JOB_FAMILIES|jobFamily|specialization/i.test(jobs) || /jobFamily/.test(taxonomy), 'Jobs taxonomy family/specialization exists');
check(/Software & IT/.test(taxonomy) && /Frontend/.test(taxonomy), 'job taxonomy includes Software & IT → Frontend');
check(/Data, AI & Analytics/.test(taxonomy) && /Public Sector & Nonprofit/.test(taxonomy), 'job taxonomy includes locked Mission B2 families');
check(/How do I choose a career\?/.test(career), 'Career Guidance FAQ includes choose-career theme');
check(/Unavailable \/ source required/.test(career), 'Career Guidance salary honesty copy present');
check(/Skill Trust/.test(career) && /International careers/.test(career), 'Career Guidance FAQ covers trust + international');
check(/Disallow: \/admin/.test(robots), 'robots.txt keeps admin private');

const dir = read('pages/Public/AgentDirectory.jsx');
const routes = read('routes/index.jsx');
check(/verification|specialt|language|Request Consultation|View Profile/i.test(dir), 'Agent directory uses public-safe fields');
check(/\/agents/.test(routes) || /AGENT_PUBLIC_DIRECTORY/.test(routes), 'Agents public route exists in router');

console.log(`finalPreLaunchDiscovery.test.js: ${count} assertions passed`);
