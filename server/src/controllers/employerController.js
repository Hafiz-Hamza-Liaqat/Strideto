import mongoose from 'mongoose';
import { createReadStream } from 'fs';
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
import { validateApplicationLink, validateApplyEmail } from '../utils/jobApplicationDestination.js';
import { computeEmployerDashboardMetrics } from '../services/employerDashboardMetrics.js';
import { syncOpportunityApplicationFromLegacyStatus } from '../services/employerOpportunityApplicationSync.js';
import { resolveEmployerApplicationResumeAccess } from '../services/applicationResumeStorage.js';
import { mapLegacyApplicationStatus } from '../../../shared/career/migrationMap.js';
import { OpportunityApplicationRepository } from '../repositories/career/OpportunityApplicationRepository.js';
import { buildEmployerProfileUpdates } from '../utils/employerProfileValidation.js';
import {
  isSameStatusNoOp,
  canTransitionApplicationStatus,
  isReconsiderationTransition,
  isHiredReopenTransition,
  resolveEmployerStatusSyncReason,
  HIRING_REOPEN_REQUIRED_CODE,
} from '../utils/applicationStatusTransition.js';
import { logAudit } from '../services/auditService.js';
import { OpportunityApplication } from '../models/career/OpportunityApplication.js';
import { parseOpeningsCount } from '../../../shared/employer/openingsCount.js';
import { normalizeCountryCode } from '../../../shared/international/country.js';
import { normalizeCurrency } from '../../../shared/international/currency.js';
import { normalizeJobLineItems } from '../../../shared/employer/jobLineItems.js';
import { isValidJobFamily, isValidSpecialization } from '../../../shared/career/jobTaxonomy.js';
import { hiringOwnerIdFrom } from '../services/employer/employerOrganizationService.js';
import {
  assertChargedSubmissionAllowed,
  recordChargedSubmission,
  loadEmployerPublishingUsage,
} from '../services/employer/employerPublishingQuota.js';
import { scheduleSeoChangeNotification } from '../services/seo/seoChangeNotificationService.js';
import { UserNotification } from '../models/UserNotification.js';
import * as verificationService from '../services/verificationService.js';

function scopeEmployerId(req) {
  return hiringOwnerIdFrom(req);
}

function invalidObjectId(id) {
  return !id || !mongoose.Types.ObjectId.isValid(id);
}

const JOB_SORTS = Object.freeze({
  createdAt: { createdAt: 1 },
  '-createdAt': { createdAt: -1 },
  deadline: { deadline: 1 },
  '-deadline': { deadline: -1 },
  title: { title: 1 },
  '-title': { title: -1 },
});

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveJobGeoFields(body = {}) {
  const countryCode = body.countryCode != null && String(body.countryCode).trim()
    ? normalizeCountryCode(body.countryCode)
    : undefined;
  const regionRaw = body.region != null ? String(body.region).trim() : '';
  const provinceRaw = body.province != null ? String(body.province).trim() : '';
  const region = regionRaw || provinceRaw || undefined;
  const city = body.city != null && String(body.city).trim() ? String(body.city).trim() : undefined;
  return {
    countryCode: countryCode || undefined,
    region,
    province: region,
    city,
  };
}

function resolveJobTaxonomyFields(body = {}) {
  const jobFamily = body.jobFamily != null && String(body.jobFamily).trim()
    ? String(body.jobFamily).trim()
    : undefined;
  const specialization = body.specialization != null && String(body.specialization).trim()
    ? String(body.specialization).trim()
    : undefined;
  if (jobFamily && !isValidJobFamily(jobFamily)) {
    return { ok: false, error: 'Invalid job family', field: 'jobFamily' };
  }
  if (specialization && jobFamily && !isValidSpecialization(jobFamily, specialization)) {
    return { ok: false, error: 'Invalid specialization for selected job family', field: 'specialization' };
  }
  if (specialization && !jobFamily) {
    return { ok: false, error: 'jobFamily is required when specialization is set', field: 'jobFamily' };
  }
  return {
    ok: true,
    jobFamily,
    specialization,
    category: body.category != null && String(body.category).trim() ? String(body.category).trim() : undefined,
  };
}

