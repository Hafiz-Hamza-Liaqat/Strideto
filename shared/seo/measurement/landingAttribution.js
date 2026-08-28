/**
 * SEO-P8 — privacy-safe landing attribution parameter extraction.
 * Persists only approved campaign fields — not full query strings.
 */
import { classifyChatGptAttribution, normalizeUtmSource } from './chatgptAttribution.js';
import { classifyPageGroup } from './pageGroups.js';
import { normalizeCanonicalPublicPath } from './canonicalPath.js';

const APPROVED_UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];

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
    if (value) attribution[key] = value.slice(0, 120);
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
export function buildLandingAttributionMetadata(pathname = '/', search = '') {
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
    chatgptAttributed: chatgpt.isChatGpt,
    chatgptSignal: chatgpt.signal,
  };
}
