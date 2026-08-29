/**
 * MKT-P4 — application communication analytics (consent-gated, no PII).
 */
import { trackPlatformEvent } from '../../../utils/platformAnalytics.js';

export const APPLICATION_COMMUNICATION_ACTIONS = {
  MESSAGE_INTENT: 'employer_candidate_message_intent',
  MESSAGE_SENT: 'employer_candidate_message_sent',
  INTERVIEW_INTENT: 'employer_interview_invite_intent',
  INTERVIEW_CREATED: 'employer_interview_invite_created',
  CANDIDATE_INTERVIEW_VIEW: 'candidate_interview_view',
  CANDIDATE_RESPONSE_INTENT: 'candidate_interview_response_intent',
  CANDIDATE_RESPONSE_UPDATED: 'candidate_interview_response_updated',
  CANDIDATE_REPLY_INTENT: 'candidate_application_message_intent',
  CANDIDATE_REPLY_SENT: 'candidate_application_message_sent',
};

export function trackApplicationCommunicationEvent(action, extra = {}) {
  trackPlatformEvent({
    eventType: 'cta_click',
    entityType: 'application_communication',
    metadata: {
      action,
      ...extra,
    },
  });
}