/** GET /employer/dashboard - Stats for employer dashboard */
export const getDashboard = asyncHandler(async (req, res) => {
  const employerId = scopeEmployerId(req);
  const metrics = await computeEmployerDashboardMetrics(employerId);
  const employer = await Employer.findById(employerId).select('verificationLevel verified companyName').lean();
  const [unreadNotifications, quota, verificationRecord] = await Promise.all([
    UserNotification.countDocuments({
      recipientType: 'employer',
      employerId: req.employer.employerId,
      read: false,
    }),
    loadEmployerPublishingUsage(employerId).catch(() => null),
    req.employer.organizationId
      ? verificationService.getVerification(req.employer.organizationId).catch(() => null)
      : Promise.resolve(null),
  ]);
  res.json({
    ...metrics,
    verificationLevel: employer?.verificationLevel || 'basic',
    verified: employer?.verified || false,
    verificationState: verificationRecord?.status || null,
    unreadNotifications,
    planSummary: quota
      ? {
          policyCode: quota.policy.code,
          dailyRemaining: quota.usage.daily.remaining,
          rollingRemaining: quota.usage.rolling30Days.remaining,
          activeFreeRemaining: quota.usage.activeFreeJobs.remaining,
          drafts: quota.drafts.count,
        }
      : null,
    teamRole: req.employer.teamRole || null,
  });
});

/** GET /employer/jobs/:id - Single owned job */
export const getJob = asyncHandler(async (req, res) => {
  if (invalidObjectId(req.params.id)) return res.status(404).json({ error: 'Job not found' });
  const employerId = scopeEmployerId(req);
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
  const employerId = scopeEmployerId(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const status = req.query.status; // draft | active | closed | pending
  const sortKey = req.query.sort || '-createdAt';
  if (!JOB_SORTS[sortKey]) {
    return res.status(400).json({ error: 'Invalid sort', code: 'INVALID_SORT' });
  }
  const filter = { employerId };
  if (status === 'pending') filter.approvalStatus = 'pending';
  else if (status && ['draft', 'active', 'closed'].includes(status)) filter.status = status;
  else if (status) return res.status(400).json({ error: 'Invalid status filter', field: 'status' });
  const q = String(req.query.q || '').trim().slice(0, 200);
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };
  const [data, total] = await Promise.all([
    Job.find(filter).sort(JOB_SORTS[sortKey]).skip((page - 1) * limit).limit(limit).lean(),
    Job.countDocuments(filter),
  ]);
  const enriched = await enrichEmployerJobsWithApplicationCounts(data);
  res.json({ data: enriched, total, page, limit });
});

/**
 * GET /employer/jobs/selector — lightweight, bounded list of ALL the employer's
 * jobs for populating job-picker dropdowns (Applications, Analytics).
 *
 * The paginated `getMyJobs` list defaults to 10 per page, which silently hid an
 * employer's 11th+ job from those selectors. This endpoint returns a minimal
 * projection for every job, ordered newest-first, capped at a high but bounded
 * limit so the payload stays small and the query stays scalable. Employers with
 * more jobs than the cap should use the paginated list; the cap is far above any
 * realistic per-employer job count.
 */
export const getJobSelectorOptions = asyncHandler(async (req, res) => {
  const employerId = scopeEmployerId(req);
  const SELECTOR_LIMIT = 500;
  const jobs = await Job.find({ employerId })
    .select('_id title applyType applicationLink applyEmail status approvalStatus')
    .sort({ createdAt: -1 })
    .limit(SELECTOR_LIMIT)
    .lean();
  const data = jobs.map((job) => ({
    _id: job._id,
    title: job.title,
    applyType: resolveJobApplyType(job),
    status: job.status,
    approvalStatus: job.approvalStatus,
  }));
  const total = await Job.countDocuments({ employerId });
  res.json({ data, total, limit: SELECTOR_LIMIT, truncated: total > data.length });
});

function parseEmployerSalaryCurrency(raw) {
  if (raw === undefined) return { ok: true, value: undefined, supplied: false };
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { ok: true, value: undefined, supplied: true };
  const code = normalizeCurrency(trimmed);
  if (!code) {
    return { ok: false, field: 'salaryCurrency', error: 'salaryCurrency must be a valid ISO 4217 code' };
  }
  return { ok: true, value: code, supplied: true };
}

