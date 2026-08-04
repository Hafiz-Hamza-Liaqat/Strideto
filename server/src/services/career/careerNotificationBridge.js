import { subscribeCareerEvent } from './CareerEventBus.js';
import { notifyUser } from '../notificationService.js';

let registered = false;

const NOTIFY_EVENTS = [
  'StageChanged',
  'OfferAccepted',
  'ApplicationWithdrawn',
  'InterviewScheduled',
  'ReminderCreated',
  // Employer Intelligence → notify talent (C.8.5)
  'CandidateShortlisted',
  'InterviewCompleted',
  'OfferSent',
  'OfferRejected',
  'CandidateRejected',
  'CandidateHired',
];

function titleForEvent(event) {
  switch (event.eventType) {
    case 'StageChanged':
      return `Application moved to ${event.payload?.toStage || 'new stage'}`;
    case 'OfferAccepted':
      return 'Offer accepted';
    case 'ApplicationWithdrawn':
      return 'Application withdrawn';
    case 'InterviewScheduled':
      return 'Interview scheduled';
    case 'ReminderCreated':
      return event.payload?.title ? `Reminder: ${event.payload.title}` : 'Reminder set';
    case 'CandidateShortlisted':
      return 'You were shortlisted';
    case 'InterviewCompleted':
      return 'Interview marked complete';
    case 'OfferSent':
      return 'An offer was sent';
    case 'OfferRejected':
      return 'Offer was declined';
    case 'CandidateRejected':
      return 'Application update';
    case 'CandidateHired':
      return 'Congratulations — hired';
    default:
      return 'Application update';
  }
}

function bodyForEvent(event) {
  switch (event.eventType) {
    case 'StageChanged':
      return `Moved from ${event.payload?.fromStage || '—'} to ${event.payload?.toStage || '—'}.`;
    case 'InterviewScheduled':
      return event.payload?.scheduledAt
        ? `Scheduled for ${new Date(event.payload.scheduledAt).toLocaleString()}.`
        : 'Interview details were updated.';
    case 'ReminderCreated':
      return event.payload?.remindAt
        ? `Due ${new Date(event.payload.remindAt).toLocaleString()}.`
        : 'A reminder was added to your application.';
    case 'CandidateShortlisted':
      return 'An employer moved your application into screening.';
    case 'OfferSent':
      return 'Review the offer details in your application tracker.';
    case 'CandidateHired':
      return 'Your application advanced to hired / joined.';
    default:
      return 'Open your application tracker for details.';
  }
}

function resolveNotifyUserId(event) {
  if (event.payload?.candidateUserId) return String(event.payload.candidateUserId);
  if (event.payload?.userId) return String(event.payload.userId);
  if (event.actor?.type === 'talent' && event.actor?.id) return String(event.actor.id);
  if (event.actor?.type === 'system' && event.payload?.userId) return String(event.payload.userId);
  return null;
}

/**
 * CareerEventBus → in-app notifications for application / hiring milestones.
 */
export function registerCareerNotificationHandlers() {
  if (registered) return;
  registered = true;

  for (const eventType of NOTIFY_EVENTS) {
    subscribeCareerEvent(eventType, async (event) => {
      const userId = resolveNotifyUserId(event);
      if (!userId) return;

      // User-facing /applications/:id must only ever contain an
      // OpportunityApplication id (the User's own tracker record) — never
      // legacyApplicationId or aggregateId, both of which identify the
      // Employer-facing Application and are not resolvable on this route.
      // Mirrors the already-correct fallback in automationService.js's
      // onJobApplication.
      const opportunityApplicationId = event.payload?.opportunityApplicationId || null;
      try {
        await notifyUser(userId, {
          category: event.eventType === 'InterviewScheduled' || event.eventType === 'InterviewCompleted'
            ? 'interview'
            : 'application',
          type: `career.${event.eventType}`,
          title: titleForEvent(event),
          body: bodyForEvent(event),
          link: opportunityApplicationId ? `/applications/${opportunityApplicationId}` : '/applications',
          metadata: {
            careerEventId: event.eventId,
            careerEventType: event.eventType,
            applicationId: opportunityApplicationId ? String(opportunityApplicationId) : null,
          },
        });
      } catch {
        /* non-blocking */
      }
    });
  }
}

export function resetCareerNotificationHandlerRegistration() {
  registered = false;
}
