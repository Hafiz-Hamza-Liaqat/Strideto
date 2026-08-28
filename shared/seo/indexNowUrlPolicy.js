/**
 * SEO-P5 — IndexNow URL safety (canonical public URLs only).
 */
import {
  PRODUCTION_PUBLIC_ORIGIN,
  CANONICAL_WWW_HOST,
  originLooksLikeLocalhost,
} from './publicSiteOrigin.js';
import { hasFilterQueryString, normalizeInternalPath } from './internalLinkSafety.js';
import { isPrivateSeoPath } from './robotsPolicy.js';

export const INDEXNOW_PROTOCOL_MAX_URLS = 10000;
export const INDEXNOW_DEFAULT_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const INDEXNOW_DEFAULT_KEY_PATH = '/indexnow-key.txt';

const REJECTED_HOST_PATTERNS = [
  /^api\./i,
  /\.vercel\.app$/i,
  /\.onrender\.com$/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/i,
];

/**
 * IndexNow key: 8–128 hex/alphanumeric per protocol practice.
 */
export function isValidIndexNowKey(key) {
  const value = String(key || '').trim();
  if (!value) return false;
  if (/\s/.test(value)) return false;
  if (value.length < 8 || value.length > 128) return false;
  return /^[a-zA-Z0-9-]+$/.test(value);
}

export function normalizeIndexNowUrlList(urls) {
  if (!Array.isArray(urls)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of urls) {
    const normalized = validateIndexNowCanonicalUrl(raw);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= INDEXNOW_PROTOCOL_MAX_URLS) break;
  }
  return out;
}

/**
 * @param {string} urlOrPath — absolute canonical URL or site-relative path
 * @param {{ origin?: string }} [options]
 * @returns {string|null}
 */
export function validateIndexNowCanonicalUrl(urlOrPath, { origin = PRODUCTION_PUBLIC_ORIGIN } = {}) {
  const raw = String(urlOrPath || '').trim();
  if (!raw) return null;
  if (raw.includes('?') || raw.includes('#')) return null;
  if (hasFilterQueryString(raw)) return null;

  let url;
  try {
    url = raw.startsWith('http://') || raw.startsWith('https://')
      ? new URL(raw)
      : new URL(normalizeInternalPath(raw), origin);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (url.hostname.toLowerCase() !== CANONICAL_WWW_HOST) return null;
  if (originLooksLikeLocalhost(url.origin)) return null;
  if (REJECTED_HOST_PATTERNS.some((re) => re.test(url.hostname))) return null;

  const path = normalizeInternalPath(url.pathname);
  if (!path || path === '/') return null;
  if (isPrivateSeoPath(path)) return null;

  return `${PRODUCTION_PUBLIC_ORIGIN}${path}`;
}

export function buildIndexNowPayload({ key, keyLocation, urls, host = CANONICAL_WWW_HOST }) {
  return {
    host,
    key: String(key).trim(),
    keyLocation,
    urlList: normalizeIndexNowUrlList(urls),
  };
}
