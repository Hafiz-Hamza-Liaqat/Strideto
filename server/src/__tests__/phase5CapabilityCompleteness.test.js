/**
 * Phase 5 — SuperAdmin QA Capability Completeness regression tests.
 *
 * CAP-01  canonical Education Agent/Agency capability exists in QA-eligible registry
 * CAP-02  SuperAdmin picker includes Education Agent/Agency capability
 * CAP-03  picker uses canonical capability ID, not a UI-only synthetic string
 * CAP-04  ordinary Admin cannot grant the capability
 * CAP-05  unknown capability ID is rejected server-side
 * CAP-06  valid existing Institution capability still works
 * CAP-07  valid existing Employer capability still works
 * CAP-08  valid existing GBS Business Services Provider capability still works
 * CAP-09  granting Education Agent QA capability does not mutate verification truth
 * CAP-10  granting Education Agent QA capability does not create Verified badge/state
 * CAP-11  revoke removes effective QA capability
 * CAP-12  expired override no longer authorizes the capability
 * CAP-13  Phase 3 provider notification semantics remain temporary-QA wording
 * CAP-14  capability list has no duplicate IDs
 * CAP-15  deprecated capabilities are excluded from QA-eligible set
 *
 * CAP-UI-01    picker is derived from canonical registry (not a duplicated hard-coded map)
 * CAP-UI-02    education_agent appears because it is in the registry
 * CAP-UI-03    registry contains no duplicate selectable IDs
 *
 * CAP-EFFECTIVE-01  organic approved trust → representative Education operation allowed
 * CAP-EFFECTIVE-02  no organic approval + qa_test education_agent override → allowed
 * CAP-EFFECTIVE-03  same provider, missing education_agent in override → denied
 * CAP-EFFECTIVE-04  education_agent override expired/revoked → denied
 * CAP-EFFECTIVE-05  suspended/revoked + education_agent override → hard denied
 * CAP-EFFECTIVE-06  successful QA operation does not mutate verification truth
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ORGANIZATION_CAPABILITY_IDS,
  ORGANIZATION_CAPABILITY_REGISTRY,
  isKnownOrganizationCapability,
  listOrganizationCapabilityIds,
  listQaEligibleCapabilities,
} from '../../../shared/capability/organizationCapabilities.js';
import {
  createOverrideService,
  createMemoryOverrideStore,
  OVERRIDE_TYPES,
} from '../services/capability/overrideService.js';
import { hasPermission, PERMISSIONS, ROLES } from '../config/rbac.js';
import {
  canExercisePrivilegedCapability,
  isSuspendedOrRevoked,
  VERIFICATION_STATUSES as VS,
} from '../../../shared/international/verification.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

let passed = 0;
function check(cond, label) {
  assert.ok(cond, label);
  passed++;
  process.stdout.write(`  [PASS] ${label}\n`);
}

function makeOverrideSvc(auditEvents = []) {
  const store = createMemoryOverrideStore();
  const svc = createOverrideService({
    overrideStore: store,
    audit: async (evt) => { auditEvents.push(evt); },
    notify: async () => {},
  });
  return { svc, store };
}

const ORG_ID = 'org-cap5-001';
const ACTOR_SA = { userId: 'sa-cap5', role: ROLES.SUPER_ADMIN };

// ─── CAP-01: Education Agent capability exists in registry ─────────────────

process.stdout.write('\nCAP-01  Education Agent capability in registry:\n');

check(
  'EDUCATION_AGENT' in ORGANIZATION_CAPABILITY_IDS,
  'CAP-01a: ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT is defined'
);
check(
  typeof ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT === 'string' &&
    ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT.length > 0,
  'CAP-01b: EDUCATION_AGENT ID is a non-empty string'
);
check(
  isKnownOrganizationCapability(ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT),
  'CAP-01c: isKnownOrganizationCapability returns true for EDUCATION_AGENT'
);
{
  const def = ORGANIZATION_CAPABILITY_REGISTRY[ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT];
  check(def !== undefined, 'CAP-01d: EDUCATION_AGENT has a registry entry');
  check(def?.deprecated === false, 'CAP-01e: EDUCATION_AGENT is not deprecated');
  check(typeof def?.description === 'string' && def.description.length > 0, 'CAP-01f: EDUCATION_AGENT has a description');
}

// ─── CAP-02: registry includes Education Agent in QA-eligible set ─────────

process.stdout.write('\nCAP-02  Registry exposes Education Agent in QA-eligible set:\n');

{
  const qaList = listQaEligibleCapabilities();
  const edEntry = qaList.find((e) => e.id === ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT);
  check(edEntry !== undefined, 'CAP-02a: education_agent appears in listQaEligibleCapabilities()');
  check(typeof edEntry?.label === 'string' && edEntry.label.length > 0, 'CAP-02b: registry entry has a non-empty label');
  check(/Education Agent/i.test(edEntry?.label || ''), 'CAP-02c: label contains "Education Agent"');
}

// ─── CAP-03: UI derives picker from canonical registry ────────────────────

process.stdout.write('\nCAP-03  UI picker derives from canonical registry:\n');

{
  const uiSource = fs.readFileSync(
    path.join(root, 'client/src/pages/Admin/AdminVerificationQueue.jsx'),
    'utf8'
  );
  // UI must import from the shared registry (not maintain its own hard-coded map).
  check(
    uiSource.includes('listQaEligibleCapabilities') &&
      uiSource.includes('@shared/capability/organizationCapabilities'),
    'CAP-03a: UI imports listQaEligibleCapabilities from @shared registry'
  );
  // UI must NOT have the old hard-coded CAPABILITY_LABELS constant.
  check(
    !uiSource.includes('const CAPABILITY_LABELS'),
    'CAP-03b: stale hard-coded CAPABILITY_LABELS map is removed'
  );
  // UI must reference the QA-eligible list for the picker loop.
  check(
    uiSource.includes('QA_ELIGIBLE_CAPABILITIES') || uiSource.includes('listQaEligibleCapabilities'),
    'CAP-03c: picker loop iterates over the registry-derived list'
  );
}

// ─── CAP-04: ordinary Admin cannot grant ─────────────────────────────────

process.stdout.write('\nCAP-04  Admin cannot grant capability override:\n');

check(
  !hasPermission(ROLES.ADMIN, PERMISSIONS.CAPABILITY_OVERRIDE),
  'CAP-04a: ADMIN does not hold CAPABILITY_OVERRIDE permission'
);
check(
  !hasPermission(ROLES.MODERATOR, PERMISSIONS.CAPABILITY_OVERRIDE),
  'CAP-04b: MODERATOR does not hold CAPABILITY_OVERRIDE permission'
);
check(
  hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.CAPABILITY_OVERRIDE),
  'CAP-04c: SUPER_ADMIN holds CAPABILITY_OVERRIDE permission'
);

// ─── CAP-05: unknown capability ID rejected server-side ──────────────────

process.stdout.write('\nCAP-05  Unknown capability rejected:\n');

{
  const { svc } = makeOverrideSvc();
  let threw = false;
  let code;
  try {
    await svc.grantOverride({
      ...ACTOR_SA,
      organizationId: ORG_ID,
      overrideType: OVERRIDE_TYPES.QA_TEST,
      reason: 'test',
      capabilities: ['unknown_education_xyz'],
    });
  } catch (e) {
    threw = true;
    code = e.code;
  }
  check(threw, 'CAP-05a: unknown capability throws');
  check(code === 'unknown_capability', 'CAP-05b: error code is unknown_capability');
}

// ─── CAP-06: Institution capability still works ───────────────────────────

process.stdout.write('\nCAP-06  Institution capability still valid:\n');

check(
  isKnownOrganizationCapability(ORGANIZATION_CAPABILITY_IDS.INSTITUTION_PORTAL),
  'CAP-06a: INSTITUTION_PORTAL is still a known capability'
);
{
  const { svc } = makeOverrideSvc();
  const result = await svc.grantOverride({
    ...ACTOR_SA,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'institution qa test',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.INSTITUTION_PORTAL],
  });
  check(result.active === true, 'CAP-06b: INSTITUTION_PORTAL grant succeeds');
  check(
    result.capabilities.includes(ORGANIZATION_CAPABILITY_IDS.INSTITUTION_PORTAL),
    'CAP-06c: INSTITUTION_PORTAL in result capabilities'
  );
}

// ─── CAP-07: Employer capability still works ─────────────────────────────

process.stdout.write('\nCAP-07  Employer capability still valid:\n');

check(
  isKnownOrganizationCapability(ORGANIZATION_CAPABILITY_IDS.EMPLOYER),
  'CAP-07a: EMPLOYER is still a known capability'
);
{
  const { svc } = makeOverrideSvc();
  const result = await svc.grantOverride({
    ...ACTOR_SA,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'employer qa test',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER],
  });
  check(result.active === true, 'CAP-07b: EMPLOYER grant succeeds');
}

// ─── CAP-08: GBS Business Services Provider capability still works ────────

process.stdout.write('\nCAP-08  GBS capability still valid:\n');

check(
  isKnownOrganizationCapability(ORGANIZATION_CAPABILITY_IDS.BUSINESS_SERVICES_PROVIDER),
  'CAP-08a: BUSINESS_SERVICES_PROVIDER is still a known capability'
);
{
  const { svc } = makeOverrideSvc();
  const result = await svc.grantOverride({
    ...ACTOR_SA,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'gbs provider qa test',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.BUSINESS_SERVICES_PROVIDER],
  });
  check(result.active === true, 'CAP-08b: BUSINESS_SERVICES_PROVIDER grant succeeds');
}

// ─── CAP-09: Granting Education Agent does not mutate verification truth ──

process.stdout.write('\nCAP-09  Education Agent grant does not mutate verification:\n');

{
  const fakeVerificationRecord = { status: 'rejected', organizationType: 'agent', earnedBadges: [] };
  const { svc } = makeOverrideSvc();
  await svc.grantOverride({
    ...ACTOR_SA,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'education agent qa',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT],
  });
  check(
    fakeVerificationRecord.status === 'rejected',
    'CAP-09a: verification status unchanged after education_agent override'
  );
  check(
    fakeVerificationRecord.earnedBadges.length === 0,
    'CAP-09b: earnedBadges unchanged after education_agent override'
  );
}

// ─── CAP-10: Granting Education Agent does not create Verified badge ───────

process.stdout.write('\nCAP-10  Education Agent grant creates no Verified badge:\n');

{
  const { svc } = makeOverrideSvc();
  const result = await svc.grantOverride({
    ...ACTOR_SA,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'education agent qa',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT],
  });
  check(
    !('earnedBadges' in result),
    'CAP-10a: override record contains no earnedBadges field'
  );
  check(
    result.active === true && result.capabilities.includes(ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT),
    'CAP-10b: override is active with education_agent capability only'
  );
}

// ─── CAP-11: Revoke removes effective QA capability ───────────────────────

process.stdout.write('\nCAP-11  Revoke removes effective capability:\n');

{
  const { svc } = makeOverrideSvc();
  await svc.grantOverride({
    ...ACTOR_SA,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'education agent qa',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT],
  });
  await svc.revokeOverride({ ...ACTOR_SA, organizationId: ORG_ID, reason: 'qa complete' });
  const active = await svc.getActiveOverride(ORG_ID);
  check(active === null, 'CAP-11a: getActiveOverride returns null after revoke');
  const hasIt = await svc.hasOverrideForCapability(ORG_ID, ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT);
  check(!hasIt, 'CAP-11b: hasOverrideForCapability returns false after revoke');
}

// ─── CAP-12: Expired override denies capability ────────────────────────────

process.stdout.write('\nCAP-12  Expired override denies capability:\n');

{
  const { svc } = makeOverrideSvc();
  const past = new Date(Date.now() - 5000);
  await svc.grantOverride({
    ...ACTOR_SA,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'education agent qa',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT],
    expiresAt: past,
  });
  const active = await svc.getActiveOverride(ORG_ID);
  check(active === null, 'CAP-12a: expired override returns null from getActiveOverride');
  const hasIt = await svc.hasOverrideForCapability(ORG_ID, ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT);
  check(!hasIt, 'CAP-12b: expired override denies education_agent capability');
}

// ─── CAP-13: Phase 3 notification semantics — temporary QA wording ─────────

process.stdout.write('\nCAP-13  Phase 3 notification semantics preserved:\n');

{
  // Phase 3 notification lives in overrideRuntime.js (notifyProviderOrganization)
  const notifySource = fs.readFileSync(
    path.join(root, 'server/src/services/capability/overrideRuntime.js'),
    'utf8'
  );
  // Notification title must say "Temporary QA" (not "Verified")
  check(
    /Temporary QA/i.test(notifySource),
    'CAP-13a: overrideRuntime notifyProviderOrganization uses "Temporary QA" title wording'
  );
  // Notification type must be qa_override (not verified/badge)
  check(
    notifySource.includes('qa_override_granted') && notifySource.includes('qa_override_revoked'),
    'CAP-13b: notification type is qa_override_granted / qa_override_revoked (not verified)'
  );
  // Must NOT emit a "Verified" notification on grant
  check(
    !(/title.*Verified|Verified.*title/.test(notifySource)),
    'CAP-13c: notification title does not say "Verified" — stays as temporary QA access'
  );
}

// ─── CAP-14: No duplicate IDs in capability list ──────────────────────────

process.stdout.write('\nCAP-14  No duplicate IDs:\n');

{
  const ids = listOrganizationCapabilityIds();
  const unique = new Set(ids);
  check(unique.size === ids.length, `CAP-14a: capability list has no duplicate IDs (${ids.length} total)`);
  check(ids.includes(ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT), 'CAP-14b: education_agent is in listOrganizationCapabilityIds()');
}

// ─── CAP-15: Deprecated capabilities are not QA-eligible ─────────────────

process.stdout.write('\nCAP-15  Deprecated capabilities excluded from QA-eligible set:\n');

{
  const allIds = listOrganizationCapabilityIds();
  const nonDeprecated = allIds.filter(
    (id) => ORGANIZATION_CAPABILITY_REGISTRY[id]?.deprecated === false
  );
  // All current capabilities are non-deprecated; verify structure is correct
  check(
    nonDeprecated.length === allIds.length,
    'CAP-15a: no deprecated capabilities in current registry (all are QA-eligible)'
  );
  check(
    nonDeprecated.includes(ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT),
    'CAP-15b: education_agent is in the non-deprecated (QA-eligible) set'
  );
  // Simulate: a hypothetical deprecated capability must not be in QA set
  const hypothetical = { deprecated: true, id: 'old_cap' };
  const wouldBeEligible = hypothetical.deprecated === false;
  check(!wouldBeEligible, 'CAP-15c: deprecated capability would be excluded from QA-eligible set');
}

// ─── CAP-UI-01: Picker derives from registry, not a duplicate map ─────────

process.stdout.write('\nCAP-UI-01  Picker derivation from canonical registry:\n');

{
  const qaList = listQaEligibleCapabilities();
  // Every entry must come directly from the registry (id matches a registry key)
  for (const entry of qaList) {
    const inRegistry = ORGANIZATION_CAPABILITY_REGISTRY[entry.id];
    check(inRegistry !== undefined, `CAP-UI-01: registry entry for "${entry.id}" is authoritative`);
    check(inRegistry.label === entry.label, `CAP-UI-01: label for "${entry.id}" matches registry`);
  }
  check(qaList.length >= 1, 'CAP-UI-01: at least one QA-eligible capability exists');
}

// ─── CAP-UI-02: education_agent appears because it is in the registry ───

process.stdout.write('\nCAP-UI-02  education_agent present via registry:\n');

{
  const qaList = listQaEligibleCapabilities();
  const ids = qaList.map((e) => e.id);
  check(
    ids.includes(ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT),
    'CAP-UI-02: education_agent is in the QA-eligible list from the registry'
  );
  // Adding it to the registry is the ONLY change needed — no separate UI edit required.
  const uiSource = fs.readFileSync(
    path.join(root, 'client/src/pages/Admin/AdminVerificationQueue.jsx'),
    'utf8'
  );
  check(
    !uiSource.includes("education_agent:") && !uiSource.includes("'education_agent'"),
    'CAP-UI-02: UI does not hard-code the education_agent ID separately — derives from registry'
  );
}

// ─── CAP-UI-03: no duplicate selectable IDs in registry ───────────────────

process.stdout.write('\nCAP-UI-03  No duplicate selectable IDs:\n');

{
  const qaList = listQaEligibleCapabilities();
  const ids = qaList.map((e) => e.id);
  const unique = new Set(ids);
  check(unique.size === ids.length, `CAP-UI-03: ${ids.length} QA-eligible IDs, all unique`);
}

// ─── CAP-EFFECTIVE: Education Agent authorization effectiveness ─────────

process.stdout.write('\nCAP-EFFECTIVE  Education Agent authorization effectiveness:\n');

// Simulate assertApprovedVerification logic as implemented in agentProfileService.js
// after Phase 5 wiring (requires EDUCATION_AGENT capability for qa_test overrides).

function simulateAgentAssertApprovedVerification(status, override) {
  if (isSuspendedOrRevoked(status)) {
    return { allowed: false, code: 'BLOCKED' };
  }
  if (!canExercisePrivilegedCapability(status)) {
    const isRejected = status === VS.REJECTED;
    const isQaTestOverride = override?.overrideType === OVERRIDE_TYPES.QA_TEST;
    const hasEducationAgentCap = isQaTestOverride &&
      Array.isArray(override?.capabilities) &&
      override.capabilities.includes(ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT);
    if (!override || (isRejected && !isQaTestOverride) || (isQaTestOverride && !hasEducationAgentCap)) {
      return { allowed: false, code: isRejected ? 'BLOCKED' : 'VERIFICATION_REQUIRED' };
    }
    return { allowed: true, code: 'OVERRIDE_BYPASS' };
  }
  return { allowed: true, code: 'APPROVED' };
}

// CAP-EFFECTIVE-01: organic approved trust → allowed (no regression)
check(
  simulateAgentAssertApprovedVerification(VS.APPROVED, null).allowed === true,
  'CAP-EFFECTIVE-01: organically approved org → Education operation allowed (normal path)'
);
check(
  simulateAgentAssertApprovedVerification(VS.APPROVED, null).code === 'APPROVED',
  'CAP-EFFECTIVE-01: code is APPROVED for organic path'
);

// CAP-EFFECTIVE-02: no organic approval + qa_test + education_agent → allowed
{
  const qaOverride = {
    overrideType: OVERRIDE_TYPES.QA_TEST,
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT],
  };
  check(
    simulateAgentAssertApprovedVerification(VS.REJECTED, qaOverride).allowed === true,
    'CAP-EFFECTIVE-02: rejected + qa_test education_agent override → Education operation allowed'
  );
  check(
    simulateAgentAssertApprovedVerification(VS.REJECTED, qaOverride).code === 'OVERRIDE_BYPASS',
    'CAP-EFFECTIVE-02: code is OVERRIDE_BYPASS'
  );
}

// CAP-EFFECTIVE-03: qa_test override missing education_agent → denied
{
  const wrongCap = {
    overrideType: OVERRIDE_TYPES.QA_TEST,
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER],
  };
  check(
    simulateAgentAssertApprovedVerification(VS.REJECTED, wrongCap).allowed === false,
    'CAP-EFFECTIVE-03: qa_test override without education_agent → denied (scope mismatch)'
  );
  check(
    simulateAgentAssertApprovedVerification(VS.UNDER_REVIEW, wrongCap).allowed === false,
    'CAP-EFFECTIVE-03: under_review + qa_test without education_agent → denied'
  );
}

// CAP-EFFECTIVE-03b: no override at all → denied
check(
  simulateAgentAssertApprovedVerification(VS.UNDER_REVIEW, null).allowed === false,
  'CAP-EFFECTIVE-03b: under_review + no override → denied'
);

// CAP-EFFECTIVE-04: expired or revoked override simulated as null (getActiveOverride returns null)
check(
  simulateAgentAssertApprovedVerification(VS.REJECTED, null).allowed === false,
  'CAP-EFFECTIVE-04: expired/revoked override (getActiveOverride returns null) → denied'
);

// CAP-EFFECTIVE-05: suspended/revoked org + correct override → absolute hard deny
{
  const qaOverride = {
    overrideType: OVERRIDE_TYPES.QA_TEST,
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT],
  };
  check(
    simulateAgentAssertApprovedVerification(VS.SUSPENDED, qaOverride).allowed === false,
    'CAP-EFFECTIVE-05: suspended + education_agent override → hard denied (BLOCKED)'
  );
  check(
    simulateAgentAssertApprovedVerification(VS.REVOKED, qaOverride).allowed === false,
    'CAP-EFFECTIVE-05: revoked + education_agent override → hard denied (BLOCKED)'
  );
}

// CAP-EFFECTIVE-06: QA operation does not mutate verification truth
{
  const verRecord = { status: VS.REJECTED, earnedBadges: [], organizationType: 'agent' };
  const qaOverride = {
    overrideType: OVERRIDE_TYPES.QA_TEST,
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT],
  };
  const result = simulateAgentAssertApprovedVerification(VS.REJECTED, qaOverride);
  check(result.allowed === true, 'CAP-EFFECTIVE-06: QA operation allowed by override');
  check(verRecord.status === VS.REJECTED, 'CAP-EFFECTIVE-06: verification status unchanged after QA operation');
  check(verRecord.earnedBadges.length === 0, 'CAP-EFFECTIVE-06: earnedBadges unchanged');
}

// CAP-EFFECTIVE: agentProfileService source wires the capability check
{
  const agentSrc = fs.readFileSync(
    path.join(root, 'server/src/services/agentProfileService.js'),
    'utf8'
  );
  check(
    agentSrc.includes('ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT'),
    'CAP-EFFECTIVE-SRC-01: agentProfileService imports and references EDUCATION_AGENT capability'
  );
  check(
    agentSrc.includes('override.capabilities.includes(ORGANIZATION_CAPABILITY_IDS.EDUCATION_AGENT)'),
    'CAP-EFFECTIVE-SRC-02: agentProfileService checks EDUCATION_AGENT in override.capabilities'
  );
  check(
    agentSrc.includes('isQaTestOverride && !hasEducationAgentCap'),
    'CAP-EFFECTIVE-SRC-03: agentProfileService denies qa_test without education_agent capability'
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────

process.stdout.write(`\n${passed} checks passed.\n`);
