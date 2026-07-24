/**
 * Overlay stack so Escape closes only the top-most overlay.
 * Register on open; unregister on close/unmount. Single document listener.
 */

const stack = [];
let listening = false;

function onDocumentKeyDown(e) {
  if (e.key !== 'Escape' || stack.length === 0) return;
  // Allow inputs to handle Escape first only if they stopPropagation;
  // top overlay always wins for modal/drawer dismiss.
  e.preventDefault();
  e.stopPropagation();
  const top = stack[stack.length - 1];
  try {
    top.onClose();
  } catch {
    /* ignore */
  }
}

/**
 * @param {() => void} onClose
 * @returns {() => void} unregister
 */
export function registerOverlayEscape(onClose) {
  const entry = { onClose };
  stack.push(entry);
  if (!listening) {
    document.addEventListener('keydown', onDocumentKeyDown, true);
    listening = true;
  }
  return () => {
    const idx = stack.lastIndexOf(entry);
    if (idx >= 0) stack.splice(idx, 1);
    if (stack.length === 0 && listening) {
      document.removeEventListener('keydown', onDocumentKeyDown, true);
      listening = false;
    }
  };
}

export function overlayStackDepth() {
  return stack.length;
}
