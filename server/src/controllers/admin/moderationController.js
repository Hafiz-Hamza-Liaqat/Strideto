import { Job } from '../../models/Job.js';
import { Employer } from '../../models/Employer.js';
import { ContentReport } from '../../models/ContentReport.js';
import { AdSlotConfig } from '../../models/AdSlotConfig.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { onJobApproved, onJobRejected, onEmployerVerificationChange } from '../../services/automationService.js';
import { assignLaunchEligibleOnAuthorityPublish } from '../../../../shared/publicDiscovery/fixtureExclusion.js';
import { ACQUISITION_EVENTS, evaluateEmployerActivation, scheduleCanonicalEvent } from '../../services/analytics/acquisitionEvents.js';
import {
  employerPrivateDraftExclusion,
  isModerationPendingJob,
} from '../../services/publishing/employerJobSubmissionState.js';

const MAX_REJECTION_REASON_LENGTH = 500;

export const getModerationQueues = asyncHandler(async (_req, res) => {
  const [pendingJobs, pendingEmployers, reportedContent, advertisements, verificationRequests] = await Promise.all([
    Job.find({ approvalStatus: 'pending', ...employerPrivateDraftExclusion() })
      .sort({ createdAt: -1 }).limit(50).lean(),
    Employer.find({ verificationLevel: 'basic', totalJobsPosted: { $gt: 0 } }).sort({ createdAt: -1 }).limit(50).lean(),
    ContentReport.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(50).lean(),
    AdSlotConfig.find().sort({ updatedAt: -1 }).limit(20).lean(),
    Employer.find({ verificationLevel: 'verified', verified: true }).sort({ updatedAt: -1 }).limit(20).select('companyName slug verificationLevel verified').lean(),
  ]);

  res.json({
    pendingJobs,
    pendingEmployers,
    reportedContent,
    advertisements,
    verificationRequests,
    counts: {
      pendingJobs: pendingJobs.length,
      pendingEmployers: pendingEmployers.length,
      reportedContent: reportedContent.length,
      advertisements: advertisements.length,
      verificationRequests: verificationRequests.length,
    },
  });
});

export const bulkApproveJobs = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: 'ids array required' });
  const pending = (await Job.find({ _id: { $in: ids }, approvalStatus: 'pending' }).lean())
    .filter(isModerationPendingJob);
  const eligibleIds = pending.filter((d) => assignLaunchEligibleOnAuthorityPublish(d)).map((d) => d._id);
  const ineligibleIds = pending.filter((d) => !assignLaunchEligibleOnAuthorityPublish(d)).map((d) => d._id);
  if (eligibleIds.length) {
    await Job.updateMany({ _id: { $in: eligibleIds } }, { $set: { approvalStatus: 'approved', status: 'active', launchEligible: true } });
  }
  if (ineligibleIds.length) {
    await Job.updateMany({ _id: { $in: ineligibleIds } }, { $set: { approvalStatus: 'approved', status: 'active', launchEligible: false } });
  }
  const result = { modifiedCount: pending.length };
  await logAudit({
    ...auditFromRequest(req),
    action: 'jobs.bulk_approve',
    targetType: 'job',
    metadata: { ids, modified: result.modifiedCount },
  });
  const approvedIds = pending.map((job) => job._id);
  const approvedJobs = await Job.find({ _id: { $in: approvedIds }, approvalStatus: 'approved' }).select('title employerId').lean();
  for (const job of approvedJobs) {
    scheduleCanonicalEvent({
      eventType: ACQUISITION_EVENTS.jobPublished,
      eventId: `${ACQUISITION_EVENTS.jobPublished}:${String(job._id)}:v1`,
      schemaVersion: '3', entityType: 'job', entityId: String(job._id),
      metadata: { conversion: ACQUISITION_EVENTS.jobPublished, employerId: job.employerId ? String(job.employerId) : null },
    });
    if (job.employerId) void evaluateEmployerActivation(job.employerId).catch(() => {});
    onJobApproved({ jobId: job._id, employerId: job.employerId, jobTitle: job.title }).catch(() => {});
  }
  res.json({ approved: result.modifiedCount });
});

