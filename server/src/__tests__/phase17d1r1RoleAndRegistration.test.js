/**
 * Phase 17D-1R1 — role-transition capability integrity + registration atomicity.
 * Run: node src/__tests__/phase17d1r1RoleAndRegistration.test.js
 */
import assert from 'node:assert/strict';
import {
  createUserCapabilityService,
  createMemoryGrantStore,
  REGISTRATION_AUTHORITY_INCOMPLETE,
} from '../services/capability/userCapabilityService.js';
import { CAPABILITY_SCHEMA_VERSION, GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { USER_CAPABILITY_IDS } from '../../../shared/capability/userCapabilities.js';
import {
  DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
  ROLE_CAPABILITY_TRANSITION_MODES,
  resolveRoleCapabilityTransitionMode,
} from '../../../shared/capability/roleCapabilityTransition.js';
import { GBS_AUDIT_EVENTS } from '../../../shared/security/gbsAuditEvents.js';
import { shouldRetryCapabilityEraRegistration } from '../../../shared/capability/legacyUserClassification.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

function serviceWith({ failGrant = false, failMark = false } = {}) {
  const events = [];
  const store = createMemoryGrantStore();
  const schema = new Map();
  const users = new Map();
  const initState = new Map();
  const inner = createMemoryGrantStore();
  const grantStore = {
    findByUser: (...args) => (failGrant ? Promise.reject(new Error('grant_read_failed')) : inner.findByUser(...args)),
    findOne: (...args) => inner.findOne(...args),
    async upsert(doc) {
      if (failGrant) throw Object.assign(new Error('grant_write_failed'), { code: 'grant_write_failed' });
      return inner.upsert(doc);
    },
  };
  const svc = createUserCapabilityService({
    grantStore: failGrant ? grantStore : store,
    markSchemaVersion: async (userId, version) => {
      if (failMark) throw Object.assign(new Error('schema_write_failed'), { code: 'schema_write_failed' });
      schema.set(String(userId), version);
      initState.set(String(userId), 'ready');
    },
    markInitializationState: async (userId, state) => {
      initState.set(String(userId), state);
    },
    loadUser: async (userId) => users.get(String(userId)) || null,
    audit: async (evt) => {
      events.push(evt);
    },
  });
  return { svc, store: failGrant ? inner : store, schema, events, users, initState };
}

check(
  DEFAULT_ADMIN_ROLE_TRANSITION_MODE === ROLE_CAPABILITY_TRANSITION_MODES.PRESERVE_EXISTING_CAPABILITIES,
  'admin default is PRESERVE_EXISTING_CAPABILITIES'
);
check(
  resolveRoleCapabilityTransitionMode('from-ui') === DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
  'unknown/client mode is ignored; server default wins'
);
check(
  resolveRoleCapabilityTransitionMode(ROLE_CAPABILITY_TRANSITION_MODES.MAKE_STAFF_ONLY) ===
    ROLE_CAPABILITY_TRANSITION_MODES.MAKE_STAFF_ONLY,
  'explicit server MAKE_STAFF_ONLY remains available'
);

// --- 1A promotion User→Admin preserves existing student grant, does not create one ---
{
  const { svc, schema, events } = serviceWith();
  await svc.initializeCustomerUser({ _id: 'promo' });
  const before = await svc.resolveUserCapabilities({
    _id: 'promo',
    role: 'User',
    capabilitySchemaVersion: schema.get('promo'),
  });
  check(before.active.includes('student'), 'source account already had student');

  const transition = await svc.applyRoleTransitionCapabilities({
    userId: 'promo',
    priorRole: 'User',
    newRole: 'Admin',
    mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
    actor: 'admin-1',
    user: { role: 'User', capabilitySchemaVersion: schema.get('promo') },
  });
  check(transition.mode === 'preserve_existing_capabilities', 'promotion uses preserve mode');
  check(transition.preservedCapabilities.includes('student'), 'promotion records that student was preserved');
  check(transition.grantedStudent === false, 'promotion does not create a new student grant');
  check(transition.grantedBusinessClient === false, 'promotion never grants business_client');

  const after = await svc.resolveUserCapabilities({
    _id: 'promo',
    role: 'Admin',
    capabilitySchemaVersion: schema.get('promo'),
  });
  check(after.active.includes('student'), 'dual-use: staff RBAC + existing student grant remains');
  check(!after.active.includes('business_client'), 'no business_client from promotion');
  check(
    events.some((e) => e.action === GBS_AUDIT_EVENTS.ROLE_TRANSITION_CAPABILITIES_PRESERVED),
    'promotion is audit-logged as preserved capabilities'
  );
}

// --- 1B staff→User demotion does not resurrect legacy student ---
{
  const { svc, schema } = serviceWith();
  await svc.initializeStaffUser({ _id: 'staff-only' });
  const staff = await svc.resolveUserCapabilities({
    _id: 'staff-only',
    role: 'Admin',
    capabilitySchemaVersion: schema.get('staff-only'),
  });
  check(!staff.active.includes('student'), 'initialized staff has zero student grants');

  await svc.applyRoleTransitionCapabilities({
    userId: 'staff-only',
    priorRole: 'Admin',
    newRole: 'User',
    mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
    user: { role: 'Admin', capabilitySchemaVersion: schema.get('staff-only') },
  });

  const demoted = await svc.resolveUserCapabilities({
    _id: 'staff-only',
    role: 'User',
    capabilitySchemaVersion: schema.get('staff-only'),
  });
  check(demoted.source === 'persisted', 'demoted staff stays on persisted grants');
  check(!demoted.active.includes('student'), 'staff→User does not trigger legacy Student fallback');
  check(schema.get('staff-only') === CAPABILITY_SCHEMA_VERSION, 'initialized zero-grant state remains authoritative');
}

// --- 1C uninitialized role change initializes schema deterministically ---
{
  const { svc, schema, events } = serviceWith();
  const transition = await svc.applyRoleTransitionCapabilities({
    userId: 'legacy-admin',
    priorRole: 'Admin',
    newRole: 'User',
    mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
    user: { role: 'Admin', capabilitySchemaVersion: 0 },
  });
  check(transition.schemaInitializedOnTransition === true, 'legacy role mutation initializes schema');
  check(schema.get('legacy-admin') === CAPABILITY_SCHEMA_VERSION, 'schema version is 1 after role mutation');
  check(transition.grantedStudent === false, 'legacy Admin→User does not materialize student');

  const resolved = await svc.resolveUserCapabilities({
    _id: 'legacy-admin',
    role: 'User',
    capabilitySchemaVersion: schema.get('legacy-admin'),
  });
  check(!resolved.active.includes('student'), 'uninitialized staff demotion does not gain legacy student');
  check(
    events.some((e) => e.action === GBS_AUDIT_EVENTS.ROLE_TRANSITION_SCHEMA_INITIALIZED),
    'schema initialization on role change is audited'
  );

  const promoLegacy = await svc.applyRoleTransitionCapabilities({
    userId: 'legacy-user',
    priorRole: 'User',
    newRole: 'Admin',
    mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
    user: { role: 'User', capabilitySchemaVersion: 0 },
  });
  check(promoLegacy.grantedStudent === false, 'uninitialized User→Admin does not create student merely from role');
  const promoResolved = await svc.resolveUserCapabilities({
    _id: 'legacy-user',
    role: 'Admin',
    capabilitySchemaVersion: schema.get('legacy-user'),
  });
  check(!promoResolved.active.includes('student'), 'uninitialized promotion becomes staff-only until explicit grant');
}

// --- MAKE_STAFF_ONLY suspends existing student with audit; still no business_client ---
{
  const { svc, schema, events } = serviceWith();
  await svc.initializeCustomerUser({ _id: 'dual' });
  await svc.applyRoleTransitionCapabilities({
    userId: 'dual',
    priorRole: 'User',
    newRole: 'Admin',
    mode: ROLE_CAPABILITY_TRANSITION_MODES.MAKE_STAFF_ONLY,
    actor: 'admin-2',
    user: { role: 'User', capabilitySchemaVersion: schema.get('dual') },
  });
  const resolved = await svc.resolveUserCapabilities({
    _id: 'dual',
    role: 'Admin',
    capabilitySchemaVersion: schema.get('dual'),
  });
  check(!resolved.active.includes('student'), 'MAKE_STAFF_ONLY suspends student rather than silently ignoring it');
  check(
    events.some((e) => e.action === GBS_AUDIT_EVENTS.ROLE_TRANSITION_STAFF_ONLY),
    'staff-only transition is audited'
  );
}

// --- 2 registration atomicity / failure injection ---
{
  const happy = serviceWith();
  await happy.svc.initializeCustomerUser({ _id: 'new-student' });
  const grants = await happy.store.findByUser('new-student');
  check(grants.filter((g) => g.capability === 'student' && g.status === GRANT_STATUSES.ACTIVE).length === 1, 'normal registration: exactly one active student grant');
  check(happy.schema.get('new-student') === CAPABILITY_SCHEMA_VERSION, 'normal registration initializes schema');
  check(!grants.some((g) => g.capability === USER_CAPABILITY_IDS.BUSINESS_CLIENT), 'registration never auto-grants business_client');

  await happy.svc.initializeCustomerUser({ _id: 'new-student' });
  const retried = await happy.store.findByUser('new-student');
  check(retried.filter((g) => g.capability === 'student').length === 1, 'duplicate/retried registration does not duplicate the grant');

  const staff = serviceWith();
  await staff.svc.initializeStaffUser({ _id: 'new-staff' });
  const staffGrants = await staff.store.findByUser('new-staff');
  check(staffGrants.length === 0, 'staff creation gets zero student grants');
  check(staff.schema.get('new-staff') === CAPABILITY_SCHEMA_VERSION, 'staff creation is schema-initialized');

  const grantFail = serviceWith({ failGrant: true });
  let grantFailed = false;
  try {
    await grantFail.svc.initializeCustomerUser({ _id: 'grant-fail' });
  } catch (err) {
    grantFailed = err.code === 'grant_write_failed';
  }
  check(grantFailed, 'grant-write failure is raised (registration cannot report success)');
  check(grantFail.schema.get('grant-fail') === undefined, 'grant failure does not mark schema initialized');
  check((await grantFail.store.findByUser('grant-fail')).length === 0, 'grant failure leaves no student grant');

  const markFail = serviceWith({ failMark: true });
  let markFailed = false;
  try {
    await markFail.svc.initializeCustomerUser({ _id: 'mark-fail' });
  } catch (err) {
    markFailed = err.code === 'schema_write_failed';
  }
  check(markFailed, 'initialization-write failure is raised (no false success)');
  const partialGrant = await markFail.store.findOne('mark-fail', 'student');
  check(partialGrant && partialGrant.status === GRANT_STATUSES.ACTIVE, 'grant succeeded before schema mark failed');
  check(markFail.schema.get('mark-fail') === undefined, 'failed mark leaves schema uninitialized — not initialized-without-student');

  const recovered = serviceWith();
  recovered.store.upsert(partialGrant);
  await recovered.svc.initializeCustomerUser({ _id: 'mark-fail' });
  check(recovered.schema.get('mark-fail') === CAPABILITY_SCHEMA_VERSION, 'retry after mark failure initializes schema');
  check(
    (await recovered.store.findByUser('mark-fail')).filter((g) => g.capability === 'student').length === 1,
    'recovery/retry does not duplicate student authority'
  );
}

{
  let incomplete = false;
  const broken = createUserCapabilityService({
    grantStore: {
      findByUser: async () => [],
      findOne: async () => null,
      upsert: async (doc) => doc,
    },
    markSchemaVersion: async () => {
      throw new Error('must not mark');
    },
    audit: async () => {},
  });
  try {
    await broken.initializeCustomerUser({ _id: 'ghost' });
  } catch (err) {
    incomplete = err.code === REGISTRATION_AUTHORITY_INCOMPLETE;
  }
  check(incomplete, 'missing active student grant after write is registration_authority_incomplete');
}

// --- Orphan customer prevention: incomplete User role touches ---
{
  const sameRole = serviceWith();
  const transition = await sameRole.svc.applyRoleTransitionCapabilities({
    userId: 'orphan-same',
    priorRole: 'User',
    newRole: 'User',
    mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
    user: {
      role: 'User',
      capabilitySchemaVersion: 0,
      capabilityInitializationState: 'pending',
    },
  });
  check(transition.grantedStudent === true, 'A. same-role User touch recovers incomplete customer');
  check(sameRole.schema.get('orphan-same') === CAPABILITY_SCHEMA_VERSION, 'A. schema ready after same-role recovery');
  check(sameRole.initState.get('orphan-same') === 'ready', 'A. init state ready after same-role recovery');
  const sameResolved = await sameRole.svc.resolveUserCapabilities({
    _id: 'orphan-same',
    role: 'User',
    capabilitySchemaVersion: sameRole.schema.get('orphan-same'),
    capabilityInitializationState: sameRole.initState.get('orphan-same'),
  });
  check(sameResolved.active.includes('student'), 'A. student active — not ready+zero orphan');
  check(!sameResolved.active.includes('business_client'), 'A. no business_client from recovery');

  const retry = serviceWith();
  const pendingRetry = {
    _id: 'retry-reg',
    role: 'User',
    capabilitySchemaVersion: 0,
    capabilityInitializationState: 'failed',
  };
  check(
    shouldRetryCapabilityEraRegistration(pendingRetry) === true,
    'B. registration retry gate still matches incomplete User'
  );
  await retry.svc.initializeCustomerUser(pendingRetry, {
    grantedBy: 'system:registration',
    grantReason: 'student_registration_retry',
  });
  check(
    (await retry.store.findOne('retry-reg', 'student'))?.status === GRANT_STATUSES.ACTIVE,
    'B. registration retry still grants student'
  );

  const promoPending = serviceWith();
  const promoTransition = await promoPending.svc.applyRoleTransitionCapabilities({
    userId: 'promo-pending',
    priorRole: 'User',
    newRole: 'Admin',
    mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
    user: {
      role: 'User',
      capabilitySchemaVersion: 0,
      capabilityInitializationState: 'pending',
    },
  });
  check(promoTransition.grantedStudent === true, 'C. incomplete User→Admin recovers customer init');
  check(promoTransition.preservedCapabilities.includes('student'), 'C. student preserved through transition');
  const promoAfter = await promoPending.svc.resolveUserCapabilities({
    _id: 'promo-pending',
    role: 'Admin',
    capabilitySchemaVersion: promoPending.schema.get('promo-pending'),
    capabilityInitializationState: promoPending.initState.get('promo-pending'),
  });
  check(promoAfter.active.includes('student'), 'C. student remains active after User→Admin');

  for (const staffRole of ['Admin', 'Editor', 'Moderator', 'SuperAdmin']) {
    const demote = serviceWith();
    await demote.svc.initializeStaffUser({ _id: `demote-${staffRole}` });
    const t = await demote.svc.applyRoleTransitionCapabilities({
      userId: `demote-${staffRole}`,
      priorRole: staffRole,
      newRole: 'User',
      mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
      user: {
        role: staffRole,
        capabilitySchemaVersion: demote.schema.get(`demote-${staffRole}`),
        capabilityInitializationState: demote.initState.get(`demote-${staffRole}`),
      },
    });
    check(t.grantedStudent === false, `D/E. initialized ${staffRole}→User does not auto-grant student`);
    const resolved = await demote.svc.resolveUserCapabilities({
      _id: `demote-${staffRole}`,
      role: 'User',
      capabilitySchemaVersion: demote.schema.get(`demote-${staffRole}`),
      capabilityInitializationState: demote.initState.get(`demote-${staffRole}`),
    });
    check(!resolved.active.includes('student'), `D/E. demoted ${staffRole} stays zero-student`);
  }

  const incompleteStaff = serviceWith();
  const staffTouch = await incompleteStaff.svc.applyRoleTransitionCapabilities({
    userId: 'incomplete-staff',
    priorRole: 'Admin',
    newRole: 'User',
    mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
    user: {
      role: 'Admin',
      capabilitySchemaVersion: 0,
      capabilityInitializationState: 'pending',
    },
  });
  check(staffTouch.grantedStudent === false, 'F. incomplete staff-origin→User does not auto-grant student');
  check(incompleteStaff.schema.get('incomplete-staff') === CAPABILITY_SCHEMA_VERSION, 'F. incomplete staff still schema-initialized');
  const staffResolved = await incompleteStaff.svc.resolveUserCapabilities({
    _id: 'incomplete-staff',
    role: 'User',
    capabilitySchemaVersion: incompleteStaff.schema.get('incomplete-staff'),
    capabilityInitializationState: incompleteStaff.initState.get('incomplete-staff'),
  });
  check(!staffResolved.active.includes('student'), 'F. incomplete staff demotion remains zero-student');

  const denied = serviceWith();
  await denied.store.upsert({
    userId: 'denied-student',
    capability: USER_CAPABILITY_IDS.STUDENT,
    status: GRANT_STATUSES.REVOKED,
    grantedAt: new Date(),
    grantedBy: 'admin',
    grantReason: 'manual_revoke',
    history: [],
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
  });
  const deniedTransition = await denied.svc.applyRoleTransitionCapabilities({
    userId: 'denied-student',
    priorRole: 'User',
    newRole: 'User',
    mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
    user: {
      role: 'User',
      capabilitySchemaVersion: 0,
      capabilityInitializationState: 'pending',
    },
  });
  check(deniedTransition.grantedStudent === false, 'G. revoked student is not resurrected');
  check(
    (await denied.store.findOne('denied-student', 'student'))?.status === GRANT_STATUSES.REVOKED,
    'G. revoked student grant remains revoked'
  );

  const suspended = serviceWith();
  await suspended.store.upsert({
    userId: 'suspended-student',
    capability: USER_CAPABILITY_IDS.STUDENT,
    status: GRANT_STATUSES.SUSPENDED,
    grantedAt: new Date(),
    grantedBy: 'admin',
    grantReason: 'manual_suspend',
    history: [],
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
  });
  const suspendedTransition = await suspended.svc.applyRoleTransitionCapabilities({
    userId: 'suspended-student',
    priorRole: 'User',
    newRole: 'User',
    mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
    user: {
      role: 'User',
      capabilitySchemaVersion: 0,
      capabilityInitializationState: 'failed',
    },
  });
  check(suspendedTransition.grantedStudent === false, 'G. suspended student is not resurrected');
  check(
    (await suspended.store.findOne('suspended-student', 'student'))?.status === GRANT_STATUSES.SUSPENDED,
    'G. suspended student grant remains suspended'
  );

  const withBiz = serviceWith();
  await withBiz.store.upsert({
    userId: 'biz-client',
    capability: USER_CAPABILITY_IDS.BUSINESS_CLIENT,
    status: GRANT_STATUSES.ACTIVE,
    grantedAt: new Date(),
    grantedBy: 'system:activation',
    grantReason: 'explicit_business_client_activation',
    history: [],
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
  });
  const bizTransition = await withBiz.svc.applyRoleTransitionCapabilities({
    userId: 'biz-client',
    priorRole: 'User',
    newRole: 'User',
    mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
    user: {
      role: 'User',
      capabilitySchemaVersion: 0,
      capabilityInitializationState: 'pending',
    },
  });
  check(bizTransition.grantedStudent === true, 'H. incomplete customer with business_client still recovers student');
  check(bizTransition.grantedBusinessClient === false, 'H. transition never auto-creates business_client');
  check(bizTransition.preservedCapabilities.includes('business_client'), 'H. existing business_client preserved');
  check(bizTransition.preservedCapabilities.includes('student'), 'H. recovered student listed in preservedCapabilities');
  const bizResolved = await withBiz.svc.resolveUserCapabilities({
    _id: 'biz-client',
    role: 'User',
    capabilitySchemaVersion: withBiz.schema.get('biz-client'),
    capabilityInitializationState: withBiz.initState.get('biz-client'),
  });
  check(bizResolved.active.includes('business_client'), 'H. business_client remains active');
  check(bizResolved.active.includes('student'), 'H. student recovered alongside business_client');

  const legacy = serviceWith();
  const legacyDemote = await legacy.svc.applyRoleTransitionCapabilities({
    userId: 'legacy-admin-2',
    priorRole: 'Admin',
    newRole: 'User',
    mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
    user: { role: 'Admin', capabilitySchemaVersion: 0 },
  });
  check(legacyDemote.grantedStudent === false, 'I. legacy uninitialized Admin→User still no student');
  const legacyResolved = await legacy.svc.resolveUserCapabilities({
    _id: 'legacy-admin-2',
    role: 'User',
    capabilitySchemaVersion: legacy.schema.get('legacy-admin-2'),
  });
  check(!legacyResolved.active.includes('student'), 'I. legacy staff demotion does not gain legacy student');

  const usersCtrl = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../controllers/admin/usersController.js'),
    'utf8'
  );
  check(
    /if \(prev === role\) continue;/.test(usersCtrl),
    'J. bulkAssignRole still skips same-role rows'
  );
}

console.log(`phase17d1r1RoleAndRegistration.test.js: ${count} assertions passed`);
