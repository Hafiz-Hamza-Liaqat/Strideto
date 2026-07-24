import { useEffect, useRef } from 'react';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';

export function Modal({ open, onClose, title, children }) {
  const panelRef = useRef(null);
  useOverlayA11y({ open, onClose, containerRef: panelRef, trapFocus: true });

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50 min-h-full" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-[min(100%,28rem)] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 my-4 mx-auto outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
        {children}
        <button type="button" onClick={onClose} className="mt-4 min-h-[44px] text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100">
          Close
        </button>
      </div>
    </div>
  );
}
