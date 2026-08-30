import {
  isKnownSocialIdentityProvider,
  isValidProviderEmail,
  isValidProviderSubject,
  normalizeProviderEmail,
  safeProviderDisplayName,
} from '../../../../shared/auth/socialIdentityProviders.js';
import { accountHasPassword } from '../../../../shared/auth/passwordAccountState.js';
import { legalAcceptanceMetadata } from '../../../../shared/legal/policyVersions.js';
import { CAPABILITY_INITIALIZATION_STATES } from '../../../../shared/capability/capabilityInitialization.js';
import {
  CAPABILITY_SCHEMA_VERSION,
  grantStatusAuthorizes,
} from '../../../../shared/capability/grantStatus.js';
import { USER_CAPABILITY_IDS } from '../../../../shared/capability/userCapabilities.js';

/**
 * Provider-neutral social identity resolution and canonical social-user
 * creation (Google Sign-In P1).
 *
 * Nothing in this module is Google-specific. It never verifies a provider
 * token, never speaks to a provider, and never issues a session. It is handed
 * an already-verified assertion — `{ provider, subject, email, emailVerified,
 * displayName }` — by a provider adapter that does not exist yet (P2), and it
 * answers exactly one question: which STRIDETO account, if any, this external
 * identity corresponds to, and whether a new one may be created.
 *
 * Framework-agnostic in the same sense as `userSecureAuthFlows.js`: every
 * function returns a plain frozen result object and no Express type is
 * referenced.
 */

export const SOCIAL_IDENTITY_RESULTS = Object.freeze({
  /** (A) Known `(provider, subject)`. The account is this identity's user. */
  IDENTITY_RESOLVED: 'identity_resolved',
  /** (B) Unknown identity and the provider did not assert a verified email. */
  PROVIDER_EMAIL_UNVERIFIED: 'provider_email_unverified',
  /** (C) Unknown identity, verified email, existing account. NO auto-link. */
  EXISTING_ACCOUNT_REQUIRES_LINK: 'existing_account_requires_link',
  /** (D) Unknown identity, verified email, no account. May be created. */
  ELIGIBLE_FOR_NEW_ACCOUNT: 'eligible_for_new_account',
  /** (E) The resolved or matched account is suspended. */
  ACCOUNT_SUSPENDED: 'account_suspended',
  /**
   * Debris from a previously failed social creation: a passwordless account
   * with zero identities whose capability initialization never completed.
   * Not an account anyone can authenticate as, and not a link candidate.
   */
  INCOMPLETE_SOCIAL_REGISTRATION: 'incomplete_social_registration',
  /** The identity row points at a user that no longer exists. */
  IDENTITY_ORPHANED: 'identity_orphaned',
  /** Malformed assertion. Never distinguishes which field was wrong. */
  INVALID_ASSERTION: 'invalid_assertion',
  /** Capability initialization did not complete. No identity was created. */
  CAPABILITY_INITIALIZATION_FAILED: 'capability_initialization_failed',
  STORAGE_FAILURE: 'storage_failure',
});

const DUPLICATE_KEY_CODE = 11000;

function isDuplicateKeyError(error) {
  return Number(error?.code) === DUPLICATE_KEY_CODE || error?.code === DUPLICATE_KEY_CODE;
}

function frozen(code, extra = {}) {
  return Object.freeze({ code, ...extra });
}

/**
 * @param {object} config
 * @param {object} config.identityStore — `findByProviderSubject`,
 *   `findByUser`, `create`.
 * @param {object} config.userStore — `findById`, `findByEmail`, `create`,
 *   `findByIdForCapabilityState`.
 * @param {object} config.capabilityService — the canonical
 *   `userCapabilityService`; only `initializeCustomerUser` and
 *   `listGrants` are used. Never re-implemented here.
 * @param {() => Date} [config.now]
 * @param {(user: object) => Promise<unknown>} [config.ensureReferralCode]
 */
