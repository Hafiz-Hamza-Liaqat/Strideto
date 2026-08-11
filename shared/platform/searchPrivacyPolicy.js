/**
 * Global / contextual search privacy policy (Phase 1).
 *
 * Explicit allowlist for indexable domains and denylist for private domains.
 * Unknown search domain: fail closed.
 */
import {
  SEARCH_ENTITY_TYPES,
  PUBLIC_SEARCH_ENTITY_TYPES,
  isSearchEntityType,
} from '../search/entityTypes.js';

/** Domains that must NEVER be indexed or returned by global search. */
export const SEARCH_PRIVACY_DENIED_DOMAINS = Object.freeze([
  'vault',
  'vault_document',
  'private_message',
  'message',
  'case_private_note',
  'budget',
  'cost_plan',
  'copilot_conversation',
  'copilot_history',
  'internal_review_note',
  'reviewer_reason',
  'payment_secret',
  'payment_method',
  'student_private_profile',
  'audit_log',
]);

export const SEARCH_PRIVACY_DENIED_DOMAIN_SET = new Set(SEARCH_PRIVACY_DENIED_DOMAINS);

/** Public discovery domains allowed in global search (positive allowlist). */
export const SEARCH_PRIVACY_ALLOWED_PUBLIC_DOMAINS = Object.freeze([
  ...PUBLIC_SEARCH_ENTITY_TYPES,
  'internship',
  'program',
  'institution',
  'test',
  'agent_public',
  'service_public',
]);

export const SEARCH_PRIVACY_ALLOWED_PUBLIC_SET = new Set(
  SEARCH_PRIVACY_ALLOWED_PUBLIC_DOMAINS
);

/**
 * True when a domain/entity type may be indexed for the given search context.
 *
 * @param {string} domain
 * @param {'public'|'authorized'} [context='public']
 */
export function isSearchDomainAllowed(domain, context = 'public') {
  if (!domain || typeof domain !== 'string') return false;
  const normalized = domain.toLowerCase().trim();

  if (SEARCH_PRIVACY_DENIED_DOMAIN_SET.has(normalized)) return false;

  if (context === 'public') {
    if (SEARCH_PRIVACY_ALLOWED_PUBLIC_SET.has(normalized)) return true;
    if (isSearchEntityType(normalized) && PUBLIC_SEARCH_ENTITY_TYPES.includes(normalized)) {
      return true;
    }
    return false;
  }

  if (SEARCH_PRIVACY_DENIED_DOMAIN_SET.has(normalized)) return false;
  return isSearchEntityType(normalized) || SEARCH_PRIVACY_ALLOWED_PUBLIC_SET.has(normalized);
}

/** Fail-closed guard for search indexing pipelines. */
export function assertSearchIndexAllowed(domain, context = 'public') {
  if (!isSearchDomainAllowed(domain, context)) {
    throw new Error(`Search domain denied by privacy policy: ${domain}`);
  }
  return true;
}

/** All known searchable entity types (for inventory tests). */
export function allKnownSearchEntityTypes() {
  return [...SEARCH_ENTITY_TYPES];
}

/**
 * Public search type clamp (Phase 7). Unknown and denied domains fail closed.
 * @param {string[]} types
 * @returns {{ allowed: string[], denied: string[] }}
 */
export function clampPublicSearchTypes(types) {
  const requested = Array.isArray(types) ? types : [];
  const allowed = [];
  const denied = [];
  for (const type of requested) {
    if (isSearchDomainAllowed(type, 'public')) allowed.push(type);
    else denied.push(type);
  }
  return { allowed, denied };
}
