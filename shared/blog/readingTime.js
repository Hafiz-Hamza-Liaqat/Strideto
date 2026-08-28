/**
 * Shared blog reading-time estimation (list, detail, JSON-LD, admin preview).
 */

/** Strip HTML tags and collapse whitespace for word counting. */
export function stripHtmlForWordCount(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} content - article body (HTML, Markdown, or plain text)
 * @param {number|string|undefined|null} override - manual readingTime minutes
 * @returns {number} minutes, minimum 1
 */
export function estimateReadingMinutes(content, override) {
  const manual = Number(override);
  if (Number.isFinite(manual) && manual > 0) return Math.round(manual);

  const text = stripHtmlForWordCount(content);
  if (!text) return 1;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/**
 * @param {{ content?: string, excerpt?: string, readingTime?: number }} post
 */
export function resolveBlogReadingMinutes(post) {
  const content = post?.content || post?.excerpt || '';
  return estimateReadingMinutes(content, post?.readingTime);
}
