import sanitizeHtmlLib from 'sanitize-html';

/** Allowed rich-text tags for CMS, blogs, career articles, etc. */
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'div', 'span',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
  'blockquote', 'pre', 'code',
  'a',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'img',
];

const ALLOWED_ATTRIBUTES = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  th: ['colspan', 'rowspan', 'scope'],
  td: ['colspan', 'rowspan'],
  '*': ['class', 'id'],
};

const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'];

const SANITIZE_OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  allowedSchemes: ALLOWED_SCHEMES,
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  enforceHtmlBoundary: true,
  transformTags: {
    a: (tagName, attribs) => {
      const next = { ...attribs };
      if (next.target === '_blank') {
        next.rel = 'noopener noreferrer';
      }
      return { tagName, attribs: next };
    },
  },
};

/**
 * Production HTML sanitizer — strips scripts, event handlers, javascript: URLs, iframes.
 * Use on every field stored or rendered as HTML.
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return sanitizeHtmlLib(html, SANITIZE_OPTIONS).trim();
}

/** Sanitize CMS static page section blocks. */
export function sanitizeCmsSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map((sec) => ({
    title: typeof sec?.title === 'string' ? sec.title.trim().slice(0, 500) : '',
    body: sanitizeHtml(sec?.body),
  }));
}

/** Strip all HTML — for plain-text fields that must never contain markup. */
export function stripAllHtml(text) {
  if (!text || typeof text !== 'string') return '';
  return sanitizeHtmlLib(text, { allowedTags: [], allowedAttributes: {} }).trim();
}
