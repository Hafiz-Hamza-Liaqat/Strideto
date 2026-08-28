/**
 * SEO-P5 — Google Indexing API eligibility boundary (policy only, no network).
 *
 * Google Indexing API is restricted to JobPosting (eligible jobs) and
 * BroadcastEvent in VideoObject. STRIDETO has no BroadcastEvent product.
 */
import { evaluateJobPostingEligibility, JOB_POSTING_SURFACES } from './jobPostingEligibility.js';

export const GOOGLE_INDEXING_API_ENTITY = Object.freeze({
  JOB_POSTING: 'job_posting',
});

/**
 * @returns {{ eligible: boolean, reason?: string }}
 */
export function evaluateGoogleIndexingApiEligibility(entityType, doc, options = {}) {
  if (entityType === 'internship' || doc?.type === 'internship' || doc?.jobType === 'Internship') {
    return { eligible: false, reason: 'internship_not_eligible' };
  }

  if (entityType === 'job' || entityType === 'jobs') {
    const result = evaluateJobPostingEligibility(doc, {
      surface: JOB_POSTING_SURFACES.DETAIL,
      now: options.now || new Date(),
    });
    if (result.eligible) {
      return { eligible: true, entity: GOOGLE_INDEXING_API_ENTITY.JOB_POSTING };
    }
    return { eligible: false, reason: result.reason || 'job_posting_ineligible' };
  }

  return { eligible: false, reason: 'entity_not_supported' };
}

/** Guard: general content must never enter a Google Indexing API submission path. */
export function assertNotGoogleIndexingApiGeneralContent(entityType) {
  if (entityType === 'blog' || entityType === 'scholarship' || entityType === 'program'
    || entityType === 'institution' || entityType === 'admission') {
    return false;
  }
  return true;
}
