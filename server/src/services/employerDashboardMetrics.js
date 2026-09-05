import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { resolveJobApplyType } from './employerApplicationCounts.js';
import { isModerationPendingJob } from './publishing/employerJobSubmissionState.js';

const NEW_APPLICATION_DAYS = 7;

export function computeConversionRate(internalApplications, internalViews) {
  if (!internalViews || internalViews <= 0) return null;
  if (internalApplications < 0) return null;
  return Number(((internalApplications / internalViews) * 100).toFixed(2));
}

/**
 * Draft Jobs must represent Jobs still legitimately in the draft workflow.
 * Rejecting a Job only changes approvalStatus (see moderationController.js
 * bulkRejectJobs) — status stays 'draft' — so a rejected Job must be
 * excluded here or it reads as an ordinary, unsubmitted draft forever.
 */
export function draftJobsFilter(employerFilter) {
  return { ...employerFilter, status: 'draft', approvalStatus: { $ne: 'rejected' } };
}

const STATUS_BUCKETS = {
  new: ['submitted', 'applied', 'viewed'],
  shortlisted: ['shortlisted'],
  interview: ['interview'],
  hired: ['hired'],
  rejected: ['rejected'],
};

function bucketCounts(rows) {
  const out = { new: 0, shortlisted: 0, interview: 0, hired: 0, rejected: 0 };
  for (const row of rows) {
    const st = row._id;
    const n = row.count;
    if (STATUS_BUCKETS.new.includes(st)) out.new += n;
    if (STATUS_BUCKETS.shortlisted.includes(st)) out.shortlisted += n;
    if (STATUS_BUCKETS.interview.includes(st)) out.interview += n;
    if (STATUS_BUCKETS.hired.includes(st)) out.hired += n;
    if (STATUS_BUCKETS.rejected.includes(st)) out.rejected += n;
  }
  return out;
}

/**
 * @param {string} employerId
 * @param {{ now?: Date }} [opts]
 */
export async function computeEmployerDashboardMetrics(employerId, { now = new Date() } = {}) {
  const eid = new mongoose.Types.ObjectId(employerId);
  const employerFilter = { employerId: eid };

  const [
    totalJobs,
    activeJobs,
    draftJobs,
    pendingApprovalJobs,
    closedJobs,
    jobRows,
  ] = await Promise.all([
    Job.countDocuments(employerFilter),
    Job.countDocuments({ ...employerFilter, status: 'active', approvalStatus: 'approved' }),
    Job.countDocuments(draftJobsFilter(employerFilter)),
    Job.find({ ...employerFilter, approvalStatus: 'pending' }).select('source submittedAt').lean()
      .then((rows) => rows.filter(isModerationPendingJob).length),
    Job.countDocuments({ ...employerFilter, status: 'closed' }),
    Job.find(employerFilter)
      .select('_id title views applyType applicationLink applyEmail status approvalStatus applicationsCount')
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  const internalJobIds = jobRows
    .filter((j) => resolveJobApplyType(j) === 'internal')
    .map((j) => j._id);

  const internalIdSet = new Set(internalJobIds.map(String));

  let totalInternalApplications = 0;
  let applicationBuckets = { new: 0, shortlisted: 0, interview: 0, hired: 0, rejected: 0 };
  let recentActivity = [];

  if (internalJobIds.length) {
    const [totalInternalApplicationsResult, statusAgg, recentApps] = await Promise.all([
      Application.countDocuments({ jobId: { $in: internalJobIds } }),
      Application.aggregate([
        { $match: { jobId: { $in: internalJobIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Application.find({ jobId: { $in: internalJobIds } })
        .sort({ appliedDate: -1 })
        .limit(15)
        .populate('jobId', 'title')
        .populate('userId', 'name')
        .lean(),
    ]);
    totalInternalApplications = totalInternalApplicationsResult;
    applicationBuckets = bucketCounts(statusAgg);

    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - NEW_APPLICATION_DAYS);
    const newApplications = await Application.countDocuments({
      jobId: { $in: internalJobIds },
      appliedDate: { $gte: cutoff },
    });
    applicationBuckets.new = newApplications;

    recentActivity = recentApps.map((a) => ({
      type: 'application',
      applicationId: a._id,
      jobId: a.jobId?._id || a.jobId,
      jobTitle: a.jobId?.title || 'Job',
      candidateName: a.userId?.name || 'Candidate',
      status: a.status,
      at: a.appliedDate || a.createdAt,
    }));
  }

  const totalViews = jobRows.reduce((s, j) => s + (j.views || 0), 0);
  const internalViews = jobRows
    .filter((j) => internalIdSet.has(String(j._id)))
    .reduce((s, j) => s + (j.views || 0), 0);

  const conversionRate = computeConversionRate(totalInternalApplications, internalViews);

  const jobs = await Promise.all(
    jobRows.slice(0, 10).map(async (j) => {
      const applyType = resolveJobApplyType(j);
      const tracked = applyType === 'internal';
      let applications = null;
      let shortlisted = 0;
      if (tracked) {
        const [appCount, shortCount] = await Promise.all([
          Application.countDocuments({ jobId: j._id }),
          Application.countDocuments({ jobId: j._id, status: 'shortlisted' }),
        ]);
        applications = appCount;
        shortlisted = shortCount;
      }
      return {
        _id: j._id,
        title: j.title,
        views: j.views || 0,
        status: j.status,
        approvalStatus: j.approvalStatus,
        applyType,
        applicationsTracked: tracked,
        applications,
        shortlisted,
      };
    })
  );

  return {
    totalJobs,
    activeJobs,
    draftJobs,
    pendingApprovalJobs,
    closedJobs,
    totalApplications: totalInternalApplications,
    totalInternalApplications,
    newApplications: applicationBuckets.new,
    shortlistedCandidates: applicationBuckets.shortlisted,
    interviews: applicationBuckets.interview,
    hired: applicationBuckets.hired,
    rejected: applicationBuckets.rejected,
    totalViews,
    internalViews,
    conversionRate,
    conversionRateLabel: conversionRate != null ? `${conversionRate}%` : 'n/a',
    recentActivity,
    jobs,
  };
}
