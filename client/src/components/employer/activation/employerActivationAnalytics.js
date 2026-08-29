/**
 * MKT-P2 — employer workspace activation analytics (post-auth funnel).
 * No form PII in metadata. Consent-gated via trackPlatformEvent.
 */
import { trackPlatformEvent } from '../../../utils/platformAnalytics.js';
import {
  emitEmployerActivationMilestoneOnce,
  ACTIVATION_MILESTONE_KEYS,
} from './employerActivationMilestones.js';

export { ACTIVATION_MILESTONE_KEYS } from './employerActivationMilestones.js';
export {
  emitEmployerActivationMilestoneOnce,
  hasEmployerActivationMilestone,
  markEmployerActivationMilestone,
  resetEmployerActivationMilestonesForTests,
} from './employerActivationMilestones.js';

export const EMPLOYER_ACTIVATION_ACTIONS = {
  ONBOARDING_VIEW: 'employer_onboarding_view',
  PROFILE_COMPLETION_INTENT: 'employer_profile_completion_intent',
  PROFILE_COMPLETED: 'employer_profile_completed',
  FIRST_JOB_INTENT: 'employer_first_job_intent',
  JOB_DRAFT_STARTED: 'employer_job_draft_started',
  APPLICATION_METHOD_SELECTED: 'employer_application_method_selected',
  PUBLISH_INTENT: 'employer_publish_intent',
  JOB_PUBLISHED: 'employer_job_published',
  ACTIVATION_COMPLETED: 'employer_activation_completed',
};

let lastOnboardingViewKey = null;
let lastOnboardingViewAt = 0;
const VIEW_BURST_MS = 250;

/** Test isolation */
export function resetEmployerActivationViewBurstState() {
  lastOnboardingViewKey = null;
  lastOnboardingViewAt = 0;
}

/**
 * @param {string} action
 * @param {object} [extra] — safe metadata only
 */
export function trackEmployerActivationEvent(action, extra = {}) {
  trackPlatformEvent({
    eventType: action === EMPLOYER_ACTIVATION_ACTIONS.ONBOARDING_VIEW ? 'page_view' : 'cta_click',
    entityType: 'employer_workspace',
    metadata: {
      pageKind: 'employer_activation',
      action,
      ...extra,
    },
  });
}

/**
 * Dashboard / checklist view — once per navigation key within burst window.
 * @param {string} navigationKey — React Router location.key
 */
export function trackEmployerOnboardingView(navigationKey) {
  if (navigationKey) {
    const now = Date.now();
    if (
      lastOnboardingViewKey === navigationKey &&
      now - lastOnboardingViewAt < VIEW_BURST_MS
    ) {
      return;
    }
    lastOnboardingViewKey = navigationKey;
    lastOnboardingViewAt = now;
  }
  trackEmployerActivationEvent(EMPLOYER_ACTIVATION_ACTIONS.ONBOARDING_VIEW, {
    surface: 'employer_dashboard',
  });
}

/**
 * Fire employer_activation_completed once per employer when derived activation becomes true.
 * @returns {boolean}
 */
export function trackEmployerActivationCompletedOnce(userId, extra = {}) {
  return emitEmployerActivationMilestoneOnce(
    userId,
    ACTIVATION_MILESTONE_KEYS.ACTIVATION_COMPLETED,
    () =>
      trackEmployerActivationEvent(EMPLOYER_ACTIVATION_ACTIONS.ACTIVATION_COMPLETED, {
        surface: 'employer_dashboard',
        ...extra,
      })
  );
}

/**
 * Fire employer_profile_completed once per employer on first transition to complete profile.
 * @returns {boolean}
 */
export function trackEmployerProfileCompletedOnce(userId, extra = {}) {
  return emitEmployerActivationMilestoneOnce(
    userId,
    ACTIVATION_MILESTONE_KEYS.PROFILE_COMPLETED,
    () =>
      trackEmployerActivationEvent(EMPLOYER_ACTIVATION_ACTIONS.PROFILE_COMPLETED, {
        source: 'employer_settings',
        ...extra,
      })
  );
}
