/**
 * Canonical AnalyticsEventService (C.7.0.5).
 * Single write path for all platform analytics events.
 */
import { AnalyticsEvent } from '../../models/AnalyticsEvent.js';
import crypto from 'crypto';
import { resolveCanonicalEventType } from '../../../../shared/analytics/eventTypes.js';
import { validateAnalyticsEvent } from '../../../../shared/analytics/validation.js';
import { analyticsCacheClear } from './analyticsCache.js';
import { normalizeLocale } from '../../../../shared/localization/localeResolver.js';

/**
 * Parse lightweight device/browser from user-agent.
 * @param {string} ua
 */
export function parseUserAgent(ua = '') {
  const s = String(ua);
  let device = 'desktop';
  if (/mobile/i.test(s)) device = 'mobile';
  else if (/tablet|ipad/i.test(s)) device = 'tablet';

  let browser = 'other';
  if (/edg\//i.test(s)) browser = 'edge';
  else if (/chrome/i.test(s) && !/edg/i.test(s)) browser = 'chrome';
  else if (/firefox/i.test(s)) browser = 'firefox';
  else if (/safari/i.test(s) && !/chrome/i.test(s)) browser = 'safari';

  return { device, browser };
}

/**
 * @param {object} input
 * @param {object} [context]
 */
export async function recordAnalyticsEvent(input = {}, context = {}) {
  const errors = validateAnalyticsEvent(input);
  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    err.details = errors;
    throw err;
  }

  const ua = context.userAgent || input.userAgent || '';
  const parsed = parseUserAgent(ua);
  const eventType = resolveCanonicalEventType(input.eventType, input.listingType || input.entityType);

  const entityType = context.entityType || input.entityType || input.listingType || null;
  const entityId = (context.entityId || input.entityId)
    ? String(context.entityId || input.entityId)
    : (input.listingId ? String(input.listingId) : null);

  const doc = await AnalyticsEvent.create({
    eventId: input.eventId || crypto.randomUUID(),
    schemaVersion: input.schemaVersion || '2',
    // These fields describe the receiving runtime, not client-asserted data.
    source: context.source || (context.userAgent ? 'client' : 'server'),
    environment: context.environment || process.env.NODE_ENV || 'development',
    eventType,
    entityType,
    entityId,
    // Identity is always established by the authenticated server context.
    // A public client may never assign an event to another user.
    userId: context.userId || undefined,
    listingType: input.listingType || (['job', 'scholarship', 'admission', 'blog', 'foreign_study'].includes(entityType) ? entityType : null),
    listingId: input.listingId || undefined,
    page: String(input.page || input.metadata?.page || '').slice(0, 500),
    referrer: String(input.referrer || '').slice(0, 500),
    country: String(input.country || '').slice(0, 80),
    province: String(input.province || '').slice(0, 80),
    device: String(input.device || parsed.device).slice(0, 40),
    browser: String(input.browser || parsed.browser).slice(0, 40),
    sessionId: String(input.sessionId || '').slice(0, 128),
    locale: normalizeLocale(input.locale || input.metadata?.locale || context.locale),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
  });

  // Invalidate aggregations so dashboards stay fresh
  analyticsCacheClear();
  return doc;
}

/**
 * Fire-and-forget record (never throws to callers).
 */
export function scheduleAnalyticsEvent(input, context = {}) {
  void recordAnalyticsEvent(input, context).catch(() => {});
}

export class AnalyticsEventService {
  static record = recordAnalyticsEvent;
  static schedule = scheduleAnalyticsEvent;
  static parseUserAgent = parseUserAgent;
}
