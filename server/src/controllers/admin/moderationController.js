import { Job } from '../../models/Job.js';
import { Employer } from '../../models/Employer.js';
import { ContentReport } from '../../models/ContentReport.js';
import { AdSlotConfig } from '../../models/AdSlotConfig.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import { onJobApproved, onJobRejected, onEmployerVerificationChange } from '../../services/automationService.js';

const MAX_REJECTION_REASON_LENGTH = 500;

export const getModerationQueues = asyncHandler(async (_req, res) => {
  const [pendingJobs, pendingEmployers, reportedContent, advertisements, verificationRequests] = await Promise.all([
    Job.find({ approvalStatus: 'pending' }).sort({ createdAt: -1 }).limit(50).lean(),
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
  const result = await Job.updateMany(
    { _id: { $in: ids }, approvalStatus: 'pending' },
    { $set: { approvalStatus: 'approved', status: 'active' } }
  );
  await logAudit({
    ...auditFromRequest(req),
    action: 'jobs.bulk_approve',
    targetType: 'job',
    metadata: { ids, modified: result.modifiedCount },
  });
  const approvedJobs = await Job.find({ _id: { $in: ids }, approvalStatus: 'approved' }).select('title employerId').lean();
  for (const job of approvedJobs) {
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
  const result = await Job.updateMany(
    { _id: { $in: ids }, approvalStatus: 'pending' },
    { $set: { approvalStatus: 'rejected' } }
  );
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
  const employer = await Employer.findByIdAndUpdate(
    id,
    { $set: { verificationLevel: level, verified: level !== 'basic' } },
    { new: true }
  ).select('-password');
  if (!employer) return res.status(404).json({ error: 'Employer not found' });
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
