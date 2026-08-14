/**
 * Phase 17D-1 — User/Org capability, legacy resolver, global deny, policy.
 * Run: node src/__tests__/phase17d1CapabilityFoundation.test.js
 */
import assert from 'node:assert/strict';
import {
  classifyLegacyUserAccount,
  LEGACY_CLASSIFICATIONS,
} from '../../../shared/capability/legacyUserClassification.js';
import {
  USER_CAPABILITY_IDS,
  isKnownUserCapability,
  getUserCapabilityDefinition,
} from '../../../shared/capability/userCapabilities.js';
import {
  isKnownOrganizationCapability,
} from '../../../shared/capability/organizationCapabilities.js';
import { GRANT_STATUSES, CAPABILITY_SCHEMA_VERSION } from '../../../shared/capability/grantStatus.js';
import {
  POLICY_ACTIONS,
  ACTION_POLICY,
  PERMISSION_POLICY_VERSION,
  getActionPolicy,
} from '../../../shared/capability/permissionPolicy.js';
import { authorizeAction, AUTH_DECISION_CODES, authorizeTenantScope } from '../../../shared/security/authorizeAction.js';
import {
  resolveSecurityAccess,
  SECURITY_ACCESS,
  SECURITY_DENIED_ACTIONS,
} from '../../../shared/security/securityAccess.js';
import { GBS_AUDIT_EVENTS, isKnownGbsAuditEvent, redactAuditMetadata } from '../../../shared/security/gbsAuditEvents.js';
import { isBusinessServicesEnabled } from '../../../shared/gbs/constants.js';
import {
  createUserCapabilityService,
  createMemoryGrantStore,
  stripUntrustedGrantFields,
  bodyAttemptsGrantMassAssignment,
} from '../services/capability/userCapabilityService.js';
import {
  createOrganizationCapabilityService,
  createMemoryOrganizationGrantStore,
} from '../services/capability/organizationCapabilityService.js';
import {
  backfillUserCapabilities,
  parseBackfillMode,
} from '../scripts/backfillUserCapabilities.js';
import {
  backfillOrganizationCapabilities,
  organizationBackfillAction,
  parseBackfillMode as parseOrgMode,
} from '../scripts/backfillOrganizationCapabilities.js';

function asyncOf(items) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

function serviceWithAudit() {
  const events = [];
  const store = createMemoryGrantStore();
  const schema = new Map();
  const svc = createUserCapabilityService({
    grantStore: store,
    markSchemaVersion: async (userId, version) => {
      schema.set(String(userId), version);
    },
    audit: async (evt) => {
      events.push(evt);
    },
  });
  return { svc, store, schema, events };
}

// --- Registry ---
{
  check(isKnownUserCapability('student'), 'student is a known user capability');
  check(isKnownUserCapability('business_client'), 'business_client is a known user capability');
  check(!isKnownUserCapability('admin'), 'admin is not a user capability');
  check(!isKnownUserCapability('unknown'), 'unknown user capability is unknown');
  check(getUserCapabilityDefinition('nope') === null, 'unknown capability definition is null (deny, no coerce)');
  check(isKnownOrganizationCapability('employer'), 'employer org capability exists');
  check(isKnownOrganizationCapability('business_client'), 'org business_client exists');
  check(isKnownOrganizationCapability('business_services_provider'), 'provider org capability exists');
  check(!isKnownOrganizationCapability('agency'), 'organizationType agency is not a capability');
}

// --- 30A legacy classification ---
{
  const student = classifyLegacyUserAccount({ role: 'User', capabilitySchemaVersion: 0 });
  check(student.kind === LEGACY_CLASSIFICATIONS.LEGACY_STUDENT_CUSTOMER, 'legacy User role is student customer');
  check(student.effectiveStudent === true, 'legacy student gets effective student');
  check(student.grantStudentOnBackfill === true, 'legacy student is backfill-eligible');

  for (const role of ['Editor', 'Moderator', 'Admin', 'SuperAdmin']) {
    const staff = classifyLegacyUserAccount({ role, capabilitySchemaVersion: 0 });
    check(staff.kind === LEGACY_CLASSIFICATIONS.LEGACY_STAFF_ONLY, `${role} is staff-only`);
    check(staff.effectiveStudent === false, `${role} gets no automatic student`);
  }

  const ambiguous = classifyLegacyUserAccount({ role: 'employer', capabilitySchemaVersion: 0 });
  check(ambiguous.kind === LEGACY_CLASSIFICATIONS.AMBIGUOUS, 'unknown role is ambiguous');
  check(ambiguous.effectiveStudent === false && ambiguous.failClosed === true, 'ambiguous fail closed');

  const initializedEmpty = classifyLegacyUserAccount({ role: 'User', capabilitySchemaVersion: 1 });
  check(initializedEmpty.kind === LEGACY_CLASSIFICATIONS.INITIALIZED, 'initialized uses persisted grants');
  check(initializedEmpty.effectiveStudent === false, 'initialized does not fall through to legacy student');
  check(initializedEmpty.usePersistedGrants === true, 'initialized uses persisted grants only');
}

