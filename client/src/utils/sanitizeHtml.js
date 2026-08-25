import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'div', 'span',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
  'blockquote', 'pre', 'code',
  'a', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'img',
];

const ALLOWED_ATTR = ['href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height', 'loading', 'class', 'colspan', 'rowspan', 'scope', 'id'];

/**
 * Defense-in-depth HTML sanitization before dangerouslySetInnerHTML.
 * Server should already sanitize on write; this protects against stale/compromised data.
 */
export function sanitizeHtmlForRender(html) {
  if (!html || typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
  });
}
