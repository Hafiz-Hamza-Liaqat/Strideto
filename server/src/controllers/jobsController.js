import { Job } from '../models/Job.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import { Employer } from '../models/Employer.js';
import { PUBLIC_JOB_HIDDEN_PUBLICATION_STATES } from '../../../shared/publicDiscovery/publicTruth.js';
import {
  projectPublicJob,
  projectPublicJobListItem,
} from '../../../shared/publicDiscovery/projectPublicDiscovery.js';
import {
  getRequestLocale,
  withListLocaleFilter,
  findLocalizedBySlug,
  findLocalizedById,
  isObjectIdParam,
} from '../utils/localeQuery.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const PUBLIC_APPROVAL_OR = [
  { approvalStatus: 'approved' },
  { approvalStatus: { $exists: false } },
];

const PUBLIC_PUBLICATION_OR = [
  { publicationState: { $exists: false } },
  { publicationState: 'active' },
];

export function buildPublicJobFilter() {
  return {
    status: 'active',
    $and: [
      { $or: PUBLIC_APPROVAL_OR },
      { $or: PUBLIC_PUBLICATION_OR },
    ],
  };
}

function safeSearchRe(value) {
  const s = String(value || '').trim().slice(0, 200);
  if (!s) return null;
  return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function buildJobQuery(q) {
  const filter = buildPublicJobFilter();
  const extraAnd = [];
  if (q.province) {
    const re = safeSearchRe(q.province);
    if (re) filter.province = re;
  }
  if (q.category) {
    const re = safeSearchRe(q.category);
    if (re) filter.category = re;
  }
  if (q.organization) {
    const re = safeSearchRe(q.organization);
    if (re) extraAnd.push({ $or: [{ company: re }, { organization: re }] });
  }
  if (q.deadline) {
    const d = new Date(q.deadline);
    if (!isNaN(d.getTime())) filter.deadline = { $gte: d };
  }
  if (q.type && ['full-time', 'part-time', 'contract', 'internship'].includes(q.type)) {
    filter.type = q.type;
  }
  if (q.applyType && (q.applyType === 'internal' || q.applyType === 'external')) {
    filter.applyType = q.applyType;
  }
  if (q.search && q.search.trim()) {
    const re = safeSearchRe(q.search);
    if (re) {
      extraAnd.push({
        $or: [{ title: re }, { company: re }, { organization: re }, { location: re }, { province: re }],
      });
    }
  }
  if (extraAnd.length) filter.$and = [...filter.$and, ...extraAnd];
  return filter;
}

function buildJobSort(sort) {
  if (sort === 'deadline') return { deadline: 1, createdAt: -1 };
  return { createdAt: -1 };
}

export const getJobs = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const sort = req.query.sort === 'deadline' ? 'deadline' : 'newest';
  const query = withListLocaleFilter(buildJobQuery(req.query), getRequestLocale(req));
  const [data, total] = await Promise.all([
    Job.find(query).sort(buildJobSort(sort)).skip(skip).limit(limit).lean(),
    Job.countDocuments(query),
  ]);
  res.json(listResponse(data.map(projectPublicJobListItem), paginate(page, limit, total), req.query));
});

export const getJobByIdOrSlug = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const locale = getRequestLocale(req);
  const publicFilter = buildPublicJobFilter();
  const job = isObjectIdParam(idOrSlug)
    ? await findLocalizedById(Job, idOrSlug, publicFilter, locale)
    : await findLocalizedBySlug(Job, idOrSlug, publicFilter, locale);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.publicationState && PUBLIC_JOB_HIDDEN_PUBLICATION_STATES.includes(job.publicationState)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  let employerVerification = null;
  if (job.employerId) {
    const emp = await Employer.findById(job.employerId).select('verificationLevel verified companyName slug').lean();
    if (emp) {
      employerVerification = {
        verificationLevel: emp.verificationLevel,
        verified: emp.verified === true && emp.verificationLevel && emp.verificationLevel !== 'basic',
        companyName: emp.companyName,
        slug: emp.slug,
      };
    }
  }
  await Job.findByIdAndUpdate(job._id, { $inc: { views: 1 } });
  const docLocale = job.locale || locale;
  const relatedFilter = withListLocaleFilter({ ...buildPublicJobFilter(), _id: { $ne: job._id } }, docLocale);
  if (job.category) relatedFilter.category = job.category;
  else if (job.province) relatedFilter.province = job.province;
  const related = await Job.find(relatedFilter).sort({ createdAt: -1 }).limit(4).lean();
  res.json(projectPublicJob(job, { related, employerVerification }));
});
