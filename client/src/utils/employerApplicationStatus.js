/** Human-facing legacy Application.status label keys (employer i18n). */
export const LEGACY_STATUS_LABEL_KEYS = {
  submitted: 'statusSubmitted',
  applied: 'statusApplied',
  viewed: 'statusViewed',
  shortlisted: 'statusShortlisted',
  rejected: 'statusRejected',
  interview: 'statusInterview',
  hired: 'statusHired',
};

/** Employer-settable statuses via PATCH /employer/applications/:id */
export const EMPLOYER_SETTABLE_STATUSES = ['shortlisted', 'rejected', 'interview', 'hired'];

export const STATUS_ACTION_LABEL_KEYS = {
  shortlisted: 'actionShortlist',
  interview: 'actionMoveToInterview',
  rejected: 'actionReject',
  hired: 'actionMarkHired',
};

/** Statuses that notify the candidate when changed (server onApplicationStatusChange). */
export const CANDIDATE_NOTIFIED_STATUSES = new Set(['shortlisted', 'rejected', 'interview', 'hired']);
