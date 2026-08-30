/**
 * Blog body format detection + legacy-safe normalization.
 * Final HTML must still be sanitized at render boundary (DOMPurify / sanitize-html).
 */
import {
  buildSemanticLinkHtml,
  linkifyEscapedInlineText,
  normalizeBlogLinksInHtml,
  normalizeSafeHref,
} from './blogLinks.js';

const HTML_TAG_RE = /<\/?(?:h[1-6]|p|ul|ol|li|div|span|strong|em|a|img|blockquote|table|thead|tbody|tfoot|tr|th|td|caption|br|hr)\b/i;
const MD_HEADING_RE = /^#{1,6}\s+\S/m;
const MD_LIST_RE = /^[\-*]\s+\S/m;
const MD_ORDERED_LIST_RE = /^\d+\.\s+\S/m;
const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/;

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function detectContentFormat(content) {
  const raw = String(content || '').trim();
  if (!raw) return 'plain';
  if (HTML_TAG_RE.test(raw)) return 'html';
  if (MD_HEADING_RE.test(raw) || MD_LIST_RE.test(raw) || MD_ORDERED_LIST_RE.test(raw) || MD_LINK_RE.test(raw)) return 'markdown';
  return 'plain';
}

function safeHref(url) {
  const href = normalizeSafeHref(url);
  return href ? escapeHtml(href) : '';
}

export function inlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = linkifyEscapedInlineText(out);
  return out;
}

export function legacyMarkdownToHtml(content) {
  const lines = String(content || '').split('\n');
  const parts = [];
  let listOpen = null;

  const closeList = () => {
    if (listOpen === 'ul') parts.push('</ul>');
    if (listOpen === 'ol') parts.push('</ol>');
    listOpen = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = Math.min(3, Math.max(2, heading[1].length));
      parts.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (/^[\-*]\s+/.test(trimmed)) {
      if (listOpen !== 'ul') {
        closeList();
        parts.push('<ul>');
        listOpen = 'ul';
      }
      parts.push(`<li>${inlineMarkdown(trimmed.replace(/^[\-*]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      if (listOpen !== 'ol') {
        closeList();
        parts.push('<ol>');
        listOpen = 'ol';
      }
      parts.push(`<li>${inlineMarkdown(trimmed.replace(/^\d+\.\s+/, ''))}</li>`);
      continue;
    }
    closeList();
    parts.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }
  closeList();
  return parts.join('');
}

export function plainTextToHtml(content) {
  const blocks = String(content || '').split(/\n{2,}/);
  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, '').trim();
}

/**
 * Demote body H1 to H2 — page title is the sole H1.
 */
export function demoteBodyH1(html) {
  return String(html || '').replace(/<h1(\s[^>]*)?>([\s\S]*?)<\/h1>/gi, '<h2$1>$2</h2>');
}

/**
 * Build a URL-safe heading id with Unicode normalization and deterministic fallbacks.
 * @param {string} text
 * @param {Set<string>} used
 * @param {() => number} nextSectionIndex
 */
export function slugifyHeading(text, used, nextSectionIndex) {
  const plain = stripTags(text);
  const normalized = plain.normalize('NFKD').replace(/\p{M}/gu, '');
  let base = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!base) {
    base = `section-${nextSectionIndex()}`;
  }

  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

/**
 * Inject stable ids into h2–h3; build TOC from the same normalized HTML.
 */
export function injectHeadingIds(html) {
  const used = new Set();
  const toc = [];
  let sectionFallback = 0;
  const nextSectionIndex = () => {
    sectionFallback += 1;
    return sectionFallback;
  };

  const normalized = String(html || '').replace(
    /<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi,
    (_match, level, attrs, inner) => {
      const text = stripTags(inner);
      if (!text) return _match;
      const id = slugifyHeading(text, used, nextSectionIndex);
      toc.push({ level: Number(level), text, id });
      const attrStr = attrs && /\bid\s*=/.test(attrs) ? attrs : ` id="${id}"${attrs || ''}`;
      return `<h${level}${attrStr}>${inner}</h${level}>`;
    }
  );
  return { html: normalized, toc };
}

/** Wrap tables for horizontal scroll on narrow viewports. */
export function wrapBlogTables(html) {
  return String(html || '').replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (match) => {
    if (/<div[^>]*blog-table-scroll/i.test(match)) return match;
    return `<div class="blog-table-scroll">${match}</div>`;
  });
}

export function normalizeBlogContent(content) {
  const format = detectContentFormat(content);
  let html = '';
  if (format === 'html') {
    html = String(content || '');
  } else if (format === 'markdown') {
    html = legacyMarkdownToHtml(content);
  } else {
    html = plainTextToHtml(content);
  }
  html = demoteBodyH1(html);
  html = normalizeBlogLinksInHtml(html);
  const { html: withIds, toc } = injectHeadingIds(html);
  return { html: wrapBlogTables(withIds), toc };
}

export function shouldShowBlogToc(toc) {
  return Array.isArray(toc) && toc.length >= 2;
}

export { escapeHtml, buildSemanticLinkHtml, normalizeSafeHref };
