import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';

export function AdminConfirmDialog({ open = false, title, message, confirmLabel, danger, onConfirm, onCancel, loading, busy, children }) {
  const { t } = useTranslation('common');
  const panelRef = useRef(null);
  const isLoading = loading || busy;
  useOverlayA11y({ open, onClose: onCancel, containerRef: panelRef, trapFocus: true });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel?.();
      }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xl border border-gray-200 dark:border-gray-700 outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        tabIndex={-1}
      >
        <h3 id="admin-confirm-title" className="text-lg font-bold text-gray-900 dark:text-white mb-2 break-words">{title}</h3>
        {message ? <p className="text-gray-600 dark:text-gray-400 mb-6 break-words">{message}</p> : null}
        {children}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 min-h-[44px] rounded-lg text-sm text-white ${danger ? 'bg-red-600' : 'bg-primary'}`}
          >
            {confirmLabel || t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
