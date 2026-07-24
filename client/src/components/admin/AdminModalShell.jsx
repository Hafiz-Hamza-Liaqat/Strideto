import { useEffect, useRef } from 'react';
import { useOverlayA11y } from '../../a11y/useOverlayA11y';

/**
 * Shared admin/modal overlay shell: Escape (stack), focus trap, aria-modal.
 * Drop-in wrapper for fixed inset dialogs without redesigning content.
 */
export function AdminModalShell({
  open = true,
  onClose,
  children,
  labelledBy,
  label,
  className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50',
  panelClassName,
  trapFocus = true,
}) {
  const panelRef = useRef(null);
  useOverlayA11y({ open, onClose, containerRef: panelRef, trapFocus });

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={className}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div ref={panelRef} className={panelClassName || 'outline-none'} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
