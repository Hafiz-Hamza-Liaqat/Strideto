/**
 * CONTENT-AUTOFILL-P2.1 — canonical BlogRichTextEditor HTML for toolbar + DOCX import.
 */
import { inlineMarkdown, escapeHtml } from '../blog/blogContent.js';
import {
  buildSemanticLinkHtml,
  normalizeSafeHref,
  normalizeBlogLinksInHtml,
  parseCitationParenthetical,
  parseMarkdownLinkLine,
} from '../blog/blogLinks.js';

export const CALLOUT_VARIANTS = Object.freeze(['important', 'tip', 'warning', 'example']);

export const CALLOUT_LABELS = Object.freeze({
  important: 'Important',
  tip: 'Tip',
  warning: 'Warning',
  example: 'Example',
});

export const SOURCES_WRAPPER_CLASS = 'blog-sources';

const INNER_CONTENT_MARKERS = Object.freeze([
  { key: 'h2', labels: ['h2'] },
  { key: 'h3', labels: ['h3'] },
  { key: 'paragraph', labels: ['paragraph'] },
  { key: 'bullet', labels: ['bullet list', 'bullet'] },
  { key: 'numbered', labels: ['numbered list', 'numbered'] },
  { key: 'quote', labels: ['quote'] },
  { key: 'important', labels: ['important'] },
  { key: 'tip', labels: ['tip'] },
  { key: 'warning', labels: ['warning'] },
  { key: 'example', labels: ['example'] },
  { key: 'sources', labels: ['sources'] },
  { key: 'table', labels: ['table'] },
]);

function safeLinkHref(url) {
  return normalizeSafeHref(url);
}

function wrapListItems(html, tag) {
  return html.replace(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi'), (_m, inner) => {
    const items = inner.replace(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi, (_li, attrs, body) => {
      const trimmed = body.trim();
      if (/^<p[\s>]/i.test(trimmed)) return `<li${attrs || ''}>${trimmed}</li>`;
      return `<li${attrs || ''}><p>${trimmed}</p></li>`;
    });
    return `<${tag}>${items}</${tag}>`;
  });
}

function normalizeLinks(html) {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_match, attrs, inner) => {
    const hrefMatch = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = hrefMatch ? safeLinkHref(hrefMatch[2] || hrefMatch[3] || hrefMatch[4] || '') : '';
    if (!href) return inner;
    const label = inner.replace(/<[^>]+>/g, '').trim() || href;
    return buildSemanticLinkHtml(label, href);
  });
}

function stripUnsafe(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
    .replace(/<(\w+)([^>]*)\sstyle\s*=\s*(".*?"|'.*?'|[^\s>]+)([^>]*)>/gi, '<$1$2$4>');
}

function normalizeTable(html) {
  return html.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_m, inner) => {
    let body = inner
      .replace(/<colgroup[\s\S]*?<\/colgroup>/gi, '')
      .replace(/<(thead|tbody)\b[^>]*>/gi, '')
      .replace(/<\/(thead|tbody)>/gi, '');
    if (!/<th\b/i.test(body)) {
      body = body.replace(/(<tr>)([\s\S]*?)(<\/tr>)/i, (rowMatch, open, rowInner, close) => {
        const converted = rowInner.replace(/<td\b([^>]*)>/gi, '<th$1>').replace(/<\/td>/gi, '</th>');
        return `${open}${converted}${close}`;
      });
    }
    body = body.replace(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (_c, tag, attrs, cell) => {
      const kept = (attrs || '').match(/\s(colspan|rowspan)\s*=\s*("?\d+"?)/gi);
      const attrStr = kept ? kept.join('') : '';
      const trimmed = cell.trim();
      const innerCell = /^<p[\s>]/i.test(trimmed) ? trimmed : `<p>${trimmed || ''}</p>`;
      return `<${tag}${attrStr}>${innerCell}</${tag}>`;
    });
    return `<table><tbody>${body}</tbody></table>`;
  });
}

