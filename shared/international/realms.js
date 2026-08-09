/**
 * Actor / realm vocabulary (Mission 1 — International Foundation).
 *
 * Strideto authenticates several independent actor realms. Today only User,
 * Employer and Admin/staff exist as live auth systems; Agent/Agency and
 * Institution are declared here as FUTURE realms so downstream authorization
 * code has one canonical vocabulary and role strings never drift.
 *
 * This module is vocabulary only. It does NOT create Agent or Institution login
 * portals, and it does NOT weaken the existing auth separation — server-side
 * authorization remains authoritative. The existing staff RBAC roles
 * (Editor/Moderator/Admin/SuperAdmin in server/src/config/rbac.js) are the
 * sub-roles of the ADMIN realm and are intentionally not duplicated here.
 *
 * Client- and server-safe: pure JS.
 */

/** Canonical actor realms. Values are stable storage strings — never rename. */
export const ACTOR_REALMS = Object.freeze({
  USER: 'user',
  EMPLOYER: 'employer',
  ADMIN: 'admin',
  // Declared for future missions; no live auth path yet.
  AGENT: 'agent',
  INSTITUTION: 'institution',
});

/** Realms that have a live authentication path in the current platform. */
export const ACTIVE_REALMS = Object.freeze([
  ACTOR_REALMS.USER,
  ACTOR_REALMS.EMPLOYER,
  ACTOR_REALMS.ADMIN,
  ACTOR_REALMS.AGENT,
]);

/** Realms declared for later missions (contract only, no live auth). */
export const FUTURE_REALMS = Object.freeze([
  ACTOR_REALMS.INSTITUTION,
]);

const REALM_VALUES = Object.values(ACTOR_REALMS);
const REALM_SET = new Set(REALM_VALUES);

/** All canonical realm values. */
export function allRealms() {
  return [...REALM_VALUES];
}

/** True for a known realm (active or future). */
export function isValidRealm(value) {
  return typeof value === 'string' && REALM_SET.has(value);
}

/** True only for a realm with a live auth path today. */
export function isActiveRealm(value) {
  return ACTIVE_REALMS.includes(value);
}

/**
 * Drift guard: every realm value is a unique, non-empty lowercase token.
 * Exposed so a test can assert the vocabulary cannot silently collide or drift
 * into mixed casing over time.
 */
export function assertRealmIntegrity() {
  const seen = new Set();
  for (const value of REALM_VALUES) {
    if (typeof value !== 'string' || !value) {
      throw new Error('Realm values must be non-empty strings');
    }
    if (value !== value.toLowerCase()) {
      throw new Error(`Realm value must be lowercase: ${value}`);
    }
    if (seen.has(value)) {
      throw new Error(`Duplicate realm value: ${value}`);
    }
    seen.add(value);
  }
  return true;
}
