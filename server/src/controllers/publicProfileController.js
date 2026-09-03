import { asyncHandler } from '../utils/asyncHandler.js';
import { Employer } from '../models/Employer.js';
import { Company } from '../models/Company.js';
import { University } from '../models/University.js';
import { Job } from '../models/Job.js';
import { Admission } from '../models/Admission.js';
import { Scholarship } from '../models/Scholarship.js';
import { ForeignStudy } from '../models/ForeignStudy.js';
import {
  getRequestLocale,
  findLocalizedBySlug,
  withListLocaleFilter,
} from '../utils/localeQuery.js';
import { freeTextCountryRegex } from '../../../shared/international/location.js';
import {
  projectPublicCompany,
  projectPublicCompanyListItem,
  projectPublicEmployer,
  projectPublicJobListItem,
  projectPublicAdmissionListItem,
  projectPublicForeignStudyListItem,
  projectPublicScholarshipListItem,
  projectPublicUniversity,
  projectPublicUniversityListItem,
} from '../../../shared/publicDiscovery/projectPublicDiscovery.js';

// A job is publicly listable only when admin-approved. Legacy rows predating
// the approvalStatus field (absent) are treated as approved, matching the
// public jobs listing (jobsController). Anything active-but-pending/rejected —
// e.g. a draft the employer just activated but that admin has not approved —
// must never appear as an open public position.
const PUBLICLY_APPROVED = {
  $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }],
};

export function isPubliclyApproved(job) {
  return job.approvalStatus === 'approved' || job.approvalStatus === undefined || job.approvalStatus === null;
}

export const getEmployerProfile = asyncHandler(async (req, res) => {
  const employer = await Employer.findOne({
    slug: req.params.slug,
    isPublicProfile: { $ne: false },
  }).select('-password -email');

  if (!employer) {
    return res.status(404).json({ error: 'Employer profile not found' });
  }

  const ownerScope = { $or: [{ employerId: employer._id }, { company: employer.companyName }] };

  const [activeJobs, recentJobs, closedJobs] = await Promise.all([
    Job.find({ employerId: employer._id, status: 'active', ...PUBLICLY_APPROVED })
      .sort({ createdAt: -1 }).limit(20).lean(),
    Job.find({ ...ownerScope, status: 'active', ...PUBLICLY_APPROVED })
      .sort({ createdAt: -1 }).limit(10).lean(),
    // Past positions = the employer's closed roles. These are prior openings,
    // not confirmed hires, so the client presents them as "Past positions".
    Job.find({ ...ownerScope, status: 'closed' })
      .sort({ updatedAt: -1 }).limit(5).lean(),
  ]);

  const allCompanyJobs = await Job.find(ownerScope).select('status approvalStatus').lean();

  res.json({
    profile: projectPublicEmployer(employer),
    stats: {
      totalJobs: allCompanyJobs.length,
      // Public "active jobs" count reflects only what a visitor can actually
      // open — approved active roles — so the stat matches the listed positions.
      activeJobs: allCompanyJobs.filter((j) => j.status === 'active' && isPubliclyApproved(j)).length,
      closedJobs: allCompanyJobs.filter((j) => j.status === 'closed').length,
    },
    activeJobs: activeJobs.map(projectPublicJobListItem),
    recentJobs: recentJobs.map(projectPublicJobListItem),
    // `pastPositions` is the truthful name; `hiringHistory` retained as a
    // backwards-compatible alias for any existing consumer.
    pastPositions: closedJobs.map(projectPublicJobListItem),
    hiringHistory: closedJobs.map(projectPublicJobListItem),
  });
});

export const getCompanyProfile = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ slug: req.params.slug, status: 'active' }).lean();
  if (!company) {
    return res.status(404).json({ error: 'Company not found' });
  }

  let employer = null;
  if (company.employerId) {
    employer = await Employer.findById(company.employerId).select('-password -email').lean();
  }

  const jobs = await Job.find({ company: company.name, status: 'active' }).sort({ createdAt: -1 }).limit(20).lean();
  const allJobs = await Job.find({ company: company.name }).select('status createdAt').lean();

  res.json({
    company: projectPublicCompany(company),
    employer: projectPublicEmployer(employer),
    stats: {
      totalJobs: allJobs.length,
      activeJobs: allJobs.filter((j) => j.status === 'active').length,
      closedJobs: allJobs.filter((j) => j.status === 'closed').length,
    },
    activeJobs: jobs.map(projectPublicJobListItem),
    openPositions: jobs.map(projectPublicJobListItem),
    recentJobs: jobs.slice(0, 10).map(projectPublicJobListItem),
  });
});

export const getUniversityProfile = asyncHandler(async (req, res) => {
  const locale = getRequestLocale(req);
  const university = await findLocalizedBySlug(
    University,
    req.params.slug,
    { status: 'active' },
    locale,
  );
  if (!university) {
    return res.status(404).json({ error: 'University not found' });
  }

  const namePattern = new RegExp(university.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const docLocale = university.locale || locale;
  const localizedActive = (extra) => withListLocaleFilter({ status: 'active', ...extra }, docLocale);

  const [admissions, scholarships, foreignStudies] = await Promise.all([
    Admission.find(localizedActive({
      $or: [{ institution: namePattern }, { university: namePattern }],
    })).sort({ deadline: 1 }).limit(15).lean(),
    Scholarship.find(localizedActive({
      $or: [{ university: namePattern }, { provider: /HEC/i }],
    })).sort({ deadline: 1 }).limit(10).lean(),
    ForeignStudy.find({ status: 'active' }).sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  res.json({
    university: projectPublicUniversity(university),
    admissions: admissions.map(projectPublicAdmissionListItem),
    scholarships: scholarships.map(projectPublicScholarshipListItem),
    foreignStudies: foreignStudies.map(projectPublicForeignStudyListItem),
  });
});

export const listCompanies = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const filter = { status: 'active' };
  if (req.query.industry) filter.industry = new RegExp(req.query.industry, 'i');

  const [data, total] = await Promise.all([
    Company.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Company.countDocuments(filter),
  ]);

  res.json({ data: data.map(projectPublicCompanyListItem), page, limit, total, pages: Math.ceil(total / limit) });
});

export const listUniversities = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const filter = { status: 'active' };
  const countryRe = freeTextCountryRegex(req.query.country || req.query.countryCode);
  if (countryRe) filter.country = countryRe;

  const [data, total] = await Promise.all([
    University.find(filter).sort({ ranking: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    University.countDocuments(filter),
  ]);

  res.json({ data: data.map(projectPublicUniversityListItem), page, limit, total, pages: Math.ceil(total / limit) });
});
