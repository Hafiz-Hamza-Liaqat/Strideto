/**
 * Versioned cookie / browser-storage consent preferences.
 * Essential auth/security storage is never gated by this module.
 */

export const CONSENT_VERSION = 1;
export const CONSENT_STORAGE_KEY = 'strideto-cookie-consent';
/** Legacy string consent: "essential" | "all" */
export const LEGACY_CONSENT_KEY = 'edurozgaar-cookie-consent';
export const CONSENT_UPDATED_EVENT = 'cookie-consent-updated';
export const OPEN_COOKIE_SETTINGS_EVENT = 'open-cookie-settings';

/**
 * Google AdSense is the only optional marketing tag wired in the client.
 * It activates only when VITE_ADSENSE_CLIENT_ID is set at build time.
 */
export function isMarketingTechnologyConfigured() {
  try {
    return Boolean(import.meta.env?.VITE_ADSENSE_CLIENT_ID);
  } catch {
    return false;
  }
}

export function createConsentRecord({
  functional = true,
  analytics = false,
  marketing = false,
  adsConfigured = isMarketingTechnologyConfigured(),
  updatedAt = new Date().toISOString(),
} = {}) {
  return Object.freeze({
    version: CONSENT_VERSION,
    necessary: true,
    functional: Boolean(functional),
    analytics: Boolean(analytics),
    marketing: adsConfigured ? Boolean(marketing) : false,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : new Date().toISOString(),
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Normalize stored or partial consent. Always forces necessary=true.
 * Bumps outdated versions to current shape (caller may re-prompt).
 */
export function normalizeConsent(raw, {
  adsConfigured = isMarketingTechnologyConfigured(),
} = {}) {
  if (typeof raw === 'string') {
    if (raw === 'all') {
      return createConsentRecord({
        functional: true,
        analytics: true,
        marketing: true,
        adsConfigured,
      });
    }
    if (raw === 'essential') {
      return createConsentRecord({
        functional: true,
        analytics: false,
        marketing: false,
        adsConfigured,
      });
    }
    return null;
  }

  if (!isPlainObject(raw)) return null;

  const version = Number(raw.version);
  if (!Number.isInteger(version) || version < 1) return null;

  return createConsentRecord({
    functional: raw.functional !== false,
    analytics: raw.analytics === true,
    marketing: raw.marketing === true,
    adsConfigured,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  });
}

/**
 * True when stored consent is present and matches current CONSENT_VERSION.
 */
export function isConsentCurrent(consent) {
  return Boolean(consent) && consent.version === CONSENT_VERSION && consent.necessary === true;
}

function readRawFromStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const current = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (current) {
      try {
        return JSON.parse(current);
      } catch {
        return null;
      }
    }
    return localStorage.getItem(LEGACY_CONSENT_KEY);
  } catch {
    return null;
  }
}

export function readStoredConsent(options) {
  return normalizeConsent(readRawFromStorage(), options);
}

export function hasStoredConsent(options) {
  return isConsentCurrent(readStoredConsent(options));
}

export function writeConsent(partial, options = {}) {
  const adsConfigured = options.adsConfigured ?? isMarketingTechnologyConfigured();
  const next = createConsentRecord({
    functional: partial?.functional !== false,
    analytics: partial?.analytics === true,
    marketing: partial?.marketing === true,
    adsConfigured,
  });
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
      localStorage.removeItem(LEGACY_CONSENT_KEY);
    } catch {
      /* private mode / quota */
    }
    try {
      window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: next }));
    } catch {
      /* ignore */
    }
  }
  return next;
}

export function acceptAllConsent(options) {
  return writeConsent(
    { functional: true, analytics: true, marketing: true },
    options
  );
}

/** Reject optional analytics/marketing; keep functional preferences on. */
export function rejectNonEssentialConsent(options) {
  return writeConsent(
    { functional: true, analytics: false, marketing: false },
    options
  );
}

export function allowsAnalytics(consent = readStoredConsent()) {
  return consent?.analytics === true;
}

export function allowsMarketing(consent = readStoredConsent()) {
  return consent?.marketing === true && isMarketingTechnologyConfigured();
}

export function allowsFunctional(consent = readStoredConsent()) {
  // Before a choice, preference storage may already exist; only honor explicit opt-out.
  if (!consent) return true;
  return consent.functional !== false;
}

export function openCookieSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT));
}

/** @deprecated Prefer allowsMarketing — kept for AdBanner compatibility. */
export function hasAdConsent() {
  return allowsMarketing();
}

export function getAdSenseClientId() {
  try {
    return import.meta.env?.VITE_ADSENSE_CLIENT_ID || '';
  } catch {
    return '';
  }
}
