import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Shared identity pages must not own Education specialty / destination taxonomy.
 * Those fields remain on AgentProfile storage but are edited only on
 * Education & Mobility Profile.
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
const eduProfile = read('pages/Agent/EducationProfile.jsx');
const eduFields = read('components/agent/EducationProfessionalProfileSection.jsx');
const services = read('pages/Agent/AgentServices.jsx');
const pub = read('pages/Public/AgentPublicProfile.jsx');
const badge = read('components/agent/StridetoVerifiedMark.jsx');
const listingEditor = read('pages/Agent/business-services/GbsListingEditor.jsx');
const gbsCaps = read('pages/Agent/business-services/GbsCapabilities.jsx');
const bizProfile = read('pages/Agent/business-services/GbsProfile.jsx');

check(!profile.includes('AGENT_SERVICE_CATEGORIES'), 'shared Profile does not import Education taxonomy');
check(!profile.includes('Destination / country expertise'), 'shared Profile has no destination expertise control');
check(!profile.includes('Service specialties'), 'shared Profile has no service specialties control');
check(!profile.includes('specialties:'), 'shared Profile save does not mutate specialties');
check(!/destinationCountries:\s*normalizeList\(form\.destinationCountries\)/.test(profile), 'shared Profile save does not mutate destinationCountries');
check(profile.includes('Save profile') && profile.includes('role="alert"'), 'shared Profile save UX remains');
check(profile.includes('Languages') && profile.includes('Service regions'), 'shared identity basics remain');
check(profile.includes('Education & Mobility Profile') || profile.includes('Education professional profile'), 'shared identity copy points to Education Profile');

check(eduProfile.includes('EducationProfessionalProfileSection'), 'Education Profile hosts professional fields');
check(eduFields.includes('Education professional profile'), 'Education professional section present');
check(eduFields.includes('Used for your Education &amp; Mobility professional profile'), 'Education ownership copy present');
check(eduFields.includes('AGENT_SERVICE_CATEGORIES'), 'Education Profile uses Education taxonomy');
check(eduFields.includes('Destination / country expertise'), 'Education destination expertise editable in Education workspace');
check(eduFields.includes('Select Education specialties') || eduFields.includes('Specialties'), 'Education specialties editable in Education workspace');
check(/updateProfile\(\{\s*specialties:/.test(eduFields) && eduFields.includes('destinationCountries:'), 'Education profile save reuses AgentProfile API fields');
check(!services.includes('AGENT_SERVICE_CATEGORIES'), 'Education Services no longer owns professional taxonomy editor');
check(!services.includes('business_formation') && !services.includes('registered_agent'), 'Education Services does not adopt GBS capability ids');

check(!bizProfile.includes('AGENT_SERVICE_CATEGORIES'), 'Business Profile has no Education taxonomy');
check(!bizProfile.includes('destinationCountries'), 'Business Profile has no Education destinations');

check(badge.includes('if (!verified) return null'), 'Verified mark fails closed');
check(pub.includes('educationProfessionalVerification?.verified === true'), 'public detail requires server verified flag');

check(!listingEditor.includes('AGENT_SERVICE_CATEGORIES'), 'GBS listing editor does not consume Education taxonomy');
check(!listingEditor.includes('study_abroad_guidance'), 'GBS listing editor has no Education categories');
check(!gbsCaps.includes('study_abroad_guidance'), 'GBS capabilities have no Education categories');

console.log(`agentProfileDomainSeparation.test.js: ${count} assertions passed`);