// --- Resolver + grants ---
{
  const { svc, schema } = serviceWithAudit();
  const legacyStudent = await svc.resolveUserCapabilities({
    _id: 'u-legacy',
    role: 'User',
    capabilitySchemaVersion: 0,
  });
  check(legacyStudent.active.includes('student'), 'legacy genuine student has effective student');
  check(!legacyStudent.active.includes('business_client'), 'legacy student is not auto business_client');
  check(legacyStudent.source === 'legacy_compatibility', 'legacy uses compatibility source');

  const staff = await svc.resolveUserCapabilities({
    _id: 'u-staff',
    role: 'Admin',
    capabilitySchemaVersion: 0,
  });
  check(!staff.active.includes('student'), 'legacy staff has no student');
  check(!staff.active.includes('business_client'), 'legacy staff has no business_client');

  const amb = await svc.resolveUserCapabilities({
    _id: 'u-amb',
    role: '',
    capabilitySchemaVersion: 0,
  });
  check(amb.failClosed === true && !amb.active.includes('student'), 'ambiguous fail closed / no student');

  await svc.initializeStaffUser({ _id: 'u-init-zero' }, { grantedBy: 'test' });
  check(schema.get('u-init-zero') === CAPABILITY_SCHEMA_VERSION, 'staff init marks schema version');
  const zero = await svc.resolveUserCapabilities({
    _id: 'u-init-zero',
    role: 'User',
    capabilitySchemaVersion: schema.get('u-init-zero'),
  });
  check(!zero.active.includes('student'), 'initialized zero grants does not inherit legacy student');
  check(zero.source === 'persisted', 'initialized zero grants uses persisted source');

  await svc.initializeCustomerUser({ _id: 'u-new' }, { grantedBy: 'system:registration' });
  const neu = await svc.resolveUserCapabilities({
    _id: 'u-new',
    role: 'User',
    capabilitySchemaVersion: schema.get('u-new'),
  });
  check(neu.active.includes('student'), 'new student registration has explicit student');
  check(!neu.active.includes('business_client'), 'new student is not auto business_client');

  const staffCreate = await svc.initializeStaffUser({ _id: 'u-staff-new' });
  check(staffCreate.grantedStudent === false, 'new staff create reports no student grant');
  const staffResolved = await svc.resolveUserCapabilities({
    _id: 'u-staff-new',
    role: 'Admin',
    capabilitySchemaVersion: schema.get('u-staff-new'),
  });
  check(!staffResolved.active.includes('student'), 'new staff has no student grant');
}