export const bulkRejectJobs = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) return res.status(400).json({ error: 'ids array required' });
  const reason = typeof req.body?.reason === 'string'
    ? req.body.reason.trim().slice(0, MAX_REJECTION_REASON_LENGTH)
    : '';
  const pending = (await Job.find({ _id: { $in: ids }, approvalStatus: 'pending' })
    .select('_id source submittedAt').lean()).filter(isModerationPendingJob);
  const pendingIds = pending.map((job) => job._id);
  const result = await Job.updateMany(
    { _id: { $in: pendingIds }, approvalStatus: 'pending' },
    { $set: { approvalStatus: 'rejected' } }
  );
  const employerPendingIds = pending
    .filter((job) => job.source === 'employer')
    .map((job) => job._id);
  if (employerPendingIds.length) {
    await Job.updateMany(
      { _id: { $in: employerPendingIds } },
      { $set: { status: 'draft', submittedAt: null } }
    );
  }
  await logAudit({
    ...auditFromRequest(req),
    action: 'jobs.bulk_reject',
    targetType: 'job',
    metadata: { ids, modified: result.modifiedCount, reason: reason || undefined },
  });
  const rejectedJobs = await Job.find({ _id: { $in: ids }, approvalStatus: 'rejected' }).select('title employerId').lean();
  for (const job of rejectedJobs) {
    onJobRejected({ jobId: job._id, employerId: job.employerId, jobTitle: job.title, reason }).catch(() => {});
  }
  res.json({ rejected: result.modifiedCount });
});

export const verifyEmployer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const level = req.body?.verificationLevel || 'verified';
  if (!['verified', 'trusted', 'basic'].includes(level)) {
    return res.status(400).json({ error: 'Invalid verification level' });
  }
  const before = await Employer.findById(id).select('verificationLevel verified');
  const employer = await Employer.findByIdAndUpdate(
    id,
    { $set: { verificationLevel: level, verified: level !== 'basic' } },
    { new: true }
  ).select('-password');
  if (!employer) return res.status(404).json({ error: 'Employer not found' });
  if (level !== 'basic' && !(before?.verified === true || ['verified', 'trusted'].includes(before?.verificationLevel))) {
    scheduleCanonicalEvent({ eventType: ACQUISITION_EVENTS.employerVerified, eventId: `${ACQUISITION_EVENTS.employerVerified}:${String(employer._id)}:v1`, schemaVersion: '3', entityType: 'employer', entityId: String(employer._id), metadata: { conversion: ACQUISITION_EVENTS.employerVerified, verificationLevel: level } });
  }
  if (level !== 'basic') {
    const hasPublishedJob = await Job.exists({ employerId: employer._id, status: 'active', approvalStatus: 'approved' });
    if (hasPublishedJob) void evaluateEmployerActivation(employer._id).catch(() => {});
  }
  onEmployerVerificationChange({
    employerId: employer._id,
    verificationLevel: level,
    companyName: employer.companyName,
  }).catch(() => {});
  await logAudit({
    ...auditFromRequest(req),
    action: 'employer.verify',
    targetType: 'employer',
    targetId: id,
    targetLabel: employer.companyName,
    metadata: { verificationLevel: level },
  });
  res.json({ employer });
});

export const reviewReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const status = req.body?.status || 'reviewed';
  const report = await ContentReport.findByIdAndUpdate(
    id,
    { $set: { status, reviewedBy: req.user.userId, reviewedAt: new Date() } },
    { new: true }
  );
  if (!report) return res.status(404).json({ error: 'Report not found' });
  await logAudit({
    ...auditFromRequest(req),
    action: 'report.review',
    targetType: 'report',
    targetId: id,
    metadata: { status },
  });
  res.json({ report });
});

export const suspendListing = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  if (type === 'job') {
    await Job.findByIdAndUpdate(id, { $set: { status: 'closed', approvalStatus: 'rejected' } });
  } else {
    return res.status(400).json({ error: 'Unsupported listing type' });
  }
  await logAudit({
    ...auditFromRequest(req),
    action: 'listing.suspend',
    targetType: type,
    targetId: id,
  });
  res.json({ suspended: true });
});
