/** MKT-P5 — application-scoped job offer constants. */

export const OFFER_STATUSES = Object.freeze(['sent', 'accepted', 'declined', 'withdrawn', 'expired']);

export const OFFER_WORK_MODES = Object.freeze(['remote', 'hybrid', 'on_site']);

export const OFFER_EMPLOYMENT_TYPES = Object.freeze([
  'full_time',
  'part_time',
  'contract',
  'internship',
  'temporary',
]);

export const OFFER_NOTE_MAX_LENGTH = 2000;
export const OFFER_COMPENSATION_MAX_LENGTH = 500;
export const OFFER_EMPLOYMENT_TYPE_MAX_LENGTH = 64;

/** Candidate may respond only while offer is effectively sent (not expired). */
export const OFFER_RESPONDABLE_STATUSES = Object.freeze(['sent']);

/** Terminal states that do not block sending a new structured offer. */
export const OFFER_TERMINAL_STATUSES = Object.freeze([
  'withdrawn',
  'declined',
  'expired',
  'accepted',
]);
