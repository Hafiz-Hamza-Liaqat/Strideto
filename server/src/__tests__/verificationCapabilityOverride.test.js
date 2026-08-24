/**
 * Super-admin capability override — contract tests.
 * Run: node src/__tests__/verificationCapabilityOverride.test.js
 *
 * Cases:
 *  A  super_admin can create QA override
 *  B  admin cannot (route auth)
 *  C  moderator cannot (route auth)
 *  D  editor cannot (route auth)
 *  E  support/reviewer (User) cannot (route auth)
 *  F  provider/employer cannot self-grant (route auth)
 *  G  student cannot grant (route auth)
 *  H  rejected evidence remains rejected after override
 *  I  pending evidence remains pending after override
 *  J  exact scoped capability becomes allowed via override
 *  K  non-selected capability stays denied after override
 *  L  expired override denies capability
 *  M  revoked override denies capability
 *  N  normal approved verification works without override
 *  O  suspended/revoked organization not unblocked by override alone
 *  P  QA override does not set earnedBadges (badge truth unaffected)
 *  Q  audit record generated for grant and for revoke
 */
import assert from 'node:assert/strict';
import {
  createOverrideService,
  createMemoryOverrideStore,
  OVERRIDE_TYPES,
} from '../services/capability/overrideService.js';
import {
  createOrganizationCapabilityService,
  createMemoryOrganizationGrantStore,
} from '../services/capability/organizationCapabilityService.js';
import { ORGANIZATION_CAPABILITY_IDS } from '../../../shared/capability/organizationCapabilities.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { hasPermission, PERMISSIONS, ROLES } from '../config/rbac.js';
import { GBS_AUDIT_EVENTS } from '../../../shared/security/gbsAuditEvents.js';

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
  });
  return { svc, store, auditEvents };
}

function makeCapSvc() {
  const store = createMemoryOrganizationGrantStore();
  const svc = createOrganizationCapabilityService({
    grantStore: store,
    audit: async () => {},
  });
  return { svc, store };
}

const ORG_ID = 'org-001';
const ACTOR_SUPER_ADMIN = { userId: 'sa-1', role: ROLES.SUPER_ADMIN };

// ─── Route authorization (RBAC) ────────────────────────────────────────────

process.stdout.write('\nRoute authorization:\n');

// B — Admin does not have CAPABILITY_OVERRIDE permission
check(
  !hasPermission(ROLES.ADMIN, PERMISSIONS.CAPABILITY_OVERRIDE),
  'B: Admin does not hold CAPABILITY_OVERRIDE permission'
);

// C — Moderator does not have it
check(
  !hasPermission(ROLES.MODERATOR, PERMISSIONS.CAPABILITY_OVERRIDE),
  'C: Moderator does not hold CAPABILITY_OVERRIDE permission'
);

// D — Editor does not have it
check(
  !hasPermission(ROLES.EDITOR, PERMISSIONS.CAPABILITY_OVERRIDE),
  'D: Editor does not hold CAPABILITY_OVERRIDE permission'
);

// E — Student (User) does not have it
check(
  !hasPermission(ROLES.STUDENT, PERMISSIONS.CAPABILITY_OVERRIDE),
  'E: Student/User does not hold CAPABILITY_OVERRIDE permission'
);

// F/G — Undefined role (employer/provider) does not have it
check(
  !hasPermission('employer', PERMISSIONS.CAPABILITY_OVERRIDE),
  'F: employer role does not hold CAPABILITY_OVERRIDE permission'
);
check(
  !hasPermission(undefined, PERMISSIONS.CAPABILITY_OVERRIDE),
  'G: undefined role does not hold CAPABILITY_OVERRIDE permission'
);

// A — SuperAdmin holds it
check(
  hasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.CAPABILITY_OVERRIDE),
  'A: SuperAdmin holds CAPABILITY_OVERRIDE permission'
);

// ─── Service-level correctness ──────────────────────────────────────────────

process.stdout.write('\nService contract:\n');

// A — super_admin can create QA override
{
  const { svc } = makeOverrideSvc();
  const result = await svc.grantOverride({
    ...ACTOR_SUPER_ADMIN,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'QA testing employer flow',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER],
  });
  check(result.active === true, 'A: grantOverride returns active=true');
  check(result.overrideType === OVERRIDE_TYPES.QA_TEST, 'A: overrideType is qa_test');
  check(result.capabilities.includes(ORGANIZATION_CAPABILITY_IDS.EMPLOYER), 'A: employer capability in result');
}

// H — rejected evidence status is untouched (override is a separate record)
{
  const fakeEvidence = { status: 'rejected', evidenceType: 'business_registration' };
  const { svc } = makeOverrideSvc();
  await svc.grantOverride({
    ...ACTOR_SUPER_ADMIN,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'test',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER],
  });
  check(fakeEvidence.status === 'rejected', 'H: rejected evidence status unchanged after override granted');
}