function parseInnerMarkerLine(line) {
  const lower = line.trim().toLowerCase().replace(/:$/, '');
  for (const entry of INNER_CONTENT_MARKERS) {
    for (const label of entry.labels) {
      if (lower === label) return entry.key;
    }
  }
  return null;
}

function parseStructuredBlocks(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && !lines[i].trim()) i += 1;
    if (i >= lines.length) break;
    const marker = parseInnerMarkerLine(lines[i]);
    if (marker) {
      i += 1;
      const bodyLines = [];
      while (i < lines.length) {
        if (parseInnerMarkerLine(lines[i])) break;
        bodyLines.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: marker, body: bodyLines.join('\n').trim() });
      continue;
    }
    const bodyLines = [];
    while (i < lines.length) {
      if (parseInnerMarkerLine(lines[i])) break;
      bodyLines.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'freeform', body: bodyLines.join('\n').trim() });
  }
  return blocks;
}

export function hasStructuredMarkers(text) {
  const lines = String(text || '').split('\n');
  return lines.some((line) => parseInnerMarkerLine(line));
}

function listItemsToHtml(items, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  const lis = items
    .filter(Boolean)
    .map((item) => `<li><p>${inlineMarkdown(item)}</p></li>`)
    .join('');
  return `<${tag}>${lis}</${tag}>`;
}

function buildCalloutHtml(variant, body) {
  const label = CALLOUT_LABELS[variant] || 'Note';
  const inner = body.trim()
    ? `<p><strong>${label}:</strong> ${inlineMarkdown(body.replace(/^\*\*[^*]+:\*\*\s*/, ''))}</p>`
    : `<p><strong>${label}:</strong> </p>`;
  return `<blockquote class="blog-callout blog-callout--${variant}">${inner}</blockquote>`;
}

function parseSourcesEntries(body) {
  const lines = String(body || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const entries = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const citation = parseCitationParenthetical(line);
    if (citation) {
      entries.push({ title: citation.title, url: citation.href });
      continue;
    }
    const mdLink = parseMarkdownLinkLine(line);
    if (mdLink) {
      entries.push({ title: mdLink.title, url: mdLink.href });
      continue;
    }
    if (/^https?:\/\//i.test(line)) {
      const href = safeLinkHref(line);
      if (href) {
        if (entries.length && !entries[entries.length - 1].url) {
          entries[entries.length - 1].url = href;
        } else {
          entries.push({ title: line, url: href });
        }
        continue;
      }
    }
    entries.push({ title: line, url: '' });
  }
  return entries.filter((e) => e.title);
}

function buildSourcesHtml(body) {
  const entries = parseSourcesEntries(body);
  const items = entries
    .map((entry) => {
      const href = safeLinkHref(entry.url);
      if (href) {
        return `<li><p>${buildSemanticLinkHtml(entry.title, href)}</p></li>`;
      }
      return `<li><p>${escapeHtml(entry.title)}</p></li>`;
    })
    .join('');
  const list = items || '<li><p>Organization — source title</p></li>';
  return `<div class="${SOURCES_WRAPPER_CLASS}"><h2>Sources</h2><ol>${list}</ol></div>`;
}

function parseSimpleTable(body) {
  const rows = String(body || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!rows.length) return '';
  const cells = rows.map((row) => row.split('|').map((c) => c.trim()));
  const [head, ...rest] = cells;
  const headRow = `<tr>${head.map((c) => `<th><p>${inlineMarkdown(c)}</p></th>`).join('')}</tr>`;
  const bodyRows = rest
    .map((row) => `<tr>${row.map((c) => `<td><p>${inlineMarkdown(c)}</p></td>`).join('')}</tr>`)
    .join('');
  return `<table><tbody>${headRow}${bodyRows}</tbody></table>`;
}

