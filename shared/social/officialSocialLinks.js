/**
 * Official Strideto social profiles (E.1F-F / E.1F-G).
 * Only URLs confirmed by product may appear here.
 */

export const OFFICIAL_LINKEDIN_COMPANY_URL = 'https://www.linkedin.com/company/strideto/';

/** Platforms with confirmed public URLs (others must stay hidden). */
export const CONFIRMED_SOCIAL_PLATFORMS = {
  linkedin: OFFICIAL_LINKEDIN_COMPANY_URL,
};

const PLACEHOLDER_HOST_SNIPPETS = ['example.com', 'example.org', 'placeholder', 'yourcompany'];

const DEFERRED_URL_PATTERNS = [
  /facebook\.com/i,
  /instagram\.com/i,
  /twitter\.com/i,
  /(^|\.)x\.com/i,
  /youtube\.com/i,
  /youtu\.be/i,
  /tiktok\.com/i,
  /t\.me\//i,
  /telegram\.(me|org)/i,
  /wa\.me/i,
  /whatsapp\.com/i,
  /github\.com/i,
];

function normalizePlatformKey(platform, icon) {
  const raw = String(platform || icon || '')
    .trim()
    .toLowerCase();
  if (!raw) return '';
  if (raw.includes('linked')) return 'linkedin';
  if (raw.includes('twitter') || raw === 'x') return 'twitter';
  if (raw.includes('telegram')) return 'telegram';
  if (raw.includes('facebook')) return 'facebook';
  if (raw.includes('instagram')) return 'instagram';
  if (raw.includes('youtube')) return 'youtube';
  if (raw.includes('tiktok')) return 'tiktok';
  if (raw.includes('whatsapp')) return 'whatsapp';
  if (raw.includes('github')) return 'github';
  return raw;
}

function normalizeUrlForCompare(url) {
  try {
    const u = new URL(String(url).trim());
    return `${u.origin}${u.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return '';
  }
}

const OFFICIAL_LINKEDIN_COMPARE = normalizeUrlForCompare(OFFICIAL_LINKEDIN_COMPANY_URL);

/**
 * @param {string} [url]
 * @returns {boolean}
 */
export function isUsableSocialUrl(url) {
  const raw = String(url || '').trim();
  if (!raw || raw === '#' || raw.startsWith('javascript:')) return false;
  const lower = raw.toLowerCase();
  if (PLACEHOLDER_HOST_SNIPPETS.some((p) => lower.includes(p))) return false;
  if (DEFERRED_URL_PATTERNS.some((re) => re.test(lower))) return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * True when CMS provides a LinkedIn URL that matches the confirmed company page (normalized).
 * @param {string} [url]
 */
export function isConfirmedLinkedInUrl(url) {
  if (!isUsableSocialUrl(url)) return false;
  const norm = normalizeUrlForCompare(url);
  return norm === OFFICIAL_LINKEDIN_COMPARE;
}

/**
 * Resolve public footer/contact social links.
 * - Only confirmed LinkedIn is shown.
 * - CMS may override display order only when it supplies the same confirmed LinkedIn URL.
 * - Blank, placeholder, or deferred-platform CMS entries are ignored.
 * - Code fallback always supplies LinkedIn when CMS does not provide a valid confirmed URL.
 *
 * @param {Array<{ platform?: string, icon?: string, url?: string }>} [cmsSocialLinks]
 * @returns {Array<{ id: string, href: string }>}
 */
export function resolvePublicSocialLinks(cmsSocialLinks = []) {
  const list = Array.isArray(cmsSocialLinks) ? cmsSocialLinks : [];
  let useLinkedIn = true;

  for (const entry of list) {
    const id = normalizePlatformKey(entry.platform, entry.icon);
    if (id !== 'linkedin') continue;
    if (isConfirmedLinkedInUrl(entry.url)) {
      useLinkedIn = true;
      break;
    }
    if (entry.url && !isConfirmedLinkedInUrl(entry.url)) {
      // Do not replace official URL with unconfirmed CMS value
      useLinkedIn = true;
      break;
    }
  }

  if (!useLinkedIn) return [];

  return [{ id: 'linkedin', href: OFFICIAL_LINKEDIN_COMPANY_URL }];
}

/**
 * Organization schema sameAs — confirmed profiles only.
 * @returns {string[]}
 */
export function organizationSameAsUrls() {
  return [OFFICIAL_LINKEDIN_COMPANY_URL];
}
