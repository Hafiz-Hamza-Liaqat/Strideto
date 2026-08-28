/**
 * SEO-P8 — canonical public path normalization for internal grouping.
 * Does not rewrite external provider URLs; only first-party paths.
 */
import { classifyCollectionQueryParam, QUERY_PARAM_KIND } from '../collectionSeoPolicy.js';

const TRACKING_KEYS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']);

/**
 * @param {string} rawPath
 * @returns {string}
 */
export function normalizeCanonicalPublicPath(rawPath = '') {
  const pathOnly = String(rawPath || '').split('?')[0].split('#')[0] || '/';
  let normalized = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized || '/';
}

/**
 * @param {string} rawUrlOrPath
 * @returns {{ canonicalPath: string, hasFacetParams: boolean, hasTrackingParams: boolean }}
 */
export function analyzePublicUrl(rawUrlOrPath = '') {
  const input = String(rawUrlOrPath || '');
  let pathname = input;
  let search = '';

  try {
    if (input.includes('://')) {
      const parsed = new URL(input);
      pathname = parsed.pathname;
      search = parsed.search;
    } else {
      const qIndex = input.indexOf('?');
      if (qIndex >= 0) {
        pathname = input.slice(0, qIndex);
        search = input.slice(qIndex);
      }
    }
  } catch {
    pathname = input.split('?')[0];
    search = input.includes('?') ? input.slice(input.indexOf('?')) : '';
  }

  const canonicalPath = normalizeCanonicalPublicPath(pathname);
  let hasFacetParams = false;
  let hasTrackingParams = false;

  if (search) {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    for (const [key] of params.entries()) {
      if (TRACKING_KEYS.has(key)) {
        hasTrackingParams = true;
        continue;
      }
      const kind = classifyCollectionQueryParam(key);
      if ([QUERY_PARAM_KIND.SEARCH, QUERY_PARAM_KIND.FILTER, QUERY_PARAM_KIND.SORT, QUERY_PARAM_KIND.PAGINATION].includes(kind)) {
        hasFacetParams = true;
      }
    }
  }

  return { canonicalPath, hasFacetParams, hasTrackingParams };
}
