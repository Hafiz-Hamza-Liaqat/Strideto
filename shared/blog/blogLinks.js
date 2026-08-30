/**
 * CONTENT-AUTOFILL-P2.2 — semantic blog link helpers (import + public render).
 */
import {
  CANONICAL_APEX_HOST,
  CANONICAL_WWW_HOST,
  isLocalHostname,
} from '../seo/publicSiteOrigin.js';

export const BLOG_EXTERNAL_LINK_CLASS = 'blog-external-link';

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const UNSAFE_HREF_RE = /^(javascript|data|vbscript):/i;
const EXTERNAL_HREF_RE = /^https?:\/\//i;
const INTERNAL_HREF_RE = /^\//;
const MAILTO_HREF_RE = /^mailto:/i;
const TEL_HREF_RE = /^tel:/i;

/** @returns {string} safe href or empty */
export function normalizeSafeHref(url) {
  const href = String(url || '').trim();
  if (!href || UNSAFE_HREF_RE.test(href)) return '';
  if (EXTERNAL_HREF_RE.test(href)) return href;
  if (INTERNAL_HREF_RE.test(href)) return href;
  if (MAILTO_HREF_RE.test(href)) return href;
  if (TEL_HREF_RE.test(href)) return href;
  return '';
}

export function isUnsafeHref(href) {
  return UNSAFE_HREF_RE.test(String(href || '').trim());
}

/**
 * True when an http(s) URL belongs to the Strideto public site (apex, www, or *.strideto.com).
 * Uses hostname parsing — not substring matching on the full href.
 */
export function isStridetoSiteHostname(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return false;
  if (host === CANONICAL_APEX_HOST || host === CANONICAL_WWW_HOST) return true;
  if (host.endsWith(`.${CANONICAL_APEX_HOST}`)) return true;
  if (isLocalHostname(host)) return true;
  return false;
}

/** @returns {boolean} */
export function isStridetoSiteHref(href) {
  const raw = String(href || '').trim();
  if (INTERNAL_HREF_RE.test(raw)) return true;
  if (!EXTERNAL_HREF_RE.test(raw)) return false;
  try {
    return isStridetoSiteHostname(new URL(raw).hostname);
  } catch {
    return false;
  }
}

export function isExternalHref(href) {
  const raw = String(href || '').trim();
  if (!EXTERNAL_HREF_RE.test(raw)) return false;
  return !isStridetoSiteHref(raw);
}

function stripAnchorAttr(attrs, name) {
  const re = new RegExp(`\\s*${name}\\s*=\\s*(".*?"|'.*?'|[^\\s>]+)`, 'gi');
  return String(attrs || '').replace(re, '');
}

function stripBlogExternalClassFromAttrs(attrs) {
  if (!/class\s*=/.test(attrs)) return attrs;
  return attrs.replace(/class\s*=\s*("([^"]*)"|'([^']*)')/i, (_m, _q, c1, c2) => {
    const tokens = (c1 || c2 || '').split(/\s+/).filter((t) => t && t !== BLOG_EXTERNAL_LINK_CLASS);
    return tokens.length ? `class="${tokens.join(' ')}"` : '';
  }).replace(/\s{2,}/g, ' ').trim();
}

function withBlogExternalClass(attrs) {
  const stripped = stripBlogExternalClassFromAttrs(attrs);
  if (/class\s*=/.test(stripped)) {
    return stripped.replace(/class\s*=\s*("([^"]*)"|'([^']*)')/i, (_m, _q, c1, c2) => {
      const existing = (c1 || c2 || '').trim();
      if (existing.includes(BLOG_EXTERNAL_LINK_CLASS)) return `class="${existing}"`;
      return `class="${`${existing} ${BLOG_EXTERNAL_LINK_CLASS}`.trim()}"`;
    });
  }
  return `${stripped} class="${BLOG_EXTERNAL_LINK_CLASS}"`.trim();
}

function formatOpeningAnchor(attrs, href, { external = false } = {}) {
  const base = stripBlogExternalClassFromAttrs(
    stripAnchorAttr(stripAnchorAttr(stripAnchorAttr(attrs, 'href'), 'target'), 'rel'),
  );
  const classed = external ? withBlogExternalClass(base) : base;
  const attrStr = classed.trim();
  if (external) {
    return `<a${attrStr ? ` ${attrStr}` : ''} href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`;
  }
  return `<a${attrStr ? ` ${attrStr}` : ''} href="${escapeHtml(href)}">`;
}

