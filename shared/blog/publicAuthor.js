/**
 * Public blog byline — confirmed author display names only (SEO-P6).
 * A missing author does not imply Strideto organization authorship.
 */

/**
 * @param {{ authorDisplay?: string, authorName?: string } | null | undefined} blog
 * @returns {string | null}
 */
export function resolvePublicBlogAuthorLabel(blog) {
  if (!blog) return null;
  const raw = String(blog.authorDisplay ?? blog.authorName ?? '').trim();
  return raw || null;
}
