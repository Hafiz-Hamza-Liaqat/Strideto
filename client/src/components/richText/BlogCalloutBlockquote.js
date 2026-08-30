/**
 * TipTap blockquote with validated blog callout variants.
 */
import Blockquote from '@tiptap/extension-blockquote';
import { CALLOUT_VARIANTS } from '../../../../shared/cms/blogCanonicalHtml.js';

function parseCalloutVariant(className) {
  const cls = String(className || '');
  if (!cls.includes('blog-callout')) return null;
  for (const variant of CALLOUT_VARIANTS) {
    if (cls.includes(`blog-callout--${variant}`)) return variant;
  }
  return null;
}

export const BlogCalloutBlockquote = Blockquote.extend({
  addAttributes() {
    return {
      calloutVariant: {
        default: null,
        parseHTML: (element) => parseCalloutVariant(element.getAttribute('class')),
        renderHTML: (attributes) => {
          if (!attributes.calloutVariant) return {};
          return {
            class: `blog-callout blog-callout--${attributes.calloutVariant}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'blockquote',
        getAttrs: (node) => {
          const el = node;
          const variant = parseCalloutVariant(el.getAttribute?.('class') || el.className);
          return variant ? { calloutVariant: variant } : {};
        },
      },
    ];
  },
});

export function isCalloutActive(editor, variant) {
  if (!editor) return false;
  return editor.isActive('blockquote', { calloutVariant: variant });
}

export function insertCallout(editor, variant) {
  const labels = { important: 'Important', tip: 'Tip', warning: 'Warning', example: 'Example' };
  const label = labels[variant] || 'Note';
  editor
    .chain()
    .focus()
    .insertContent(
      `<blockquote class="blog-callout blog-callout--${variant}"><p><strong>${label}:</strong> </p></blockquote><p></p>`
    )
    .run();
}
