/** MKT-P4 — application-scoped employer/candidate communication constants. */

/** Matches employer note limit in EmployerIntelligenceService.addNote. */
export const APPLICATION_MESSAGE_MAX_LENGTH = 4000;

export const APPLICATION_MESSAGE_MIN_LENGTH = 1;

export const APPLICATION_MESSAGE_TYPES = Object.freeze([
  'message',
  'interview_invitation',
  'interview_update',
  'system',
]);

export const APPLICATION_MESSAGE_SENDER_ROLES = Object.freeze(['employer', 'candidate', 'system']);

export const INTERVIEW_INVITATION_METHODS = Object.freeze(['video', 'phone', 'in_person']);

export const INTERVIEW_INVITATION_STATUSES = Object.freeze([
  'pending',
  'accepted',
  'declined',
  'cancelled',
]);

export const INTERVIEW_INVITATION_MIN_DURATION_MINUTES = 15;
export const INTERVIEW_INVITATION_MAX_DURATION_MINUTES = 480;

export const APPLICATION_COMMUNICATION_PAGE_SIZE = 50;
export const APPLICATION_COMMUNICATION_MAX_PAGE_SIZE = 100;

export const INTERVIEW_EMPLOYER_NOTE_MAX_LENGTH = 2000;