function blockToHtml(block) {
  const { type, body } = block;
  if (!body && type !== 'important' && type !== 'tip' && type !== 'warning' && type !== 'example') {
    return '';
  }
  switch (type) {
    case 'h2':
      return `<h2>${inlineMarkdown(body)}</h2>`;
    case 'h3':
      return `<h3>${inlineMarkdown(body)}</h3>`;
    case 'paragraph':
      return `<p>${inlineMarkdown(body)}</p>`;
    case 'bullet':
      return listItemsToHtml(body.split('\n').map((l) => l.replace(/^[-*•]\s*/, '').trim()), false);
    case 'numbered':
      return listItemsToHtml(body.split('\n').map((l) => l.replace(/^\d+\.\s*/, '').trim()), true);
    case 'quote':
      return `<blockquote><p>${inlineMarkdown(body.replace(/^>\s*/, ''))}</p></blockquote>`;
    case 'important':
    case 'tip':
    case 'warning':
    case 'example':
      return buildCalloutHtml(type, body);
    case 'sources':
      return buildSourcesHtml(body);
    case 'table':
      return parseSimpleTable(body);
    case 'freeform':
      return markdownLinesToCanonicalHtml(body);
    default:
      return markdownLinesToCanonicalHtml(body);
  }
}

function markdownLinesToCanonicalHtml(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const parts = [];
  let listType = null;
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    parts.push(listItemsToHtml(listItems, listType === 'ol'));
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      flushList();
      parts.push(`<h3>${inlineMarkdown(h3[1])}</h3>`);
      continue;
    }
    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      flushList();
      parts.push(`<h2>${inlineMarkdown(h2[1])}</h2>`);
      continue;
    }
    const quote = trimmed.match(/^>\s*(.+)$/);
    if (quote) {
      flushList();
      parts.push(`<blockquote><p>${inlineMarkdown(quote[1])}</p></blockquote>`);
      continue;
    }
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(bullet[1]);
      continue;
    }
    if (listType === 'ol') {
      const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
      if (numbered) {
        listItems.push(numbered[1]);
        continue;
      }
    }
    flushList();
    parts.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }
  flushList();
  return parts.join('');
}

/**
 * Convert structured CMS / markdown content text to canonical blog editor HTML.
 */
export function structuredContentToCanonicalBlogHtml(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (hasStructuredMarkers(raw)) {
    return parseStructuredBlocks(raw).map(blockToHtml).join('');
  }
  return markdownLinesToCanonicalHtml(raw);
}

/**
 * Normalize mammoth / foreign HTML into canonical TipTap-compatible blog HTML.
 */
export function mammothHtmlToCanonicalBlogHtml(html) {
  let out = stripUnsafe(String(html || ''));
  out = out.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '<h2>$1</h2>');
  out = wrapListItems(out, 'ul');
  out = wrapListItems(out, 'ol');
  out = normalizeTable(out);
  out = normalizeLinks(out);
  out = out.replace(/<blockquote\b([^>]*)>([\s\S]*?)<\/blockquote>/gi, (_m, attrs, inner) => {
    if (/blog-callout/i.test(attrs)) return _m;
    const pInner = /^<p[\s>]/i.test(inner.trim()) ? inner : `<p>${inner}</p>`;
    return `<blockquote>${pInner}</blockquote>`;
  });
  out = normalizeBlogLinksInHtml(out);
  return out.trim();
}

/**
 * Prefer DOCX HTML when present; otherwise structured/markdown text conversion.
 */
export function extractContentSectionFromFullDocxHtml(docxHtml) {
  const html = String(docxHtml || '');
  if (!html) return '';
  const startRe = /<p[^>]*>\s*(?:Content|Article Content|Blog Content|Body)\s*<\/p>/i;
  const endRe = /<p[^>]*>\s*(?:Title|Blog Title|Article Title|Post Title|Category|Blog Category|Author|Author Name|Summary|Summary \/ Excerpt|Excerpt|Short Description|Tags|Keywords|Topics|Published At|Publish Date|Publication Date|Status|Publication Status|SEO Slug|Slug|URL Slug|SEO Title|Meta Title|Meta Description|SEO Description|Canonical URL|Canonical Link|Featured|Is Featured|Featured Image URL|Featured Image|Image Alt Text|OG Image|OG Image URL)\s*<\/p>/i;
  const startMatch = html.search(startRe);
  if (startMatch < 0) return '';
  const afterStart = html.slice(startMatch).replace(startRe, '');
  const endMatch = afterStart.search(endRe);
  return (endMatch >= 0 ? afterStart.slice(0, endMatch) : afterStart).trim();
}

