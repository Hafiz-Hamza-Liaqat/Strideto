/**
 * Google Sign-In P1 — social identity foundation tests (no DB).
 * Run: node src/__tests__/socialIdentityFoundation.test.js
 *
 * Everything here exercises the real service through injected in-memory
 * stores that reproduce the two `UserIdentity` unique indexes and the `User`
 * unique email index, so the resolution policy, the capability contract, and
 * every race/failure path are covered without Mongo.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import {
  createSocialIdentityLinkingService,
  SOCIAL_IDENTITY_RESULTS as R,
} from '../services/auth/socialIdentityLinking.js';
import {
  createUserCapabilityService,
  createMemoryGrantStore,
} from '../services/capability/userCapabilityService.js';
import {
  accountHasPassword,
  isSocialOnlyAccount,
} from '../../../shared/auth/passwordAccountState.js';
import {
  SOCIAL_IDENTITY_PROVIDERS,
  isKnownSocialIdentityProvider,
  isValidProviderSubject,
  normalizeProviderEmail,
  safeProviderDisplayName,
} from '../../../shared/auth/socialIdentityProviders.js';
import { CONNECTED_ACCOUNT_PROVIDERS } from '../../../shared/auth/connectedAccounts.js';
import { USER_CAPABILITY_IDS } from '../../../shared/capability/userCapabilities.js';
import { CAPABILITY_SCHEMA_VERSION } from '../../../shared/capability/grantStatus.js';
import {
  compareUserIdentityIndexes,
  USER_IDENTITY_INDEXES,
} from '../scripts/provisionUserIdentityIndexes.js';

const here = dirname(fileURLToPath(import.meta.url));
const readRepo = (rel) => readFileSync(resolve(here, '../../..', rel), 'utf8');
/** Strips comments so source contracts assert about code, not prose. */
const codeOnly = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

// ---------------------------------------------------------------------------
// In-memory harness — reproduces the storage constraints that matter.
// ---------------------------------------------------------------------------

function duplicateKeyError(message) {
  const error = new Error(message);
  error.code = 11000;
  return error;
}

function makeHarness({
  users = [],
  identities = [],
  failGrant = false,
  failMarkSchema = false,
} = {}) {
  let nextId = 1000;
  const userRows = new Map();
  const identityRows = [];

  for (const seed of users) {
    userRows.set(String(seed._id), { ...seed });
  }
  for (const seed of identities) {
    identityRows.push({ ...seed });
  }

  const userStore = {
    async findById(userId) {
      const row = userRows.get(String(userId));
      return row ? { ...row } : null;
    },
    async findByEmail(email) {
      for (const row of userRows.values()) {
        if (row.email === email) return { ...row };
      }
      return null;
    },
    async create(doc) {
      for (const row of userRows.values()) {
        if (row.email === doc.email) {
          throw duplicateKeyError('E11000 duplicate key error: email');
        }
      }
      const _id = `u-${(nextId += 1)}`;
      const row = { _id, capabilitySchemaVersion: 0, ...doc };
      userRows.set(_id, row);
      return { ...row };
    },
    async findByIdForCapabilityState(userId) {
      const row = userRows.get(String(userId));
      if (!row) return null;
      return {
        role: row.role,
        capabilitySchemaVersion: row.capabilitySchemaVersion,
        capabilityInitializationState: row.capabilityInitializationState,
      };
    },
  };

  const identityStore = {
    async findByProviderSubject(provider, subject) {
      const found = identityRows.find(
        (row) => row.provider === provider && row.subject === subject
      );
      return found ? { ...found } : null;
    },
    async findByUser(userId) {
      return identityRows
        .filter((row) => String(row.userId) === String(userId))
        .map((row) => ({ ...row }));
    },
    async create(doc) {
      const subjectClash = identityRows.some(
        (row) => row.provider === doc.provider && row.subject === doc.subject
      );
      if (subjectClash) {
        throw duplicateKeyError('E11000 duplicate key error: provider_1_subject_1');
      }
      const userClash = identityRows.some(
        (row) =>
          String(row.userId) === String(doc.userId) && row.provider === doc.provider
      );
      if (userClash) {
        throw duplicateKeyError('E11000 duplicate key error: userId_1_provider_1');
      }
      const row = { _id: `i-${(nextId += 1)}`, ...doc };
      identityRows.push(row);
      return { ...row };
    },
  };

  const grantStore = createMemoryGrantStore();
  const realUpsert = grantStore.upsert.bind(grantStore);
  grantStore.upsert = async (doc) => {
    if (failGrant) throw new Error('grant store unavailable');
    return realUpsert(doc);
  };

  const capabilityService = createUserCapabilityService({
    grantStore,
    async markSchemaVersion(userId, version) {
      if (failMarkSchema) throw new Error('mark schema unavailable');
      const row = userRows.get(String(userId));
      if (row) {
        row.capabilitySchemaVersion = version;
        row.capabilityInitializationState = 'ready';
      }
    },
    async markInitializationState(userId, state) {
      const row = userRows.get(String(userId));
      if (row) row.capabilityInitializationState = state;
    },
    async loadUser(userId) {
      const row = userRows.get(String(userId));
      return row ? { ...row } : null;
    },
  });

  const service = createSocialIdentityLinkingService({
    identityStore,
    userStore,
    capabilityService,
  });

  return { service, userStore, identityStore, capabilityService, userRows, identityRows };
}