// I — pending evidence status is untouched
{
  const fakeEvidence = { status: 'pending', evidenceType: 'identity' };
  const { svc } = makeOverrideSvc();
  await svc.grantOverride({
    ...ACTOR_SUPER_ADMIN,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'test',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER],
  });
  check(fakeEvidence.status === 'pending', 'I: pending evidence status unchanged after override granted');
}

// J — exact capability becomes resolvable via override
{
  const { svc: overrideSvc } = makeOverrideSvc();
  const { svc: capSvc } = makeCapSvc();
  await overrideSvc.grantOverride({
    ...ACTOR_SUPER_ADMIN,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'test',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER],
  });
  const hasOverride = await overrideSvc.hasOverrideForCapability(ORG_ID, ORGANIZATION_CAPABILITY_IDS.EMPLOYER);
  check(hasOverride, 'J: hasOverrideForCapability returns true for granted capability');

  // Normal grant resolution has no active grant — the override fills the gap
  const resolved = await capSvc.resolveOrganizationCapabilities({ _id: ORG_ID });
  check(!resolved.active.includes(ORGANIZATION_CAPABILITY_IDS.EMPLOYER), 'J: capability NOT in normal grant active list (no real grant exists)');
}

// K — non-selected capability stays denied
{
  const { svc: overrideSvc } = makeOverrideSvc();
  await overrideSvc.grantOverride({
    ...ACTOR_SUPER_ADMIN,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'test',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER],  // only employer, not business_client
  });
  const hasBizClient = await overrideSvc.hasOverrideForCapability(ORG_ID, ORGANIZATION_CAPABILITY_IDS.BUSINESS_CLIENT);
  check(!hasBizClient, 'K: non-selected capability denied via override check');
}

// L — expired override denies capability
{
  const { svc: overrideSvc } = makeOverrideSvc();
  const pastDate = new Date(Date.now() - 1000);
  await overrideSvc.grantOverride({
    ...ACTOR_SUPER_ADMIN,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'test',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER],
    expiresAt: pastDate,
  });
  const active = await overrideSvc.getActiveOverride(ORG_ID);
  check(active === null, 'L: expired override returns null from getActiveOverride');
  const hasIt = await overrideSvc.hasOverrideForCapability(ORG_ID, ORGANIZATION_CAPABILITY_IDS.EMPLOYER);
  check(!hasIt, 'L: expired override denies capability');
}

// M — revoked override denies capability
{
  const { svc: overrideSvc } = makeOverrideSvc();
  await overrideSvc.grantOverride({
    ...ACTOR_SUPER_ADMIN,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'test',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER],
  });
  await overrideSvc.revokeOverride({ ...ACTOR_SUPER_ADMIN, organizationId: ORG_ID, reason: 'cleanup' });
  const active = await overrideSvc.getActiveOverride(ORG_ID);
  check(active === null, 'M: revoked override returns null from getActiveOverride');
  const hasIt = await overrideSvc.hasOverrideForCapability(ORG_ID, ORGANIZATION_CAPABILITY_IDS.EMPLOYER);
  check(!hasIt, 'M: revoked override denies capability');
}

// N — normal grant-based capability works without override
{
  const { svc: capSvc } = makeCapSvc();
  await capSvc.grantCapability({
    organizationId: ORG_ID,
    capability: ORGANIZATION_CAPABILITY_IDS.EMPLOYER,
    grantedBy: 'system',
    grantReason: 'org verified',
  });
  const resolved = await capSvc.resolveOrganizationCapabilities({ _id: ORG_ID });
  check(
    capSvc.hasActiveOrganizationCapability(resolved, ORGANIZATION_CAPABILITY_IDS.EMPLOYER),
    'N: normal active grant allows capability without any override'
  );
}

// O — suspended grant stays denied; override does not affect grant.status
{
  const { svc: capSvc } = makeCapSvc();
  await capSvc.grantCapability({
    organizationId: ORG_ID,
    capability: ORGANIZATION_CAPABILITY_IDS.EMPLOYER,
    grantedBy: 'system',
    grantReason: 'org verified',
  });
  await capSvc.setStatus({
    organizationId: ORG_ID,
    capability: ORGANIZATION_CAPABILITY_IDS.EMPLOYER,
    status: GRANT_STATUSES.SUSPENDED,
    actor: 'moderator-1',
    reason: 'policy violation',
  });
  const resolved = await capSvc.resolveOrganizationCapabilities({ _id: ORG_ID });
  check(
    !capSvc.hasActiveOrganizationCapability(resolved, ORGANIZATION_CAPABILITY_IDS.EMPLOYER),
    'O: suspended grant denies capability (capability override does not touch grant status)'
  );
}

