import sanitizeHtmlLib from 'sanitize-html';
import { CALLOUT_VARIANTS, SOURCES_WRAPPER_CLASS } from '../../../shared/cms/blogCanonicalHtml.js';

/** Allowed rich-text tags for CMS, blogs, career articles, etc. */
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'div', 'span',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
  'blockquote', 'pre', 'code',
  'a',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'img',
];

const ALLOWED_CALLOUT_CLASS_TOKENS = new Set([
  'blog-callout',
  ...CALLOUT_VARIANTS.map((v) => `blog-callout--${v}`),
]);
const ALLOWED_LINK_CLASS = 'blog-external-link';

function sanitizeLinkClass(className) {
  const tokens = String(className || '')
    .split(/\s+/)
    .filter((t) => t === ALLOWED_LINK_CLASS);
  return tokens.join(' ');
}

function sanitizeCalloutClass(className) {
  const tokens = String(className || '')
    .split(/\s+/)
    .filter((t) => ALLOWED_CALLOUT_CLASS_TOKENS.has(t));
  if (!tokens.includes('blog-callout')) return '';
  return tokens.join(' ');
}

function isUnsafeHref(href) {
  return /^(javascript|data|vbscript):/i.test(String(href || '').trim());
}

const ALLOWED_ATTRIBUTES = {
  a: ['href', 'title', 'target', 'rel', 'class'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  th: ['colspan', 'rowspan', 'scope'],
  td: ['colspan', 'rowspan'],
  blockquote: ['class'],
  div: ['class'],
  '*': ['id'],
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
      if (isUnsafeHref(next.href)) {
        delete next.href;
        return { tagName: 'span', attribs: next };
      }
      const linkClass = sanitizeLinkClass(next.class);
      if (linkClass) next.class = linkClass;
      else delete next.class;
      if (next.target === '_blank') {
        next.rel = 'noopener noreferrer';
      }
      return { tagName, attribs: next };
    },
    blockquote: (tagName, attribs) => {
      const next = { ...attribs };
      const cls = sanitizeCalloutClass(next.class);
      if (cls) next.class = cls;
      else delete next.class;
      return { tagName, attribs: next };
    },
    div: (tagName, attribs) => {
      const next = { ...attribs };
      if (next.class === SOURCES_WRAPPER_CLASS) {
        next.class = SOURCES_WRAPPER_CLASS;
      } else {
        delete next.class;
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
