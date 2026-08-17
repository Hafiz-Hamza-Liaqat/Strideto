import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { canExercisePrivilegedCapability, VERIFICATION_STATUSES as VS } from '../../../shared/international/verification.js';

/**
 * Education "Verified by Strideto" must reuse canExercisePrivilegedCapability
 * (OrganizationVerification APPROVED) — never client flags or Business capability.
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

const svc = read('server/src/services/agentProfileService.js');
const badge = read('client/src/components/agent/StridetoVerifiedMark.jsx');
const pub = read('client/src/pages/Public/AgentPublicProfile.jsx');
const agentRoutes = read('server/src/routes/agent.js');

check(canExercisePrivilegedCapability(VS.APPROVED) === true, 'APPROVED exercises privilege');
for (const status of [
  VS.DRAFT,
  VS.VERIFICATION_PENDING,
  VS.UNDER_REVIEW,
  VS.NEEDS_INFORMATION,
  VS.ENHANCED_REVIEW,
  VS.REJECTED,
  VS.SUSPENDED,
  VS.REVOKED,
  VS.EXPIRED,
]) {
  check(canExercisePrivilegedCapability(status) === false, `${status} does not exercise privilege`);
}

check(/educationVerified = canExercisePrivilegedCapability\(verStatus\)/.test(svc), 'detail projection reuses canonical predicate');
check(svc.includes("scope: 'education_mobility'"), 'projection scope is education_mobility');
check(/if \(!canExercisePrivilegedCapability\(verStatus\)\)/.test(svc), 'public detail 404s without Education privilege');
check(svc.includes('educationProfessionalVerification'), 'projection field present');
check(!svc.includes('verified: req.body') && !svc.includes('educationVerified: req'), 'server does not accept client verified flags');

check(/verified = false/.test(badge) && /if \(!verified\) return null/.test(badge), 'badge fails closed');
check(pub.includes('educationProfessionalVerification?.verified === true'), 'client requires exact true');
check(!pub.includes('verified={true}'), 'client does not hardcode verified');

check(!/verified=true|educationVerified=true|stridetoVerified=true/.test(agentRoutes), 'routes do not accept verified query/body shortcuts');

// Business capability taxonomy must stay separate from Education mark authority
const caps = read('shared/gbs/businessServicesCapabilities.js');
check(caps.includes('business_formation') && caps.includes('registered_agent'), 'GBS capability catalog intact');
check(!caps.includes('study_abroad_guidance'), 'GBS catalog has no Education categories');

const eduTax = read('shared/agent/constants.js');
check(eduTax.includes('study_abroad_guidance') && eduTax.includes('AGENT_SERVICE_CATEGORIES'), 'Education taxonomy intact');
check(!eduTax.includes('business_formation') && !eduTax.includes('registered_agent'), 'Education taxonomy has no GBS capabilities');

console.log(`educationVerifiedMarkAuthority.test.js: ${count} assertions passed`);