/**
 * Build canonical anchor: readable label + safe href.
 * External links get target/rel + blog-external-link class.
 */
export function buildSemanticLinkHtml(label, href) {
  const safe = normalizeSafeHref(href);
  const text = String(label || '').trim() || safe;
  if (!safe) return escapeHtml(text);
  if (isExternalHref(safe)) {
    return `<a href="${escapeHtml(safe)}" class="${BLOG_EXTERNAL_LINK_CLASS}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  }
  return `<a href="${escapeHtml(safe)}">${escapeHtml(text)}</a>`;
}

/**
 * Parse "Source title (https://example.com/path)" from a plain line.
 */
export function parseCitationParenthetical(text) {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^(.+?)\s+\((https?:\/\/[^)\s]+)\)\s*$/);
  if (!match) return null;
  const href = normalizeSafeHref(match[2]);
  if (!href) return null;
  const title = match[1].trim();
  if (!title) return null;
  return { title, href };
}

/**
 * Parse "[label](https://example.com)" from a plain line.
 */
export function parseMarkdownLinkLine(text) {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
  if (!match) return null;
  const href = normalizeSafeHref(match[2]);
  if (!href) return null;
  return { title: match[1].trim(), href };
}

/**
 * Apply inline link patterns to escaped plain text (markdown bold/italic applied first).
 */
export function linkifyEscapedInlineText(text) {
  let out = String(text || '');
  // [label](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => buildSemanticLinkHtml(label, url));
  // Title (https://url) — conservative; skip if already contains anchor markup
  if (!out.includes('<a ')) {
    out = out.replace(/([^<(]+?)\s+\((https?:\/\/[^)\s]+)\)/g, (_m, title, url) => {
      const t = title.trim();
      if (!t) return _m;
      return buildSemanticLinkHtml(t, url);
    });
  }
  // Standalone raw URLs not already linked
  out = out.replace(/(^|[\s(>])(https?:\/\/[^\s<)]+)(?=$|[\s<,;:!?)])/g, (_m, prefix, url) => {
    if (prefix.endsWith('"') || prefix.endsWith("'")) return _m;
    const safe = normalizeSafeHref(url.replace(/[.,;:!?)]+$/, ''));
    if (!safe) return _m;
    return `${prefix}${buildSemanticLinkHtml(safe, safe)}`;
  });
  return out;
}

/**
 * Normalize legacy/heavy Sources entries and parenthetical citations in stored HTML.
 */
export function normalizeBlogLinksInHtml(html) {
  let out = String(html || '');

  // Sources: Title (<a ...>official link</a>) → linked title
  out = out.replace(
    /<li><p>([^<]+?)\s+\(<a\b([^>]*?)href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>[\s\S]*?<\/a>\)\s*<\/p><\/li>/gi,
    (_m, title, _attrs, _q, h1, h2, h3) => {
      const href = normalizeSafeHref(h1 || h2 || h3 || '');
      if (!href) return _m;
      return `<li><p>${buildSemanticLinkHtml(title.trim(), href)}</p></li>`;
    },
  );

  // List/plain citations: Title (https://...) without anchor
  out = out.replace(/<li><p>([^<]+?)\s+\((https?:\/\/[^)]+)\)\s*<\/p><\/li>/gi, (_m, title, url) => {
    const href = normalizeSafeHref(url);
    if (!href) return _m;
    return `<li><p>${buildSemanticLinkHtml(title.trim(), href)}</p></li>`;
  });

  out = out.replace(/<p>([^<]+?)\s+\((https?:\/\/[^)]+)\)\s*<\/p>/gi, (_m, title, url) => {
    const href = normalizeSafeHref(url);
    if (!href) return _m;
    return `<p>${buildSemanticLinkHtml(title.trim(), href)}</p>`;
  });

  // Ensure anchors have one href + correct internal/external attrs (preserve inner markup from mammoth)
  out = out.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attrs, inner) => {
    const hrefMatch = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = hrefMatch ? normalizeSafeHref(hrefMatch[2] || hrefMatch[3] || hrefMatch[4] || '') : '';
    if (!href) return inner;
    return `${formatOpeningAnchor(attrs, href, { external: isExternalHref(href) })}${inner}</a>`;
  });

  return out;
}