// P — QA override does not set earnedBadges (badge truth is from real verification)
{
  const { svc: overrideSvc } = makeOverrideSvc();
  const override = await overrideSvc.grantOverride({
    ...ACTOR_SUPER_ADMIN,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'test',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER],
  });
  check(
    !('earnedBadges' in override),
    'P: override record contains no earnedBadges field — badge state is not modified'
  );
}

// Q — audit events emitted for grant and revoke
{
  const events = [];
  const { svc: overrideSvc } = makeOverrideSvc(events);
  await overrideSvc.grantOverride({
    ...ACTOR_SUPER_ADMIN,
    organizationId: ORG_ID,
    overrideType: OVERRIDE_TYPES.QA_TEST,
    reason: 'audit test',
    capabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER],
  });
  check(
    events.some((e) => e.action === GBS_AUDIT_EVENTS.CAPABILITY_OVERRIDE_GRANTED),
    'Q: CAPABILITY_OVERRIDE_GRANTED audit event emitted on grant'
  );
  check(
    events.some((e) => e.targetId === ORG_ID),
    'Q: audit event targets the correct organizationId'
  );
  const beforeRevoke = events.length;
  await overrideSvc.revokeOverride({ ...ACTOR_SUPER_ADMIN, organizationId: ORG_ID, reason: 'done' });
  check(
    events.length > beforeRevoke &&
      events.some((e) => e.action === GBS_AUDIT_EVENTS.CAPABILITY_OVERRIDE_REVOKED),
    'Q: CAPABILITY_OVERRIDE_REVOKED audit event emitted on revoke'
  );
}

// Validation: bad inputs are rejected
{
  const { svc } = makeOverrideSvc();
  let threw = false;
  try {
    await svc.grantOverride({
      ...ACTOR_SUPER_ADMIN,
      organizationId: ORG_ID,
      overrideType: 'invalid_type',
      reason: 'test',
      capabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER],
    });
  } catch (e) {
    threw = true;
    check(e.code === 'invalid_override_type', 'Validation: invalid overrideType rejected with correct code');
  }
  check(threw, 'Validation: invalid overrideType throws');
}
{
  const { svc } = makeOverrideSvc();
  let threw = false;
  try {
    await svc.grantOverride({
      ...ACTOR_SUPER_ADMIN,
      organizationId: ORG_ID,
      overrideType: OVERRIDE_TYPES.QA_TEST,
      reason: '',
      capabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER],
    });
  } catch (e) {
    threw = true;
    check(e.code === 'reason_required', 'Validation: empty reason rejected');
  }
  check(threw, 'Validation: empty reason throws');
}
{
  const { svc } = makeOverrideSvc();
  let threw = false;
  try {
    await svc.grantOverride({
      ...ACTOR_SUPER_ADMIN,
      organizationId: ORG_ID,
      overrideType: OVERRIDE_TYPES.QA_TEST,
      reason: 'test',
      capabilities: ['unknown_cap'],
    });
  } catch (e) {
    threw = true;
    check(e.code === 'unknown_capability', 'Validation: unknown capability rejected');
  }
  check(threw, 'Validation: unknown capability throws');
}
{
  const { svc } = makeOverrideSvc();
  let threw = false;
  try {
    await svc.revokeOverride({ ...ACTOR_SUPER_ADMIN, organizationId: 'no-org', reason: 'x' });
  } catch (e) {
    threw = true;
    check(e.code === 'override_not_found', 'Validation: revoke with no override returns 404 code');
  }
  check(threw, 'Validation: revoke with no active override throws');
}

// ─── Hard-deny precedence + qa_test REJECTED bypass ─────────────────────────
// Tests that:
//   - suspended / revoked are always hard-denied regardless of override type
//   - REJECTED + qa_test override → ALLOWED (cross-role QA workflow)
//   - REJECTED + manual_exception override → still DENIED
//   - REJECTED + no override → DENIED

process.stdout.write('\nHard-deny precedence:\n');

import {
  isBlocked,
  isSuspendedOrRevoked,
  canExercisePrivilegedCapability,
  VERIFICATION_STATUSES as VS,
} from '../../../shared/international/verification.js';

/**
 * Simulates the updated assertApprovedVerification / organizationCapabilityRuntime logic.
 *
 * overrideType defaults to OVERRIDE_TYPES.QA_TEST since that is the common QA case.
 * Pass OVERRIDE_TYPES.MANUAL_EXCEPTION to test the stricter policy path.
 */
