/**
 * Canonical client analytics emitter (C.7.0.5 + SEO-P8 landing attribution).
 * All public interactions should use this helper.
 * First-party only — gated on analytics consent (no third-party tags).
 */
import { analyticsEventApi } from '../services/contentInsightsApi';
import { allowsAnalytics } from '../consent/cookieConsentStorage';
import { buildLandingAttributionMetadata } from '@shared/seo/measurement/landingAttribution.js';

const SESSION_KEY = 'er_analytics_session';
const ACQUISITION_KEY = 'er_acquisition_attribution';
function eventId() {
  try {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

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
 * First-touch acquisition attribution for the session (UTM fields only).
 */
function getSessionAcquisitionMetadata() {
  if (typeof window === 'undefined') return {};
  try {
    const existing = sessionStorage.getItem(ACQUISITION_KEY);
    if (existing) return JSON.parse(existing);

    const landing = buildLandingAttributionMetadata(
      window.location.pathname,
      window.location.search,
      document.referrer || '',
    );
    sessionStorage.setItem(ACQUISITION_KEY, JSON.stringify(landing));
    return landing;
  } catch {
    return {};
  }
}

/**
 * Initialize first-touch attribution at an eligible public landing entry.
 * Storage remains consent-gated; callers do not need to emit an event.
 */
export function initializeLandingAttribution() {
  if (!allowsAnalytics()) return {};
  return getSessionAcquisitionMetadata();
}

export function getRegistrationAttribution() {
  if (!allowsAnalytics()) return undefined;
  const value = getSessionAcquisitionMetadata();
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'landingPage', 'referrerCategory'];
  const result = Object.fromEntries(keys.filter((key) => value?.[key]).map((key) => [key, value[key]]));
  return Object.keys(result).length ? result : undefined;
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

  const acquisition = getSessionAcquisitionMetadata();
  const metadata = {
    ...acquisition,
    ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
  };

  const body = {
    ...payload,
    locale,
    page: payload.page || window.location.pathname,
    referrer: payload.referrer || document.referrer || '',
    sessionId: payload.sessionId || getSessionId(),
    metadata,
    eventId: payload.eventId || eventId(),
    schemaVersion: '2',
    source: 'client',
    environment: import.meta?.env?.MODE === 'production' ? 'production' : (import.meta?.env?.MODE || 'development'),
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
