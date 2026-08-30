/**
 * CONTENT-AUTOFILL-P2 — deterministic CMS document import field contracts.
 */
import { canonicalBlogCategoryLabel, BLOG_CATEGORY_REGISTRY } from '../blog/taxonomy.js';

export const CANDIDATE_STATUS = Object.freeze({
  ACCEPTED: 'accepted',
  REVIEW: 'review',
  REJECTED: 'rejected',
});

export const CMS_DANGEROUS_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
  'isAdmin',
  'role',
  'createdBy',
  'ownerId',
  'permissions',
  'password',
  'token',
]);

export const BLOG_IMPORT_FIELDS = Object.freeze([
  'title',
  'category',
  'authorName',
  'excerpt',
  'content',
  'imageUrl',
  'imageAlt',
  'gallery',
  'readingTime',
  'tags',
  'publishedAt',
  'status',
  'slug',
  'seoTitle',
  'metaDescription',
  'canonicalUrl',
  'ogImageUrl',
  'isFeatured',
]);

export const CAREER_IMPORT_FIELDS = Object.freeze([
  'title',
  'category',
  'excerpt',
  'content',
  'tags',
  'imageUrl',
  'scheduledAt',
  'status',
  'slug',
  'seoTitle',
  'metaDescription',
  'isFeatured',
]);

const BLOG_FIELD_SET = new Set(BLOG_IMPORT_FIELDS);
const CAREER_FIELD_SET = new Set(CAREER_IMPORT_FIELDS);

const URL_RE = /^https?:\/\/.+/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = new Set(['draft', 'published', 'archived']);

function result(status, value = null, reason = '') {
  return { status, value: value ?? null, reason };
}

export function isAllowlistedCmsField(contentType, field) {
  if (CMS_DANGEROUS_KEYS.has(field)) return false;
  if (contentType === 'blog') return BLOG_FIELD_SET.has(field);
  if (contentType === 'career-article') return CAREER_FIELD_SET.has(field);
  return false;
}

export function parseBooleanCandidate(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  if (['true', 'yes', '1'].includes(s)) return result(CANDIDATE_STATUS.ACCEPTED, true);
  if (['false', 'no', '0'].includes(s)) return result(CANDIDATE_STATUS.ACCEPTED, false);
  return result(CANDIDATE_STATUS.REJECTED, null, 'invalid_boolean');
}

export function validateUrlCandidate(value) {
  const s = String(value || '').trim();
  if (!s) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  if (/^javascript:/i.test(s) || /[<>"']/.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'unsafe_url');
  if (!URL_RE.test(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'invalid_url');
  return result(CANDIDATE_STATUS.ACCEPTED, s);
}

export function validateSlugCandidate(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s || s.length > 200) return result(CANDIDATE_STATUS.REJECTED, null, 'invalid_slug');
  if (!SLUG_RE.test(s)) return result(CANDIDATE_STATUS.REVIEW, s, 'slug_needs_normalization');
  return result(CANDIDATE_STATUS.ACCEPTED, s);
}

export function validateStatusCandidate(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  if (!STATUSES.has(s)) return result(CANDIDATE_STATUS.REJECTED, null, 'invalid_status');
  if (s === 'published') return result(CANDIDATE_STATUS.REVIEW, s, 'published_requires_manual_confirm');
  return result(CANDIDATE_STATUS.ACCEPTED, s);
}

export function validateBlogCategoryCandidate(value) {
  const raw = String(value || '').trim();
  if (!raw) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  const canonical = canonicalBlogCategoryLabel(raw);
  const known = BLOG_CATEGORY_REGISTRY.some((c) => c.label === canonical);
  if (known) return result(CANDIDATE_STATUS.ACCEPTED, canonical);
  return result(CANDIDATE_STATUS.REJECTED, null, 'unknown_category');
}

export function validateReadingTimeCandidate(value) {
  const n = Number(String(value || '').trim());
  if (!Number.isFinite(n) || n <= 0 || n > 999) return result(CANDIDATE_STATUS.REJECTED, null, 'invalid_reading_time');
  return result(CANDIDATE_STATUS.ACCEPTED, Math.round(n));
}

export function validateDateTimeCandidate(value) {
  const s = String(value || '').trim();
  if (!s) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return result(CANDIDATE_STATUS.REJECTED, null, 'invalid_date');
  if (s.length <= 10) return result(CANDIDATE_STATUS.ACCEPTED, s.slice(0, 10));
  return result(CANDIDATE_STATUS.ACCEPTED, s.slice(0, 16));
}

export function validatePlainTextCandidate(value, { min = 1, max = 50000 } = {}) {
  const s = String(value || '').trim();
  if (!s || s.length < min) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  if (s.length > max) return result(CANDIDATE_STATUS.REVIEW, s.slice(0, max), 'truncated');
  if (/<script/i.test(s)) return result(CANDIDATE_STATUS.REVIEW, s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ''), 'script_stripped');
  return result(CANDIDATE_STATUS.ACCEPTED, s);
}

export function validateTagsCandidate(value) {
  const lines = String(value || '')
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!lines.length) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  if (lines.some((t) => t.length > 80)) return result(CANDIDATE_STATUS.REJECTED, null, 'tag_too_long');
  return result(CANDIDATE_STATUS.ACCEPTED, lines);
}

export function validateGalleryCandidate(value) {
  const lines = String(value || '')
    .split(/\n/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (!lines.length) return result(CANDIDATE_STATUS.REJECTED, null, 'empty');
  for (const line of lines) {
    const v = validateUrlCandidate(line);
    if (v.status === CANDIDATE_STATUS.REJECTED) return result(CANDIDATE_STATUS.REJECTED, null, 'invalid_gallery_url');
  }
  return result(CANDIDATE_STATUS.ACCEPTED, lines);
}

export function applyCmsFieldContract(field, value, contentType) {
  switch (field) {
    case 'title':
    case 'authorName':
    case 'excerpt':
    case 'seoTitle':
    case 'metaDescription':
    case 'imageAlt':
      return validatePlainTextCandidate(value, { max: field === 'metaDescription' ? 500 : 5000 });
    case 'content':
      return validatePlainTextCandidate(value, { min: 1, max: 200000 });
    case 'category':
      return contentType === 'blog'
        ? validateBlogCategoryCandidate(value)
        : validatePlainTextCandidate(value, { max: 120 });
    case 'imageUrl':
    case 'canonicalUrl':
    case 'ogImageUrl':
      return validateUrlCandidate(value);
    case 'slug':
      return validateSlugCandidate(value);
    case 'status':
      return validateStatusCandidate(value);
    case 'readingTime':
      return validateReadingTimeCandidate(value);
    case 'publishedAt':
    case 'scheduledAt':
      return validateDateTimeCandidate(value);
    case 'tags':
      return validateTagsCandidate(value);
    case 'gallery':
      return validateGalleryCandidate(value);
    case 'isFeatured':
      return parseBooleanCandidate(value);
    default:
      return result(CANDIDATE_STATUS.REJECTED, null, 'unknown_field');
  }
}
