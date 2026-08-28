/**
 * SEO-P3 — density/content gates for intentionally approved indexable landings.
 *
 * Thresholds are route-type specific and supplied by callers; this module does
 * not invent production counts.
 */

export const SEO_LANDING_DISPOSITION = Object.freeze({
  INDEXABLE: 'INDEXABLE',
  NOINDEX: 'NOINDEX',
  NOT_FOUND: 'NOT_FOUND',
});

/**
 * Evaluate whether a registered static landing has enough substance to index.
 * Callers pass measured counts and content flags from repository truth.
 */
export function evaluateSeoLandingEligibility({
  routeType,
  resultCount = 0,
  minResults = 0,
  hasUniqueIntro = false,
  hasStableEntity = true,
  isPublic = true,
} = {}) {
  if (!isPublic) {
    return { indexable: false, disposition: SEO_LANDING_DISPOSITION.NOINDEX, reason: 'not_public' };
  }
  if (!hasStableEntity) {
    return { indexable: false, disposition: SEO_LANDING_DISPOSITION.NOT_FOUND, reason: 'unstable_entity' };
  }
  if (typeof minResults === 'number' && minResults > 0 && resultCount < minResults) {
    return {
      indexable: false,
      disposition: SEO_LANDING_DISPOSITION.NOINDEX,
      reason: 'insufficient_results',
    };
  }
  if (!hasUniqueIntro && routeType !== 'clean_collection') {
    return {
      indexable: false,
      disposition: SEO_LANDING_DISPOSITION.NOINDEX,
      reason: 'missing_unique_intro',
    };
  }
  return { indexable: true, disposition: SEO_LANDING_DISPOSITION.INDEXABLE, reason: 'eligible' };
}

/**
 * Valid collection with zero current results remains a valid page (not 404).
 * Unknown generated landing slugs should not masquerade as success pages.
 */
export function evaluateEmptyCollectionPolicy({ isKnownCollection = true } = {}) {
  if (isKnownCollection) {
    return { disposition: SEO_LANDING_DISPOSITION.INDEXABLE, reason: 'valid_collection_zero_results' };
  }
  return { disposition: SEO_LANDING_DISPOSITION.NOT_FOUND, reason: 'unknown_landing' };
}