export function createSocialIdentityLinkingService({
  identityStore,
  userStore,
  capabilityService,
  now = () => new Date(),
  ensureReferralCode = async () => undefined,
} = {}) {
  if (!identityStore || typeof identityStore.findByProviderSubject !== 'function') {
    throw new TypeError('identityStore exposing findByProviderSubject is required');
  }
  if (!userStore || typeof userStore.findByEmail !== 'function') {
    throw new TypeError('userStore exposing findByEmail is required');
  }
  if (!capabilityService || typeof capabilityService.initializeCustomerUser !== 'function') {
    throw new TypeError('capabilityService exposing initializeCustomerUser is required');
  }

  function normalizeAssertion(assertion = {}) {
    const provider = assertion.provider;
    const subject = assertion.subject;
    const email = normalizeProviderEmail(assertion.email);
    if (!isKnownSocialIdentityProvider(provider)) return null;
    if (!isValidProviderSubject(subject)) return null;
    if (!isValidProviderEmail(email)) return null;
    return {
      provider,
      subject,
      email,
      emailVerified: assertion.emailVerified === true,
      displayName: safeProviderDisplayName(assertion.displayName, email),
    };
  }

  /**
   * The narrow shape produced only by a social creation whose capability
   * initialization failed after the User row was written: passwordless, zero
   * identities, initialization never reached `ready`. A real password account
   * has a password; a real social account has an identity. Nothing else can
   * land in this shape, so resuming it can never link two real accounts.
   */
  async function classifyExistingAccount(user) {
    if (user.accountStatus === 'suspended') {
      return SOCIAL_IDENTITY_RESULTS.ACCOUNT_SUSPENDED;
    }
    if (accountHasPassword(user)) {
      return SOCIAL_IDENTITY_RESULTS.EXISTING_ACCOUNT_REQUIRES_LINK;
    }
    const identities = await identityStore.findByUser(user._id);
    if (Array.isArray(identities) && identities.length > 0) {
      // A passwordless account that already holds identities is a real social
      // account. A *different* provider subject reaching it must still be
      // linked deliberately while authenticated — never auto-linked here.
      return SOCIAL_IDENTITY_RESULTS.EXISTING_ACCOUNT_REQUIRES_LINK;
    }
    if (user.capabilityInitializationState === CAPABILITY_INITIALIZATION_STATES.READY) {
      return SOCIAL_IDENTITY_RESULTS.EXISTING_ACCOUNT_REQUIRES_LINK;
    }
    return SOCIAL_IDENTITY_RESULTS.INCOMPLETE_SOCIAL_REGISTRATION;
  }

  /**
   * Resolution policy A–F. Pure decision — performs no writes of any kind.
   */
  async function resolveIdentity(rawAssertion) {
    const assertion = normalizeAssertion(rawAssertion);
    if (!assertion) return frozen(SOCIAL_IDENTITY_RESULTS.INVALID_ASSERTION);

    let identity;
    try {
      identity = await identityStore.findByProviderSubject(
        assertion.provider,
        assertion.subject
      );
    } catch {
      return frozen(SOCIAL_IDENTITY_RESULTS.STORAGE_FAILURE);
    }

    // (A) Known subject wins outright. The provider's current email is never
    // consulted, so an email change at the provider resolves the same user and
    // can never fork a second account.
    if (identity) {
      let user;
      try {
        user = await userStore.findById(identity.userId);
      } catch {
        return frozen(SOCIAL_IDENTITY_RESULTS.STORAGE_FAILURE);
      }
      if (!user) return frozen(SOCIAL_IDENTITY_RESULTS.IDENTITY_ORPHANED);
      // (E) Suspension is checked on the resolved account, not the assertion.
      if (user.accountStatus === 'suspended') {
        return frozen(SOCIAL_IDENTITY_RESULTS.ACCOUNT_SUSPENDED);
      }
      return frozen(SOCIAL_IDENTITY_RESULTS.IDENTITY_RESOLVED, { user, identity });
    }

    // (B) No identity and no verified email: refuse outright. Do not create,
    // do not link, do not look the email up at all.
    if (!assertion.emailVerified) {
      return frozen(SOCIAL_IDENTITY_RESULTS.PROVIDER_EMAIL_UNVERIFIED);
    }

    let existing;
    try {
      existing = await userStore.findByEmail(assertion.email);
    } catch {
      return frozen(SOCIAL_IDENTITY_RESULTS.STORAGE_FAILURE);
    }

    // (C) Existing STRIDETO account with the same normalized email. This is
    // the approved launch policy: never auto-link. Authenticated Connected
    // Accounts linking is a separate, later phase.
    if (existing) {
      const classification = await classifyExistingAccount(existing);
      return frozen(classification, { user: existing });
    }

    // (D) Nothing exists. Eligible for canonical new social-user creation.
    return frozen(SOCIAL_IDENTITY_RESULTS.ELIGIBLE_FOR_NEW_ACCOUNT, {
      normalizedEmail: assertion.email,
      displayName: assertion.displayName,
    });
  }

  /** Confirms the canonical customer authority actually landed. */
  async function assertCanonicalCustomerAuthority(userId) {
    const grants = await capabilityService.listGrants(userId);
    const rows = Array.isArray(grants) ? grants : [];
    const student = rows.find(
      (grant) => grant.capability === USER_CAPABILITY_IDS.STUDENT
    );
    if (!student || !grantStatusAuthorizes(student.status)) return false;
    const businessClient = rows.find(
      (grant) => grant.capability === USER_CAPABILITY_IDS.BUSINESS_CLIENT
    );
    if (businessClient && grantStatusAuthorizes(businessClient.status)) return false;
    const state = await userStore.findByIdForCapabilityState(userId);
    return (
      state?.role === 'User'
      && state?.capabilityInitializationState === CAPABILITY_INITIALIZATION_STATES.READY
      && state?.capabilitySchemaVersion === CAPABILITY_SCHEMA_VERSION
    );
  }

  /**
   * Runs the canonical public-customer initialization on an already-created
   * User row, then creates the identity. Ordering is deliberate and is the
   * core failure-safety property of this phase: the `UserIdentity` — the only
   * thing that makes an account reachable by a social login — is written
   * **last**, and only after capability initialization is confirmed. A crash
   * or failure at any earlier point therefore leaves a user that no social
   * flow can authenticate as, rather than an authenticatable account without
   * canonical capabilities.
   */
  async function initializeAndLink(user, assertion, provenance) {
    try {
      await capabilityService.initializeCustomerUser(user, provenance);
    } catch {
      // `initializeCustomerUser` has already marked the row `failed` when the
      // grant did not land. No identity is created, so the account stays
      // unreachable and the next attempt resumes it.
      return frozen(SOCIAL_IDENTITY_RESULTS.CAPABILITY_INITIALIZATION_FAILED, {
        user,
      });
    }

    let authoritative;
    try {
      authoritative = await assertCanonicalCustomerAuthority(user._id);
    } catch {
      return frozen(SOCIAL_IDENTITY_RESULTS.CAPABILITY_INITIALIZATION_FAILED, {
        user,
      });
    }
    if (!authoritative) {
      return frozen(SOCIAL_IDENTITY_RESULTS.CAPABILITY_INITIALIZATION_FAILED, {
        user,
      });
    }

    try {
      await ensureReferralCode(user);
    } catch {
      // Referral codes are a rewards convenience, never authority. A failure
      // here must not strand an otherwise fully initialized account.
    }

    const linkedAt = now();
    let identity;
    try {
      identity = await identityStore.create({
        userId: user._id,
        provider: assertion.provider,
        subject: assertion.subject,
        emailAtLink: assertion.email,
        emailVerifiedAtLink: true,
        linkedAt,
        lastLoginAt: null,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        return frozen(SOCIAL_IDENTITY_RESULTS.STORAGE_FAILURE, { user });
      }
      // (F) A concurrent callback created the identity first. Converge on
      // whatever the unique index accepted rather than inventing a second one.
      return resolveIdentity(assertion);
    }

    return frozen(SOCIAL_IDENTITY_RESULTS.IDENTITY_RESOLVED, {
      user,
      identity,
      created: true,
    });
  }

  /**
   * Canonical new social-user creation. Provider-neutral: `provenance` is
   * supplied by the provider adapter (for Google this will be
   * `{ grantedBy: 'system:oauth_google', grantReason: 'student_registration_google' }`).
   *
   * Issues no session. Session issuance belongs to the provider callback phase
   * and goes through the existing, unchanged `userSecureAuthFlows`.
   */
  async function createSocialUser(rawAssertion, provenance = {}) {
    const assertion = normalizeAssertion(rawAssertion);
    if (!assertion) return frozen(SOCIAL_IDENTITY_RESULTS.INVALID_ASSERTION);
    if (!provenance.grantedBy || !provenance.grantReason) {
      return frozen(SOCIAL_IDENTITY_RESULTS.INVALID_ASSERTION);
    }

    /**
     * Re-resolve rather than trusting a caller-supplied verdict, and resume
     * our own debris from a previously failed creation instead of stranding
     * the address forever behind `existing_account_requires_link`. Only the
     * two states that permit a write proceed past here.
     */
    const resolveAndResume = async () => {
      const current = await resolveIdentity(assertion);
      if (current.code === SOCIAL_IDENTITY_RESULTS.INCOMPLETE_SOCIAL_REGISTRATION) {
        return initializeAndLink(current.user, assertion, provenance);
      }
      return current;
    };

    const resolution = await resolveAndResume();
    if (resolution.code !== SOCIAL_IDENTITY_RESULTS.ELIGIBLE_FOR_NEW_ACCOUNT) {
      return resolution;
    }

    let user;
    try {
      user = await userStore.create({
        email: assertion.email,
        name: assertion.displayName,
        role: 'User',
        emailVerified: true,
        hasPassword: false,
        capabilityInitializationState: CAPABILITY_INITIALIZATION_STATES.PENDING,
        ...legalAcceptanceMetadata(now()),
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        return frozen(SOCIAL_IDENTITY_RESULTS.STORAGE_FAILURE);
      }
      // (F) A concurrent request won the unique `email` index. Converge on
      // whatever it produced — completing its work if it has not finished —
      // rather than forking a second account.
      return resolveAndResume();
    }

    return initializeAndLink(user, assertion, provenance);
  }

  /**
   * Convenience composition for the future provider callback: resolve, and
   * create only when the policy says a new account is permitted. Still issues
   * no session.
   */
  async function resolveOrCreate(rawAssertion, provenance = {}) {
    const resolution = await resolveIdentity(rawAssertion);
    if (
      resolution.code === SOCIAL_IDENTITY_RESULTS.ELIGIBLE_FOR_NEW_ACCOUNT
      || resolution.code === SOCIAL_IDENTITY_RESULTS.INCOMPLETE_SOCIAL_REGISTRATION
    ) {
      return createSocialUser(rawAssertion, provenance);
    }
    return resolution;
  }

  return Object.freeze({ resolveIdentity, createSocialUser, resolveOrCreate });
}
