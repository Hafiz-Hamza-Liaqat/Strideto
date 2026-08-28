/**
 * SEO-P5 — IndexNow configuration (disabled by default; production-only network).
 */
import {
  PRODUCTION_PUBLIC_ORIGIN,
  resolvePublicSiteOrigin,
  originLooksLikeLocalhost,
} from '../../../../shared/seo/publicSiteOrigin.js';
import {
  INDEXNOW_DEFAULT_ENDPOINT,
  INDEXNOW_DEFAULT_KEY_PATH,
  isValidIndexNowKey,
} from '../../../../shared/seo/indexNowUrlPolicy.js';

const PREVIEW_HOST_PATTERNS = [
  /\.vercel\.app$/i,
  /\.onrender\.com$/i,
];

function isExplicitlyDisabled(env) {
  const enabledFlag = String(env.INDEXNOW_ENABLED || '').trim().toLowerCase();
  return enabledFlag === '0' || enabledFlag === 'false' || enabledFlag === 'no';
}

function isExplicitlyEnabled(env) {
  const enabledFlag = String(env.INDEXNOW_ENABLED || '').trim().toLowerCase();
  return enabledFlag === '1' || enabledFlag === 'true' || enabledFlag === 'yes';
}

export function resolveConfiguredSiteOrigin(env = process.env) {
  const raw = String(env.SITE_URL || env.FRONTEND_URL || '').trim();
  return resolvePublicSiteOrigin(raw);
}

/**
 * Fail-closed production context required before any live IndexNow HTTP or key exposure.
 */
export function isIndexNowProductionContext(env = process.env) {
  if (String(env.NODE_ENV || '') !== 'production') {
    return { ok: false, reason: 'not_production_env' };
  }

  const rawSiteUrl = String(env.SITE_URL || env.FRONTEND_URL || '').trim();
  if (!rawSiteUrl) {
    return { ok: false, reason: 'missing_site_url' };
  }

  let parsed;
  try {
    parsed = new URL(rawSiteUrl);
  } catch {
    return { ok: false, reason: 'invalid_site_url' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (originLooksLikeLocalhost(hostname)) {
    return { ok: false, reason: 'local_site_url' };
  }
  if (PREVIEW_HOST_PATTERNS.some((re) => re.test(hostname))) {
    return { ok: false, reason: 'preview_site_url' };
  }

  const siteOrigin = resolveConfiguredSiteOrigin(env);
  if (siteOrigin !== PRODUCTION_PUBLIC_ORIGIN) {
    return { ok: false, reason: 'non_canonical_site_url' };
  }

  return { ok: true };
}

export function readIndexNowConfig(env = process.env) {
  if (isExplicitlyDisabled(env)) {
    return { enabled: false, reason: 'explicitly_disabled' };
  }

  const production = isIndexNowProductionContext(env);
  if (!production.ok) {
    return { enabled: false, reason: production.reason };
  }

  if (!isExplicitlyEnabled(env)) {
    return { enabled: false, reason: 'not_explicitly_enabled' };
  }

  const key = String(env.INDEXNOW_KEY || '').trim();
  const endpoint = String(env.INDEXNOW_ENDPOINT || INDEXNOW_DEFAULT_ENDPOINT).trim();
  const keyLocation = String(
    env.INDEXNOW_KEY_LOCATION || `${PRODUCTION_PUBLIC_ORIGIN}${INDEXNOW_DEFAULT_KEY_PATH}`
  ).trim();

  if (!key) {
    return { enabled: false, reason: 'missing_key' };
  }

  if (!isValidIndexNowKey(key)) {
    return { enabled: false, reason: 'invalid_key', malformed: true };
  }

  let keyLocationUrl;
  try {
    keyLocationUrl = new URL(keyLocation);
  } catch {
    return { enabled: false, reason: 'invalid_key_location', malformed: true };
  }

  if (keyLocationUrl.protocol !== 'https:' || keyLocationUrl.hostname !== 'www.strideto.com') {
    return { enabled: false, reason: 'invalid_key_location_host', malformed: true };
  }

  return {
    enabled: true,
    key,
    endpoint,
    keyLocation,
    host: 'www.strideto.com',
  };
}

export function isIndexNowKeyFileConfigured(env = process.env) {
  const config = readIndexNowConfig(env);
  return config.enabled === true;
}
