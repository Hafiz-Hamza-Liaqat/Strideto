/**
 * CONTENT-AUTOFILL-P2.1 — normalize imported CMS tags to newline-separated form text.
 */

export const CMS_MAX_TAGS = 20;
export const CMS_MAX_TAG_LENGTH = 80;

/**
 * @param {string} raw
 * @returns {string[]} deduplicated tags preserving first casing
 */
export function normalizeCmsImportTags(raw) {
  const parts = String(raw || '')
    .split(/[\n;,]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const tag of parts) {
    if (tag.length > CMS_MAX_TAG_LENGTH) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= CMS_MAX_TAGS) break;
  }
  return out;
}

/** @returns {string} newline-separated tags for admin form fields */
export function cmsImportTagsToFormText(raw) {
  return normalizeCmsImportTags(raw).join('\n');
}