// --- Grant status ---
{
  const { svc, events } = serviceWithAudit();
  await svc.grantCapability({
    userId: 'u1',
    capability: 'student',
    grantedBy: 'admin',
    grantReason: 'test',
  });
  let resolved = await svc.resolveUserCapabilities({
    _id: 'u1',
    capabilitySchemaVersion: 1,
  });
  check(svc.hasActiveUserCapability(resolved, 'student'), 'active grant is usable');

  await svc.setStatus({
    userId: 'u1',
    capability: 'student',
    status: GRANT_STATUSES.SUSPENDED,
    actor: 'admin',
    reason: 'abuse',
  });
  resolved = await svc.resolveUserCapabilities({ _id: 'u1', capabilitySchemaVersion: 1 });
  check(!svc.hasActiveUserCapability(resolved, 'student'), 'suspended grant does not authorize');

  await svc.setStatus({
    userId: 'u1',
    capability: 'student',
    status: GRANT_STATUSES.REVOKED,
    actor: 'admin',
    reason: 'left',
  });
  resolved = await svc.resolveUserCapabilities({ _id: 'u1', capabilitySchemaVersion: 1 });
  check(!svc.hasActiveUserCapability(resolved, 'student'), 'revoked grant does not authorize');
  const grants = await svc.listGrants('u1');
  check(grants[0].history.length >= 3, 'grant history is retained');
  check(grants[0].history.some((h) => h.status === 'active'), 'history retains prior active status');
  check(
    events.some((e) => e.action === GBS_AUDIT_EVENTS.USER_CAPABILITY_GRANTED),
    'grant emits user_capability_granted'
  );
  check(
    events.some((e) => e.action === GBS_AUDIT_EVENTS.USER_CAPABILITY_SUSPENDED),
    'suspend emits user_capability_suspended'
  );
  check(
    events.some((e) => e.action === GBS_AUDIT_EVENTS.USER_CAPABILITY_REVOKED),
    'revoke emits user_capability_revoked'
  );

  let unknownDenied = false;
  try {
    await svc.grantCapability({ userId: 'u1', capability: 'wizard', grantedBy: 'x' });
  } catch (err) {
    unknownDenied = err.code === 'unknown_capability';
  }
  check(unknownDenied, 'unknown capability grant is denied');
  check(!svc.hasActiveUserCapability(resolved, 'wizard'), 'unknown capability is not active');
}

// --- Mass assignment / workspace ---
{
  check(bodyAttemptsGrantMassAssignment({ capability: 'student' }), 'capability in body is mass-assignment');
  check(bodyAttemptsGrantMassAssignment({ grantedBy: 'me' }), 'grantedBy in body is mass-assignment');
  const stripped = stripUntrustedGrantFields({
    name: 'Ada',
    capability: 'business_client',
    grantedBy: 'attacker',
    policyVersion: '99',
  });
  check(stripped.name === 'Ada' && stripped.capability === undefined, 'untrusted grant fields stripped');

  const decision = authorizeAction({
    authenticated: true,
    principal: { accountStatus: 'active' },
    requiredUserCapability: 'business_client',
    activeUserCapabilities: [],
    activeWorkspace: 'business_client',
    preference: 'business_client',
  });
  check(decision.allowed === false, 'activeWorkspace without grant is denied');
  check(decision.code === AUTH_DECISION_CODES.CAPABILITY_DENIED, 'workspace preference has zero authority');

  const studentDenied = authorizeAction({
    authenticated: true,
    principal: { accountStatus: 'active' },
    requiredUserCapability: 'student',
    activeUserCapabilities: [],
    activeWorkspace: 'student',
  });
  check(studentDenied.allowed === false, 'activeWorkspace=student without grant is denied');
}

// --- 30B dual capability ---
{
  const studentOnly = authorizeAction({
    authenticated: true,
    principal: { accountStatus: 'active' },
    actionId: POLICY_ACTIONS.STUDENT_PRODUCT_WRITE,
    activeUserCapabilities: ['student'],
  });
  check(studentOnly.allowed, 'student-only may student-write');
  const studentGbs = authorizeAction({
    authenticated: true,
    principal: { accountStatus: 'active' },
    actionId: POLICY_ACTIONS.GBS_BUYER_ACTION,
    activeUserCapabilities: ['student'],
  });
  check(!studentGbs.allowed, 'student-only cannot GBS buyer authorize');

  const bcOnlyStudent = authorizeAction({
    authenticated: true,
    principal: { accountStatus: 'active' },
    actionId: POLICY_ACTIONS.STUDENT_PRODUCT_WRITE,
    activeUserCapabilities: ['business_client'],
  });
  check(!bcOnlyStudent.allowed, 'business-client-only cannot student-write');
  const bcOnlyGbs = authorizeAction({
    authenticated: true,
    principal: { accountStatus: 'active' },
    actionId: POLICY_ACTIONS.GBS_BUYER_ACTION,
    activeUserCapabilities: ['business_client'],
  });
  check(bcOnlyGbs.allowed, 'business-client-only may GBS buyer authorize');

  const dualStudent = authorizeAction({
    authenticated: true,
    principal: { accountStatus: 'active' },
    actionId: POLICY_ACTIONS.STUDENT_PRODUCT_WRITE,
    activeUserCapabilities: ['student', 'business_client'],
  });
  const dualGbs = authorizeAction({
    authenticated: true,
    principal: { accountStatus: 'active' },
    actionId: POLICY_ACTIONS.GBS_BUYER_ACTION,
    activeUserCapabilities: ['student', 'business_client'],
  });
  check(dualStudent.allowed && dualGbs.allowed, 'dual-capable evaluated per action');
}

