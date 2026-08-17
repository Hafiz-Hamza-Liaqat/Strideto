import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Shared Profile must not own Education specialty / destination taxonomy.
 * Those fields remain on AgentProfile storage but are edited only under
 * Education → My Education Services.
 */

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

const profile = read('pages/Agent/AgentProfile.jsx');
const services = read('pages/Agent/AgentServices.jsx');
const pub = read('pages/Public/AgentPublicProfile.jsx');
const badge = read('components/agent/StridetoVerifiedMark.jsx');
const listingEditor = read('pages/Agent/business-services/GbsListingEditor.jsx');
const gbsCaps = read('pages/Agent/business-services/GbsCapabilities.jsx');

check(!profile.includes('AGENT_SERVICE_CATEGORIES'), 'shared Profile does not import Education taxonomy');
check(!profile.includes('Destination / country expertise'), 'shared Profile has no destination expertise control');
check(!profile.includes('Service specialties'), 'shared Profile has no service specialties control');
check(!profile.includes('specialties:'), 'shared Profile save does not mutate specialties');
check(!/destinationCountries:\s*normalizeList\(form\.destinationCountries\)/.test(profile), 'shared Profile save does not mutate destinationCountries');
check(profile.includes('Save profile') && profile.includes('role="alert"'), 'shared Profile save UX remains');
check(profile.includes('Languages') && profile.includes('Service regions'), 'shared identity basics remain');
check(profile.includes('My Education Services'), 'shared Profile points editors to Education home');

check(services.includes('Education professional profile'), 'Education Services hosts professional profile section');
check(services.includes('Used for your Education &amp; Mobility professional profile'), 'Education ownership copy present');
check(services.includes('AGENT_SERVICE_CATEGORIES'), 'Education Services uses Education taxonomy');
check(services.includes('Destination / country expertise'), 'Education destination expertise editable in Education workspace');
check(services.includes('Select Education specialties') || services.includes('Specialties'), 'Education specialties editable in Education workspace');
check(/updateProfile\(\{\s*specialties:/.test(services) && services.includes('destinationCountries:'), 'Education profile save reuses AgentProfile API fields');
check(!services.includes('business_formation') && !services.includes('registered_agent'), 'Education Services does not adopt GBS capability ids');

check(badge.includes('if (!verified) return null'), 'Verified mark fails closed');
check(pub.includes('educationProfessionalVerification?.verified === true'), 'public detail requires server verified flag');

check(!listingEditor.includes('AGENT_SERVICE_CATEGORIES'), 'GBS listing editor does not consume Education taxonomy');
check(!listingEditor.includes('study_abroad_guidance'), 'GBS listing editor has no Education categories');
check(!gbsCaps.includes('study_abroad_guidance'), 'GBS capabilities have no Education categories');

console.log(`agentProfileDomainSeparation.test.js: ${count} assertions passed`);