export const createJob = asyncHandler(async (req, res) => {
  const employerId = scopeEmployerId(req);
  const employer = await Employer.findById(employerId);
  if (!employer) return res.status(404).json({ error: 'Employer not found' });

  const body = req.body;
  const title = (body.jobTitle || body.title || '').trim();
  const companyName = (body.companyName || employer.companyName || '').trim();
  if (!title || !companyName) return res.status(400).json({ error: 'jobTitle and companyName are required' });
  const openings = parseOpeningsCount(body.openingsCount, { required: true });
  if (!openings.ok) return res.status(400).json({ error: openings.error, field: 'openingsCount', code: openings.code });

  const linkResult = validateApplicationLink(body.applyLink);
  if (!linkResult.ok) return res.status(400).json({ error: linkResult.message, field: linkResult.field });
  const emailResult = validateApplyEmail(body.applyEmail);
  if (!emailResult.ok) return res.status(400).json({ error: emailResult.message, field: emailResult.field });

  // An explicit applyType (PF-HIRE-B1's method selector) is optional and, when
  // present, authoritative — it must agree with whatever destination fields
  // were supplied. When absent, fall back to the pre-existing inference so
  // any caller that predates the selector keeps working unchanged.
  let applyType;
  if (body.applyType !== undefined) {
    if (body.applyType !== 'internal' && body.applyType !== 'external') {
      return res.status(400).json({ error: 'applyType must be internal or external', field: 'applyType' });
    }
    if (body.applyType === 'internal' && (linkResult.value || emailResult.value)) {
      return res.status(400).json({ error: 'Internal applications cannot include an external destination', field: 'applyType' });
    }
    if (body.applyType === 'external' && !linkResult.value && !emailResult.value) {
      return res.status(400).json({ error: 'External applications require a URL or email destination', field: 'applyType' });
    }
    applyType = body.applyType;
  } else {
    applyType = linkResult.value || emailResult.value ? 'external' : 'internal';
  }

  const slug = jobSlug(title, body.location || '');
  const existingSlug = await Job.findOne({ slug });
  const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

  const isFirstJob = (employer.totalJobsPosted || 0) === 0;
  const approvalStatus = 'pending';
  const geo = resolveJobGeoFields(body);
  const taxonomy = resolveJobTaxonomyFields(body);
  if (!taxonomy.ok) {
    return res.status(400).json({ error: taxonomy.error, field: taxonomy.field });
  }
  const salaryCurrencyResult = parseEmployerSalaryCurrency(body.salaryCurrency);
  if (!salaryCurrencyResult.ok) {
    return res.status(400).json({ error: salaryCurrencyResult.error, field: salaryCurrencyResult.field });
  }
  const job = await Job.create({
    title,
    slug: finalSlug,
    company: companyName,
    organization: companyName,
    location: body.location,
    countryCode: geo.countryCode,
    region: geo.region,
    province: geo.province,
    city: geo.city,
    category: taxonomy.category,
    jobFamily: taxonomy.jobFamily,
    specialization: taxonomy.specialization,
    type: body.type || 'full-time',
    jobType: body.jobType || 'Private',
    workMode: ['remote', 'hybrid', 'on_site'].includes(body.workMode) ? body.workMode : undefined,
    educationRequirement: body.educationRequirement,
    experience: body.experience,
    applyType,
    applicationLink: linkResult.value || null,
    applyEmail: emailResult.value || null,
    description: stripAllHtml(body.jobDescription || body.description),
    requirements: normalizeJobLineItems(body.requirements),
    responsibilities: normalizeJobLineItems(body.responsibilities),
    salaryRange: body.salaryRange,
    salaryCurrency: salaryCurrencyResult.value,
    skillsRequired: body.skillsRequired || [],
    deadline: body.applicationDeadline ? new Date(body.applicationDeadline) : null,
    employerId,
    postedByEmployerId: req.employer.employerId,
    source: 'employer',
    // SEO-P0B — the only workflow that may grant Google for Jobs eligibility:
    // the hiring organization is authenticated here and is publishing its own
    // vacancy, so STRIDETO is an authorized publisher for this record. Curated
    // external jobs never reach this path and keep the schema default (false).
    // The job still has to clear moderation (approvalStatus/status) before it
    // is public at all, and the detail page re-checks required fields.
    jobsGraphEligible: true,
    status: 'draft',
    approvalStatus,
    planType: isFirstJob ? 'free' : null,
    openingsCount: openings.value,
  });

  if (isFirstJob) {
    await Employer.findByIdAndUpdate(employerId, { $inc: { totalJobsPosted: 1 } });
  }

  res.status(201).json({ job, isFirstJobFree: isFirstJob, quotaConsumed: false });
});

