/**
 * Homepage CMS safety — suppress unsupported aggregates and known legacy seed/demo hero copy.
 * CMS remains the owner for intentionally authored content; only exact legacy defaults are normalized.
 */

function normalizeCopy(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/[—–]/g, '-')
    .trim()
    .toLowerCase();
}

/** Exact legacy headlines from pre-MKT-P0B seed/i18n defaults — not arbitrary CMS editorial copy. */
const LEGACY_HERO_HEADLINES = new Set(
  [
    'Every Step Toward Success.',
    'Every Step Toward Success',
    'Find jobs, scholarships, admissions, and career resources worldwide',
  ].map(normalizeCopy)
);

/** Exact legacy subheadlines from pre-MKT-P0B seed/i18n defaults. */
const LEGACY_HERO_SUBHEADLINES = new Set(
  [
    'Discover jobs, scholarships, admissions, internships, and career resources worldwide—all in one place.',
    'Discover jobs, scholarships, admissions, internships, and career resources worldwide - all in one place.',
    'Discover jobs, scholarships, admissions, internships, and study opportunities — all in one place.',
    'Discover jobs, scholarships, admissions, internships, and study opportunities - all in one place.',
  ].map(normalizeCopy)
);

const LEGACY_HERO_CTA_LABELS = new Set(
  ['jobs', 'scholarships', 'admissions', 'internships'].map(normalizeCopy)
);

export function isLegacyHomepageHeroHeadline(text) {
  if (!text) return false;
  return LEGACY_HERO_HEADLINES.has(normalizeCopy(text));
}

export function isLegacyHomepageHeroSubheadline(text) {
  if (!text) return false;
  return LEGACY_HERO_SUBHEADLINES.has(normalizeCopy(text));
}

/**
 * Pre-MKT-P0B seed published four equal discovery chips instead of the new CTA hierarchy.
 */
export function isLegacyHomepageHeroCtas(ctas) {
  if (!Array.isArray(ctas) || ctas.length !== 4) return false;
  const labels = ctas.map((cta) => normalizeCopy(cta?.label));
  if (labels.some((label) => !label)) return false;
  return labels.every((label) => LEGACY_HERO_CTA_LABELS.has(label));
}

export function resolveHomepageHeroHeadline(cmsHeadline, fallback) {
  if (!cmsHeadline || isLegacyHomepageHeroHeadline(cmsHeadline)) return fallback;
  return cmsHeadline;
}

export function resolveHomepageHeroSubheadline(cmsSubheadline, fallback) {
  if (!cmsSubheadline || isLegacyHomepageHeroSubheadline(cmsSubheadline)) return fallback;
  return cmsSubheadline;
}

export function resolveHomepageHeroCtas(cmsCtas) {
  if (!cmsCtas?.length || isLegacyHomepageHeroCtas(cmsCtas)) return null;
  return cmsCtas;
}

export function isUnsupportedHomepageStat(stat) {
  if (!stat || typeof stat !== 'object') return true;
  const value = String(stat.value ?? '').trim();
  const label = String(stat.label ?? '').trim();
  if (!value || !label) return true;

  if (/^\d+\+$/.test(value) || /^\d{3,}$/.test(value)) return true;

  const combined = `${value} ${label}`;
  return [
    /\bthousand/i,
    /\bmillion/i,
    /\bverified\b/i,
    /\btrusted\b/i,
    /\bsuccess\s*rate/i,
    /100%/i,
  ].some((pattern) => pattern.test(combined));
}

export function filterSafeHomepageStats(stats) {
  if (!Array.isArray(stats) || !stats.length) return null;
  const safe = stats.filter((stat) => !isUnsupportedHomepageStat(stat));
  return safe.length ? safe : null;
}
