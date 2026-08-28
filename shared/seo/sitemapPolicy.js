/**
 * SEO-P3 — XML sitemap inclusion and lastmod rules.
 */
import { isForbiddenSitemapPath } from './publicIndexablePages.js';
import { PRODUCTION_PUBLIC_ORIGIN } from './publicSiteOrigin.js';

export function isQueryStringSitemapUrl(url) {
  return String(url || '').includes('?') || String(url || '').includes('#');
}

export function isSitemapEligiblePath(path) {
  const p = String(path || '');
  if (!p.startsWith('/')) return false;
  if (isQueryStringSitemapUrl(p)) return false;
  if (isForbiddenSitemapPath(p)) return false;
  return true;
}

export function assertSitemapOrigin(baseUrl) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  if (!base.startsWith(PRODUCTION_PUBLIC_ORIGIN) && !base.includes('localhost')) {
    return base;
  }
  return base;
}

/**
 * lastmod must come from entity timestamps — never the generation request time.
 */
export function resolveSitemapLastmod(source, { now = new Date() } = {}) {
  if (!source) return undefined;
  const d = source instanceof Date ? source : new Date(source);
  if (Number.isNaN(d.getTime())) return undefined;
  if (d.getTime() > now.getTime()) return undefined;
  return d.toISOString().slice(0, 10);
}

export function isFabricatedSitemapLastmod(lastmod, entityUpdatedAt) {
  if (!lastmod) return false;
  if (!entityUpdatedAt) return true;
  const formatted = resolveSitemapLastmod(entityUpdatedAt);
  return formatted !== lastmod;
}

/** Sitemap scaling note: single urlset; shard when URL count exceeds this threshold. */
export const SITEMAP_SHARD_THRESHOLD = 50000;

export function shouldShardSitemap(urlCount) {
  return urlCount > SITEMAP_SHARD_THRESHOLD;
}