/** PATCH /employer/jobs/:id - Update owned job */
export const updateJob = asyncHandler(async (req, res) => {
  if (invalidObjectId(req.params.id)) return res.status(404).json({ error: 'Job not found' });
  const employerId = scopeEmployerId(req);
  const job = await Job.findOne({ _id: req.params.id, employerId });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'closed') {
    return res.status(400).json({ error: 'Closed jobs cannot be edited. Reopen the job first.' });
  }
  const previous = job.toObject();
  const body = req.body;

  // Validate before any mutation of `job` — both possible destination-URL
  // key names (`applyLink` from the current client, `applicationLink` for
  // any caller that sends the stored field name directly) go through the
  // same canonical check, so neither path can bypass it.
  const linkSupplied = body.applyLink !== undefined || body.applicationLink !== undefined;
  let validatedLink;
  if (linkSupplied) {
    const incoming = body.applyLink !== undefined ? body.applyLink : body.applicationLink;
    const linkResult = validateApplicationLink(incoming);
    if (!linkResult.ok) return res.status(400).json({ error: linkResult.message, field: linkResult.field });
    validatedLink = linkResult.value;
  }
  let validatedEmail;
  if (body.applyEmail !== undefined) {
    const emailResult = validateApplyEmail(body.applyEmail);
    if (!emailResult.ok) return res.status(400).json({ error: emailResult.message, field: emailResult.field });
    validatedEmail = emailResult.value;
  }

  // PF-HIRE-B2 — resolve the target applyType/destinations before mutating
  // `job` or querying anything else, mirroring createJob's explicit-applyType
  // contract (reused, not duplicated: same validators, same accepted values).
  const applyTypeSupplied = body.applyType !== undefined;
  const targetLink = linkSupplied ? validatedLink : job.applicationLink;
  const targetEmail = body.applyEmail !== undefined ? validatedEmail : job.applyEmail;
  let targetApplyType = job.applyType;

  if (applyTypeSupplied) {
    if (body.applyType !== 'internal' && body.applyType !== 'external') {
      return res.status(400).json({ error: 'applyType must be internal or external', field: 'applyType' });
    }
    if (body.applyType === 'internal' && (targetLink || targetEmail)) {
      return res.status(400).json({ error: 'Internal applications cannot include an external destination', field: 'applyType' });
    }
    if (body.applyType === 'external') {
      if (!targetLink && !targetEmail) {
        return res.status(400).json({ error: 'External applications require a URL or email destination', field: 'applyType' });
      }
      if (targetLink && targetEmail) {
        return res
          .status(400)
          .json({ error: 'External applications must use exactly one destination: a URL or an email, not both', field: 'applyType' });
      }
    }
    targetApplyType = body.applyType;
  } else if (linkSupplied || body.applyEmail !== undefined) {
    // Legacy inference path (no explicit applyType sent) — unchanged formula,
    // preserved for any caller that predates the method selector.
    targetApplyType = targetLink || targetEmail ? 'external' : 'internal';
  }

  // Existing-Application safety guard (PF-HIRE-B2 §6): an internal Job that
  // already has Employer-facing Applications cannot be switched to external
  // — those candidates would otherwise be orphaned from the hiring context
  // they applied into. External -> internal never needs this guard (private
  // tracker records are not Employer-facing Applications).
  if (resolveJobApplyType(job) === 'internal' && targetApplyType === 'external') {
    const existingApplications = await Application.countDocuments({ jobId: job._id });
    if (existingApplications > 0) {
      return res.status(409).json({
        error: 'This job already has applications and cannot be changed to external hiring.',
        field: 'applyType',
      });
    }
  }

  if (body.openingsCount !== undefined) {
    const openings = parseOpeningsCount(body.openingsCount, { required: true });
    if (!openings.ok) return res.status(400).json({ error: openings.error, field: 'openingsCount', code: openings.code });
    job.openingsCount = openings.value;
  }

  if (body.salaryCurrency !== undefined) {
    const salaryCurrencyResult = parseEmployerSalaryCurrency(body.salaryCurrency);
    if (!salaryCurrencyResult.ok) {
      return res.status(400).json({ error: salaryCurrencyResult.error, field: salaryCurrencyResult.field });
    }
    job.salaryCurrency = salaryCurrencyResult.value;
  }
  if (body.requirements !== undefined) job.requirements = normalizeJobLineItems(body.requirements);
  if (body.responsibilities !== undefined) job.responsibilities = normalizeJobLineItems(body.responsibilities);

  if (body.jobFamily !== undefined) {
    const val = String(body.jobFamily || '').trim();
    if (val && !isValidJobFamily(val)) {
      return res.status(400).json({ error: 'Invalid job family', field: 'jobFamily' });
    }
  }
  if (body.specialization !== undefined) {
    const val = String(body.specialization || '').trim();
    const family = body.jobFamily !== undefined ? String(body.jobFamily || '').trim() : job.jobFamily;
    if (val && (!family || !isValidSpecialization(family, val))) {
      return res.status(400).json({ error: 'Invalid specialization for selected job family', field: 'specialization' });
    }
  }

  const allowed = [
    'title', 'company', 'organization', 'location', 'countryCode', 'region', 'province', 'city',
    'category', 'jobFamily', 'specialization', 'type', 'jobType', 'workMode',
    'educationRequirement', 'experience', 'applicationLink', 'applyEmail', 'description', 'requirements',
    'responsibilities', 'salaryRange', 'salaryCurrency', 'skillsRequired', 'deadline', 'jobTitle', 'companyName', 'jobDescription', 'applyLink', 'applicationDeadline',
  ];
  allowed.forEach((key) => {
    if (body[key] !== undefined) {
      if (key === 'jobTitle') job.title = sanitizeString(body[key]);
      else if (key === 'companyName') job.company = job.organization = sanitizeString(body[key]);
      else if (key === 'jobDescription') job.description = stripAllHtml(body[key]);
      else if (key === 'description') job.description = stripAllHtml(body[key]);
      else if (key === 'applyLink' || key === 'applicationLink') job.applicationLink = validatedLink;
      else if (key === 'applyEmail') job.applyEmail = validatedEmail;
      else if (key === 'applicationDeadline') job.deadline = body[key] ? new Date(body[key]) : null;
      else if (key === 'countryCode') job.countryCode = normalizeCountryCode(body[key]) || undefined;
      else if (key === 'region' || key === 'province') {
        const val = String(body[key] || '').trim() || undefined;
        job.region = val;
        job.province = val;
      } else if (key === 'jobFamily') {
        job.jobFamily = String(body[key] || '').trim() || undefined;
      } else if (key === 'specialization') {
        job.specialization = String(body[key] || '').trim() || undefined;
      } else if (key === 'workMode') {
        const wm = body[key];
        if (wm && !['remote', 'hybrid', 'on_site'].includes(wm)) {
          return res.status(400).json({ error: 'workMode must be remote, hybrid, or on_site', field: 'workMode' });
        }
        job.workMode = wm || undefined;
      } else job[key] = body[key];
    }
  });
  if (body.skillsRequired && Array.isArray(body.skillsRequired)) job.skillsRequired = body.skillsRequired;

  if (applyTypeSupplied) {
    job.applyType = targetApplyType;
    if (targetApplyType === 'internal') {
      // Belt-and-suspenders: validation above already guarantees both are
      // empty whenever this line is reached, but this keeps the invariant
      // airtight even if that validation is ever refactored.
      job.applicationLink = null;
      job.applyEmail = null;
    }
  } else if (linkSupplied || body.applyEmail !== undefined) {
    job.applyType = job.applicationLink || job.applyEmail ? 'external' : 'internal';
  }

  if (job.status === 'active' && job.approvalStatus === 'approved') {
    job.approvalStatus = 'pending';
  }
  await job.save();
  scheduleSeoChangeNotification({
    entityType: 'job',
    previous,
    next: job,
    action: 'save',
  });
  res.json({ job, message: job.approvalStatus === 'pending' ? 'Changes saved. Job may require admin re-approval.' : undefined });
});

