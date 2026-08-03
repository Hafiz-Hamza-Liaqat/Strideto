import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { onApplicationStatusChange, onJobSubmitted } from '../services/automationService.js';
import { Employer } from '../models/Employer.js';
import { JobPlan } from '../models/JobPlan.js';
import { verifyPaymentForActivation } from '../services/paymentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { jobSlug } from '../utils/slugify.js';
import { sanitizeString } from '../utils/sanitize.js';
import { stripAllHtml } from '../utils/htmlSanitize.js';
import { TalentProfileReadService } from '../services/career/TalentProfileReadService.js';
import { enrichEmployerJobsWithApplicationCounts, resolveJobApplyType } from '../services/employerApplicationCounts.js';
import { computeEmployerDashboardMetrics } from '../services/employerDashboardMetrics.js';
import { syncOpportunityApplicationFromLegacyStatus } from '../services/employerOpportunityApplicationSync.js';
import { buildEmployerProfileUpdates } from '../utils/employerProfileValidation.js';

/** GET /employer/dashboard - Stats for employer dashboard */
export const getDashboard = asyncHandler(async (req, res) => {
  const employerId = req.employer.employerId;
  const metrics = await computeEmployerDashboardMetrics(employerId);
  const employer = await Employer.findById(employerId).select('verificationLevel verified companyName').lean();
  res.json({
    ...metrics,
    verificationLevel: employer?.verificationLevel || 'basic',
    verified: employer?.verified || false,
  });
});

/** GET /employer/jobs/:id - Single owned job */
export const getJob = asyncHandler(async (req, res) => {
  const employerId = req.employer.employerId;
  const job = await Job.findOne({ _id: req.params.id, employerId }).lean();
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const [enriched] = await enrichEmployerJobsWithApplicationCounts([job]);
  res.json({ job: enriched });
});

/** PATCH /employer/profile - Update employer company profile (no password) */
export const updateEmployerProfile = asyncHandler(async (req, res) => {
  const employerId = req.employer.employerId;
  const parsed = buildEmployerProfileUpdates(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const employer = await Employer.findByIdAndUpdate(employerId, { $set: parsed.updates }, { new: true });
  if (!employer) return res.status(404).json({ error: 'Employer not found' });
  const e = employer.toObject();
  delete e.password;
  res.json({ employer: e });
});

/** GET /employer/jobs - List employer's job posts */
export const getMyJobs = asyncHandler(async (req, res) => {
  const employerId = req.employer.employerId;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const status = req.query.status; // draft | active | closed
  const filter = { employerId };
  if (status && ['draft', 'active', 'closed'].includes(status)) filter.status = status;
  const [data, total] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Job.countDocuments(filter),
  ]);
  const enriched = await enrichEmployerJobsWithApplicationCounts(data);
  res.json({ data: enriched, total, page, limit });
});

/** POST /employer/jobs - Create job as draft (first job can be free) */
export const createJob = asyncHandler(async (req, res) => {
  const employerId = req.employer.employerId;
  const employer = await Employer.findById(employerId);
  if (!employer) return res.status(404).json({ error: 'Employer not found' });

  const body = req.body;
  const title = (body.jobTitle || body.title || '').trim();
  const companyName = (body.companyName || employer.companyName || '').trim();
  if (!title || !companyName) return res.status(400).json({ error: 'jobTitle and companyName are required' });

  const slug = jobSlug(title, body.location || '');
  const existingSlug = await Job.findOne({ slug });
  const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

  const isFirstJob = (employer.totalJobsPosted || 0) === 0;
  const approvalStatus = 'pending';
  const job = await Job.create({
    title,
    slug: finalSlug,
    company: companyName,
    organization: companyName,
    location: body.location,
    province: body.province,
    city: body.city,
    category: body.category,
    type: body.type || 'full-time',
    jobType: body.jobType || 'Private',
    educationRequirement: body.educationRequirement,
    experience: body.experience,
    applyType: body.applyLink || body.applyEmail ? 'external' : 'internal',
    applicationLink: body.applyLink || null,
    applyEmail: body.applyEmail || null,
    description: stripAllHtml(body.jobDescription || body.description),
    requirements: body.requirements || [],
    salaryRange: body.salaryRange,
    skillsRequired: body.skillsRequired || [],
    deadline: body.applicationDeadline ? new Date(body.applicationDeadline) : null,
    employerId,
    source: 'employer',
    status: 'draft',
    approvalStatus,
    planType: isFirstJob ? 'free' : null,
  });

  if (isFirstJob) {
    await Employer.findByIdAndUpdate(employerId, { $inc: { totalJobsPosted: 1 } });
  }

  onJobSubmitted({
    jobId: job._id,
    jobTitle: job.title,
    companyName,
  }).catch(() => {});

  res.status(201).json({ job, isFirstJobFree: isFirstJob });
});

