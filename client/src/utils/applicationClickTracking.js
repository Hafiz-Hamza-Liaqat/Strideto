/**
 * SEO-P8 — outbound application click tracking (safe metadata only).
 */
import { trackPlatformEvent } from './platformAnalytics.js';
import { classifyPageGroup } from '@shared/seo/measurement/pageGroups.js';

/**
 * @param {object} params
 * @param {string} params.entityType
 * @param {string} params.entityId
 * @param {string} [params.page]
 * @param {'external_url'|'email'|'internal'} [params.destinationType]
 */
export function trackApplicationClick({
  entityType,
  entityId,
  page,
  destinationType = 'external_url',
}) {
  const pathname = page || (typeof window !== 'undefined' ? window.location.pathname : '/');
  const { pageGroup } = classifyPageGroup(pathname);

  trackPlatformEvent({
    eventType: 'application_click',
    entityType,
    entityId: entityId ? String(entityId) : undefined,
    metadata: {
      action: 'application',
      pageGroup,
      destinationType,
      landingPage: pathname,
    },
  });
}
