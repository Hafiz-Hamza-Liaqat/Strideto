/** Suppress duplicate cta_click from same control within Strict Mode / double-handler window. */
export const CTA_CLICK_BURST_MS = 250;

let lastClickAt = 0;
let lastClickKey = null;

export function resetEmployerCtaClickBurstState() {
  lastClickAt = 0;
  lastClickKey = null;
}

export function advanceEmployerCtaClickClock(ms) {
  lastClickAt -= ms;
}

/**
 * One analytics click per user gesture; allow distinct ctaIds and later genuine clicks.
 * @param {string} [clickKey] — stable id e.g. ctaId + action
 */
export function shouldEmitEmployerCtaClick(clickKey) {
  if (!clickKey) return true;
  const now = Date.now();
  if (lastClickKey === clickKey && now - lastClickAt < CTA_CLICK_BURST_MS) {
    return false;
  }
  lastClickKey = clickKey;
  lastClickAt = now;
  return true;
}
