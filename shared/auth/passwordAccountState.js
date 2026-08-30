/**
 * Password-account state (Google Sign-In P1).
 *
 * `User.hasPassword` is the explicit marker introduced so a social-only
 * account can exist without a password at all. It is deliberately interpreted
 * through this helper rather than read raw, because three shapes must all be
 * handled and only one of them is new:
 *
 *   `hasPassword === true`   — a password account (every registration path).
 *   `hasPassword === false`  — a social-only account. Only the canonical
 *                              social-user creation path ever writes this.
 *   field absent/undefined   — a historical document written before the field
 *                              existed. These are password accounts: they were
 *                              all created through a path that required a
 *                              password. Treated as `true`.
 *
 * The absent case is why no production backfill is required. `hasPassword`
 * carries a schema default of `true`, so every newly written and newly
 * hydrated document is explicit; historical rows are read correctly without
 * being rewritten. A stored password, when the caller has selected it, is
 * used as corroborating proof — but its absence is never taken as proof of a
 * social-only account, because `User.password` is `select: false` and is
 * simply not loaded on most queries.
 *
 * Fail direction: unknown state resolves to "password account", which
 * preserves exactly the pre-P1 behaviour of every existing flow.
 */

export function accountHasPassword(user) {
  if (!user || typeof user !== 'object') return false;
  if (user.hasPassword === false) return false;
  if (user.hasPassword === true) return true;
  // Historical document. If the password field was actually selected, use it;
  // otherwise assume the pre-P1 invariant that every account has a password.
  if (typeof user.password === 'string') return user.password.length > 0;
  return true;
}

/**
 * True only for accounts that provably have no password and therefore cannot
 * participate in any password flow.
 */
export function isSocialOnlyAccount(user) {
  return !accountHasPassword(user);
}

/**
 * Canonical, user-facing reason returned by password flows that a social-only
 * account may reach while authenticated. Never used on unauthenticated flows,
 * where responses must stay generic for anti-enumeration.
 */
export const PASSWORD_NOT_SET_CODE = 'password_not_set';

export const PASSWORD_NOT_SET_MESSAGE =
  'This account signs in with a connected provider and has no password set.';