/** POST /employer/jobs/:id/close - Close an active or draft job */
export const closeJob = asyncHandler(async (req, res) => {
  if (invalidObjectId(req.params.id)) return res.status(404).json({ error: 'Job not found' });
  const employerId = scopeEmployerId(req);
  const job = await Job.findOne({ _id: req.params.id, employerId });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'closed') return res.status(400).json({ error: 'Job is already closed' });
  const previous = job.toObject();
  job.status = 'closed';
  await job.save();
  scheduleSeoChangeNotification({
    entityType: 'job',
    previous,
    next: job,
    action: 'save',
  });
  res.json({ job });
});

/** POST /employer/jobs/:id/reopen - Reopen a closed job as draft */
export const reopenJob = asyncHandler(async (req, res) => {
  if (invalidObjectId(req.params.id)) return res.status(404).json({ error: 'Job not found' });
  const employerId = scopeEmployerId(req);
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
  if (invalidObjectId(req.params.id)) return res.status(404).json({ error: 'Job not found' });
  const employerId = scopeEmployerId(req);
  const job = await Job.findOne({ _id: req.params.id, employerId });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'active') return res.status(400).json({ error: 'Job is already active' });
  const previous = job.toObject();

  const { planId, paymentId } = req.body;
  const plan = planId ? await JobPlan.findById(planId) : null;
  const isFreeJob = job.planType === 'free' || !planId;

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
  } else {
    try {
      await assertChargedSubmissionAllowed(employerId);
    } catch (err) {
      if (err.status) return res.status(err.status).json(err.body || { error: err.message, code: err.code });
      throw err;
    }
  }

  const planType = isFreeJob ? 'free' : (plan?.slug || 'standard');
  let expiresAt = null;
  if (plan?.durationDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.durationDays);
  } else if (isFreeJob) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
  }

  job.status = 'active';
  job.planId = plan?._id || job.planId;
  job.planType = planType;
  job.expiresAt = expiresAt;
  job.paidUntil = expiresAt;
  job.approvalStatus = 'pending';
  if (isFreeJob) recordChargedSubmission(job);
  await job.save();

  scheduleSeoChangeNotification({
    entityType: 'job',
    previous,
    next: job,
    action: 'save',
  });

  onJobSubmitted({
    jobId: job._id,
    jobTitle: job.title,
    companyName: job.company,
    employerId,
  }).catch(() => {});

  res.json({ job, message: 'Job submitted for review. It will appear after admin approval.', quotaConsumed: Boolean(isFreeJob) });
});