// --- 30D global security deny ---
{
  const denied = authorizeAction({
    authenticated: true,
    principal: { accountStatus: 'suspended' },
    requiredUserCapability: 'student',
    activeUserCapabilities: ['student'],
  });
  check(!denied.allowed && denied.code === AUTH_DECISION_CODES.SECURITY_DENIED, 'global deny overrides active grant');
  check(SECURITY_DENIED_ACTIONS.includes('READ'), 'deny covers READ');
  check(SECURITY_DENIED_ACTIONS.includes('WRITE'), 'deny covers WRITE');
  check(SECURITY_DENIED_ACTIONS.includes('TRANSITION'), 'deny covers TRANSITION');
  check(SECURITY_DENIED_ACTIONS.includes('GRANT'), 'deny covers GRANT');
  check(SECURITY_DENIED_ACTIONS.includes('ADMINISTRATIVE_ACTION'), 'deny covers ADMINISTRATIVE_ACTION');
  check(SECURITY_DENIED_ACTIONS.includes('DOWNLOAD'), 'deny covers DOWNLOAD');
  const access = resolveSecurityAccess({ accountStatus: 'suspended' });
  check(access.decision === SECURITY_ACCESS.SECURITY_DENIED, 'suspended maps to security_denied');
}

// --- 30E organization ---
{
  const orgStore = createMemoryOrganizationGrantStore();
  const orgSvc = createOrganizationCapabilityService({ grantStore: orgStore, audit: async () => {} });
  const employerOrg = { _id: 'org-e', organizationType: 'employer', status: 'active' };
  let orgCaps = await orgSvc.resolveOrganizationCapabilities(employerOrg);
  check(!orgCaps.active.includes('business_client'), 'employer type does not grant business_client');
  const orgBuyer = authorizeAction({
    authenticated: true,
    principal: { accountStatus: 'active' },
    organization: employerOrg,
    membership: true,
    actionId: POLICY_ACTIONS.GBS_ORGANIZATION_BUYER_ACTION,
    activeUserCapabilities: ['business_client'],
    activeOrganizationCapabilities: orgCaps.active,
  });
  check(!orgBuyer.allowed, 'org type alone cannot GBS org-buyer authorize');

  await orgSvc.grantCapability({
    organizationId: 'org-e',
    capability: 'business_client',
    grantedBy: 'admin',
    grantReason: 'activation',
  });
  orgCaps = await orgSvc.resolveOrganizationCapabilities(employerOrg);
  const orgBuyerOk = authorizeAction({
    authenticated: true,
    principal: { accountStatus: 'active' },
    organization: employerOrg,
    membership: true,
    actionId: POLICY_ACTIONS.GBS_ORGANIZATION_BUYER_ACTION,
    activeUserCapabilities: ['business_client'],
    activeOrganizationCapabilities: orgCaps.active,
  });
  check(orgBuyerOk.allowed, 'user+membership+org business_client may authorize GBS org buyer');

  const noMembership = authorizeAction({
    authenticated: true,
    principal: { accountStatus: 'active' },
    organization: employerOrg,
    membership: false,
    actionId: POLICY_ACTIONS.GBS_ORGANIZATION_BUYER_ACTION,
    activeUserCapabilities: ['business_client'],
    activeOrganizationCapabilities: orgCaps.active,
  });
  check(!noMembership.allowed, 'membership required for org buyer');

  const employerCookie = authorizeAction({
    authenticated: true,
    employerPrincipal: true,
    principal: { accountStatus: 'active' },
    actionId: POLICY_ACTIONS.GBS_BUYER_ACTION,
    activeUserCapabilities: ['business_client'],
  });
  check(!employerCookie.allowed, 'Employer cookie cannot GBS buyer authorize');
  check(employerCookie.code === AUTH_DECISION_CODES.EMPLOYER_COOKIE_DENIED, 'employer cookie deny code');
}

