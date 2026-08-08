/**
 * Employer public-profile slug generation (Mission 0 — Employer stabilization).
 *
 * The Employer model has always declared a unique, sparse `slug` field and the
 * public profile controller resolves employers by it, but no code ever
 * generated one — so newly registered employers had no reachable public
 * profile. These helpers produce a deterministic, collision-safe slug and are
 * shared by the registration path and the (dry-run-first) backfill script.
 *
 * International note: slugs derive from the free-text `companyName`, so they are
 * inherently locale-agnostic; no country/currency assumption is embedded here.
 */
import { employerSlug as baseEmployerSlug } from './slugify.js';

/**
 * Slugs that would collide with real Employer portal / auth routes under the
 * public `/employer/:slug` gate. Kept in sync with the client-side
 * `EmployerPublicGate` reserved list so a generated slug is always reachable.
 */
export const RESERVED_EMPLOYER_SLUGS = new Set([
  'jobs',
  'settings',
  'applications',
  'analytics',
  'login',
  'register',
  'new',
  'notifications',
  'dashboard',
  'intelligence',
  'me',
  'profile',
  'plans',
]);

/** Deterministic base slug for a company name, never empty and never reserved. */
export function employerSlugBase(companyName) {
  const base = baseEmployerSlug(companyName);
  const safe = base || 'employer';
  return RESERVED_EMPLOYER_SLUGS.has(safe) ? `${safe}-org` : safe;
}

/**
 * Deterministic slug candidate for a given attempt index. Attempt 0 is the
 * bare base; later attempts append `-2`, `-3`, … so collision resolution is
 * stable and human-readable.
 */
export function employerSlugCandidate(companyName, attempt = 0) {
  const base = employerSlugBase(companyName);
  return attempt <= 0 ? base : `${base}-${attempt + 1}`;
}

/**
 * Resolve the first non-colliding slug for a company name.
 *
 * @param {string} companyName
 * @param {(slug: string) => (boolean | Promise<boolean>)} slugExists
 *   Predicate that returns whether a candidate slug is already taken. Injected
 *   so this stays unit-testable without a database.
 * @param {{ maxAttempts?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function ensureUniqueEmployerSlug(companyName, slugExists, { maxAttempts = 100 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = employerSlugCandidate(companyName, attempt);
    // eslint-disable-next-line no-await-in-loop
    const taken = await slugExists(candidate);
    if (!taken) return candidate;
  }
  // Extremely unlikely fallback: guarantee uniqueness with a compact suffix.
  return `${employerSlugBase(companyName)}-${Date.now().toString(36)}`;
}
