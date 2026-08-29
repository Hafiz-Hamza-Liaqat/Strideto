/**
 * MKT-P5 — application offer analytics (consent-gated, no PII).
 */
import { trackPlatformEvent } from '../../../utils/platformAnalytics.js';

export const APPLICATION_OFFER_ACTIONS = {
  OFFER_INTENT: 'employer_offer_intent',
  OFFER_CREATED: 'employer_offer_created',
  OFFER_SENT: 'employer_offer_sent',
  CANDIDATE_OFFER_VIEW: 'candidate_offer_view',
  CANDIDATE_RESPONSE_INTENT: 'candidate_offer_response_intent',
  CANDIDATE_RESPONSE_UPDATED: 'candidate_offer_response_updated',
  WITHDRAW_INTENT: 'employer_offer_withdraw_intent',
  WITHDRAWN: 'employer_offer_withdrawn',
};

export function trackApplicationOfferEvent(action, extra = {}) {
  trackPlatformEvent({
    eventType: 'cta_click',
    entityType: 'application_offer',
    metadata: {
      action,
      ...extra,
    },
  });
}