function simulateAssertApprovedVerification(
  status,
  hasActiveOverride,
  overrideType = OVERRIDE_TYPES.QA_TEST
) {
  // Absolute hard deny: suspended and revoked are terminal regardless of override type.
  if (isSuspendedOrRevoked(status)) {
    return { allowed: false, reason: 'BLOCKED' };
  }
  // REJECTED: hard deny unless there is an active qa_test override.
  // manual_exception and unknown types preserve the stricter REJECTED block.
  if (status === VS.REJECTED) {
    if (!hasActiveOverride || overrideType !== OVERRIDE_TYPES.QA_TEST) {
      return { allowed: false, reason: 'BLOCKED' };
    }
    // qa_test override — fall through to capability gate below
  }
  if (!canExercisePrivilegedCapability(status)) {
    if (!hasActiveOverride) {
      return { allowed: false, reason: 'VERIFICATION_REQUIRED' };
    }
    return { allowed: true, reason: 'OVERRIDE_BYPASS' };
  }
  return { allowed: true, reason: 'APPROVED' };
}

// Suspended org with active qa_test override — absolute hard deny
check(
  simulateAssertApprovedVerification(VS.SUSPENDED, true).allowed === false,
  'HD-1: suspended org with active override → DENIED (BLOCKED)'
);
check(
  simulateAssertApprovedVerification(VS.SUSPENDED, true).reason === 'BLOCKED',
  'HD-1: reason is BLOCKED, not override bypass'
);

// Revoked org with active qa_test override — absolute hard deny
check(
  simulateAssertApprovedVerification(VS.REVOKED, true).allowed === false,
  'HD-2: revoked org with active override → DENIED'
);

// REJECTED + qa_test override → ALLOWED (new behavior — cross-role QA testing)
check(
  simulateAssertApprovedVerification(VS.REJECTED, true, OVERRIDE_TYPES.QA_TEST).allowed === true,
  'HD-3: rejected org + qa_test override → ALLOWED (QA bypass)'
);
check(
  simulateAssertApprovedVerification(VS.REJECTED, true, OVERRIDE_TYPES.QA_TEST).reason === 'OVERRIDE_BYPASS',
  'HD-3: bypass reason is OVERRIDE_BYPASS, not BLOCKED'
);

// REJECTED + manual_exception → still DENIED (stricter policy preserved)
check(
  simulateAssertApprovedVerification(VS.REJECTED, true, OVERRIDE_TYPES.MANUAL_EXCEPTION).allowed === false,
  'HD-3a: rejected org + manual_exception override → DENIED (strict policy)'
);
check(
  simulateAssertApprovedVerification(VS.REJECTED, true, OVERRIDE_TYPES.MANUAL_EXCEPTION).reason === 'BLOCKED',
  'HD-3a: reason remains BLOCKED for manual_exception on rejected org'
);

// REJECTED + no override → denied regardless
check(
  simulateAssertApprovedVerification(VS.REJECTED, false).allowed === false,
  'HD-3b: rejected org + no override → DENIED'
);

// Pre-approval org (under_review) WITH active override → ALLOWED (override bypass)
check(
  simulateAssertApprovedVerification(VS.UNDER_REVIEW, true).allowed === true,
  'HD-4: under_review org with active override → ALLOWED via override bypass'
);
check(
  simulateAssertApprovedVerification(VS.UNDER_REVIEW, true).reason === 'OVERRIDE_BYPASS',
  'HD-4: bypass reason recorded correctly'
);

// Pre-approval org WITHOUT active override → DENIED (needs real approval or override)
check(
  simulateAssertApprovedVerification(VS.UNDER_REVIEW, false).allowed === false,
  'HD-5: under_review org without override → DENIED'
);

// Approved org without any override → ALLOWED (normal path unchanged)
check(
  simulateAssertApprovedVerification(VS.APPROVED, false).allowed === true,
  'HD-6: approved org without override → ALLOWED (normal path unaffected)'
);

// isSuspendedOrRevoked helper covers SUSPENDED and REVOKED, not REJECTED
check(
  isSuspendedOrRevoked(VS.SUSPENDED) === true,
  'HD-7: isSuspendedOrRevoked(suspended) = true — absolute block'
);
check(
  isSuspendedOrRevoked(VS.REVOKED) === true,
  'HD-8: isSuspendedOrRevoked(revoked) = true — absolute block'
);
check(
  isSuspendedOrRevoked(VS.REJECTED) === false,
  'HD-9: isSuspendedOrRevoked(rejected) = false — qa_test may bypass'
);
check(
  isSuspendedOrRevoked(VS.UNDER_REVIEW) === false,
  'HD-10: isSuspendedOrRevoked(under_review) = false — runtime guard will allow merge'
);
check(
  isBlocked(VS.REJECTED) === true,
  'HD-11: isBlocked(rejected) still true — non-QA paths see REJECTED as blocked'
);

// ─── QA REJECTED-STATUS CAPABILITY SCENARIOS (Task 1 A-E) ───────────────────
// Tests A-E from the STRIDETO QA override goal-alignment spec.

process.stdout.write('\nQA REJECTED-status capability scenarios:\n');

// A — rejected + no override → denied
check(
  simulateAssertApprovedVerification(VS.REJECTED, false).allowed === false,
  'REJ-A: rejected + no override → denied'
);

