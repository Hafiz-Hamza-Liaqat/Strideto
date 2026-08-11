/**
 * L.2.8 — Job vacancy / seats tracking (canonical Job model, no duplicate service).
 */
import { Job } from '../../models/Job.js';
import { Application } from '../../models/Application.js';
import { OpportunityApplication } from '../../models/career/OpportunityApplication.js';

const HIRED_STAGES = new Set(['accepted', 'joined', 'hired']);
const HIRED_LEGACY = new Set(['hired', 'accepted', 'joined']);

export async function countFilledSeats(jobId) {
  const [legacyHired, oaHired] = await Promise.all([
    Application.countDocuments({ jobId, status: { $in: [...HIRED_LEGACY] } }),
    OpportunityApplication.countDocuments({
      opportunityType: 'job',
      opportunityId: jobId,
      pipelineStage: { $in: [...HIRED_STAGES] },
    }),
  ]);
  return Math.max(legacyHired, oaHired);
}

/**
 * @param {object} job — Job lean doc
 * @returns {object} vacancy stats
 */
export async function getVacancyStats(job) {
  if (!job) return null;
  const totalSeats = job.totalSeats != null && job.totalSeats > 0 ? Number(job.totalSeats) : null;
  const applicationsCount = job.applicationsCount ?? 0;
  const filledSeats = totalSeats != null ? await countFilledSeats(job._id) : null;
  const remainingSeats = totalSeats != null && filledSeats != null
    ? Math.max(0, totalSeats - filledSeats)
    : null;

  let vacancyStatus = 'open';
  if (job.status === 'closed') vacancyStatus = 'closed';
  else if (totalSeats != null && remainingSeats === 0) vacancyStatus = 'filled';
  else if (totalSeats != null && filledSeats > 0) vacancyStatus = 'filling';

  return {
    totalSeats,
    filledSeats,
    remainingSeats,
    applicationsCount,
    closingDate: job.deadline || job.expiresAt || null,
    status: job.status,
    vacancyStatus,
    autoCloseWhenFilled: job.autoCloseWhenFilled !== false,
    hiringClosed: job.status === 'closed' || (remainingSeats === 0 && totalSeats != null),
  };
}

export async function assertJobAcceptingApplications(job) {
  if (!job) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }
  if (job.status !== 'active') {
    const err = new Error('Hiring closed — this job is not accepting applications');
    err.status = 400;
    err.code = 'HIRING_CLOSED';
    throw err;
  }
  if (job.approvalStatus && job.approvalStatus !== 'approved') {
    const err = new Error('Job not found');
    err.status = 404;
    err.code = 'NOT_PUBLIC';
    throw err;
  }
  if (job.publicationState && ['draft', 'pending_review', 'rejected', 'closed', 'expired'].includes(job.publicationState)) {
    const err = new Error('This job is not accepting applications');
    err.status = 400;
    err.code = 'HIRING_CLOSED';
    throw err;
  }
  const closeAt = job.applicationsCloseAt || job.deadline;
  if (closeAt) {
    const d = new Date(closeAt);
    if (!Number.isNaN(d.getTime()) && d < new Date()) {
      const err = new Error('Application deadline has passed');
      err.status = 400;
      err.code = 'DEADLINE_PASSED';
      throw err;
    }
  }
  const stats = await getVacancyStats(job);
  if (stats.hiringClosed) {
    const err = new Error('Hiring closed — all seats have been filled');
    err.status = 400;
    err.code = 'HIRING_CLOSED';
    throw err;
  }
  return stats;
}

/**
 * After pipeline transition to hired — auto-close if seats exhausted.
 */
export async function syncVacancyAfterHire(jobId) {
  const job = await Job.findById(jobId);
  if (!job || job.totalSeats == null || job.totalSeats <= 0) return null;
  const stats = await getVacancyStats(job);
  if (
    stats.remainingSeats === 0
    && stats.autoCloseWhenFilled
    && job.status === 'active'
  ) {
    job.status = 'closed';
    await job.save();
    return { closed: true, stats };
  }
  return { closed: false, stats };
}

export const JobVacancyService = {
  countFilledSeats,
  getVacancyStats,
  assertJobAcceptingApplications,
  syncVacancyAfterHire,
};
