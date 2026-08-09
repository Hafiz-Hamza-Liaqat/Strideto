/**
 * Organization identity contract (Mission 1 — International Foundation).
 *
 * The additive abstraction that future organization actors — Employer/company,
 * Agent, Agency, University, College, Institute — will share. This module is
 * the contract (types, validation, slug rules). It does NOT replace the existing
 * Employer model and it does NOT migrate any employer; the persistence side is a
 * separate additive Organization model that links back to legacy records.
 *
 * Trust/verification state machines, evidence and risk are OWNED BY MISSION 2
 * and are intentionally NOT built here — only a coarse lifecycle `status` exists
 * so records can be represented.
 *
 * Client- and server-safe: pure JS.
 */
import { normalizeCountryCode } from './country.js';

/** Canonical organization types. Stable storage strings — never rename. */
export const ORGANIZATION_TYPES = Object.freeze({
  EMPLOYER: 'employer',
  AGENT: 'agent',
  AGENCY: 'agency',
  UNIVERSITY: 'university',
  COLLEGE: 'college',
  INSTITUTE: 'institute',
  // Mission 18 — institution portal types (additive, no existing values renamed)
  SCHOOL: 'school',
  TRAINING_CENTER: 'training_center',
});

const TYPE_VALUES = Object.values(ORGANIZATION_TYPES);
const TYPE_SET = new Set(TYPE_VALUES);

/** Coarse lifecycle. Verification sub-states are Mission 2's concern. */
export const ORGANIZATION_STATUSES = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
});

const STATUS_VALUES = Object.values(ORGANIZATION_STATUSES);
const STATUS_SET = new Set(STATUS_VALUES);

/** All canonical organization type values. */
export function organizationTypes() {
  return [...TYPE_VALUES];
}

/** True for a known organization type. */
export function isValidOrganizationType(value) {
  return typeof value === 'string' && TYPE_SET.has(value);
}

/** True for a known lifecycle status. */
export function isValidOrganizationStatus(value) {
  return typeof value === 'string' && STATUS_SET.has(value);
}

/**
 * Base slug for a display/legal name: lowercase, ASCII-word tokens joined by
 * single hyphens. Never empty (`'organization'` fallback) so every record is
 * addressable. Slug SEMANTICS (uniqueness) are enforced by
 * `ensureUniqueOrganizationSlug`, not here.
 */
export function organizationSlugBase(name) {
  const base = (typeof name === 'string' ? name : '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'organization';
}

/** Deterministic slug candidate for attempt N (0 = bare base, then -2, -3, …). */
export function organizationSlugCandidate(name, attempt = 0) {
  const base = organizationSlugBase(name);
  return attempt <= 0 ? base : `${base}-${attempt + 1}`;
}

/**
 * Resolve the first non-colliding slug. `slugExists` is injected (returns
 * whether a candidate is already taken) so this stays DB-agnostic and unit
 * testable, exactly like the accepted employer-slug helper.
 *
 * @param {string} name
 * @param {(slug: string) => (boolean|Promise<boolean>)} slugExists
 * @param {{ maxAttempts?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function ensureUniqueOrganizationSlug(name, slugExists, { maxAttempts = 100 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = organizationSlugCandidate(name, attempt);
    // eslint-disable-next-line no-await-in-loop
    const taken = await slugExists(candidate);
    if (!taken) return candidate;
  }
  return `${organizationSlugBase(name)}-${Date.now().toString(36)}`;
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const hasUnsafeDisplayMarkup = (v) => /[<>\u0000-\u001F\u007F]/u.test(v);

/**
 * Validate + normalize an organization identity candidate (the additive core
 * fields). Verification/evidence fields are NOT accepted here — Mission 2.
 *
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validateOrganizationCore(input = {}) {
  const errors = [];
  const out = {};

  if (!isValidOrganizationType(input.organizationType)) {
    errors.push('organizationType is invalid');
  } else {
    out.organizationType = input.organizationType;
  }

  out.legalName = str(input.legalName);
  out.displayName = str(input.displayName) || out.legalName;
  if (!out.displayName) errors.push('displayName or legalName is required');
  if (hasUnsafeDisplayMarkup(out.legalName) || hasUnsafeDisplayMarkup(out.displayName)) {
    errors.push('organization names must be plain Unicode text without markup or control characters');
  }

  if (input.countryCode !== undefined && input.countryCode !== null && str(input.countryCode)) {
    const cc = normalizeCountryCode(input.countryCode);
    if (!cc) errors.push('countryCode must be a valid ISO 3166-1 alpha-2 code');
    else out.countryCode = cc;
  }

  const status = input.status === undefined ? ORGANIZATION_STATUSES.DRAFT : input.status;
  if (!isValidOrganizationStatus(status)) errors.push('status is invalid');
  else out.status = status;

  out.website = str(input.website);
  out.officialDomain = str(input.officialDomain).toLowerCase();

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: out };
}