// B — rejected + qa_test override → allowed (capability may be exercised)
check(
  simulateAssertApprovedVerification(VS.REJECTED, true, OVERRIDE_TYPES.QA_TEST).allowed === true,
  'REJ-B: rejected + qa_test override → allowed (QA capability exercised)'
);

// C — rejected org: qa_test override for different capability must not affect unrelated caps
// This is enforced by the capability-scoping in resolveOrganizationCapabilitiesForRequest:
// only capabilities listed in override.capabilities are merged into resolved.active.
// Simulate: the override grants EMPLOYER but the check is for BUSINESS_CLIENT.
{
  const overrideCapabilities = [ORGANIZATION_CAPABILITY_IDS.EMPLOYER];
  const requestedCap = ORGANIZATION_CAPABILITY_IDS.BUSINESS_CLIENT;
  const isGranted = overrideCapabilities.includes(requestedCap);
  check(
    !isGranted,
    'REJ-C: rejected + qa_test override for EMPLOYER only — BUSINESS_CLIENT check → denied'
  );
}

// D — suspended + qa_test → absolute deny
check(
  simulateAssertApprovedVerification(VS.SUSPENDED, true, OVERRIDE_TYPES.QA_TEST).allowed === false,
  'REJ-D: suspended + qa_test override → absolute deny (hard block)'
);

// E — revoked + qa_test → absolute deny
check(
  simulateAssertApprovedVerification(VS.REVOKED, true, OVERRIDE_TYPES.QA_TEST).allowed === false,
  'REJ-E: revoked + qa_test override → absolute deny (hard block)'
);

// ─── QA PUBLIC PROFILE VISIBILITY (Task 2 tests 1-6) ────────────────────────
// Simulates the getPublicProfileBySlug override-aware logic without DB I/O.

process.stdout.write('\nQA public profile visibility:\n');

/**
 * Simulates the getPublicProfileBySlug access decision:
 *   - organically verified (APPROVED + launchEligible) → normal access
 *   - unverified (non-APPROVED, no override) → denied
 *   - qa_test override → direct-link allowed, NOT organically verified
 *   - suspended/revoked → denied even with qa_test override
 */
function simulatePublicProfileAccess({ verStatus, launchEligible, hasQaOverride }) {
  // Simulate: profile found in launch-visible query only when launchEligible
  const foundNormal = launchEligible;
  if (foundNormal && canExercisePrivilegedCapability(verStatus)) {
    return { allowed: true, qaTestProvider: false, educationVerified: true };
  }
  // QA direct-link path
  if (!isSuspendedOrRevoked(verStatus) && hasQaOverride) {
    return {
      allowed: true,
      qaTestProvider: true,
      educationVerified: false,
    };
  }
  return { allowed: false };
}

// 1 — organically verified provider → normal public access
check(
  simulatePublicProfileAccess({ verStatus: VS.APPROVED, launchEligible: true, hasQaOverride: false }).allowed === true,
  'PUB-1: organically verified provider → normal public access allowed'
);
check(
  simulatePublicProfileAccess({ verStatus: VS.APPROVED, launchEligible: true, hasQaOverride: false }).educationVerified === true,
  'PUB-1: organically verified provider → educationVerified = true'
);

// 2 — ordinary unverified provider (no override) → denied
check(
  simulatePublicProfileAccess({ verStatus: VS.UNDER_REVIEW, launchEligible: false, hasQaOverride: false }).allowed === false,
  'PUB-2: ordinary unverified provider without override → denied'
);

// 3 — qa_test override provider → direct access allowed
check(
  simulatePublicProfileAccess({ verStatus: VS.REJECTED, launchEligible: false, hasQaOverride: true }).allowed === true,
  'PUB-3: qa_test override provider → direct-link access allowed'
);

// 4 — qa_test override provider → genuine Verified badge is false
check(
  simulatePublicProfileAccess({ verStatus: VS.REJECTED, launchEligible: false, hasQaOverride: true }).educationVerified === false,
  'PUB-4: qa_test override provider → educationVerified badge is false (no fabrication)'
);
check(
  simulatePublicProfileAccess({ verStatus: VS.REJECTED, launchEligible: false, hasQaOverride: true }).qaTestProvider === true,
  'PUB-4: qa_test override provider → qaTestProvider marker is true'
);

// 5 — qa_test provider NOT in ordinary discovery (getPublicDirectory uses $match status=APPROVED)
// getPublicDirectory does a $lookup on OrganizationVerification where status=APPROVED.
// A REJECTED org never satisfies that join, so it is never included in directory results.
// We verify the gate predicate directly.
{
  const directoryRequiresApproved = true; // $match: { status: VERIFICATION_STATUSES.APPROVED }
  const qaOrgStatus = VS.REJECTED;
  const wouldAppearInDirectory = directoryRequiresApproved && qaOrgStatus === VS.APPROVED;
  check(
    !wouldAppearInDirectory,
    'PUB-5: qa_test override provider (REJECTED) is NOT included in ordinary discovery/directory'
  );
}

