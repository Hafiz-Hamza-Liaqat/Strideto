/**
 * MKT-P3 — employer applicant review analytics.
 * No applicant PII in metadata. Consent-gated via trackPlatformEvent.
 */
import { trackPlatformEvent } from '../../../utils/platformAnalytics.js';

export const EMPLOYER_APPLICANT_ACTIONS = {
  APPLICATIONS_VIEW: 'employer_applications_view',
  APPLICATION_OPENED: 'employer_application_opened',
  STATUS_INTENT: 'employer_application_status_intent',
  STATUS_UPDATED: 'employer_application_status_updated',
  RESUME_OPEN_INTENT: 'employer_resume_open_intent',
  EMPTY_STATE_VIEW: 'employer_applicant_empty_state_view',
};

let lastApplicationsViewKey = null;
let lastApplicationsViewAt = 0;
let lastEmptyStateKey = null;
let lastEmptyStateAt = 0;
const VIEW_BURST_MS = 250;

/** Test isolation */
export function resetEmployerApplicantAnalyticsState() {
  lastApplicationsViewKey = null;
  lastApplicationsViewAt = 0;
  lastEmptyStateKey = null;
  lastEmptyStateAt = 0;
}

/**
 * @param {string} action
 * @param {object} [extra] — safe metadata only
 */
export function trackEmployerApplicantEvent(action, extra = {}) {
  trackPlatformEvent({
    eventType: action === EMPLOYER_APPLICANT_ACTIONS.APPLICATIONS_VIEW ? 'page_view' : 'cta_click',
    entityType: 'employer_workspace',
    metadata: {
      pageKind: 'employer_applicant_review',
      action,
      ...extra,
    },
  });
}

/**
 * Applications inbox view — once per navigation key within burst window.
 * @param {string} navigationKey
 * @param {object} [extra]
 */
export function trackEmployerApplicationsView(navigationKey, extra = {}) {
  if (navigationKey) {
    const now = Date.now();
    if (
      lastApplicationsViewKey === navigationKey &&
      now - lastApplicationsViewAt < VIEW_BURST_MS
    ) {
      return;
    }
    lastApplicationsViewKey = navigationKey;
    lastApplicationsViewAt = now;
  }
  trackEmployerApplicantEvent(EMPLOYER_APPLICANT_ACTIONS.APPLICATIONS_VIEW, {
    surface: 'applications_inbox',
    ...extra,
  });
}

/**
 * Empty-state view — once per surface key within burst window.
 * @param {string} surfaceKey
 * @param {object} [extra]
 */
export function trackEmployerApplicantEmptyStateView(surfaceKey, extra = {}) {
  if (surfaceKey) {
    const now = Date.now();
    if (lastEmptyStateKey === surfaceKey && now - lastEmptyStateAt < VIEW_BURST_MS) {
      return;
    }
    lastEmptyStateKey = surfaceKey;
    lastEmptyStateAt = now;
  }
  trackEmployerApplicantEvent(EMPLOYER_APPLICANT_ACTIONS.EMPTY_STATE_VIEW, {
    surface: surfaceKey,
    ...extra,
  });
}