// --- 30H tenant ---
{
  const wrong = authorizeTenantScope({ principalTenantId: 'A', resourceTenantId: 'B' });
  check(!wrong.allowed && wrong.code === AUTH_DECISION_CODES.TENANT_DENIED, 'wrong tenant denied');
  const unknown = authorizeTenantScope({ principalTenantId: '', resourceTenantId: 'B' });
  check(!unknown.allowed, 'unknown tenant denied');
  const ok = authorizeTenantScope({ principalTenantId: 'A', resourceTenantId: 'A' });
  check(ok.allowed, 'same tenant allowed');
}

// --- Policy is source-controlled ---
{
  check(getActionPolicy(POLICY_ACTIONS.STUDENT_APPLICATION_WRITE).requiredUserCapability === 'student', 'student write policy');
  check(getActionPolicy(POLICY_ACTIONS.GBS_BUYER_ACTION).requiredUserCapability === 'business_client', 'gbs buyer policy');
  check(ACTION_POLICY[POLICY_ACTIONS.ADMIN_PROVIDER_VERIFICATION].requireStaffRbac === true, 'admin verification is staff RBAC');
  check(PERMISSION_POLICY_VERSION === '17d-1.0', 'policy version frozen');
  check(isBusinessServicesEnabled({}) === false, 'GBS feature flag default OFF');
  check(isBusinessServicesEnabled({ BUSINESS_SERVICES_ENABLED: '1' }) === true, 'GBS flag explicit ON');
}

// --- Backfill dry-run / not live ---
{
  check(parseBackfillMode([]).dryRun === true, 'user backfill dry-run default');
  check(parseBackfillMode(['--apply']).apply === true, 'user backfill apply flag');
  check(parseOrgMode([]).dryRun === true, 'org backfill dry-run default');

  const users = [
    { _id: '1', role: 'User', capabilitySchemaVersion: 0 },
    { _id: '2', role: 'Admin', capabilitySchemaVersion: 0 },
    { _id: '3', role: 'mystery', capabilitySchemaVersion: 0 },
    { _id: '4', role: 'User', capabilitySchemaVersion: 1 },
  ];
  let granted = 0;
  const summary = await backfillUserCapabilities({
    userCursor: asyncOf(users),
    apply: false,
    grantStudent: async () => {
      granted += 1;
    },
    markInitialized: async () => {},
    log: () => {},
  });
  check(summary.wouldGrantStudent === 1, 'dry-run would grant one student');
  check(summary.wouldInitializeStaff === 1, 'dry-run would init one staff');
  check(summary.skippedAmbiguous === 1, 'dry-run skips ambiguous');
  check(summary.skippedInitialized === 1, 'dry-run skips initialized');
  check(granted === 0, 'dry-run does not write grants');
  check(summary.neverGranted === USER_CAPABILITY_IDS.BUSINESS_CLIENT, 'backfill never grants business_client');

  const orgs = [
    { _id: 'o1', organizationType: 'employer' },
    { _id: 'o2', organizationType: 'agency' },
    { _id: 'o3', organizationType: 'university' },
  ];
  let orgGranted = 0;
  const orgSummary = await backfillOrganizationCapabilities({
    organizationCursor: asyncOf(orgs),
    apply: false,
    grantEmployer: async () => {
      orgGranted += 1;
    },
    log: () => {},
  });
  check(orgSummary.wouldGrantEmployer === 1, 'org dry-run would grant one employer capability');
  check(orgGranted === 0, 'org dry-run does not write');
  check(organizationBackfillAction({ organizationType: 'agency' }).skip === true, 'agency is not auto provider');
  check(organizationBackfillAction({ organizationType: 'employer' }).grant === 'employer', 'employer type maps to employer capability only');
}

// --- Audit redaction ---
{
  check(isKnownGbsAuditEvent('capability_denied'), 'capability_denied is catalogued');
  check(isKnownGbsAuditEvent('security_denied'), 'security_denied is catalogued');
  const redacted = redactAuditMetadata({ password: 'x', jwt: 'y', capability: 'student' });
  check(redacted.password === undefined && redacted.jwt === undefined, 'secrets stripped from audit metadata');
  check(redacted.capability === 'student', 'safe audit fields retained');
}

console.log(`phase17d1CapabilityFoundation.test.js: ${count} assertions passed`);