/** GET /employer/jobs/:id/applications - List applications for a job */
export const getJobApplications = asyncHandler(async (req, res) => {
  if (invalidObjectId(req.params.id)) return res.status(404).json({ error: 'Job not found' });
  const employerId = scopeEmployerId(req);
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

  const APPLICATION_LIST_LIMIT = 500;
  const [applications, applicationTotal] = await Promise.all([
    Application.find({ jobId: job._id })
    .populate('userId', 'name email')
    .sort({ appliedDate: -1 })
    .limit(APPLICATION_LIST_LIMIT)
    .lean(),
    Application.countDocuments({ jobId: job._id }),
  ]);

  // Canonical hiring stage for each row, batched (no N+1). Ownership is already
  // established above — every Application here belongs to this Employer's Job —
  // so no other Employer's tracker can be reached through these ids. Rows with
  // no linked tracker (historical, pre-dual-write) resolve to null and the
  // client falls back to the legacy status label.
  const stageByLegacyId = new Map(
    (await OpportunityApplicationRepository.findStagesByLegacyApplicationIds(
      applications.map((app) => app._id)
    )).map((oa) => [String(oa.legacyApplicationId), oa.pipelineStage || null])
  );

  const candidateByUserId = await TalentProfileReadService.getCandidateCardsForUsers(
    applications.map((app) => app.userId?._id || app.userId)
  );
  const enriched = applications.map((app) => {
      const userId = app.userId?._id || app.userId;
      const { resumeURL, coverLetter, note: _note, ...row } = app;
      return {
        ...row,
        hasResume: Boolean(resumeURL),
        hasCoverLetter: Boolean(coverLetter?.trim()),
        candidate: userId ? candidateByUserId.get(String(userId)) || null : null,
        hiringStage: stageByLegacyId.get(String(app._id)) || null,
      };
    });

  res.json({
    data: enriched,
    job: jobMeta,
    applicationsTracked: true,
    submittedApplicationsCount: applicationTotal,
    returnedApplicationsCount: enriched.length,
    listLimit: APPLICATION_LIST_LIMIT,
    truncated: applicationTotal > enriched.length,
  });
});

