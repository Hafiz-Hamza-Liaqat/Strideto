/**
 * SEO-P3 — collection/search URL indexability and canonical policy.
 *
 * Clean collection routes are self-canonical and indexable.
 * Search, filter, sort, and pagination query permutations canonicalize to the
 * clean collection and are noindex,follow to prevent crawl traps.
 */

export const QUERY_PARAM_KIND = Object.freeze({
  SEARCH: 'SEARCH',
  FILTER: 'FILTER',
  SORT: 'SORT',
  PAGINATION: 'PAGINATION',
  UI_STATE: 'UI_STATE',
  TRACKING: 'TRACKING',
  UNKNOWN: 'UNKNOWN',
});

/** Repository-truth classification for public discovery query keys. */
export const COLLECTION_QUERY_PARAM_KINDS = Object.freeze({
  search: QUERY_PARAM_KIND.SEARCH,
  q: QUERY_PARAM_KIND.SEARCH,
  page: QUERY_PARAM_KIND.PAGINATION,
  limit: QUERY_PARAM_KIND.PAGINATION,
  sort: QUERY_PARAM_KIND.SORT,
  countryCode: QUERY_PARAM_KIND.FILTER,
  country: QUERY_PARAM_KIND.FILTER,
  region: QUERY_PARAM_KIND.FILTER,
  province: QUERY_PARAM_KIND.FILTER,
  city: QUERY_PARAM_KIND.FILTER,
  jobFamily: QUERY_PARAM_KIND.FILTER,
  specialization: QUERY_PARAM_KIND.FILTER,
  category: QUERY_PARAM_KIND.FILTER,
  organization: QUERY_PARAM_KIND.FILTER,
  deadline: QUERY_PARAM_KIND.FILTER,
  type: QUERY_PARAM_KIND.FILTER,
  employmentType: QUERY_PARAM_KIND.FILTER,
  applyType: QUERY_PARAM_KIND.FILTER,
  workMode: QUERY_PARAM_KIND.FILTER,
  level: QUERY_PARAM_KIND.FILTER,
  degree: QUERY_PARAM_KIND.FILTER,
  degreeLevel: QUERY_PARAM_KIND.FILTER,
  studyLevel: QUERY_PARAM_KIND.FILTER,
  field: QUERY_PARAM_KIND.FILTER,
  subject: QUERY_PARAM_KIND.FILTER,
  institution: QUERY_PARAM_KIND.FILTER,
  institutionId: QUERY_PARAM_KIND.FILTER,
  institutionType: QUERY_PARAM_KIND.FILTER,
  provider: QUERY_PARAM_KIND.FILTER,
  providerType: QUERY_PARAM_KIND.FILTER,
  fundingType: QUERY_PARAM_KIND.FILTER,
  scholarshipType: QUERY_PARAM_KIND.FILTER,
  applicationMethod: QUERY_PARAM_KIND.FILTER,
  university: QUERY_PARAM_KIND.FILTER,
  universityId: QUERY_PARAM_KIND.FILTER,
  program: QUERY_PARAM_KIND.FILTER,
  studyMode: QUERY_PARAM_KIND.FILTER,
  isPaid: QUERY_PARAM_KIND.FILTER,
  duration: QUERY_PARAM_KIND.FILTER,
  applyMethod: QUERY_PARAM_KIND.FILTER,
  skillset: QUERY_PARAM_KIND.FILTER,
  compensation: QUERY_PARAM_KIND.FILTER,
  location: QUERY_PARAM_KIND.FILTER,
  featured: QUERY_PARAM_KIND.FILTER,
  lang: QUERY_PARAM_KIND.UI_STATE,
  utm_source: QUERY_PARAM_KIND.TRACKING,
  utm_medium: QUERY_PARAM_KIND.TRACKING,
  utm_campaign: QUERY_PARAM_KIND.TRACKING,
  utm_term: QUERY_PARAM_KIND.TRACKING,
  utm_content: QUERY_PARAM_KIND.TRACKING,
  gclid: QUERY_PARAM_KIND.TRACKING,
  fbclid: QUERY_PARAM_KIND.TRACKING,
});

const NON_INDEXABLE_KINDS = new Set([
  QUERY_PARAM_KIND.SEARCH,
  QUERY_PARAM_KIND.FILTER,
  QUERY_PARAM_KIND.SORT,
  QUERY_PARAM_KIND.PAGINATION,
]);

const DEFAULT_SORT_VALUES = new Set(['newest', 'default', 'relevance', '']);

export function classifyCollectionQueryParam(key) {
  return COLLECTION_QUERY_PARAM_KINDS[key] || QUERY_PARAM_KIND.UNKNOWN;
}

function isEmptyParamValue(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

/**
 * Strip normalized/no-op query keys so ?page=1 and ?search= do not create facets.
 */
export function normalizeCollectionQuery(searchParams, { defaultSort = 'newest' } = {}) {
  const input =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(searchParams || '');

  const out = new URLSearchParams();
  for (const [key, raw] of input.entries()) {
    if (isEmptyParamValue(raw)) continue;
    if (key === 'page' && (raw === '1' || raw === 1)) continue;
    if (key === 'sort') {
      const sortVal = String(raw).trim().toLowerCase();
      const defaultVal = String(defaultSort || 'newest').trim().toLowerCase();
      if (sortVal === defaultVal || DEFAULT_SORT_VALUES.has(sortVal)) continue;
    }
    if (key === 'limit') continue;
    out.append(key, String(raw).trim());
  }
  return out;
}

export function hasNonIndexableCollectionQuery(searchParams, options) {
  const normalized = normalizeCollectionQuery(searchParams, options);
  for (const [key] of normalized.entries()) {
    const kind = classifyCollectionQueryParam(key);
    if (NON_INDEXABLE_KINDS.has(kind)) return true;
    if (kind === QUERY_PARAM_KIND.UNKNOWN && key !== 'lang') return true;
  }
  return false;
}

/**
 * Evaluate SEO directives for a public collection route.
 *
 * Pagination policy (SEO-P3): page 2+ is UI-only on most surfaces; public
 * detail URLs remain discoverable via sitemap and collection navigation, so
 * paginated/filtered collection URLs use noindex,follow + clean canonical.
 */
export function evaluateCollectionSeo({ cleanPath, searchParams, defaultSort = 'newest' } = {}) {
  const path = String(cleanPath || '/').startsWith('/') ? String(cleanPath) : `/${cleanPath}`;
  const normalized = normalizeCollectionQuery(searchParams, { defaultSort });
  const faceted = hasNonIndexableCollectionQuery(normalized, { defaultSort });

  if (!faceted) {
    return {
      indexable: true,
      canonicalPath: path,
      robots: 'index, follow',
      reason: 'clean_collection',
      normalizedQuery: normalized.toString(),
    };
  }

  return {
    indexable: false,
    canonicalPath: path,
    robots: 'noindex, follow',
    reason: 'faceted_collection_query',
    normalizedQuery: normalized.toString(),
  };
}

export function collectionSeoHeadProps({ cleanPath, searchParams, defaultSort } = {}) {
  const policy = evaluateCollectionSeo({ cleanPath, searchParams, defaultSort });
  return {
    canonical: policy.canonicalPath,
    noindex: !policy.indexable,
    robots: policy.robots,
    policy,
  };
}
