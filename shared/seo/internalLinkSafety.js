/**
 * SEO-P4 — shared internal-link safety policy.
 * Pure functions only; no routing or CMS side effects.
 */
import { isPrivateSeoPath } from './robotsPolicy.js';

const FILTER_QUERY_KEYS = new Set([
  'search',
  'sort',
  'page',
  'filter',
  'q',
  'city',
  'country',
  'countrycode',
  'jobfamily',
  'specialization',
  'field',
  'institutionid',
  'province',
  'region',
  'type',
  'category',
  'tags',
  'deadline',
  'workmode',
]);

/**
 * @param {string} path
 * @returns {string}
 */
export function normalizeInternalPath(path) {
  if (!path || typeof path !== 'string') return '';
  const withoutHash = path.split('#')[0].trim();
  const withoutQuery = withoutHash.split('?')[0].trim();
  if (!withoutQuery) return '';
  if (withoutQuery.startsWith('http://') || withoutQuery.startsWith('https://')) {
    try {
      return normalizeInternalPath(new URL(withoutQuery).pathname);
    } catch {
      return '';
    }
  }
  const normalized = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function hasFilterQueryString(url) {
  if (!url || typeof url !== 'string' || !url.includes('?')) return false;
  try {
    const search = url.includes('://') ? new URL(url).search : url.slice(url.indexOf('?'));
    const params = new URLSearchParams(search);
    for (const key of params.keys()) {
      const k = key.toLowerCase();
      if (FILTER_QUERY_KEYS.has(k) || k.startsWith('utm_')) return true;
    }
  } catch {
    return true;
  }
  return false;
}

/**
 * @param {string} path
 * @param {{ currentPath?: string, allowQuery?: boolean }} [options]
 * @returns {boolean}
 */
export function isSafeInternalLink(path, { currentPath, allowQuery = false } = {}) {
  const normalized = normalizeInternalPath(path);
  if (!normalized) return false;
  if (!allowQuery && hasFilterQueryString(path)) return false;
  if (currentPath && normalized === normalizeInternalPath(currentPath)) return false;
  if (normalized.startsWith('/admin')) return false;
  if (isPrivateSeoPath(normalized)) return false;
  return true;
}

/**
 * @template {{ path: string }} T
 * @param {T[]} items
 * @param {{ keyFn?: (item: T) => string }} [options]
 * @returns {T[]}
 */
export function dedupeInternalLinks(items, { keyFn = (item) => normalizeInternalPath(item.path) } = {}) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * @template {{ path: string }} T
 * @param {T[]} items
 * @param {{ currentPath?: string, allowQuery?: boolean, keyFn?: (item: T) => string }} [options]
 * @returns {T[]}
 */
export function filterSafeInternalLinks(items, options = {}) {
  return dedupeInternalLinks(
    (items || []).filter((item) => item?.path && isSafeInternalLink(item.path, options)),
    options,
  );
}
