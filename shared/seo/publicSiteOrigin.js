/**
 * Public site origin for canonical URLs, sitemaps, and robots.
 *
 * Production contract: https://www.strideto.com
 * The apex host is NOT the canonical origin: production answers
 * `https://strideto.com/*` with a 308 to `https://www.strideto.com/*`, so any
 * canonical/OG/sitemap URL built on the apex host points at a redirect. A
 * canonical URL must be the final, non-redirecting URL, so the apex host is
 * normalized to the www host here rather than emitted verbatim (SEO-P0A).
 *
 * Local HTTPS runtime: https://localhost:8443
 * Never emit the retired http://localhost:8080 origin.
 */

export const PRODUCTION_PUBLIC_ORIGIN = 'https://www.strideto.com';
export const CANONICAL_APEX_HOST = 'strideto.com';
export const CANONICAL_WWW_HOST = 'www.strideto.com';
export const LOCAL_PUBLIC_ORIGIN = 'https://localhost:8443';
const RETIRED_LOCAL_PORT = '8080';

export function isLocalHostname(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
}

export function resolvePublicSiteOrigin(configuredOrigin) {
  const raw = String(configuredOrigin || '').trim().replace(/\/$/, '');
  if (!raw) return PRODUCTION_PUBLIC_ORIGIN;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return PRODUCTION_PUBLIC_ORIGIN;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return PRODUCTION_PUBLIC_ORIGIN;
  }

  if (isLocalHostname(url.hostname) && url.port === RETIRED_LOCAL_PORT) {
    return LOCAL_PUBLIC_ORIGIN;
  }

  // Apex → www: production redirects the apex host, so emitting it would make
  // every canonical, hreflang, OG and sitemap URL a redirect target.
  if (url.hostname.toLowerCase() === CANONICAL_APEX_HOST && !url.port) {
    return PRODUCTION_PUBLIC_ORIGIN;
  }

  return `${url.protocol}//${url.host}`;
}

export function originLooksLikeLocalhost(origin) {
  try {
    return isLocalHostname(new URL(origin).hostname);
  } catch {
    return /localhost|127\.0\.0\.1/i.test(String(origin || ''));
  }
}
