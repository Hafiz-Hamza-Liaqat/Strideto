/**
 * MKT-P1 — first-party employer conversion analytics (cta_click + page_view).
 * No personal form data in metadata.
 */
import { trackPlatformEvent } from '../../../utils/platformAnalytics.js';
import { shouldEmitEmployerPageView } from './employerPageViewBurst.js';

export {
  advanceEmployerPageViewClock,
  resetEmployerPageViewBurstState,
  shouldEmitEmployerPageView,
} from './employerPageViewBurst.js';

export const EMPLOYER_CTA_ACTIONS = {
  PAGE_VIEW: 'employer_page_view',
  SIGNUP_INTENT: 'employer_signup_intent',
  LOGIN_INTENT: 'employer_login_intent',
  POST_JOB_INTENT: 'post_job_intent',
  BROWSE_JOBS_INTENT: 'employer_browse_jobs_intent',
  HOMEPAGE_EMPLOYER_CTA: 'homepage_employer_cta',
  APPLICATION_METHOD_INFO: 'employer_application_method_info_view',
};

/**
 * @param {string} action - one of EMPLOYER_CTA_ACTIONS values
 * @param {object} [extra] - safe metadata only (ctaId, section, placement, path, navigationKey)
 */
export function trackEmployerAcquisitionEvent(action, extra = {}) {
  if (action === EMPLOYER_CTA_ACTIONS.PAGE_VIEW) {
    const { navigationKey, ...safeExtra } = extra;
    const path = safeExtra.path || (typeof window !== 'undefined' ? window.location.pathname : '');
    if (!shouldEmitEmployerPageView(navigationKey)) return;

    trackPlatformEvent({
      eventType: 'page_view',
      entityType: 'page',
      metadata: {
        pageKind: 'employer_acquisition',
        ...safeExtra,
      },
    });
    return;
  }

  trackPlatformEvent({
    eventType: 'cta_click',
    entityType: 'page',
    metadata: {
      action,
      pageKind: 'employer_acquisition',
      ...extra,
    },
  });
}
