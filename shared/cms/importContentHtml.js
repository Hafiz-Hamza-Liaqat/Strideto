/**
 * Convert imported plain-text article body to safe blog HTML (paragraphs, lists, headings).
 * Server applies sanitizeHtml after conversion.
 */

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} text
 * @returns {string} HTML fragment (unsanitized — sanitize on server)
 */
export function importPlainTextToBlogHtml(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return '';

  const lines = raw.split('\n');
  const parts = [];
  let listType = null;
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    const tag = listType === 'ol' ? 'ol' : 'ul';
    parts.push(`<${tag}>${listItems.map((li) => `<li>${escapeHtml(li)}</li>`).join('')}</${tag}>`);
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
      parts.push(`<h3>${escapeHtml(h3[1])}</h3>`);
      continue;
    }
    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      flushList();
      parts.push(`<h2>${escapeHtml(h2[1])}</h2>`);
      continue;
    }
    const quote = trimmed.match(/^>\s*(.+)$/);
    if (quote) {
      flushList();
      parts.push(`<blockquote><p>${escapeHtml(quote[1])}</p></blockquote>`);
      continue;
    }
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(bullet[1]);
      continue;
    }
    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(numbered[1]);
      continue;
    }

    flushList();
    parts.push(`<p>${escapeHtml(trimmed)}</p>`);
  }

  flushList();
  return parts.join('');
}
