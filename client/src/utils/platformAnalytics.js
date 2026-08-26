/**
 * Canonical client analytics emitter (C.7.0.7.1).
 * All public interactions should use this helper.
 * First-party only — gated on analytics consent (no third-party tags).
 */
import { analyticsEventApi } from '../services/contentInsightsApi';
import { allowsAnalytics } from '../consent/cookieConsentStorage';

const SESSION_KEY = 'er_analytics_session';

function getSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

/**
 * Fire-and-forget analytics event via canonical API.
 * @param {object} payload
 */
export function trackPlatformEvent(payload = {}) {
  if (typeof window === 'undefined') return;
  if (!allowsAnalytics()) return;
  let locale = payload.locale;
  try {
    locale = locale || localStorage.getItem('edurozgaar-lang') || 'en';
  } catch {
    locale = locale || 'en';
  }
  const body = {
    ...payload,
    locale,
    page: payload.page || window.location.pathname,
    referrer: payload.referrer || document.referrer || '',
    sessionId: payload.sessionId || getSessionId(),
  };
  analyticsEventApi.record(body).catch(() => {});
}

/**
 * Track a content detail page view.
 */
export function trackContentView(entityType, entityId, eventType) {
  trackPlatformEvent({
    eventType: eventType || `${entityType}_view`,
    entityType,
    entityId: entityId ? String(entityId) : undefined,
  });
}

/**
 * Track page view (generic).
 */
export function trackPageView(pageType = 'page') {
  trackPlatformEvent({
    eventType: pageType === 'page-builder' ? 'page_builder_view' : 'page_view',
    entityType: pageType,
    metadata: { path: window.location.pathname },
  });
}

/**
 * Track dynamic block render/click.
 */
export function trackDynamicBlock(action, blockType, entityId) {
  trackPlatformEvent({
    eventType: action === 'click' ? 'dynamic_block_click' : 'dynamic_block_render',
    entityType: 'dynamic-block',
    entityId: entityId ? String(entityId) : undefined,
    metadata: { blockType },
  });
}

/**
 * Track search from listing pages (legacy search event).
 */
export function trackSearchQuery(query) {
  if (!query?.trim()) return;
  trackPlatformEvent({ eventType: 'search', metadata: { query: query.trim() } });
}