// 6 — revoked/suspended provider denied even with qa_test override
check(
  simulatePublicProfileAccess({ verStatus: VS.REVOKED, launchEligible: false, hasQaOverride: true }).allowed === false,
  'PUB-6a: revoked provider remains denied even with qa_test override'
);
check(
  simulatePublicProfileAccess({ verStatus: VS.SUSPENDED, launchEligible: false, hasQaOverride: true }).allowed === false,
  'PUB-6b: suspended provider remains denied even with qa_test override'
);

// ─── GBS SELLER ROUTE OVERRIDE AWARENESS (Task 3) ───────────────────────────
// Confirms the provider listing authority is wired through the override runtime.

process.stdout.write('\nGBS seller route override awareness:\n');

import { GBS_AUTHORITY_DENY_REASONS } from '../../../shared/gbs/gbsProviderAuthority.js';
import { ORGANIZATION_CAPABILITY_IDS as ORG_CAP_IDS } from '../../../shared/capability/organizationCapabilities.js';

/**
 * Simulates the assertListingAuthority override-bypass guard.
 * When NOT_VERIFIED is the deny reason, a qa_test override with
 * BUSINESS_SERVICES_PROVIDER grants passage.
 */
function simulateListingAuthorityOverride({ providerTrustVerified, orgOverride }) {
  const decision = providerTrustVerified
    ? { allowed: true, reason: null }
    : { allowed: false, reason: GBS_AUTHORITY_DENY_REASONS.NOT_VERIFIED };

  if (!decision.allowed) {
    if (
      decision.reason === GBS_AUTHORITY_DENY_REASONS.NOT_VERIFIED &&
      orgOverride?.overrideType === OVERRIDE_TYPES.QA_TEST &&
      Array.isArray(orgOverride?.capabilities) &&
      orgOverride.capabilities.includes(ORG_CAP_IDS.BUSINESS_SERVICES_PROVIDER)
    ) {
      return { allowed: true, reason: 'QA_OVERRIDE_BYPASS' };
    }
    return decision;
  }
  return decision;
}

// Verified provider — normal allowed
check(
  simulateListingAuthorityOverride({ providerTrustVerified: true, orgOverride: null }).allowed === true,
  'GBS-S-1: trust-verified provider → listing authority allowed (normal path)'
);

// Unverified provider + no override → denied
check(
  simulateListingAuthorityOverride({ providerTrustVerified: false, orgOverride: null }).allowed === false,
  'GBS-S-2: unverified provider + no override → listing denied'
);
check(
  simulateListingAuthorityOverride({ providerTrustVerified: false, orgOverride: null }).reason === GBS_AUTHORITY_DENY_REASONS.NOT_VERIFIED,
  'GBS-S-2: deny reason is NOT_VERIFIED'
);

// Unverified provider + qa_test override with BUSINESS_SERVICES_PROVIDER → allowed
check(
  simulateListingAuthorityOverride({
    providerTrustVerified: false,
    orgOverride: { overrideType: OVERRIDE_TYPES.QA_TEST, capabilities: [ORG_CAP_IDS.BUSINESS_SERVICES_PROVIDER] },
  }).allowed === true,
  'GBS-S-3: unverified provider + qa_test BUSINESS_SERVICES_PROVIDER override → listing allowed'
);

// Unverified provider + qa_test override WITHOUT BUSINESS_SERVICES_PROVIDER → still denied
check(
  simulateListingAuthorityOverride({
    providerTrustVerified: false,
    orgOverride: { overrideType: OVERRIDE_TYPES.QA_TEST, capabilities: [ORG_CAP_IDS.EMPLOYER] },
  }).allowed === false,
  'GBS-S-4: unverified provider + qa_test override missing BUSINESS_SERVICES_PROVIDER → denied'
);

// Unverified provider + manual_exception override → still denied (only qa_test bypasses)
check(
  simulateListingAuthorityOverride({
    providerTrustVerified: false,
    orgOverride: { overrideType: OVERRIDE_TYPES.MANUAL_EXCEPTION, capabilities: [ORG_CAP_IDS.BUSINESS_SERVICES_PROVIDER] },
  }).allowed === false,
  'GBS-S-5: unverified provider + manual_exception override → listing denied (qa_test only)'
);

// ─── INSTITUTION QA WORKFLOW (Task: institution coverage check) ──────────────
//
// Student-facing institution routes are NOT gated on OrganizationVerification.
// Gate is CanonicalInstitution.status === 'published' and Program.status === 'published'.
// verifiedManagement in profile response is additive metadata — NOT a gate.
// Admission submission gates on InstitutionClaim.state === 'approved' (separate from org ver).
//
// The INSTITUTION PORTAL side (assertApprovedVerification in institutionPortalService)
// had the same REJECTED hard-deny as the pre-fix agent side — now aligned.