const GOOGLE_PROVENANCE = Object.freeze({
  grantedBy: 'system:oauth_google',
  grantReason: 'student_registration_google',
});

const assertion = (overrides = {}) => ({
  provider: 'google',
  subject: 'google-sub-1',
  email: 'ada@example.com',
  emailVerified: true,
  displayName: 'Ada Lovelace',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Provider registry — provider-neutral, LinkedIn/Facebook ready.
// ---------------------------------------------------------------------------
{
  check(SOCIAL_IDENTITY_PROVIDERS.includes('google'), 'google is a supported identity provider');
  check(SOCIAL_IDENTITY_PROVIDERS.includes('linkedin'), 'linkedin is a supported identity provider');
  check(SOCIAL_IDENTITY_PROVIDERS.includes('facebook'), 'facebook is a supported identity provider');
  check(
    SOCIAL_IDENTITY_PROVIDERS.every((p) => CONNECTED_ACCOUNT_PROVIDERS.includes(p)),
    'identity providers are a subset of the Connected Accounts registry'
  );
  check(!isKnownSocialIdentityProvider('apple'), 'unconfigured providers are not identity providers');
  check(!isKnownSocialIdentityProvider(''), 'empty provider is rejected');
  check(isValidProviderSubject('1078...9'), 'a normal subject is valid');
  check(!isValidProviderSubject(''), 'empty subject is rejected');
  check(!isValidProviderSubject(' padded'), 'untrimmed subject is rejected');
  check(!isValidProviderSubject('x'.repeat(256)), 'over-long subject is rejected');
  check(normalizeProviderEmail('  Ada@Example.COM ') === 'ada@example.com', 'email normalization matches User.email');
  check(safeProviderDisplayName('', 'ada@example.com') === 'ada', 'display name falls back to the email local part');
  check(
    safeProviderDisplayName('x'.repeat(500), '').length === 120,
    'provider display name length is bounded'
  );
}

// ---------------------------------------------------------------------------
// Password-state interpretation.
// ---------------------------------------------------------------------------
{
  check(accountHasPassword({ hasPassword: true }) === true, 'explicit true is a password account');
  check(accountHasPassword({ hasPassword: false }) === false, 'explicit false is social-only');
  check(accountHasPassword({}) === true, 'historical document with no marker is a password account');
  check(
    accountHasPassword({ email: 'x@y.z' }) === true,
    'historical document with unselected password is still a password account'
  );
  check(
    accountHasPassword({ password: '$2a$12$hash' }) === true,
    'a stored password corroborates a password account'
  );
  check(
    accountHasPassword({ hasPassword: false, password: '$2a$12$hash' }) === false,
    'explicit social-only marker wins over a stray stored password'
  );
  check(accountHasPassword(null) === false, 'absent user is never a password account');
  check(isSocialOnlyAccount({ hasPassword: false }) === true, 'isSocialOnlyAccount inverts correctly');
  check(isSocialOnlyAccount({}) === false, 'historical accounts are not social-only');
}

// ---------------------------------------------------------------------------
// (A) Known provider+subject resolves the same user, email changes included.
// ---------------------------------------------------------------------------
{
  const { service } = makeHarness({
    users: [{ _id: 'u-1', email: 'ada@example.com', role: 'User', accountStatus: 'active', hasPassword: true }],
    identities: [{ _id: 'i-1', userId: 'u-1', provider: 'google', subject: 'google-sub-1', emailAtLink: 'ada@example.com' }],
  });

  const first = await service.resolveIdentity(assertion());
  check(first.code === R.IDENTITY_RESOLVED, 'known provider+subject resolves the identity');
  check(String(first.user._id) === 'u-1', 'known subject resolves the linked user');

  const renamed = await service.resolveIdentity(
    assertion({ email: 'ada.lovelace@newdomain.example' })
  );
  check(renamed.code === R.IDENTITY_RESOLVED, 'changed provider email still resolves by subject');
  check(String(renamed.user._id) === 'u-1', 'changed provider email resolves the SAME user');

  const otherSubject = await service.resolveIdentity(assertion({ subject: 'google-sub-2' }));
  check(
    otherSubject.code === R.EXISTING_ACCOUNT_REQUIRES_LINK,
    'a different subject on the same email is never silently resolved'
  );
}

// ---------------------------------------------------------------------------
// (B) Unverified provider email is rejected outright.
// ---------------------------------------------------------------------------
{
  const h = makeHarness({});
  const result = await h.service.resolveIdentity(assertion({ emailVerified: false }));
  check(result.code === R.PROVIDER_EMAIL_UNVERIFIED, 'unverified provider email is rejected');
  check(h.userRows.size === 0 && h.identityRows.length === 0, 'unverified email creates nothing');

  const created = await h.service.createSocialUser(
    assertion({ emailVerified: false }),
    GOOGLE_PROVENANCE
  );
  check(created.code === R.PROVIDER_EMAIL_UNVERIFIED, 'creation also refuses an unverified email');
  check(h.userRows.size === 0, 'no User created for an unverified provider email');
  check(h.identityRows.length === 0, 'no UserIdentity created for an unverified provider email');

  const missingFlag = await h.service.resolveIdentity(assertion({ emailVerified: 'true' }));
  check(
    missingFlag.code === R.PROVIDER_EMAIL_UNVERIFIED,
    'email_verified must be boolean true, not a truthy string'
  );
}

// ---------------------------------------------------------------------------
// (C) Existing STRIDETO email — NO AUTO-LINK.
// ---------------------------------------------------------------------------
{
  const h = makeHarness({
    users: [{
      _id: 'u-1',
      email: 'ada@example.com',
      role: 'User',
      accountStatus: 'active',
      hasPassword: true,
      capabilityInitializationState: 'ready',
      capabilitySchemaVersion: CAPABILITY_SCHEMA_VERSION,
    }],
  });

  const resolved = await h.service.resolveIdentity(assertion());
  check(resolved.code === R.EXISTING_ACCOUNT_REQUIRES_LINK, 'existing email returns existing_account_requires_link');

  const created = await h.service.createSocialUser(assertion(), GOOGLE_PROVENANCE);
  check(created.code === R.EXISTING_ACCOUNT_REQUIRES_LINK, 'creation refuses to auto-link an existing account');
  check(h.userRows.size === 1, 'no duplicate User is created for an existing email');
  check(h.identityRows.length === 0, 'no UserIdentity is created for an existing email');
  const grants = await h.capabilityService.listGrants('u-1');
  check(grants.length === 0, 'no capabilities are initialized on a requires-link outcome');

  const viaResolveOrCreate = await h.service.resolveOrCreate(assertion(), GOOGLE_PROVENANCE);
  check(
    viaResolveOrCreate.code === R.EXISTING_ACCOUNT_REQUIRES_LINK,
    'resolveOrCreate honours the no-auto-link policy'
  );
  check(h.identityRows.length === 0, 'resolveOrCreate created no identity for an existing account');
}

// A passwordless account that already holds identities is a real social
// account — a second, different provider subject still must not auto-link.
{
  const h = makeHarness({
    users: [{
      _id: 'u-1',
      email: 'ada@example.com',
      role: 'User',
      accountStatus: 'active',
      hasPassword: false,
      capabilityInitializationState: 'ready',
      capabilitySchemaVersion: CAPABILITY_SCHEMA_VERSION,
    }],
    identities: [{ _id: 'i-1', userId: 'u-1', provider: 'linkedin', subject: 'li-1' }],
  });
  const result = await h.service.resolveIdentity(assertion());
  check(
    result.code === R.EXISTING_ACCOUNT_REQUIRES_LINK,
    'a second provider on an existing social account still requires deliberate linking'
  );
}

// ---------------------------------------------------------------------------
// (E) Suspended accounts are rejected on both paths.
// ---------------------------------------------------------------------------
{
  const byIdentity = makeHarness({
    users: [{ _id: 'u-1', email: 'ada@example.com', role: 'User', accountStatus: 'suspended', hasPassword: false }],
    identities: [{ _id: 'i-1', userId: 'u-1', provider: 'google', subject: 'google-sub-1' }],
  });
  const resolvedSuspended = await byIdentity.service.resolveIdentity(assertion());
  check(resolvedSuspended.code === R.ACCOUNT_SUSPENDED, 'suspended account with a known identity is rejected');

  const byEmail = makeHarness({
    users: [{ _id: 'u-1', email: 'ada@example.com', role: 'User', accountStatus: 'suspended', hasPassword: true }],
  });
  const matchedSuspended = await byEmail.service.resolveIdentity(assertion());
  check(matchedSuspended.code === R.ACCOUNT_SUSPENDED, 'suspended account matched by email is rejected');

  const created = await byEmail.service.createSocialUser(assertion(), GOOGLE_PROVENANCE);
  check(created.code === R.ACCOUNT_SUSPENDED, 'creation refuses a suspended account');
  check(byEmail.identityRows.length === 0, 'suspended account gains no identity');
}

// An identity row pointing at a deleted user is an orphan, never a new account.
{
  const h = makeHarness({
    identities: [{ _id: 'i-1', userId: 'u-gone', provider: 'google', subject: 'google-sub-1' }],
  });
  const result = await h.service.resolveIdentity(assertion());
  check(result.code === R.IDENTITY_ORPHANED, 'identity pointing at a missing user is orphaned, not re-created');
}

// ---------------------------------------------------------------------------
// (D) Canonical new social-user creation.
// ---------------------------------------------------------------------------
{
  const h = makeHarness({});
  const eligible = await h.service.resolveIdentity(assertion());
  check(eligible.code === R.ELIGIBLE_FOR_NEW_ACCOUNT, 'unknown identity + verified email + no account is eligible');

  const created = await h.service.createSocialUser(assertion(), GOOGLE_PROVENANCE);
  check(created.code === R.IDENTITY_RESOLVED, 'new social user creation succeeds');
  check(created.created === true, 'creation is reported as a new account');

  const row = h.userRows.get(String(created.user._id));
  check(row.role === 'User', 'new social user role is User');
  check(row.emailVerified === true, 'new social user is emailVerified');
  check(row.hasPassword === false, 'new social user has hasPassword false');
  check(row.password === undefined, 'new social user is given NO password, not a random one');
  check(row.email === 'ada@example.com', 'new social user email is the normalized provider email');
  check(row.name === 'Ada Lovelace', 'new social user name is the safe provider display name');
  check(row.termsAcceptedAt instanceof Date, 'new social user records legal acceptance metadata');
  check(row.capabilityInitializationState === 'ready', 'initialization ends ready');
  check(row.capabilitySchemaVersion === CAPABILITY_SCHEMA_VERSION, 'capability schema version is current');

  const grants = await h.capabilityService.listGrants(created.user._id);
  const student = grants.find((g) => g.capability === USER_CAPABILITY_IDS.STUDENT);
  check(!!student && student.status === 'active', 'new social user holds an active student grant');
  check(student.grantedBy === 'system:oauth_google', 'grant provenance is the provider adapter value');
  check(student.grantReason === 'student_registration_google', 'grant reason is the provider adapter value');
  check(
    !grants.some((g) => g.capability === USER_CAPABILITY_IDS.BUSINESS_CLIENT),
    'new social user receives NO business_client capability'
  );
  check(grants.length === 1, 'new social user receives exactly one capability grant');

  check(h.identityRows.length === 1, 'exactly one UserIdentity is created');
  const identity = h.identityRows[0];
  check(identity.provider === 'google' && identity.subject === 'google-sub-1', 'identity is keyed by provider+subject');
  check(identity.emailAtLink === 'ada@example.com', 'identity records the link-time email as metadata');
  check(identity.emailVerifiedAtLink === true, 'identity records link-time verification state');
  check(identity.lastLoginAt === null, 'identity records no login — P1 issues no session');
  check(
    !('accessToken' in identity) && !('refreshToken' in identity) && !('idToken' in identity),
    'no OAuth material is persisted on the identity'
  );

  // The created account is now resolvable by subject alone.
  const again = await h.service.resolveIdentity(assertion({ email: 'changed@example.com' }));
  check(again.code === R.IDENTITY_RESOLVED, 'the created identity resolves on a later login');
  check(String(again.user._id) === String(created.user._id), 'later login resolves the same account');
}

// Staff/admin authority is never conferred by the provenance a caller passes.
{
  const h = makeHarness({});
  await h.service.createSocialUser(assertion(), {
    grantedBy: 'system:oauth_google',
    grantReason: 'student_registration_google',
  });
  const [row] = [...h.userRows.values()];
  check(row.role === 'User', 'social creation never assigns a staff role');
  const grants = await h.capabilityService.listGrants(row._id);
  check(
    grants.every((g) => g.capability === USER_CAPABILITY_IDS.STUDENT),
    'social creation grants only the canonical student capability'
  );
}

// Provenance is mandatory — a provider adapter must declare it.
{
  const h = makeHarness({});
  const noProvenance = await h.service.createSocialUser(assertion(), {});
  check(noProvenance.code === R.INVALID_ASSERTION, 'creation without provenance is refused');
  check(h.userRows.size === 0, 'refused provenance creates no User');
}

// ---------------------------------------------------------------------------
// Malformed assertions.
// ---------------------------------------------------------------------------
{
  const h = makeHarness({});
  for (const bad of [
    assertion({ provider: 'apple' }),
    assertion({ provider: undefined }),
    assertion({ subject: '' }),
    assertion({ subject: null }),
    assertion({ email: 'not-an-email' }),
    assertion({ email: '' }),
  ]) {
    const result = await h.service.resolveIdentity(bad);
    check(result.code === R.INVALID_ASSERTION, 'malformed assertion is rejected uniformly');
  }
  check(h.userRows.size === 0 && h.identityRows.length === 0, 'malformed assertions write nothing');
}

// ---------------------------------------------------------------------------
// Failure safety — capability initialization failure yields no usable identity.
// ---------------------------------------------------------------------------
{
  const h = makeHarness({ failGrant: true });
  const result = await h.service.createSocialUser(assertion(), GOOGLE_PROVENANCE);
  check(result.code === R.CAPABILITY_INITIALIZATION_FAILED, 'grant failure is reported, not swallowed');
  check(h.identityRows.length === 0, 'capability failure creates NO UserIdentity');

  const [row] = [...h.userRows.values()];
  check(row.capabilityInitializationState === 'failed', 'the stranded row is marked failed');
  check(row.hasPassword === false, 'the stranded row has no password and cannot be password-authenticated');

  // Unreachable by any social login: no identity exists for the subject.
  const rescan = await h.service.resolveIdentity(assertion());
  check(
    rescan.code === R.INCOMPLETE_SOCIAL_REGISTRATION,
    'the stranded row is classified as incomplete social registration, not a link candidate'
  );
  check(rescan.code !== R.IDENTITY_RESOLVED, 'the stranded row can never resolve as an authenticated identity');
}

// Schema-marking failure is equally fatal to the identity.
{
  const h = makeHarness({ failMarkSchema: true });
  const result = await h.service.createSocialUser(assertion(), GOOGLE_PROVENANCE);
  check(result.code === R.CAPABILITY_INITIALIZATION_FAILED, 'schema-mark failure blocks the identity');
  check(h.identityRows.length === 0, 'schema-mark failure creates no UserIdentity');
}

// A later retry resumes the stranded row rather than duplicating or stranding it.
{
  const h = makeHarness({ failGrant: true });
  await h.service.createSocialUser(assertion(), GOOGLE_PROVENANCE);
  check(h.userRows.size === 1, 'first attempt created exactly one row');

  h.capabilityService.__unused = undefined; // no-op; keeps the harness shape explicit
  // Repair the store, then retry the identical assertion.
  const repaired = makeHarness({
    users: [...h.userRows.values()].map((row) => ({ ...row })),
  });
  const retry = await repaired.service.createSocialUser(assertion(), GOOGLE_PROVENANCE);
  check(retry.code === R.IDENTITY_RESOLVED, 'a retry after repair completes the social account');
  check(repaired.userRows.size === 1, 'the retry did NOT create a duplicate User');
  check(repaired.identityRows.length === 1, 'the retry created exactly one identity');
  const grants = await repaired.capabilityService.listGrants(retry.user._id);
  check(grants.length === 1 && grants[0].capability === USER_CAPABILITY_IDS.STUDENT, 'the retry lands the student grant');
}

// A fully-initialized passwordless account with no identity is NOT resumable —
// it must stay a requires-link outcome, never a silent takeover.
{
  const h = makeHarness({
    users: [{
      _id: 'u-1',
      email: 'ada@example.com',
      role: 'User',
      accountStatus: 'active',
      hasPassword: false,
      capabilityInitializationState: 'ready',
      capabilitySchemaVersion: CAPABILITY_SCHEMA_VERSION,
    }],
  });
  const result = await h.service.createSocialUser(assertion(), GOOGLE_PROVENANCE);
  check(
    result.code === R.EXISTING_ACCOUNT_REQUIRES_LINK,
    'a ready passwordless account is never resumed as incomplete debris'
  );
  check(h.identityRows.length === 0, 'no identity is created for a ready account');
}

// ---------------------------------------------------------------------------
// Race convergence.
// ---------------------------------------------------------------------------

// Duplicate email race: the losing writer must converge, never fork.
{
  const h = makeHarness({});
  const [first, second] = await Promise.all([
    h.service.createSocialUser(assertion(), GOOGLE_PROVENANCE),
    h.service.createSocialUser(assertion(), GOOGLE_PROVENANCE),
  ]);
  const codes = [first.code, second.code];
  check(h.userRows.size === 1, 'a concurrent duplicate-email race creates exactly one User');
  check(h.identityRows.length === 1, 'a concurrent race creates exactly one UserIdentity');
  check(
    codes.every((code) => code === R.IDENTITY_RESOLVED),
    'both concurrent callers converge on the same resolved identity'
  );
  check(
    String(first.user._id) === String(second.user._id),
    'the losing concurrent caller resolves the winner account rather than forking one'
  );
  const grants = await h.capabilityService.listGrants([...h.userRows.values()][0]._id);
  check(grants.length === 1, 'the race leaves exactly one capability grant');
}

// Duplicate provider-subject race: the identity unique index converges.
{
  const h = makeHarness({
    users: [{
      _id: 'u-1',
      email: 'other@example.com',
      role: 'User',
      accountStatus: 'active',
      hasPassword: true,
      capabilityInitializationState: 'ready',
      capabilitySchemaVersion: CAPABILITY_SCHEMA_VERSION,
    }],
  });
  // Seed the identity concurrently: it appears between resolve and create.
  const originalCreate = h.identityStore.create.bind(h.identityStore);
  h.identityStore.create = async (doc) => {
    h.identityRows.push({ _id: 'i-race', userId: 'u-1', provider: doc.provider, subject: doc.subject });
    return originalCreate(doc);
  };

  const result = await h.service.createSocialUser(assertion(), GOOGLE_PROVENANCE);
  check(result.code === R.IDENTITY_RESOLVED, 'a provider-subject collision converges on the winning identity');
  check(String(result.user._id) === 'u-1', 'the collision resolves to the identity that won the unique index');
  check(
    h.identityRows.filter((r) => r.provider === 'google' && r.subject === 'google-sub-1').length === 1,
    'the unique index leaves exactly one identity for the subject'
  );
}

// One identity per provider per user.
{
  const h = makeHarness({
    users: [{ _id: 'u-1', email: 'ada@example.com', role: 'User', accountStatus: 'active', hasPassword: true }],
    identities: [{ _id: 'i-1', userId: 'u-1', provider: 'google', subject: 'google-sub-1' }],
  });
  await assert.rejects(
    () => h.identityStore.create({ userId: 'u-1', provider: 'google', subject: 'google-sub-9' }),
    (error) => Number(error.code) === 11000,
    'a second google identity on the same user violates the unique index'
  );
  count += 1;

  await assert.rejects(
    () => h.identityStore.create({ userId: 'u-2', provider: 'google', subject: 'google-sub-1' }),
    (error) => Number(error.code) === 11000,
    'the same google subject on a second user violates the unique index'
  );
  count += 1;

  const linkedin = await h.identityStore.create({ userId: 'u-1', provider: 'linkedin', subject: 'li-1' });
  check(!!linkedin._id, 'a different provider on the same user is permitted');
}

// ---------------------------------------------------------------------------
// Index provisioning contract (autoIndex is off in this repository).
// ---------------------------------------------------------------------------
{
  const names = USER_IDENTITY_INDEXES.map(({ name }) => name);
  check(names.length === 3, 'three UserIdentity indexes are provisioned');
  const uniques = USER_IDENTITY_INDEXES.filter(({ unique }) => unique);
  check(uniques.length === 2, 'two of them are unique');
  check(
    uniques.some(({ key }) => JSON.stringify(key) === JSON.stringify({ provider: 1, subject: 1 })),
    'provider+subject is unique'
  );
  check(
    uniques.some(({ key }) => JSON.stringify(key) === JSON.stringify({ userId: 1, provider: 1 })),
    'userId+provider is unique'
  );
  const missing = compareUserIdentityIndexes([]);
  check(missing.every(({ status }) => status === 'MISSING'), 'an empty collection reports every index missing');
  const ready = compareUserIdentityIndexes(
    USER_IDENTITY_INDEXES.map(({ name, key, unique }) => ({ name, key, unique }))
  );
  check(ready.every(({ ready: isReady }) => isReady), 'matching indexes report ready');
}

// ---------------------------------------------------------------------------
// Source contracts — password flows and P1 scope boundaries.
// ---------------------------------------------------------------------------
{
  const userModel = readRepo('server/src/models/User.js');
  check(/hasPassword/.test(userModel), 'User model carries the hasPassword marker');
  check(
    /required: function requirePasswordUnlessSocialOnly/.test(userModel),
    'User.password requirement is conditional on password state'
  );
  check(
    /this\.hasPassword !== false/.test(userModel),
    'the password requirement only relaxes for an explicit social-only account'
  );
  check(
    /typeof this\.password !== 'string'/.test(userModel),
    'comparePassword fails closed when no password is stored'
  );
  check(!/googleId/.test(userModel), 'no Google-specific field was added to the User model');

  const auth = readRepo('server/src/controllers/authController.js');
  const login = auth.slice(auth.indexOf('export const login'));
  check(/accountHasPassword\(user\)/.test(login.slice(0, 900)), 'login refuses a social-only account');
  check(
    /Invalid email or password/.test(login.slice(0, 900)),
    'login keeps the generic non-enumerating response for social-only accounts'
  );
  check(!/initializeCustomerUser/.test(login.slice(0, 900)), 'login still does not initialize capabilities');

  const forgot = auth.slice(auth.indexOf('export const forgotPassword'));
  check(
    /if \(user && accountHasPassword\(user\)\)/.test(forgot.slice(0, 1400)),
    'forgot-password issues no reset token for a social-only account'
  );

  const change = auth.slice(auth.indexOf('export const changePassword'));
  check(
    /PASSWORD_NOT_SET_CODE/.test(change.slice(0, 1400)),
    'change-password returns an explicit reason for a social-only account'
  );

  const flows = readRepo('server/src/services/auth/userSecureAuthFlows.js');
  check(
    /accountHasPassword\(subject\)/.test(flows),
    'reset-password refuses to honour a token for a social-only account'
  );

  const mutation = readRepo('server/src/services/auth/AccountSecurityMutationService.js');
  const adminReset = mutation.slice(mutation.indexOf('async function adminResetUserPassword'));
  check(
    /hasPassword: true/.test(adminReset.slice(0, 1600)),
    'admin password reset keeps hasPassword consistent with the stored password'
  );

  const linking = codeOnly(readRepo('server/src/services/auth/socialIdentityLinking.js'));
  check(!/google/i.test(linking), 'the linking service contains no Google-specific code');
  check(!/GOOGLE_CLIENT/.test(linking), 'no Google client configuration is referenced');
  check(!/issueLoginSession|issueAccessToken/.test(linking), 'P1 issues no session');

  const identityModel = codeOnly(readRepo('server/src/models/UserIdentity.js'));
  check(
    !/accessToken|refreshToken|idToken|id_token/.test(identityModel),
    'the UserIdentity model stores no OAuth material'
  );
  check(
    /\{ provider: 1, subject: 1 \}, \{ unique: true \}/.test(identityModel),
    'provider+subject unique index is declared on the schema'
  );
  check(
    /\{ userId: 1, provider: 1 \}, \{ unique: true \}/.test(identityModel),
    'userId+provider unique index is declared on the schema'
  );

  const routes = readRepo('server/src/routes/auth.js');
  check(!/oauth/i.test(routes), 'no OAuth route was added in P1');

  const serverPkg = readRepo('server/package.json');
  check(
    !/passport|openid-client|google-auth-library|oauth4webapi/.test(serverPkg),
    'no OAuth library was installed'
  );

  const socialButton = readRepo('client/src/components/auth/SocialAuthButton.jsx');
  check(/comingSoon/.test(socialButton), 'SocialAuthButton is unchanged (still coming-soon capable)');
}

console.log(`socialIdentityFoundation: ${count} checks passed`);