/** PATCH /employer/jobs/:id - Update owned job */
export const updateJob = asyncHandler(async (req, res) => {
  const employerId = req.employer.employerId;
  const job = await Job.findOne({ _id: req.params.id, employerId });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'closed') {
    return res.status(400).json({ error: 'Closed jobs cannot be edited. Reopen the job first.' });
  }
  const body = req.body;
  const allowed = [
    'title', 'company', 'organization', 'location', 'province', 'city', 'category', 'type', 'jobType',
    'educationRequirement', 'experience', 'applicationLink', 'applyEmail', 'description', 'requirements',
    'salaryRange', 'skillsRequired', 'deadline', 'jobTitle', 'companyName', 'jobDescription', 'applyLink', 'applicationDeadline',
  ];
  allowed.forEach((key) => {
    if (body[key] !== undefined) {
      if (key === 'jobTitle') job.title = sanitizeString(body[key]);
      else if (key === 'companyName') job.company = job.organization = sanitizeString(body[key]);
      else if (key === 'jobDescription') job.description = stripAllHtml(body[key]);
      else if (key === 'description') job.description = stripAllHtml(body[key]);
      else if (key === 'applyLink') job.applicationLink = body[key];
      else if (key === 'applicationDeadline') job.deadline = body[key] ? new Date(body[key]) : null;
      else job[key] = body[key];
    }
  });
  if (body.requirements && Array.isArray(body.requirements)) job.requirements = body.requirements;
  if (body.skillsRequired && Array.isArray(body.skillsRequired)) job.skillsRequired = body.skillsRequired;
  if (body.applyLink !== undefined || body.applyEmail !== undefined) {
    job.applyType = job.applicationLink || job.applyEmail ? 'external' : 'internal';
  }
  if (job.status === 'active' && job.approvalStatus === 'approved') {
    job.approvalStatus = 'pending';
  }
  await job.save();
  res.json({ job, message: job.approvalStatus === 'pending' ? 'Changes saved. Job may require admin re-approval.' : undefined });
});

/** POST /employer/jobs/:id/close - Close an active or draft job */
export const closeJob = asyncHandler(async (req, res) => {
  const employerId = req.employer.employerId;
  const job = await Job.findOne({ _id: req.params.id, employerId });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'closed') return res.status(400).json({ error: 'Job is already closed' });
  job.status = 'closed';
  await job.save();
  res.json({ job });
});

/** POST /employer/jobs/:id/reopen - Reopen a closed job as draft */
export const reopenJob = asyncHandler(async (req, res) => {
  const employerId = req.employer.employerId;
  const job = await Job.findOne({ _id: req.params.id, employerId });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'closed') return res.status(400).json({ error: 'Only closed jobs can be reopened' });
  job.status = 'draft';
  await job.save();
  res.json({ job, message: 'Job reopened as draft. Activate when ready to publish.' });
});

/** GET /employer/plans - List job posting plans */
export const getPlans = asyncHandler(async (_req, res) => {
  const plans = await JobPlan.find({ isActive: true }).sort({ price: 1 }).lean();
  res.json({ data: plans });
});