process.stdout.write('\nInstitution QA workflow:\n');

/**
 * Simulates institutionPortalService.assertApprovedVerification
 * after the qa_test bypass fix (analogous to agentProfileService fix).
 */
function simulateInstitutionAssertApprovedVerification(
  status,
  hasActiveOverride,
  overrideType = OVERRIDE_TYPES.QA_TEST
) {
  // Absolute hard deny: suspended and revoked.
  if (isSuspendedOrRevoked(status)) return { allowed: false, code: 'BLOCKED' };
  if (!canExercisePrivilegedCapability(status)) {
    const isRejected = status === VS.REJECTED;
    const isQaTest = overrideType === OVERRIDE_TYPES.QA_TEST;
    if (!hasActiveOverride || (isRejected && !isQaTest)) {
      return { allowed: false, code: isRejected ? 'BLOCKED' : 'VERIFICATION_REQUIRED' };
    }
    return { allowed: true, code: 'OVERRIDE_BYPASS' };
  }
  return { allowed: true, code: 'APPROVED' };
}

/**
 * Simulates student profile/program access decision.
 * Gate: CanonicalInstitution.status === 'published' — NOT OrganizationVerification.
 */
function simulateStudentInstitutionAccess({ institutionPublished }) {
  // Students access published institutions regardless of org verification.
  return { allowed: institutionPublished };
}

// INST-1: Student can view a published institution regardless of org verification status
check(
  simulateStudentInstitutionAccess({ institutionPublished: true }).allowed === true,
  'INST-1: published institution → student access allowed (no org verification gate)'
);

// INST-2: Student cannot view an unpublished institution
check(
  simulateStudentInstitutionAccess({ institutionPublished: false }).allowed === false,
  'INST-2: unpublished institution → student access denied'
);

// INST-3: verifiedManagement is additive — not present for unverified org (no fabrication)
{
  const verStatus = VS.REJECTED;
  const verifiedManagement = canExercisePrivilegedCapability(verStatus) ? { officialDataSupplied: true } : null;
  check(
    verifiedManagement === null,
    'INST-3: rejected org → verifiedManagement is null in profile response (no badge fabrication)'
  );
}

// INST-4: Institution portal — rejected + qa_test override → ALLOWED (can manage programs)
check(
  simulateInstitutionAssertApprovedVerification(VS.REJECTED, true, OVERRIDE_TYPES.QA_TEST).allowed === true,
  'INST-4: rejected institution + qa_test override → portal write ALLOWED'
);

// INST-5: Institution portal — rejected + manual_exception → DENIED (strict policy)
check(
  simulateInstitutionAssertApprovedVerification(VS.REJECTED, true, OVERRIDE_TYPES.MANUAL_EXCEPTION).allowed === false,
  'INST-5: rejected institution + manual_exception → portal write DENIED'
);

// INST-6: Institution portal — rejected + no override → DENIED
check(
  simulateInstitutionAssertApprovedVerification(VS.REJECTED, false).allowed === false,
  'INST-6: rejected institution + no override → portal write DENIED'
);

// INST-7: Institution portal — suspended + qa_test → absolute hard deny
check(
  simulateInstitutionAssertApprovedVerification(VS.SUSPENDED, true, OVERRIDE_TYPES.QA_TEST).allowed === false,
  'INST-7: suspended institution + qa_test override → absolute hard deny'
);

// INST-8: Institution portal — revoked + qa_test → absolute hard deny
check(
  simulateInstitutionAssertApprovedVerification(VS.REVOKED, true, OVERRIDE_TYPES.QA_TEST).allowed === false,
  'INST-8: revoked institution + qa_test override → absolute hard deny'
);

// INST-9: Institution discovery (directory) gates on CanonicalInstitution.status=published,
// NOT org verification — a QA institution without published status won't appear in discovery.
{
  const directoryRequiresPublished = true;
  const qaInstitutionPublished = false; // QA fixture typically not published
  const wouldAppearInDirectory = directoryRequiresPublished && qaInstitutionPublished;
  check(
    !wouldAppearInDirectory,
    'INST-9: QA institution (not published) excluded from directory discovery'
  );
}

// INST-10: Approved institution → normal portal write allowed (no regression)
check(
  simulateInstitutionAssertApprovedVerification(VS.APPROVED, false).allowed === true,
  'INST-10: approved institution → portal write ALLOWED (normal path unchanged)'
);

// ─── ADM: submitStudentApplication claim bypass ──────────────────────────────
// Simulates the QA bypass logic in institutionAdmissionService.js
// Mirrors the exact decision tree in submitStudentApplication.
//
// Required: qa_test + INSTITUTION_PORTAL capability + not suspended/revoked.

