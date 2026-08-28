/**
 * SEO-P4 — deterministic blog related-post ranking.
 */
import { canonicalBlogCategoryLabel } from './taxonomy.js';
import { resolveClusterForBlogCategory } from '../seo/contentClusters.js';
import { normalizeInternalPath } from '../seo/internalLinkSafety.js';

const BLOG_ROUTE_PREFIX = '/blog';

/**
 * @param {string} tag
 * @returns {string}
 */
export function normalizeBlogTag(tag) {
  return String(tag || '').trim().toLowerCase();
}

/**
 * @param {{ slug?: string, canonicalUrl?: string }} article
 * @param {string} [blogRoutePrefix]
 * @returns {string}
 */
export function blogArticleCanonicalPath(article, blogRoutePrefix = BLOG_ROUTE_PREFIX) {
  if (!article?.slug) return '';
  const custom = article.canonicalUrl;
  if (custom && typeof custom === 'string' && !custom.includes('?')) {
    if (custom.startsWith('http://') || custom.startsWith('https://')) {
      try {
        return normalizeInternalPath(new URL(custom).pathname);
      } catch {
        return '';
      }
    }
    return normalizeInternalPath(custom);
  }
  return `${blogRoutePrefix}/${article.slug}`;
}

/**
 * @param {object} article
 * @param {{ excludeSlug?: string, excludeId?: string }} [options]
 * @returns {boolean}
 */
export function isPublishableBlogCandidate(article, { excludeSlug, excludeId } = {}) {
  if (!article || article.status !== 'published') return false;
  if (!article.slug || !String(article.slug).trim()) return false;
  if (excludeSlug && article.slug === excludeSlug) return false;
  if (excludeId && String(article._id) === String(excludeId)) return false;
  return true;
}

/**
 * @param {object} current
 * @param {object} candidate
 * @returns {number}
 */
export function scoreRelatedBlogPost(current, candidate) {
  let score = 0;

  const curCat = canonicalBlogCategoryLabel(current.category);
  const candCat = canonicalBlogCategoryLabel(candidate.category);
  if (curCat && candCat && curCat === candCat) score += 25;

  const curTags = new Set((current.tags || []).map(normalizeBlogTag).filter(Boolean));
  for (const tag of candidate.tags || []) {
    if (curTags.has(normalizeBlogTag(tag))) score += 10;
  }

  const curCluster = resolveClusterForBlogCategory(current.category);
  const candCluster = resolveClusterForBlogCategory(candidate.category);
  if (curCluster && candCluster && curCluster.id === candCluster.id) score += 15;

  const ts = candidate.publishedAt || candidate.updatedAt || candidate.createdAt;
  if (ts) {
    const age = Date.now() - new Date(ts).getTime();
    if (!Number.isNaN(age) && age >= 0) score += Math.max(0, 1 - Math.floor(age / (365 * 24 * 60 * 60 * 1000)));
  }

  return score;
}

/**
 * @param {object} current
 * @param {object[]} candidates
 * @param {{ limit?: number, curated?: object[], excludeSlug?: string, excludeId?: string }} [options]
 * @returns {{ items: object[], usedFallback: boolean, relation: 'curated' | 'related' | 'recent' }}
 */
export function rankRelatedBlogPosts(current, candidates, options = {}) {
  const {
    limit = 3,
    curated = [],
    excludeSlug = current?.slug,
    excludeId = current?._id,
  } = options;

  const seenPaths = new Set();
  const seenIds = new Set();
  if (excludeId) seenIds.add(String(excludeId));
  if (excludeSlug) seenPaths.add(blogArticleCanonicalPath({ slug: excludeSlug }));

  const curatedItems = [];
  for (const article of curated) {
    if (!isPublishableBlogCandidate(article, { excludeSlug, excludeId })) continue;
    const path = blogArticleCanonicalPath(article);
    const id = String(article._id || '');
    if (!path || seenPaths.has(path) || (id && seenIds.has(id))) continue;
    seenPaths.add(path);
    if (id) seenIds.add(id);
    curatedItems.push(article);
    if (curatedItems.length >= limit) {
      return { items: curatedItems.slice(0, limit), usedFallback: false, relation: 'curated' };
    }
  }

  const pool = (candidates || []).filter((article) => {
    if (!isPublishableBlogCandidate(article, { excludeSlug, excludeId })) return false;
    const path = blogArticleCanonicalPath(article);
    const id = String(article._id || '');
    if (!path || seenPaths.has(path) || (id && seenIds.has(id))) return false;
    return true;
  });

  const scored = pool
    .map((article) => ({
      article,
      score: scoreRelatedBlogPost(current, article),
      ts: new Date(article.publishedAt || article.updatedAt || article.createdAt || 0).getTime(),
    }))
    .sort((a, b) => b.score - a.score || b.ts - a.ts);

  const strong = scored.filter((row) => row.score >= 10);
  const ranked = (strong.length ? strong : scored).slice(0, limit - curatedItems.length);

  const relatedItems = ranked.map((row) => row.article);
  const items = [...curatedItems, ...relatedItems].slice(0, limit);

  return {
    items,
    usedFallback: strong.length === 0 && curatedItems.length === 0,
    relation: curatedItems.length ? 'curated' : (strong.length ? 'related' : 'recent'),
  };
}
