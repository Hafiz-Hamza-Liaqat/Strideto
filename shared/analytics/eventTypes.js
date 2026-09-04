/**
 * Canonical analytics event types (C.7.0.5).
 */

export const ANALYTICS_EVENT_TYPES = [
  'page_view',
  'search',
  'search_click',
  'job_view',
  'scholarship_view',
  'blog_view',
  'admission_view',
  'university_view',
  'career_view',
  'page_builder_view',
  'form_submit',
  'media_view',
  'media_download',
  'ad_impression',
  'ad_click',
  'dynamic_block_render',
  'dynamic_block_click',
  'cta_click',
  'application_click',
  'user_registered',
  'employer_registered',
  'user_verified',
  'employer_email_verified',
  'employer_verified',
  'user_activated',
  'employer_activated',
  'job_published',
  'internal_application_created',
  'newsletter_signup',
  // Legacy / existing
  'view',
  'click',
  'bookmark',
  'notification_sent',
  'notification_opened',
  'resume_download',
  'email_sent',
  // Career domain (C.8.0.2A)
  'profile_created',
  'profile_updated',
  'resume_version_created',
  'resume_published',
  // OpportunityApplication (C.8.0.3A)
  'application_created',
  'application_updated',
  'application_stage_changed',
  'application_withdrawn',
  'application_note_added',
  'application_reminder_created',
  'application_document_attached',
  'application_offer_accepted',
  'application_archived',
  // Assessments (C.8.4)
  'assessment_started',
  'assessment_completed',
  'assessment_passed',
  'assessment_failed',
  'credential_issued',
  // Employer Intelligence (C.8.5)
  'employer_candidate_viewed',
  'employer_candidate_shortlisted',
  'employer_interview_scheduled',
  'employer_interview_completed',
  'employer_offer_sent',
  'employer_offer_accepted',
  'employer_offer_rejected',
  'employer_candidate_rejected',
  'employer_candidate_hired',
  'employer_hiring_note_added',
];

export const ANALYTICS_EVENT_TYPE_SET = new Set(ANALYTICS_EVENT_TYPES);

export const ANALYTICS_ENTITY_TYPES = [
  'job',
  'scholarship',
  'admission',
  'university',
  'blog',
  'career-guidance',
  'page',
  'form',
  'media',
  'ad',
  'dynamic-block',
  'cms-page',
  'opportunity-application',
  'employer-hiring',
];

/**
 * @param {string} type
 */
export function isAnalyticsEventType(type) {
  return ANALYTICS_EVENT_TYPE_SET.has(type);
}

/**
 * Map legacy listingType + eventType combinations.
 * @param {string} eventType
 * @param {string} [listingType]
 */
export function resolveCanonicalEventType(eventType, listingType) {
  const t = String(eventType || '').trim();
  if (t === 'view' && listingType === 'job') return 'job_view';
  if (t === 'view' && listingType === 'scholarship') return 'scholarship_view';
  if (t === 'view' && listingType === 'blog') return 'blog_view';
  if (t === 'view' && listingType === 'admission') return 'admission_view';
  return t;
}