/** GET /employer/applications/:id - Single application for employer review */
export const getApplicationDetail = asyncHandler(async (req, res) => {
  if (invalidObjectId(req.params.id)) return res.status(404).json({ error: 'Application not found' });
  const employerId = scopeEmployerId(req);
  const application = await Application.findById(req.params.id)
    .populate('userId', 'name email')
    .populate('jobId')
    .lean();
  if (!application?.jobId || application.jobId.employerId?.toString() !== String(employerId)) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const job = application.jobId;
  const applyType = resolveJobApplyType(job);
  if (applyType === 'external') {
    return res.status(404).json({ error: 'Application not found' });
  }

  const oaDoc = await OpportunityApplication.findOne({ legacyApplicationId: application._id })
    .select('pipelineStage stageHistory')
    .lean();
  const hiringStage = oaDoc?.pipelineStage || null;
  const stageHistory = (oaDoc?.stageHistory || []).map((entry) => ({
    _id: entry._id,
    fromStage: entry.fromStage,
    toStage: entry.toStage,
    at: entry.at,
    reason: entry.reason || '',
    byActorType: entry.byActorType,
  }));

  const userId = application.userId?._id || application.userId;
  const candidateByUserId = userId
    ? await TalentProfileReadService.getCandidateCardsForUsers([userId])
    : new Map();
  const candidate = userId ? candidateByUserId.get(String(userId)) || null : null;

  const jobMeta = {
    _id: job._id,
    title: job.title,
    applyType,
    status: job.status,
    approvalStatus: job.approvalStatus,
  };

  res.json({
    data: {
      _id: application._id,
      status: application.status,
      hiringStage,
      appliedDate: application.appliedDate,
      createdAt: application.createdAt,
      coverLetter: application.coverLetter || null,
      note: application.note || null,
      resumeSource: application.resumeSource || 'none',
      hasResume: Boolean(application.resumeURL),
      hasCoverLetter: Boolean(application.coverLetter?.trim()),
      skillSnapshot: application.skillSnapshot || null,
      userId: application.userId,
      candidate,
      jobId: job._id,
      stageHistory,
    },
    job: jobMeta,
    applicationsTracked: true,
  });
});

