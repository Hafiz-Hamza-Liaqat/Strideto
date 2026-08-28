/**
 * Canonical schema.org entity @id helpers (SEO-P2).
 * All IDs resolve through buildCanonicalUrl — never request-host-dependent.
 */
import { buildCanonicalUrl, SITE_URL } from './config.js';

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const ORGANIZATION_LOGO_URL = `${SITE_URL}/branding/logo-symbol.svg`;

/** Normalize a route path or absolute URL into a canonical path segment. */
export function normalizeSchemaPath(pathOrUrl = '/') {
  if (!pathOrUrl) return '/';
  const raw = String(pathOrUrl).trim();
  if (raw.startsWith('http')) {
    const base = SITE_URL.replace(/\/$/, '');
    if (raw.startsWith(base)) {
      const rest = raw.slice(base.length) || '/';
      return rest.startsWith('/') ? rest : `/${rest}`;
    }
    return raw;
  }
  return raw.startsWith('/') ? raw : `/${raw}`;
}

/** Stable fragment @id for a canonical page URL, e.g. /jobs#webpage. */
export function buildEntityId(pathOrUrl, fragment) {
  const path = normalizeSchemaPath(pathOrUrl);
  const canonical =
    typeof path === 'string' && path.startsWith('http')
      ? path.replace(/\/$/, '') || path
      : buildCanonicalUrl(path);
  const idBase = path === '/' || canonical === SITE_URL ? `${SITE_URL}/` : canonical;
  return `${idBase}#${fragment}`;
}

export function buildPageId(pathOrUrl) {
  return buildEntityId(pathOrUrl, 'webpage');
}

export function buildBreadcrumbId(pathOrUrl) {
  return buildEntityId(pathOrUrl, 'breadcrumb');
}

export function buildBlogPostingId(pathOrUrl) {
  return buildEntityId(pathOrUrl, 'article');
}
