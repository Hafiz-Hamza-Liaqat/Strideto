import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { ToolbarButton } from './RichTextToolbar';

const CALLOUT_VARIANTS = [
  { key: 'important', label: 'Important' },
  { key: 'tip', label: 'Tip' },
  { key: 'warning', label: 'Warning' },
  { key: 'example', label: 'Example' },
];

const editorSurfaceClass =
  'blog-editor-surface min-h-[220px] px-3 py-2 focus:outline-none text-gray-800 dark:text-gray-200';

/**
 * Blog article rich-text editor — sanitized HTML output, H2/H3 only, tables, callouts.
 */
export function BlogRichTextEditor({ value, onChange, placeholder = 'Write article content…' }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        class: editorSurfaceClass,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current && value !== undefined) {
      editor.commands.setContent(value || '', false);
    }
  }, [editor, value]);

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('Link URL (https:// or /path)', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertTable = () => {
    const raw = window.prompt('Table size (rows x columns)', '3x3');
    if (!raw) return;
    const match = String(raw).trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i);
    const rows = match ? Math.min(12, Math.max(2, parseInt(match[1], 10))) : 3;
    const cols = match ? Math.min(8, Math.max(2, parseInt(match[2], 10))) : 3;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  };

  const insertCallout = (variant) => {
    const label = CALLOUT_VARIANTS.find((v) => v.key === variant)?.label || 'Note';
    editor
      .chain()
      .focus()
      .insertContent(
        `<blockquote class="blog-callout blog-callout--${variant}"><p><strong>${label}:</strong> </p></blockquote><p></p>`
      )
      .run();
  };

  const insertSourcesSection = () => {
    editor
      .chain()
      .focus()
      .insertContent(
        '<div class="blog-sources"><h2>Sources</h2><ol><li>Organization — source title (<a href="https://">official link</a>)</li></ol></div><p></p>'
      )
      .run();
  };

  return (
    <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <ToolbarButton title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          Undo
        </ToolbarButton>
        <ToolbarButton title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          Redo
        </ToolbarButton>
        <span className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" aria-hidden />
        <ToolbarButton title="Paragraph" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>
          ¶
        </ToolbarButton>
        {[2, 3].map((level) => (
          <ToolbarButton
            key={level}
            title={`Heading ${level}`}
            active={editor.isActive('heading', { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            H{level}
          </ToolbarButton>
        ))}
        <span className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" aria-hidden />
        <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em>I</em>
        </ToolbarButton>
        <span className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" aria-hidden />
        <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          • List
        </ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. List
        </ToolbarButton>
        <ToolbarButton title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          Quote
        </ToolbarButton>
        <ToolbarButton title="Link" active={editor.isActive('link')} onClick={setLink}>
          Link
        </ToolbarButton>
        <ToolbarButton title="Insert table" onClick={insertTable}>
          Table
        </ToolbarButton>
        <span className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" aria-hidden />
        {CALLOUT_VARIANTS.map((v) => (
          <ToolbarButton key={v.key} title={`${v.label} callout`} onClick={() => insertCallout(v.key)}>
            {v.label}
          </ToolbarButton>
        ))}
        <ToolbarButton title="Sources section" onClick={insertSourcesSection}>
          Sources
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