const SUPPLEMENT_BLOCK_TYPES = new Set(['important', 'tip', 'warning', 'example', 'sources']);

function stripStructuredMarkerParagraphsFromNative(html) {
  return String(html || '')
    .replace(/<p>\s*(Important|Tip|Warning|Example|Sources)\s*<\/p>/gi, '')
    .replace(/<p>\s*https?:\/\/[^<]+\s*<\/p>/gi, (match) => match);
}

function structuredSupplementHtml(plain) {
  if (!hasStructuredMarkers(plain)) return '';
  return parseStructuredBlocks(plain)
    .filter((block) => SUPPLEMENT_BLOCK_TYPES.has(block.type))
    .map(blockToHtml)
    .join('');
}

export function importContentToCanonicalBlogHtml(text, { docxHtml = '', documentText = '' } = {}) {
  const plain = String(text || '').trim();
  const fullHtml = String(docxHtml || '').trim();

  if (fullHtml && documentText) {
    const nativeSlice = extractContentSectionFromFullDocxHtml(fullHtml);
    if (nativeSlice) {
      let nativeCanonical = mammothHtmlToCanonicalBlogHtml(nativeSlice);
      nativeCanonical = stripStructuredMarkerParagraphsFromNative(nativeCanonical);
      const supplements = structuredSupplementHtml(plain);
      if (nativeCanonical || supplements) {
        return normalizeBlogLinksInHtml(`${nativeCanonical}${supplements}`.trim());
      }
    }
  }

  if (fullHtml && !hasStructuredMarkers(plain) && !/^#{1,3}\s/m.test(plain)) {
    return mammothHtmlToCanonicalBlogHtml(fullHtml);
  }
  return normalizeBlogLinksInHtml(structuredContentToCanonicalBlogHtml(plain));
}

/** @deprecated use structuredContentToCanonicalBlogHtml */
export function importPlainTextToBlogHtml(text) {
  return structuredContentToCanonicalBlogHtml(text);
}

/**
 * Career textarea: readable plain/markdown without raw HTML tags on apply.
 */
export function canonicalBlogHtmlToCareerPlain(html) {
  let text = String(html || '');
  text = text.replace(/<div class="blog-sources"[^>]*>[\s\S]*?<\/div>/gi, (block) => {
    const inner = block.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').trim();
    return `\nSources\n${inner}\n`;
  });
  text = text.replace(/<blockquote class="blog-callout blog-callout--(\w+)"[^>]*>[\s\S]*?<\/blockquote>/gi, (_m, v) => {
    const plain = _m.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return `\n${v.charAt(0).toUpperCase() + v.slice(1)}\n${plain}\n`;
  });
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  text = text.replace(/<li><p>([\s\S]*?)<\/p><\/li>/gi, '- $1\n');
  text = text.replace(/<li>([\s\S]*?)<\/li>/gi, '- $1\n');
  text = text.replace(/<blockquote><p>([\s\S]*?)<\/p><\/blockquote>/gi, '> $1\n');
  text = text.replace(/<p>([\s\S]*?)<\/p>/gi, '$1\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** Strip to semantic skeleton for equivalence tests. */
export function normalizeBlogHtmlSemantics(html) {
  return String(html || '')
    .replace(/\s+/g, ' ')
    .replace(/<p><\/p>/gi, '')
    .replace(/<colgroup[\s\S]*?<\/colgroup>/gi, '')
    .replace(/\sstyle="[^"]*"/gi, '')
    .replace(/<li><p>/gi, '<li><p>')
    .trim()
    .toLowerCase();
}
