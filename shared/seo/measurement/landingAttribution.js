/**
 * SEO-P8 — privacy-safe landing attribution parameter extraction.
 * Persists only approved campaign fields — not full query strings.
 */
import { classifyChatGptAttribution, normalizeUtmSource } from './chatgptAttribution.js';
import { classifyPageGroup } from './pageGroups.js';
import { normalizeCanonicalPublicPath } from './canonicalPath.js';

export const ATTRIBUTION_SCHEMA_VERSION = '1';
export const APPROVED_ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'landingPage',
  'referrerCategory',
];
const APPROVED_UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
const MAX_VALUE_LENGTH = 120;

function cleanValue(value, { lowercase = false } = {}) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_VALUE_LENGTH);
  if (!cleaned) return null;
  return lowercase ? cleaned.toLowerCase() : cleaned;
}

export function normalizeAttribution(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const result = {};
  const source = cleanValue(input.utm_source, { lowercase: true });
  const medium = cleanValue(input.utm_medium, { lowercase: true });
  const campaign = cleanValue(input.utm_campaign);
  const content = cleanValue(input.utm_content);
  let landingPage = null;
  if (typeof input.landingPage === 'string') {
    try { landingPage = normalizeCanonicalPublicPath(input.landingPage).slice(0, 500); } catch { landingPage = null; }
  }
  const referrerCategory = cleanValue(input.referrerCategory, { lowercase: true });
  if (source) result.utm_source = normalizeUtmSource(source);
  if (medium) result.utm_medium = medium;
  if (campaign) result.utm_campaign = campaign;
  if (content) result.utm_content = content;
  if (landingPage) result.landingPage = landingPage;
  if (referrerCategory && ['direct', 'search', 'social', 'referral', 'unknown'].includes(referrerCategory)) {
    result.referrerCategory = referrerCategory;
  }
  return Object.keys(result).length ? result : null;
}

/**
 * @param {string|URLSearchParams} search
 */
export function extractApprovedAttributionParams(search = '') {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search || '').replace(/^\?/, ''));

  const attribution = {};
  for (const key of APPROVED_UTM_KEYS) {
    const value = params.get(key);
    if (value) attribution[key] = cleanValue(value, { lowercase: key === 'utm_source' || key === 'utm_medium' });
  }
  if (attribution.utm_source) {
    attribution.utm_source = normalizeUtmSource(attribution.utm_source);
  }
  return attribution;
}

/**
 * @param {string} pathname
 * @param {string|URLSearchParams} [search]
 */
function classifyReferrerCategory(referrer = '') {
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (/google\.|bing\.|duckduckgo\.|yahoo\./.test(host)) return 'search';
    if (/facebook\.|instagram\.|linkedin\.|twitter\.|x\.com|t\.co|whatsapp\./.test(host)) return 'social';
    return 'referral';
  } catch {
    return 'unknown';
  }
}

export function buildLandingAttributionMetadata(pathname = '/', search = '', referrer = '') {
  const utm = extractApprovedAttributionParams(search);
  const landingPage = normalizeCanonicalPublicPath(pathname);
  const { pageGroup, isApprovedLanding } = classifyPageGroup(landingPage);
  const chatgpt = classifyChatGptAttribution({
    utmSource: utm.utm_source,
  });

  return {
    landingPage,
    pageGroup,
    isApprovedLanding,
    acquisitionSource: chatgpt.isChatGpt ? 'chatgpt' : (utm.utm_source || null),
    acquisitionMedium: utm.utm_medium || null,
    acquisitionCampaign: utm.utm_campaign || null,
    utm_source: utm.utm_source || null,
    utm_medium: utm.utm_medium || null,
    utm_campaign: utm.utm_campaign || null,
    utm_content: utm.utm_content || null,
    referrerCategory: classifyReferrerCategory(referrer),
    attributionSchemaVersion: ATTRIBUTION_SCHEMA_VERSION,
    chatgptAttributed: chatgpt.isChatGpt,
    chatgptSignal: chatgpt.signal,
  };
}