/** GET /employer/applications/:id/resume — Authorized resume access (no raw URL in JSON) */
export const getApplicationResume = asyncHandler(async (req, res) => {
  if (invalidObjectId(req.params.id)) return res.status(404).json({ error: 'Application not found' });
  const employerId = scopeEmployerId(req);
  const application = await Application.findById(req.params.id).populate('jobId');
  if (!application || application.jobId?.employerId?.toString() !== String(employerId)) {
    return res.status(404).json({ error: 'Application not found' });
  }
  if (resolveJobApplyType(application.jobId) === 'external') {
    return res.status(404).json({ error: 'Application not found' });
  }

  const access = await resolveEmployerApplicationResumeAccess(application);
  if (!access.ok) {
    return res.status(404).json({ error: 'No resume was submitted with this application' });
  }

  if (access.mode === 'local_stream') {
    res.setHeader('Content-Type', access.contentType);
    res.setHeader('Content-Disposition', 'inline; filename="resume"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    createReadStream(access.filepath).pipe(res);
    return;
  }

  if (access.mode === 'remote_stream') {
    const upstream = await fetch(access.url);
    if (!upstream.ok) {
      return res.status(404).json({ error: 'No resume was submitted with this application' });
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', access.contentType || upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline; filename="resume"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(buffer);
  }

  return res.status(404).json({ error: 'No resume was submitted with this application' });
});

/** PATCH /employer/applications/:id - Update application status (shortlist, reject, interview, hired) */
export const updateApplicationStatus = asyncHandler(async (req, res) => {
  if (invalidObjectId(req.params.id)) return res.status(404).json({ error: 'Application not found' });
  const employerId = scopeEmployerId(req);
  const application = await Application.findById(req.params.id).populate('jobId');
  if (!application || application.jobId?.employerId?.toString() !== String(employerId)) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const ALLOWED_BODY_KEYS = new Set(['status', 'confirmReopen']);
  const unexpectedKeys = Object.keys(req.body || {}).filter(
    (key) => req.body[key] !== undefined && !ALLOWED_BODY_KEYS.has(key)
  );
  if (unexpectedKeys.length > 0) {
    return res.status(400).json({ error: 'Only application status may be updated' });
  }

  const { status } = req.body;
  const confirmReopen = req.body?.confirmReopen === true;
  const allowed = ['shortlisted', 'rejected', 'interview', 'hired'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Use: ' + allowed.join(', ') });
  }
  const previousStatus = application.status;

  if (isHiredReopenTransition(previousStatus, status) && !confirmReopen) {
    return res.status(400).json({
      error: 'Reopening a hired application requires confirmReopen: true',
      code: HIRING_REOPEN_REQUIRED_CODE,
    });
  }

  if (!canTransitionApplicationStatus(previousStatus, status, { confirmReopen })) {
    return res.status(400).json({ error: 'Invalid status transition' });
  }

  // Same-status idempotency: a repeated update to the status the application is
  // already in must be a server-side no-op — no write, no tracker sync, no
  // notification, and no automation — so redelivered/duplicate clicks cannot
  // append duplicate history or re-notify the candidate.
  if (isSameStatusNoOp(previousStatus, status)) {
    return res.json({ application, unchanged: true });
  }

  const oaBefore = await OpportunityApplication.findOne({ legacyApplicationId: application._id })
    .select('stageHistory')
    .lean();
  const historySequence = (oaBefore?.stageHistory?.length || 0) + 1;
  const syncReason = resolveEmployerStatusSyncReason(previousStatus, status);
  const reconsidered = isReconsiderationTransition(previousStatus, status);
  const reopened = isHiredReopenTransition(previousStatus, status);

  // Keep user OpportunityApplication tracker in sync when dual-write exists (best-effort)
  application.status = status;
  await application.save();

  const syncResult = await syncOpportunityApplicationFromLegacyStatus(application, {
    employerId,
    previousStatus,
    newStatus: status,
    reason: syncReason,
    metadata: reconsidered ? { reconsidered: true } : reopened ? { reopened: true } : {},
  });

  const oaAfter = await OpportunityApplication.findOne({ legacyApplicationId: application._id })
    .select('pipelineStage stageHistory')
    .lean();
  const hiringStage = oaAfter?.pipelineStage || mapLegacyApplicationStatus(status);
  const stageHistory = (oaAfter?.stageHistory || []).map((entry) => ({
    _id: entry._id,
    fromStage: entry.fromStage,
    toStage: entry.toStage,
    at: entry.at,
    reason: entry.reason || '',
    byActorType: entry.byActorType,
  }));

  const auditIp =
    req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
  await logAudit({
    actor: { employerId, role: 'employer' },
    action: reconsidered
      ? 'application.reconsidered'
      : reopened
        ? 'application.reopened'
        : 'application.status_updated',
    targetType: 'application',
    targetId: application._id,
    ip: auditIp,
    metadata: {
      fromStatus: previousStatus,
      toStatus: status,
      historySequence,
    },
  });

  onApplicationStatusChange({
    applicationId: application._id,
    userId: application.userId,
    status,
    previousStatus,
    jobTitle: application.jobId?.title || 'Job',
    interviewWhen: req.body?.interviewWhen,
    interviewLink: req.body?.interviewLink,
    reconsidered,
    historySequence,
  }).catch(() => {});

  res.json({
    application,
    hiringStage,
    stageHistory,
    syncOk: syncResult.ok,
    reconsidered,
    reopened,
  });
});

/** GET /employer/analytics/:jobId - Analytics for one job */
export const getJobAnalytics = asyncHandler(async (req, res) => {
  if (invalidObjectId(req.params.jobId)) return res.status(404).json({ error: 'Job not found' });
  const employerId = scopeEmployerId(req);
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

/** GET /employer/interviews — owned interview-stage applications (deep-link source). */
export const getInterviews = asyncHandler(async (req, res) => {
  const employerId = scopeEmployerId(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const jobs = await Job.find({ employerId }).select('_id').lean();
  const jobIds = jobs.map((j) => j._id);
  const filter = { jobId: { $in: jobIds }, status: 'interview' };
  const [data, total] = await Promise.all([
    Application.find(filter)
      .populate('userId', 'name email')
      .populate('jobId', 'title')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Application.countDocuments(filter),
  ]);
  res.json({ data, total, page, limit });
});