/** POST /employer/jobs/:id/activate - Activate job (free or after verified payment) */
export const activateJob = asyncHandler(async (req, res) => {
  const employerId = req.employer.employerId;
  const job = await Job.findOne({ _id: req.params.id, employerId });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'active') return res.status(400).json({ error: 'Job is already active' });

  const { planId, paymentId } = req.body;
  const plan = planId ? await JobPlan.findById(planId) : null;
  const isFreeJob = job.planType === 'free';

  if (!isFreeJob) {
    if (!plan) return res.status(400).json({ error: 'planId is required for paid activation' });
    if (plan.price > 0) {
      const verification = await verifyPaymentForActivation({
        paymentId,
        employerId,
        jobId: job._id,
        planId: plan._id,
      });
      if (!verification.ok) {
        return res.status(402).json({ error: verification.error });
      }
    }
  }

  const planType = isFreeJob ? 'free' : (plan?.slug || 'standard');
  let expiresAt = null;
  if (plan?.durationDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);
  }

  job.status = 'active';
  job.planId = plan?._id || job.planId;
  job.planType = planType;
  job.expiresAt = expiresAt;
  job.paidUntil = expiresAt;
  job.approvalStatus = 'pending';
  await job.save();

  res.json({ job, message: 'Job activated. It will appear after admin approval.' });
});

/** GET /employer/jobs/:id/applications - List applications for a job */
export const getJobApplications = asyncHandler(async (req, res) => {
  const employerId = req.employer.employerId;
  const job = await Job.findOne({ _id: req.params.id, employerId }).lean();
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const applyType = resolveJobApplyType(job);
  const jobMeta = {
    _id: job._id,
    title: job.title,
    applyType,
    applicationLink: job.applicationLink || null,
    applyEmail: job.applyEmail || null,
    status: job.status,
    approvalStatus: job.approvalStatus,
  };

  if (applyType === 'external') {
    return res.json({
      data: [],
      job: jobMeta,
      applicationsTracked: false,
      submittedApplicationsCount: null,
      message:
        'Applications for this job are handled outside Strideto and are not visible in your applicant dashboard.',
    });
  }

  const applications = await Application.find({ jobId: job._id })
    .populate('userId', 'name email')
    .sort({ appliedDate: -1 })
    .lean();

  const enriched = await Promise.all(
    applications.map(async (app) => {
      const userId = app.userId?._id || app.userId;
      const candidate = userId
        ? await TalentProfileReadService.getCandidateCardForUser(userId)
        : null;
      return {
        ...app,
        candidate,
      };
    })
  );

  res.json({
    data: enriched,
    job: jobMeta,
    applicationsTracked: true,
    submittedApplicationsCount: enriched.length,
  });
});

/** PATCH /employer/applications/:id - Update application status (shortlist, reject, interview, hired) */
export const updateApplicationStatus = asyncHandler(async (req, res) => {
  const employerId = req.employer.employerId;
  const application = await Application.findById(req.params.id).populate('jobId');
  if (!application || application.jobId?.employerId?.toString() !== String(employerId)) {
    return res.status(404).json({ error: 'Application not found' });
  }
  const { status } = req.body;
  const allowed = ['shortlisted', 'rejected', 'interview', 'hired'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Use: ' + allowed.join(', ') });
  }
  // Keep user OpportunityApplication tracker in sync when dual-write exists (best-effort)
  const previousStatus = application.status;
  application.status = status;
  await application.save();

  void syncOpportunityApplicationFromLegacyStatus(application, {
    employerId,
    previousStatus,
    newStatus: status,
  });

  onApplicationStatusChange({
    applicationId: application._id,
    userId: application.userId,
    status,
    jobTitle: application.jobId?.title || 'Job',
    interviewWhen: req.body?.interviewWhen,
    interviewLink: req.body?.interviewLink,
  }).catch(() => {});
  res.json({ application });
});

/** GET /employer/analytics/:jobId - Analytics for one job */
export const getJobAnalytics = asyncHandler(async (req, res) => {
  const employerId = req.employer.employerId;
  const job = await Job.findOne({ _id: req.params.jobId, employerId }).lean();
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const applicationsCount =
    resolveJobApplyType(job) === 'external' ? null : await Application.countDocuments({ jobId: job._id });
  const views = job.views || 0;
  const conversionRate =
    applicationsCount != null && views > 0 ? ((applicationsCount / views) * 100).toFixed(2) : null;
  res.json({
    views,
    applications: applicationsCount,
    applicationsTracked: applicationsCount != null,
    applyType: resolveJobApplyType(job),
    conversionRate: conversionRate != null ? `${conversionRate}%` : 'n/a',
  });
});
