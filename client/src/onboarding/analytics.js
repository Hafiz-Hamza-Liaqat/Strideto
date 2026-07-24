import { trackPlatformEvent } from '../utils/platformAnalytics.js';

export function trackOnboarding(eventType, metadata = {}) {
  trackPlatformEvent({
    eventType,
    entityType: 'onboarding',
    metadata,
  });
}
