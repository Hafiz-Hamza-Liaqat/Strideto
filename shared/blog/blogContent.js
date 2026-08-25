/**
 * Blog body format detection + legacy-safe normalization.
 * Final HTML must still be sanitized at render boundary (DOMPurify / sanitize-html).
 */

const HTML_TAG_RE = /<\/?(?:h[1-6]|p|ul|ol|li|div|span|strong|em|a|img|blockquote|table|br|hr)\b/i;
const MD_HEADING_RE = /^#{1,6}\s+\S/m;
const MD_LIST_RE = /^[\-*]\s+\S/m;
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
  if (MD_HEADING_RE.test(raw) || MD_LIST_RE.test(raw) || MD_LINK_RE.test(raw)) return 'markdown';
  return 'plain';
}

function safeHref(url) {
  const href = String(url || '').trim();
  if (/^https?:\/\//i.test(href)) return escapeHtml(href);
  return '';
}

function inlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const href = safeHref(url);
    return href ? `<a href="${href}" rel="noopener noreferrer">${escapeHtml(label)}</a>` : escapeHtml(label);
  });
  return out;
}

export function legacyMarkdownToHtml(content) {
  const lines = String(content || '').split('\n');
  const parts = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      parts.push('</ul>');
      listOpen = false;
    }
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
      const level = Math.min(6, Math.max(2, heading[1].length));
      parts.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (/^[\-*]\s+/.test(trimmed)) {
      if (!listOpen) {
        parts.push('<ul>');
        listOpen = true;
      }
      parts.push(`<li>${inlineMarkdown(trimmed.replace(/^[\-*]\s+/, ''))}</li>`);
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

function slugifyHeading(text, used) {
  const base = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[^;\s]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, '').trim();
}

/**
 * Inject stable ids into h2–h6; build TOC from the same normalized HTML.
 */
export function injectHeadingIds(html) {
  const used = new Set();
  const toc = [];
  const normalized = String(html || '').replace(
    /<h([2-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi,
    (_match, level, attrs, inner) => {
      const text = stripTags(inner);
      if (!text) return _match;
      const id = slugifyHeading(text, used);
      toc.push({ level: Number(level), text, id });
      const attrStr = attrs && /\bid\s*=/.test(attrs) ? attrs : ` id="${id}"${attrs || ''}`;
      return `<h${level}${attrStr}>${inner}</h${level}>`;
    }
  );
  return { html: normalized, toc };
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
  return injectHeadingIds(html);
}

export function shouldShowBlogToc(toc) {
  return Array.isArray(toc) && toc.length >= 2;
}

export { escapeHtml };
