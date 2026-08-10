import { useEffect, useRef } from 'react';
import { registerOverlayEscape } from './overlayStack';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root) {
  if (!root) return [];
  return [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null
  );
}

/**
 * Registers Escape (via overlay stack) and optional focus trap for an open overlay.
 * Restores focus to the previously focused element on close.
 *
 * @param {{ open: boolean, onClose: () => void, containerRef?: React.RefObject, trapFocus?: boolean }} opts
 */
export function useOverlayA11y({ open, onClose, containerRef, trapFocus = true }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open || typeof onClose !== 'function') return undefined;
    previousFocusRef.current = document.activeElement;
    return registerOverlayEscape(() => onCloseRef.current?.());
    // onClose is intentionally read from onCloseRef. Depending on an inline
    // callback here would re-capture focus on every parent render and restore
    // focus to an element inside the closing overlay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !trapFocus) return undefined;
    const root = containerRef?.current;
    if (!root) return undefined;

    const focusFirst = () => {
      const nodes = getFocusable(root);
      const target = nodes[0] || root;
      if (target && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    };
    // Defer so portal content is mounted
    const t = requestAnimationFrame(focusFirst);

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const list = getFocusable(root);
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !root.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    root.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(t);
      root.removeEventListener('keydown', onKeyDown);
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [open, trapFocus, containerRef]);
}
