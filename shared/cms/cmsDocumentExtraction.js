/**
 * CONTENT-AUTOFILL-P2 — structured CMS document label parsing (blog / career guidance).
 */
import {
  applyCmsFieldContract,
  BLOG_IMPORT_FIELDS,
  CAREER_IMPORT_FIELDS,
  CANDIDATE_STATUS,
  CMS_DANGEROUS_KEYS,
  isAllowlistedCmsField,
} from './cmsDocumentFieldContracts.js';
import {
  importContentToCanonicalBlogHtml,
  canonicalBlogHtmlToCareerPlain,
} from './blogCanonicalHtml.js';
import { cmsImportTagsToFormText } from './cmsTagNormalize.js';

export const MAX_CMS_DOCUMENT_TEXT_CHARS = 150_000;

/** Label phrase → canonical field (longest phrases first at runtime). */
export const BLOG_LABEL_ALIASES = Object.freeze({
  title: ['title'],
  category: ['category'],
  authorName: ['author'],
  excerpt: ['summary / excerpt', 'summary', 'excerpt'],
  content: ['content'],
  imageUrl: ['featured image url'],
  imageAlt: ['featured image alt text', 'featured image alt'],
  gallery: ['gallery urls', 'gallery'],
  readingTime: ['reading time'],
  tags: ['tags'],
  publishedAt: ['published at'],
  status: ['status'],
  slug: ['seo slug', 'slug'],
  seoTitle: ['seo title'],
  metaDescription: ['meta description'],
  canonicalUrl: ['canonical url'],
  ogImageUrl: ['open graph image url', 'og image url'],
  isFeatured: ['featured'],
});

export const CAREER_LABEL_ALIASES = Object.freeze({
  title: ['title'],
  category: ['category'],
  excerpt: ['summary / excerpt', 'summary', 'excerpt'],
  content: ['content'],
  tags: ['tags'],
  imageUrl: ['featured image url'],
  scheduledAt: ['scheduled at'],
  status: ['status'],
  slug: ['seo slug', 'slug'],
  seoTitle: ['seo title'],
  metaDescription: ['meta description'],
  isFeatured: ['featured'],
});

function normalizeDocumentText(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, MAX_CMS_DOCUMENT_TEXT_CHARS);
}

function labelEntriesForType(contentType) {
  const map = contentType === 'blog' ? BLOG_LABEL_ALIASES : CAREER_LABEL_ALIASES;
  const entries = [];
  for (const [field, phrases] of Object.entries(map)) {
    for (const phrase of phrases) {
      entries.push({ field, phrase: phrase.toLowerCase(), len: phrase.length });
    }
  }
  entries.sort((a, b) => b.len - a.len);
  return entries;
}

function allowedFields(contentType) {
  return contentType === 'blog' ? BLOG_IMPORT_FIELDS : CAREER_IMPORT_FIELDS;
}

/**
 * Find labeled sections in normalized document text.
 * @returns {Map<string, string>}
 */
export function parseLabeledSections(text, contentType) {
  const normalized = normalizeDocumentText(text);
  const lines = normalized.split('\n');
  const labelEntries = labelEntriesForType(contentType);
  const markers = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const lower = line.toLowerCase().replace(/:$/, '').trim();
    for (const { field, phrase } of labelEntries) {
      if (lower === phrase || lower === `${phrase}:`) {
        markers.push({ field, lineIndex: i });
        break;
      }
    }
  }

  const raw = new Map();
  for (let m = 0; m < markers.length; m += 1) {
    const { field, lineIndex } = markers[m];
    if (CMS_DANGEROUS_KEYS.has(field) || !isAllowlistedCmsField(contentType, field)) continue;
    const start = lineIndex + 1;
    const end = m + 1 < markers.length ? markers[m + 1].lineIndex : lines.length;
    const body = lines.slice(start, end).join('\n').trim();
    if (body) raw.set(field, body);
  }

  return raw;
}

function toSuggestion(field, contract, evidence) {
  if (contract.status === CANDIDATE_STATUS.REJECTED) return null;
  return {
    value: contract.value,
    status: contract.status,
    confidence: contract.status === CANDIDATE_STATUS.ACCEPTED ? 'high' : 'medium',
    sourceType: 'explicit_label',
    evidence: evidence?.slice(0, 120),
    reason: contract.reason || undefined,
  };
}

/**
 * @param {string} text
 * @param {'blog'|'career-article'} contentType
 * @param {{ contentHtml?: string }} [options]
 */
export function extractCmsFieldsFromText(text, contentType, options = {}) {
  const rawSections = parseLabeledSections(text, contentType);
  const suggestions = {};
  let foundCount = 0;
  let validCount = 0;
  let reviewCount = 0;

  for (const field of allowedFields(contentType)) {
    if (!rawSections.has(field)) continue;
    foundCount += 1;
    let rawValue = rawSections.get(field);

    if (field === 'content') {
      const canonicalHtml = importContentToCanonicalBlogHtml(rawValue, {
        docxHtml: options.contentHtml || '',
        documentText: options.documentText || text,
      });
      if (contentType === 'career-article') {
        rawValue = canonicalBlogHtmlToCareerPlain(canonicalHtml) || rawValue;
      } else {
        rawValue = canonicalHtml || rawValue;
      }
    }

    if (field === 'tags') {
      rawValue = cmsImportTagsToFormText(rawValue);
    }

    const contract = applyCmsFieldContract(field, rawValue, contentType);
    const sug = toSuggestion(field, contract, rawSections.get(field));
    if (!sug) continue;
    suggestions[field] = sug;
    if (sug.status === CANDIDATE_STATUS.ACCEPTED) validCount += 1;
    if (sug.status === CANDIDATE_STATUS.REVIEW) reviewCount += 1;
  }

  return {
    suggestions,
    meta: {
      contentType,
      foundCount,
      validCount,
      reviewCount,
      fieldCount: Object.keys(suggestions).length,
    },
  };
}

export { normalizeDocumentText };
