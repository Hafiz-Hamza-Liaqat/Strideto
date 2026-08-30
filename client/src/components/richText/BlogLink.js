import Link from '@tiptap/extension-link';
import { mergeAttributes } from '@tiptap/core';
import { BLOG_EXTERNAL_LINK_CLASS, isExternalHref, normalizeSafeHref } from '../../../../shared/blog/blogLinks.js';

/**
 * Blog editor link mark — external http(s) links open in new tab with semantic class.
 */
export const BlogLink = Link.extend({
  renderHTML({ HTMLAttributes }) {
    const href = normalizeSafeHref(HTMLAttributes.href || '');
    const external = isExternalHref(href);
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        href: href || HTMLAttributes.href,
        class: external ? BLOG_EXTERNAL_LINK_CLASS : null,
        target: external ? '_blank' : null,
        rel: external ? 'noopener noreferrer' : null,
      }),
      0,
    ];
  },
});