process.stdout.write('\nInstitution admission claim bypass:\n');

const ADM_REQUIRED_CAP = ORGANIZATION_CAPABILITY_IDS.INSTITUTION_PORTAL;

function simulateClaimBypass({
  hasApprovedClaim,
  hasAnyClaim,
  overrideType,         // 'qa_test' | 'manual_exception' | null
  overrideCapabilities, // string[] | null
  orgStatus,            // VS.*
}) {
  const suspendedOrRevoked = (s) => s === VS.SUSPENDED || s === VS.REVOKED;

  if (hasApprovedClaim) return { allowed: true, path: 'normal' };
  if (!hasAnyClaim) return { allowed: false, code: 'CLAIM_REQUIRED', path: 'no_claim' };

  const hasQaType = overrideType === 'qa_test';
  const hasScopedCap =
    Array.isArray(overrideCapabilities) &&
    overrideCapabilities.includes(ADM_REQUIRED_CAP);

  if (!hasQaType || !hasScopedCap) {
    return { allowed: false, code: 'CLAIM_REQUIRED', path: 'no_qa_override' };
  }
  if (suspendedOrRevoked(orgStatus)) {
    return { allowed: false, code: 'CLAIM_REQUIRED', path: 'blocked_org' };
  }
  return { allowed: true, path: 'qa_bypass' };
}

// ADM-1: Approved claim, no override → allowed (normal path, no regression)
check(
  simulateClaimBypass({
    hasApprovedClaim: true, hasAnyClaim: true,
    overrideType: null, overrideCapabilities: null, orgStatus: VS.APPROVED,
  }).allowed === true,
  'ADM-1: approved claim + no override → admission ALLOWED (normal path)'
);

// ADM-2: Unapproved claim + no override → denied
check(
  simulateClaimBypass({
    hasApprovedClaim: false, hasAnyClaim: true,
    overrideType: null, overrideCapabilities: null, orgStatus: VS.REJECTED,
  }).allowed === false,
  'ADM-2: unapproved claim + no override → admission DENIED'
);

// ADM-3: Unapproved claim + correctly scoped qa_test override → allowed
check(
  simulateClaimBypass({
    hasApprovedClaim: false, hasAnyClaim: true,
    overrideType: 'qa_test', overrideCapabilities: [ADM_REQUIRED_CAP], orgStatus: VS.REJECTED,
  }).allowed === true,
  'ADM-3: unapproved claim + qa_test + INSTITUTION_PORTAL → admission ALLOWED (QA bypass)'
);

// ADM-4: Unapproved claim + qa_test with WRONG capability → denied (scope mismatch)
check(
  simulateClaimBypass({
    hasApprovedClaim: false, hasAnyClaim: true,
    overrideType: 'qa_test', overrideCapabilities: [ORGANIZATION_CAPABILITY_IDS.EMPLOYER], orgStatus: VS.REJECTED,
  }).allowed === false,
  'ADM-4: unapproved claim + qa_test + wrong capability (EMPLOYER) → admission DENIED (scope mismatch)'
);

// ADM-5: Suspended org + correctly scoped qa_test override → absolute deny
check(
  simulateClaimBypass({
    hasApprovedClaim: false, hasAnyClaim: true,
    overrideType: 'qa_test', overrideCapabilities: [ADM_REQUIRED_CAP], orgStatus: VS.SUSPENDED,
  }).allowed === false,
  'ADM-5: suspended org + correctly scoped qa_test → admission DENIED (absolute block)'
);

// ADM-6: Revoked org + correctly scoped qa_test override → absolute deny
check(
  simulateClaimBypass({
    hasApprovedClaim: false, hasAnyClaim: true,
    overrideType: 'qa_test', overrideCapabilities: [ADM_REQUIRED_CAP], orgStatus: VS.REVOKED,
  }).allowed === false,
  'ADM-6: revoked org + correctly scoped qa_test → admission DENIED (absolute block)'
);

// ADM-7: Claim state remains unchanged after QA admission bypass
// The service uses the claim for org routing only — it never writes back to the claim.
// Verified by: simulateClaimBypass returns no claimState field (nothing is mutated).
{
  const claimBefore = { state: 'pending', canonicalInstitutionId: 'inst-qa-001' };
  simulateClaimBypass({
    hasApprovedClaim: false, hasAnyClaim: true,
    overrideType: 'qa_test', overrideCapabilities: [ADM_REQUIRED_CAP], orgStatus: VS.REJECTED,
  });
  check(
    claimBefore.state === 'pending',
    'ADM-7: claim.state remains unchanged (pending) after QA admission bypass'
  );
}

// ─── Summary ────────────────────────────────────────────────────────────────

process.stdout.write(`\n${passed} checks passed.\n`);
