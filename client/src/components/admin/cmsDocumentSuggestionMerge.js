/**
 * CMS document suggestion merge — reuses job autofill field-state semantics.
 */
import {
  resolveFieldState,
  buildSuggestionConflicts,
  FIELD_STATE,
} from '../jobs/jobDocumentSuggestionMerge.js';

export { resolveFieldState, buildSuggestionConflicts, FIELD_STATE };

const ARRAY_FIELDS = new Set(['tags', 'gallery']);
const LINE_ARRAY_FIELDS = new Set(['gallery']);

function isEmptyValue(val) {
  if (val == null) return true;
  if (typeof val === 'string') return val.trim() === '';
  if (typeof val === 'boolean') return false;
  if (Array.isArray(val)) return val.length === 0;
  return false;
}

function normalizeForCompare(val, field) {
  if (ARRAY_FIELDS.has(field)) {
    const arr = Array.isArray(val) ? val : String(val || '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    return arr.join('\n').toLowerCase();
  }
  if (field === 'readingTime') return String(val ?? '').trim();
  if (field === 'isFeatured') return String(!!val);
  return String(val ?? '').trim().toLowerCase();
}

function valuesEqual(current, suggested, field) {
  return normalizeForCompare(current, field) === normalizeForCompare(suggested, field);
}

function arrayToFormText(val, field) {
  if (Array.isArray(val)) {
    return LINE_ARRAY_FIELDS.has(field) ? val.join('\n') : val.join('\n');
  }
  return String(val || '');
}

function shouldApplyField(state, { onlyEmpty, allowUntouchedDefaults = true }) {
  if (onlyEmpty && !allowUntouchedDefaults) return state === FIELD_STATE.EMPTY;
  if (onlyEmpty) return state === FIELD_STATE.EMPTY || state === FIELD_STATE.UNTOUCHED_DEFAULT;
  return true;
}

/**
 * Apply CMS document suggestions to admin form state (non-destructive by default).
 */
export function applyCmsDocumentSuggestions(form, suggestions, options = {}) {
  const {
    onlyEmpty = true,
    allowUntouchedDefaults = true,
    fields = null,
    touchedFields,
    initialForm,
    formDefaults,
  } = options;

  const next = { ...form };
  const applied = [];
  const skipped = [];

  for (const [field, suggestion] of Object.entries(suggestions || {})) {
    if (fields && !fields.includes(field)) continue;
    const suggested = suggestion?.value;
    if (suggested == null || suggested === '') {
      skipped.push(field);
      continue;
    }
    if (suggestion?.status === 'rejected') {
      skipped.push(field);
      continue;
    }
    if (onlyEmpty && suggestion?.status === 'review') {
      skipped.push(field);
      continue;
    }

    const current = next[field];
    if (onlyEmpty && !isEmptyValue(current)) {
      skipped.push(field);
      continue;
    }

    const state = resolveFieldState(field, current, {
      touchedFields,
      initialForm,
      formDefaults,
      field,
    });

    if (!onlyEmpty && !shouldApplyField(state, { onlyEmpty: false, allowUntouchedDefaults })) {
      skipped.push(field);
      continue;
    }

    if (!isEmptyValue(current) && valuesEqual(current, suggested, field)) {
      skipped.push(field);
      continue;
    }

    if (field === 'readingTime') {
      next[field] = String(suggested);
    } else if (ARRAY_FIELDS.has(field)) {
      next[field] = arrayToFormText(suggested, field);
    } else if (field === 'isFeatured') {
      next[field] = !!suggested;
    } else {
      next[field] = suggested;
    }
    applied.push(field);
  }

  return { form: next, applied, skipped };
}

export const BLOG_FORM_DEFAULTS = {
  title: '',
  excerpt: '',
  content: '',
  category: '',
  authorName: '',
  tags: '',
  imageUrl: '',
  imageAlt: '',
  gallery: '',
  readingTime: '',
  status: 'draft',
  publishedAt: '',
  isFeatured: false,
  slug: '',
  seoTitle: '',
  metaDescription: '',
  canonicalUrl: '',
  ogImageUrl: '',
};

export const CAREER_FORM_DEFAULTS = {
  title: '',
  excerpt: '',
  content: '',
  category: '',
  tags: '',
  imageUrl: '',
  status: 'draft',
  scheduledAt: '',
  isFeatured: false,
  slug: '',
  seoTitle: '',
  metaDescription: '',
};

export const CMS_SUGGESTION_FIELD_LABELS = {
  title: 'Title',
  category: 'Category',
  authorName: 'Author',
  excerpt: 'Summary',
  content: 'Content',
  imageUrl: 'Featured image URL',
  imageAlt: 'Featured image alt text',
  gallery: 'Gallery URLs',
  readingTime: 'Reading time',
  tags: 'Tags',
  publishedAt: 'Published at',
  scheduledAt: 'Scheduled at',
  status: 'Status',
  slug: 'SEO slug',
  seoTitle: 'SEO title',
  metaDescription: 'Meta description',
  canonicalUrl: 'Canonical URL',
  ogImageUrl: 'Open Graph image URL',
  isFeatured: 'Featured',
};

export const BLOG_SUGGESTION_FIELD_MAP = Object.fromEntries(
  Object.keys(BLOG_FORM_DEFAULTS).map((k) => [k, k]),
);

export const CAREER_SUGGESTION_FIELD_MAP = Object.fromEntries(
  Object.keys(CAREER_FORM_DEFAULTS).map((k) => [k, k]),
);
