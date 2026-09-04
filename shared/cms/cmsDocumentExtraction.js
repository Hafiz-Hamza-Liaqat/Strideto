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
  title: ['title', 'blog title', 'article title', 'post title'],
  category: ['category', 'blog category'],
  authorName: ['author', 'author name'],
  excerpt: ['summary / excerpt', 'summary', 'excerpt', 'short description', 'article summary'],
  content: ['content', 'article content', 'blog content', 'body'],
  imageUrl: ['featured image url', 'featured image'],
  imageAlt: ['featured image alt text', 'featured image alt', 'image alt text', 'alt text'],
  gallery: ['gallery urls', 'gallery'],
  readingTime: ['reading time', 'read time', 'estimated reading time'],
  tags: ['tags', 'keywords', 'topics'],
  publishedAt: ['published at', 'publish date', 'publication date'],
  status: ['status', 'publication status'],
  slug: ['seo slug', 'slug', 'url slug'],
  seoTitle: ['seo title', 'meta title'],
  metaDescription: ['meta description', 'seo description'],
  canonicalUrl: ['canonical url', 'canonical link'],
  ogImageUrl: ['open graph image url', 'og image url', 'og image'],
  isFeatured: ['featured', 'is featured'],
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
      entries.push({ field, phrase: phrase.toLowerCase().replace(/\s+/g, ' ').trim(), len: phrase.length });
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
  let contentSeen = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const lower = line.toLowerCase().replace(/\s+/g, ' ').replace(/:$/, '').trim();
    if (contentType === 'blog' && !contentSeen && ['sources', 'references', 'official sources', 'source links'].includes(lower)) {
      markers.push({ field: '__sources', lineIndex: i, inline: '' });
      continue;
    }
    for (const { field, phrase } of labelEntries) {
      if (lower === phrase || lower === `${phrase}:`) {
        markers.push({ field, lineIndex: i, inline: '' });
        if (field === 'content') contentSeen = true;
        break;
      }
      const inline = line.match(new RegExp(`^${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.*)$`, 'i'));
      if (inline && inline[1].trim()) {
        markers.push({ field, lineIndex: i, inline: inline[1].trim() });
        break;
      }
    }
  }

  const raw = new Map();
  for (let m = 0; m < markers.length; m += 1) {
    const { field, lineIndex } = markers[m];
    if (CMS_DANGEROUS_KEYS.has(field) || (field !== '__sources' && !isAllowlistedCmsField(contentType, field))) continue;
    const start = lineIndex + 1;
    const end = m + 1 < markers.length ? markers[m + 1].lineIndex : lines.length;
    const body = markers[m].inline || lines.slice(start, end).join('\n').trim();
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
  let rawSections = parseLabeledSections(text, contentType);
  if (contentType === 'blog' && rawSections.has('__sources')) {
    const sourceBody = rawSections.get('__sources');
    const contentBody = rawSections.get('content');
    rawSections.delete('__sources');
    rawSections.set('content', [sourceBody ? `Sources\n${sourceBody}` : '', contentBody || ''].filter(Boolean).join('\n\n'));
  }
  // Natural articles are intentionally conservative: infer only an unambiguous
  // first heading and the remaining article body. All publication/SEO metadata
  // stays manual unless explicitly labeled.
  if (contentType === 'blog' && rawSections.size === 0) {
    const lines = normalizeDocumentText(text).split('\n');
    const first = lines.findIndex((line) => line.trim());
    if (first >= 0) {
      const title = lines[first].trim();
      const body = lines.slice(first + 1).join('\n').trim();
      rawSections = new Map([['title', title]]);
      if (body) rawSections.set('content', body);
    }
  }
  const suggestions = {};
  let foundCount = 0;
  let validCount = 0;
  let reviewCount = 0;

  for (const field of allowedFields(contentType)) {
    if (!rawSections.has(field)) continue;
    foundCount += 1;
    let rawValue = rawSections.get(field);

    if (field === 'content') {
      const hasExplicitContentMarker = /^(?:content|article content|blog content|body)\s*(?::\s*.*)?$/im.test(String(text || ''));
      const canonicalHtml = importContentToCanonicalBlogHtml(rawValue, {
        // Native DOCX HTML is used only for an explicitly labeled content
        // section. Natural articles must not duplicate their title into body.
        docxHtml: hasExplicitContentMarker ? (options.contentHtml || '') : '',
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
