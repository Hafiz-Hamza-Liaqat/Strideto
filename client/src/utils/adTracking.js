/**
 * Client-side ad impression/click tracking — fire-and-forget, never blocks UI.
 * First-party house-ad measurement; requires analytics consent.
 */
import { API_BASE_URL } from '../constants';
import { allowsAnalytics } from '../consent/cookieConsentStorage';

const impressionKeys = new Set();

export function calculateCtr(clicks, impressions) {
  const c = Number(clicks) || 0;
  const i = Number(impressions) || 0;
  if (i <= 0) return null;
  return (c / i) * 100;
}

export function formatCtr(clicks, impressions) {
  const ctr = calculateCtr(clicks, impressions);
  if (ctr == null) return '—';
  return `${ctr.toFixed(2)}%`;
}

function impressionKey(slotId, placementId) {
  return `${slotId}:${placementId || ''}`;
}

export function hasRecordedImpression(slotId, placementId) {
  return impressionKeys.has(impressionKey(slotId, placementId));
}

export function markImpressionRecorded(slotId, placementId) {
  impressionKeys.add(impressionKey(slotId, placementId));
}

function postBeacon(path, payload) {
  if (typeof window === 'undefined') return;
  const url = `${API_BASE_URL}${path}`;
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* silent */
  }
}

/**
 * @param {{ slotId: string, placementId?: string, pageId?: string }} payload
 * @param {{ preview?: boolean }} [options]
 */
export function trackAdImpression(payload, options = {}) {
  if (options.preview || !payload?.slotId) return;
  if (!allowsAnalytics()) return;
  if (hasRecordedImpression(payload.slotId, payload.placementId)) return;
  markImpressionRecorded(payload.slotId, payload.placementId);
  postBeacon('/monetization/impression', {
    slotId: payload.slotId,
    placementId: payload.placementId,
    pageId: payload.pageId,
  });
}

/**
 * @param {{ slotId: string, placementId?: string, pageId?: string }} payload
 * @param {{ preview?: boolean }} [options]
 */
export function trackAdClick(payload, options = {}) {
  if (options.preview || !payload?.slotId) return;
  if (!allowsAnalytics()) return;
  postBeacon('/monetization/click', {
    slotId: payload.slotId,
    placementId: payload.placementId,
    pageId: payload.pageId,
  });
}
