/**
 * SEO-P8 — ChatGPT referral attribution (deterministic UTM signal).
 * Does NOT claim prompts, citations, impressions, or rankings.
 */

export const CHATGPT_UTM_SOURCE = 'chatgpt.com';

const CHATGPT_REFERRER_HOSTS = new Set(['chatgpt.com', 'www.chatgpt.com']);

/**
 * @param {string} utmSource
 */
export function normalizeUtmSource(utmSource) {
  return String(utmSource || '').trim().toLowerCase();
}

/**
 * Primary deterministic ChatGPT classification rule.
 * @param {string} utmSource
 */
export function isChatGptUtmSource(utmSource) {
  return normalizeUtmSource(utmSource) === CHATGPT_UTM_SOURCE;
}

/**
 * Optional host-level referrer fallback — secondary only.
 * @param {string} referrerUrl
 */
export function isChatGptReferrerHost(referrerUrl) {
  if (!referrerUrl) return false;
  try {
    const host = new URL(referrerUrl).hostname.toLowerCase();
    return CHATGPT_REFERRER_HOSTS.has(host);
  } catch {
    return false;
  }
}

/**
 * @param {{ utmSource?: string, referrer?: string }} input
 * @returns {{ isChatGpt: boolean, signal: 'utm_source'|'referrer_host'|null }}
 */
export function classifyChatGptAttribution(input = {}) {
  if (isChatGptUtmSource(input.utmSource)) {
    return { isChatGpt: true, signal: 'utm_source' };
  }
  if (isChatGptReferrerHost(input.referrer)) {
    return { isChatGpt: true, signal: 'referrer_host' };
  }
  return { isChatGpt: false, signal: null };
}

/**
 * Reject loose AI/GPT substring matching.
 * @param {string} utmSource
 */
export function isLooseAiSourceMisclassification(utmSource) {
  const normalized = normalizeUtmSource(utmSource);
  if (!normalized) return false;
  if (isChatGptUtmSource(normalized)) return false;
  return /(?:^|[._-])(ai|gpt|chat|openai)(?:[._-]|$)/i.test(normalized);
}
