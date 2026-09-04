/**
 * Predicates for the Employer-to-moderation boundary.
 * Employer drafts remain private until the explicit submit action sets
 * submittedAt. Curated/Admin jobs retain their existing moderation semantics.
 */
export function isExplicitlySubmittedEmployerJob(job) {
  return job?.source === 'employer'
    && job?.approvalStatus === 'pending'
    && Boolean(job?.submittedAt);
}

export function isModerationPendingJob(job) {
  if (job?.approvalStatus !== 'pending') return false;
  if (job?.source !== 'employer') return true;
  return Boolean(job?.submittedAt);
}

export function isPrivateEmployerDraft(job) {
  return job?.source === 'employer'
    && job?.status === 'draft'
    && !job?.submittedAt;
}
