/**
 * TipTap Sources section — preserves div.blog-sources wrapper.
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { SOURCES_WRAPPER_CLASS } from '../../../../shared/cms/blogCanonicalHtml.js';

export const BlogSources = Node.create({
  name: 'blogSources',
  group: 'block',
  content: 'heading orderedList',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: `div.${SOURCES_WRAPPER_CLASS}`, priority: 60 }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: SOURCES_WRAPPER_CLASS }), 0];
  },
});

export function insertSourcesSection(editor) {
  editor
    .chain()
    .focus()
    .insertContent(
      `<div class="${SOURCES_WRAPPER_CLASS}"><h2>Sources</h2><ol><li><p>Organization — source title (<a href="https://">official link</a>)</p></li></ol></div><p></p>`
    )
    .run();
}

export function isSourcesActive(editor) {
  return !!editor?.isActive('blogSources');
}
