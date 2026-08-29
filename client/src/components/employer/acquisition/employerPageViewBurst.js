/** Suppress only Strict Mode / same-tick duplicate effects — not browser Back/Forward revisits. */
export const STRICT_MODE_BURST_MS = 250;

let lastPageViewAt = 0;
let lastPageViewNavigationKey = null;

/** Reset burst state — test isolation only. */
export function resetEmployerPageViewBurstState() {
  lastPageViewAt = 0;
  lastPageViewNavigationKey = null;
}

/** Test helper — simulate elapsed time between visits (e.g. browser Back). */
export function advanceEmployerPageViewClock(ms) {
  lastPageViewAt -= ms;
}

/**
 * One page view per active visit; suppress duplicate effect firings within burst window only.
 * Browser Back restores the same location.key but elapsed time allows a new page view.
 * @param {string} [navigationKey]
 */
export function shouldEmitEmployerPageView(navigationKey) {
  if (!navigationKey) return true;
  const now = Date.now();
  if (
    lastPageViewNavigationKey === navigationKey
    && now - lastPageViewAt < STRICT_MODE_BURST_MS
  ) {
    return false;
  }
  lastPageViewNavigationKey = navigationKey;
  lastPageViewAt = now;
  return true;
}
