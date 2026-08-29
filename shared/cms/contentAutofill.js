/**
 * Deterministic admin content autofill (CONTENT-AUTOFILL-P1).
 * Fills empty metadata from admin-entered title/body — no AI, no invented facts.
 */
import { stripHtmlForWordCount } from '../blog/readingTime.js';

export const META_DESCRIPTION_MAX = 160;
export const EXCERPT_SUGGESTION_MAX = 280;

/** @param {unknown} value */
export function isEmptyContentField(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'boolean') return false;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * URL-safe slug from title (matches server slugify + AdminSlugField normalizeClientSlug).
 * @param {string} title
 */
export function deriveContentSlug(title) {
  if (!title || typeof title !== 'string') return '';
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * SEO title suggestion — title only; public pages append section suffix at render time.
 * @param {string} title
 */
export function deriveSafeSeoTitle(title) {
  return String(title || '').trim();
}

/**
 * Plain text from HTML or plain body for deterministic excerpt/meta derivation.
 * @param {string} htmlOrText
 */
export function plainTextFromContent(htmlOrText) {
  return stripHtmlForWordCount(htmlOrText);
}

/**
 * Meta description from admin-entered excerpt or body — never from title alone.
 * @param {{ excerpt?: string, content?: string, maxLength?: number }} opts
 */
export function deriveMetaDescriptionFromEnteredSummary(opts = {}) {
  const maxLength = opts.maxLength ?? META_DESCRIPTION_MAX;
  const excerpt = plainTextFromContent(opts.excerpt);
  if (excerpt) return excerpt.slice(0, maxLength).trim();

  const body = plainTextFromContent(opts.content);
  if (body) return body.slice(0, maxLength).trim();

  return '';
}

/**
 * Optional excerpt from first suitable plain-text section of entered body.
 * @param {string} content
 * @param {number} [maxLength]
 */
export function deriveExcerptFromEnteredContent(content, maxLength = EXCERPT_SUGGESTION_MAX) {
  const text = plainTextFromContent(content);
  if (!text) return '';
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).trim();
}

/**
 * @param {Record<string, unknown>} form
 * @param {Record<string, unknown>} patch
 */
export function applyContentAutofillPatch(form, patch) {
  const next = { ...form };
  let applied = 0;
  for (const [key, value] of Object.entries(patch || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (!isEmptyContentField(next[key])) continue;
    next[key] = value;
    applied += 1;
  }
  return { form: next, applied };
}

/**
 * @param {Record<string, unknown>} form
 * @param {(content: string, excerpt?: string) => number | string} estimateReadingMinutes
 */
export function buildBlogAutofillPatch(form, estimateReadingMinutes) {
  const patch = {};
  const title = String(form.title || '').trim();
  if (!title) return patch;

  if (isEmptyContentField(form.slug)) {
    patch.slug = deriveContentSlug(title);
  }
  if (isEmptyContentField(form.seoTitle)) {
    patch.seoTitle = deriveSafeSeoTitle(title);
  }
  if (isEmptyContentField(form.metaDescription)) {
    const meta = deriveMetaDescriptionFromEnteredSummary({
      excerpt: form.excerpt,
      content: form.content,
    });
    if (meta) patch.metaDescription = meta;
  }
  if (isEmptyContentField(form.excerpt) && form.content) {
    const excerpt = deriveExcerptFromEnteredContent(String(form.content));
    if (excerpt) patch.excerpt = excerpt;
  }
  if (isEmptyContentField(form.readingTime) && estimateReadingMinutes) {
    const source = String(form.content || form.excerpt || '');
    if (plainTextFromContent(source)) {
      patch.readingTime = String(estimateReadingMinutes(source));
    }
  }
  if (isEmptyContentField(form.ogImageUrl) && !isEmptyContentField(form.imageUrl)) {
    patch.ogImageUrl = String(form.imageUrl).trim();
  }

  return patch;
}

/** @param {Record<string, unknown>} form */
export function buildCareerArticleAutofillPatch(form) {
  const patch = {};
  const title = String(form.title || '').trim();
  if (!title) return patch;

  if (isEmptyContentField(form.slug)) {
    patch.slug = deriveContentSlug(title);
  }
  if (isEmptyContentField(form.seoTitle)) {
    patch.seoTitle = deriveSafeSeoTitle(title);
  }
  if (isEmptyContentField(form.metaDescription)) {
    const meta = deriveMetaDescriptionFromEnteredSummary({
      excerpt: form.excerpt,
      content: form.content,
    });
    if (meta) patch.metaDescription = meta;
  }
  if (isEmptyContentField(form.excerpt) && form.content) {
    const excerpt = deriveExcerptFromEnteredContent(String(form.content));
    if (excerpt) patch.excerpt = excerpt;
  }

  return patch;
}
