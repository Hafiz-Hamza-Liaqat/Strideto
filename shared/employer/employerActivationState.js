/**
 * MKT-P2 — pure employer activation checklist state derived from real profile/job data.
 * Profile field rules mirror server EmployerSubmissionEligibility profile checks (not verification).
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validEmail(value) {
  return nonEmptyString(value) && EMAIL_PATTERN.test(value.trim().toLowerCase());
}

function hasLocation(employer) {
  return ['location', 'city', 'province'].some((field) => nonEmptyString(employer?.[field]));
}

/**
 * @param {object} [employer]
 * @returns {{ complete: boolean, missingFields: string[] }}
 */
export function evaluateEmployerProfileCompleteness(employer) {
  const missingFields = [];
  if (!nonEmptyString(employer?.companyName)) missingFields.push('companyName');
  if (!validEmail(employer?.email)) missingFields.push('email');
  if (!nonEmptyString(employer?.companyDescription)) missingFields.push('companyDescription');
  if (!nonEmptyString(employer?.industry)) missingFields.push('industry');
  if (!hasLocation(employer)) missingFields.push('location');
  return {
    complete: missingFields.length === 0,
    missingFields,
  };
}

/**
 * @param {object} job
 */
function jobHasApplicationMethod(job) {
  if (!job || typeof job !== 'object') return false;
  const applyType = job.applyType;
  if (applyType === 'internal') return true;
  if (applyType === 'external') {
    return nonEmptyString(job.applicationLink) || nonEmptyString(job.applyEmail);
  }
  return false;
}

/**
 * Job submitted for review / live (not an unsubmitted draft).
 * @param {object} job
 */
export function isJobPublishedForActivation(job) {
  if (!job) return false;
  if (job.status === 'draft') return false;
  return job.status === 'active' || job.status === 'closed' || job.approvalStatus === 'pending';
}

/**
 * @param {object} params
 * @param {object} [params.employer]
 * @param {object} [params.dashboard] — dashboard API payload with jobs + counts
 */
export function deriveEmployerActivationChecklist({ employer, dashboard } = {}) {
  const profile = evaluateEmployerProfileCompleteness(employer);
  const jobs = dashboard?.jobs || [];
  const totalJobs = dashboard?.totalJobs ?? jobs.length;

  const firstJobCreated = totalJobs > 0;
  const applicationMethodChosen = jobs.some(jobHasApplicationMethod);

  const publishedCount =
    (dashboard?.activeJobs || 0) +
    (dashboard?.pendingApprovalJobs || 0) +
    (dashboard?.closedJobs || 0);
  const opportunityPublished =
    publishedCount > 0 || jobs.some((j) => isJobPublishedForActivation(j));

  const items = [
    {
      id: 'profile',
      complete: profile.complete,
      routeKey: 'settings',
    },
    {
      id: 'firstJob',
      complete: firstJobCreated,
      routeKey: 'postJob',
    },
    {
      id: 'applicationMethod',
      complete: applicationMethodChosen,
      routeKey: 'postJob',
    },
    {
      id: 'published',
      complete: opportunityPublished,
      routeKey: 'jobs',
    },
  ];

  const completedCount = items.filter((i) => i.complete).length;
  const activationComplete = completedCount === items.length;

  return {
    items,
    completedCount,
    totalCount: items.length,
    activationComplete,
    profile,
    showChecklist: !activationComplete,
  };
}
