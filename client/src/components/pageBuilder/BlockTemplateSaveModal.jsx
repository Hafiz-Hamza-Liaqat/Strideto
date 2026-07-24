import { useState, useRef } from 'react';
import { adminFieldClass } from '../admin/AdminImageUrlField';
import { TEMPLATE_CATEGORIES } from '@shared/pageBuilderTemplates.js';
import { blockToTemplatePayload } from '@shared/pageBuilderTemplates.js';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';

/**
 * Save current block configuration as a reusable template (copy-on-insert).
 */
export function BlockTemplateSaveModal({ block, open, onClose, onSave }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('general');
  const [description, setDescription] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef(null);
  useOverlayA11y({ open: open && !!block, onClose, containerRef: panelRef, trapFocus: true });

  if (!open || !block) return null;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = blockToTemplatePayload(block, { name, category, description });
      if (previewImageUrl) payload.previewImageUrl = previewImageUrl;
      await onSave(payload);
      onClose();
      setName('');
      setDescription('');
      setPreviewImageUrl('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <form
        ref={panelRef}
        onSubmit={submit}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl p-4 sm:p-6 space-y-4 outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-template-title"
        tabIndex={-1}
      >
        <h3 id="save-template-title" className="text-lg font-semibold text-gray-900 dark:text-white">Save as Template</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Templates are copied when inserted — edits won&apos;t affect saved pages.</p>

        <label className="block text-sm">
          <span className="font-medium">Name *</span>
          <input className={`${adminFieldClass} mt-1`} required value={name} onChange={(e) => setName(e.target.value)} placeholder={`${block.type} template`} />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Category</span>
          <select className={`${adminFieldClass} mt-1`} value={category} onChange={(e) => setCategory(e.target.value)}>
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium">Description</span>
          <textarea className={`${adminFieldClass} mt-1`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Preview image URL (optional)</span>
          <input className={`${adminFieldClass} mt-1`} type="url" value={previewImageUrl} onChange={(e) => setPreviewImageUrl(e.target.value)} />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 min-h-[44px] text-sm rounded-lg border border-gray-300 dark:border-gray-600">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 min-h-[44px] text-sm rounded-lg bg-primary text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Save template'}
          </button>
        </div>
      </form>
    </div>
  );
}
