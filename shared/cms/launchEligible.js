import { assignLaunchEligibleOnAuthorityPublish, isFixtureRecord } from '../publicDiscovery/fixtureExclusion.js';

/** CMS content types using draft | active | closed */
export const CMS_STATUS = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  CLOSED: 'closed',
});

/**
 * Derive launchEligible for Admission / Scholarship / Internship CMS records.
 * Do not accept client-supplied launchEligible — derive from publication status.
 */
export function deriveCmsLaunchEligible(existing = {}, nextStatus = existing.status) {
  if (nextStatus === CMS_STATUS.DRAFT || nextStatus === CMS_STATUS.CLOSED) {
    return false;
  }
  if (nextStatus === CMS_STATUS.ACTIVE) {
    return assignLaunchEligibleOnAuthorityPublish(existing);
  }
  return existing.launchEligible === true;
}

export function applyCmsLaunchEligible(doc, existingSnapshot = null) {
  const existing = existingSnapshot || (doc.toObject ? doc.toObject() : doc);
  doc.launchEligible = deriveCmsLaunchEligible(existing, doc.status);
}

/**
 * Job public eligibility: active + approved only; never from status alone when pending/rejected.
 */
export function deriveJobLaunchEligible(job = {}) {
  const { status, approvalStatus } = job;
  if (status === CMS_STATUS.CLOSED || status === CMS_STATUS.DRAFT) {
    return false;
  }
  if (approvalStatus === 'rejected' || approvalStatus === 'pending') {
    return false;
  }
  if (status === CMS_STATUS.ACTIVE && approvalStatus === 'approved') {
    if (isFixtureRecord(job)) return false;
    return true;
  }
  if (status === CMS_STATUS.ACTIVE && approvalStatus !== 'approved') {
    return false;
  }
  return job.launchEligible === true;
}

export function applyJobLaunchEligible(doc, existingSnapshot = null) {
  const merged = { ...(existingSnapshot || {}), ...(doc.toObject ? doc.toObject() : doc) };
  doc.launchEligible = deriveJobLaunchEligible(merged);
}
