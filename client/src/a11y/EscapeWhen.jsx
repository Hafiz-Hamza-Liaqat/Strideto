import { useEffect } from 'react';
import { registerOverlayEscape } from './overlayStack';

/**
 * Registers Escape → onEscape while `active` is true (top-of-stack aware).
 * Use inside inline admin dialogs without refactoring markup.
 */
export function EscapeWhen({ active, onEscape }) {
  useEffect(() => {
    if (!active || typeof onEscape !== 'function') return undefined;
    return registerOverlayEscape(onEscape);
  }, [active, onEscape]);
  return null;
}
