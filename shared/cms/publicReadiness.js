import { CMS_STATUS } from './launchEligible.js';

const BLOG_PUBLISHED = 'published';

export function isBlogPublicReady(record = {}) {
  return record.status === BLOG_PUBLISHED && Boolean(record.slug);
}

export function isAdmissionPublicReady(record = {}) {
  return record.status === CMS_STATUS.ACTIVE && record.launchEligible === true && Boolean(record.slug);
}

export function isScholarshipPublicReady(record = {}) {
  return isAdmissionPublicReady(record);
}

export function isInternshipPublicReady(record = {}) {
  return isAdmissionPublicReady(record);
}

export function isJobPublicReady(record = {}) {
  if (!record.slug) return false;
  if (record.status !== CMS_STATUS.ACTIVE) return false;
  if (record.approvalStatus !== 'approved') return false;
  return record.launchEligible === true;
}

/** Admin table status label — avoids "Active" when not publicly eligible. */
export function formatCmsPublicationStatus(record = {}) {
  const { status, launchEligible } = record;
  if (status === CMS_STATUS.DRAFT) return 'Draft';
  if (status === CMS_STATUS.CLOSED) return 'Closed';
  if (status === CMS_STATUS.ACTIVE) {
    return launchEligible === true ? 'Active — Public' : 'Active — Not public';
  }
  return status || '—';
}

export function formatJobPublicationStatus(record = {}) {
  const { status, approvalStatus, launchEligible } = record;
  if (status === CMS_STATUS.DRAFT) return 'Draft';
  if (status === CMS_STATUS.CLOSED) return 'Closed';
  if (approvalStatus === 'pending') return 'Pending approval';
  if (approvalStatus === 'rejected') return 'Rejected';
  if (status === CMS_STATUS.ACTIVE && approvalStatus === 'approved') {
    return launchEligible === true ? 'Active — Public' : 'Active — Not public';
  }
  if (status === CMS_STATUS.ACTIVE) return 'Active — Not public';
  return status || '—';
}

export function formatBlogPublicationStatus(record = {}) {
  if (record.status === BLOG_PUBLISHED) return 'Published';
  if (record.status === 'archived') return 'Archived';
  return 'Draft';
}

export const VIEW_PUBLIC_HINT = 'Publish this record before viewing its public page.';
