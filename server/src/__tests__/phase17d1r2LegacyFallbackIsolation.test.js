/**
 * Phase 17D-1R2 — isolate legacy student fallback from new registrations.
 * Run: node src/__tests__/phase17d1r2LegacyFallbackIsolation.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  classifyLegacyUserAccount,
  LEGACY_CLASSIFICATIONS,
  shouldRetryCapabilityEraRegistration,
} from '../../../shared/capability/legacyUserClassification.js';
import {
  CAPABILITY_INITIALIZATION_STATES,
  isCapabilityEraIncomplete,
  isHistoricalLegacyEligible,
} from '../../../shared/capability/capabilityInitialization.js';
import { CAPABILITY_SCHEMA_VERSION } from '../../../shared/capability/grantStatus.js';
import { USER_CAPABILITY_IDS } from '../../../shared/capability/userCapabilities.js';
import { authorizeAction, AUTH_DECISION_CODES } from '../../../shared/security/authorizeAction.js';
import {
  createUserCapabilityService,
  createMemoryGrantStore,
} from '../services/capability/userCapabilityService.js';
import { DEFAULT_ADMIN_ROLE_TRANSITION_MODE } from '../../../shared/capability/roleCapabilityTransition.js';
import { classifyUserForBackfill } from '../scripts/backfillUserCapabilities.js';

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

function serviceWith({ failGrant = false, failMark = false } = {}) {
  const store = createMemoryGrantStore();
  const inner = createMemoryGrantStore();
  const schema = new Map();
  const initState = new Map();
  const grantStore = {
    findByUser: (...args) => inner.findByUser(...args),
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
      initState.set(String(userId), CAPABILITY_INITIALIZATION_STATES.READY);
    },
    markInitializationState: async (userId, state) => {
      initState.set(String(userId), state);
    },
    audit: async () => {},
  });
  return { svc, store: failGrant ? inner : store, schema, initState };
}

function survivingPartialUser(overrides = {}) {
  return {
    _id: 'partial-reg',
    role: 'User',
    accountStatus: 'active',
    capabilitySchemaVersion: 0,
    capabilityInitializationState: CAPABILITY_INITIALIZATION_STATES.PENDING,
    ...overrides,
  };
}

function studentProductDecision(resolved, user) {
  return authorizeAction({
    authenticated: true,
    principal: user,
    requiredUserCapability: USER_CAPABILITY_IDS.STUDENT,
    activeUserCapabilities: resolved.active,
    activeWorkspace: 'student',
  });
}

// --- Historical legacy remains available ---
{
  const historical = classifyLegacyUserAccount({ role: 'User', capabilitySchemaVersion: 0 });
  check(historical.kind === LEGACY_CLASSIFICATIONS.LEGACY_STUDENT_CUSTOMER, '1. genuine historical User is legacy student');
  check(historical.effectiveStudent === true, '1. historical User gets effective student');
  check(isHistoricalLegacyEligible({ role: 'User' }), 'missing initialization state is historical legacy-eligible');

  const staff = classifyLegacyUserAccount({ role: 'Admin', capabilitySchemaVersion: 0 });
  check(staff.kind === LEGACY_CLASSIFICATIONS.LEGACY_STAFF_ONLY && staff.effectiveStudent === false, '2. historical staff has no student');

  const amb = classifyLegacyUserAccount({ role: 'employer', capabilitySchemaVersion: 0 });
  check(amb.failClosed === true && amb.effectiveStudent === false, '3. ambiguous historical account denies');
}

// --- Successful new Student ---
{
  const { svc, schema, initState, store } = serviceWith();
  await svc.initializeCustomerUser({ _id: 'new-ok' });
  const resolved = await svc.resolveUserCapabilities({
    _id: 'new-ok',
    role: 'User',
    capabilitySchemaVersion: schema.get('new-ok'),
    capabilityInitializationState: initState.get('new-ok'),
  });
  check(schema.get('new-ok') === CAPABILITY_SCHEMA_VERSION, '4. successful registration initializes schema');
  check(initState.get('new-ok') === 'ready', '4. successful registration is ready');
  check(resolved.active.filter((c) => c === 'student').length === 1, '4. exactly one active student');
  check(!resolved.active.includes('business_client'), '10. business_client is never automatic');
  const grants = await store.findByUser('new-ok');
  check(grants.filter((g) => g.capability === 'student').length === 1, '4. exactly one student grant row');
}

// --- Grant-write failure after User.create: no legacy student ---
{
  const { svc, initState, store } = serviceWith({ failGrant: true });
  let failed = false;
  try {
    await svc.initializeCustomerUser({ _id: 'partial-reg' });
  } catch (err) {
    failed = err.code === 'grant_write_failed';
  }
  check(failed, '5. grant-write failure is raised (registration not successful)');
  check(initState.get('partial-reg') === 'failed', '5. surviving account is marked failed, not legacy');
  check((await store.findByUser('partial-reg')).length === 0, '5. no student grant exists');

  const surviving = survivingPartialUser({
    capabilityInitializationState: initState.get('partial-reg'),
  });
  const resolved = await svc.resolveUserCapabilities(surviving);
  check(resolved.classification === LEGACY_CLASSIFICATIONS.CAPABILITY_ERA_INCOMPLETE, '5. resolver classifies capability-era incomplete');
  check(!resolved.active.includes('student'), '5. surviving account has no effective student');
  check(resolved.source === 'persisted', '5. incomplete accounts use persisted grants only, not legacy fallback');

  const loginShaped = await svc.resolveUserCapabilities({ ...surviving, lastLoginAt: new Date() });
  check(!loginShaped.active.includes('student'), '6. login-shaped resolution cannot bypass initialization state');

  const refreshShaped = await svc.resolveUserCapabilities({ ...surviving, tokenVersion: 1 });
  check(!refreshShaped.active.includes('student'), '6. refresh-shaped resolution cannot bypass initialization state');

  const verifiedShaped = await svc.resolveUserCapabilities({ ...surviving, emailVerified: true });
  check(!verifiedShaped.active.includes('student'), '6. email verification state cannot bypass initialization state');

  const resendShaped = await svc.resolveUserCapabilities({ ...surviving, emailVerified: false });
  check(!resendShaped.active.includes('student'), '6. resend verification cannot bypass initialization state');

  const product = studentProductDecision(resolved, surviving);
  check(
    product.allowed === false && product.code === AUTH_DECISION_CODES.CAPABILITY_DENIED,
    '6. Student product authorization denies the partial registration'
  );
  check(
    studentProductDecision(resolved, surviving).allowed === false,
    '16. activeWorkspace student preference does not authorize'
  );
}

// --- Schema finalization failure after grant: no false success, retry safe ---
{
  const { svc, schema, initState, store } = serviceWith({ failMark: true });
  let markFailed = false;
  try {
    await svc.initializeCustomerUser({ _id: 'mark-fail' });
  } catch (err) {
    markFailed = err.code === 'schema_write_failed';
  }
  check(markFailed, '7. finalization failure is raised');
  check(schema.get('mark-fail') === undefined, '7. schema is not marked ready');
  const grant = await store.findOne('mark-fail', 'student');
  check(Boolean(grant), '7. explicit grant may remain');
  check(initState.get('mark-fail') !== 'ready', '7. account is not falsely ready');
  check(initState.get('mark-fail') !== 'legacy', '7. remaining grant does not become historical legacy');

  const recovered = serviceWith();
  await recovered.store.upsert(grant);
  await recovered.svc.initializeCustomerUser({ _id: 'mark-fail' });
  check(recovered.schema.get('mark-fail') === CAPABILITY_SCHEMA_VERSION, '8. retry reaches ready schema');
  check(recovered.initState.get('mark-fail') === 'ready', '8. retry reaches ready state');
  check(
    (await recovered.store.findByUser('mark-fail')).filter((g) => g.capability === 'student').length === 1,
    '8. retry does not duplicate the grant'
  );
}

// --- Staff / business_client ---
{
  const { svc, schema, initState } = serviceWith();
  await svc.initializeStaffUser({ _id: 'staff-new' });
  const resolved = await svc.resolveUserCapabilities({
    _id: 'staff-new',
    role: 'Admin',
    capabilitySchemaVersion: schema.get('staff-new'),
    capabilityInitializationState: initState.get('staff-new'),
  });
  check(!resolved.active.includes('student'), '9. initialized staff has no student');
  check(initState.get('staff-new') === 'ready', '9. staff create is ready');
}

// --- Anti-enumeration compensation ---
{
  check(
    shouldRetryCapabilityEraRegistration({
      role: 'User',
      capabilityInitializationState: 'pending',
    }) === true,
    '11/8. pending customer registration may be retried'
  );
  check(
    shouldRetryCapabilityEraRegistration({
      role: 'User',
      capabilityInitializationState: 'failed',
    }) === true,
    'failed capability-era customer may be retried'
  );
  check(
    shouldRetryCapabilityEraRegistration({ role: 'User', capabilitySchemaVersion: 0 }) === false,
    '13. historical uninitialized User is not treated as a new failed registration'
  );
  check(
    shouldRetryCapabilityEraRegistration({
      role: 'Admin',
      capabilityInitializationState: 'pending',
    }) === false,
    '12. compensation does not convert staff to Student'
  );
  check(
    shouldRetryCapabilityEraRegistration({
      role: 'User',
      capabilitySchemaVersion: 1,
      capabilityInitializationState: 'ready',
    }) === false,
    'initialized zero-grant account is not auto-granted student'
  );
}

// --- Role transitions ---
{
  const { svc, schema, initState } = serviceWith();
  await svc.initializeStaffUser({ _id: 'staff-zero' });
  await svc.applyRoleTransitionCapabilities({
    userId: 'staff-zero',
    priorRole: 'Admin',
    newRole: 'User',
    mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
    user: {
      role: 'Admin',
      capabilitySchemaVersion: schema.get('staff-zero'),
      capabilityInitializationState: initState.get('staff-zero'),
    },
  });
  const demoted = await svc.resolveUserCapabilities({
    _id: 'staff-zero',
    role: 'User',
    capabilitySchemaVersion: schema.get('staff-zero'),
    capabilityInitializationState: initState.get('staff-zero'),
  });
  check(!demoted.active.includes('student'), '14. staff→User initialized zero grant has no fallback');

  const pendingPromo = serviceWith();
  const pendingUser = survivingPartialUser({ _id: 'pending-promo' });
  const transition = await pendingPromo.svc.applyRoleTransitionCapabilities({
    userId: 'pending-promo',
    priorRole: 'User',
    newRole: 'Admin',
    mode: DEFAULT_ADMIN_ROLE_TRANSITION_MODE,
    user: pendingUser,
  });
  check(transition.grantedStudent === false && transition.grantedBusinessClient === false, '15. User→staff creates no new capability');
  check(pendingPromo.initState.get('pending-promo') === 'ready', 'role mutation does not mark a pending registration as historical legacy');
  check(pendingPromo.initState.get('pending-promo') !== 'legacy', 'pending registration is not rewritten as legacy eligible');
}

// --- Backfill classification ---
{
  check(
    classifyUserForBackfill({ role: 'User', capabilitySchemaVersion: 0 }).grantStudentOnBackfill === true,
    'historical genuine Student remains a backfill candidate'
  );
  check(
    classifyUserForBackfill({
      role: 'User',
      capabilitySchemaVersion: 0,
      capabilityInitializationState: 'pending',
    }).grantStudentOnBackfill === false,
    'pending registration is not a historical Student backfill candidate'
  );
  check(isCapabilityEraIncomplete({ capabilityInitializationState: 'failed' }) === true, 'failed is capability-era incomplete');
}

// --- Source: login/verify/resend/refresh do not grant student ---
{
  const auth = read('server/src/controllers/authController.js');
  const login = auth.slice(auth.indexOf('export const login'));
  check(!/initializeCustomerUser/.test(login.slice(0, 800)), 'login does not initialize student capability');
  check(!/classifyLegacyUserAccount/.test(login.slice(0, 800)), 'login does not apply the legacy classifier');

  const verify = auth.slice(auth.indexOf('export const verifyEmail'));
  check(!/initializeCustomerUser/.test(verify.slice(0, 1200)), 'email verification does not initialize student capability');

  const resend = auth.slice(auth.indexOf('export const resendVerification'));
  check(!/initializeCustomerUser/.test(resend), 'resend verification does not initialize student capability');

  const register = read('server/src/controllers/authController.js');
  check(/capabilityInitializationState: 'pending'/.test(register), 'new registration writes pending before grant');
  check(/shouldRetryCapabilityEraRegistration\(existing\)/.test(register), 'existing-email compensation requires capability-era pending/failed');

  const authorize = read('server/src/services/security/authorizeAction.js');
  check(/capabilityInitializationState/.test(authorize), 'Student product auth loads initialization state from Mongo, not JWT/workspace');

  const model = read('server/src/models/User.js');
  check(!/capabilityInitializationState:[\s\S]{0,120}default:/.test(model), 'no mongoose default that would reclassify historical rows');
}

console.log(`phase17d1r2LegacyFallbackIsolation.test.js: ${count} assertions passed`);
