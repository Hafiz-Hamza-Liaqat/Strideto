import { Job } from '../models/Job.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import { Employer } from '../models/Employer.js';
import { PUBLIC_JOB_HIDDEN_PUBLICATION_STATES } from '../../../shared/publicDiscovery/publicTruth.js';
import {
  projectPublicJob,
  projectPublicJobListItem,
} from '../../../shared/publicDiscovery/projectPublicDiscovery.js';
import { normalizeCountryCode } from '../../../shared/international/country.js';
import { withFixtureExclusion } from '../../../shared/publicDiscovery/fixtureExclusion.js';
import { isValidJobFamily, isValidSpecialization } from '../../../shared/career/jobTaxonomy.js';
import {
  getRequestLocale,
  withListLocaleFilter,
  findLocalizedBySlug,
  findLocalizedById,
  isObjectIdParam,
} from '../utils/localeQuery.js';
import {
  attachEmployerLogos,
  collectEmployerIdsForLogoFallback,
  fetchEmployerLogoMap,
} from '../utils/employerLogoProjection.js';
import { rankRelatedJobs } from '../../../shared/seo/relatedRanking.js';
import { clusterResourceLinks } from '../../../shared/seo/contentClusters.js';
import { logSearchQuery } from '../services/search/SearchIndexService.js';

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

const JOB_SEARCH_INTENT_KEYS = Object.freeze([
  'search', 'countryCode', 'region', 'province', 'city', 'jobFamily',
  'specialization', 'category', 'organization', 'deadline', 'type',
  'applyType', 'workMode',
]);

export function hasJobSearchIntent(query = {}) {
  return JOB_SEARCH_INTENT_KEYS.some((key) => String(query[key] || '').trim().length > 0);
}

export function buildJobsSearchMeasurement({ query = {}, total, responseTimeMs = 0, userId = null } = {}) {
  return {
    query: String(query.search || '').trim().slice(0, 200),
    entityTypes: ['job'],
    resultCount: total,
    responseTimeMs,
    source: 'public',
    userId,
  };
}

export function buildPublicJobFilter({ allowHistorical = false } = {}) {
  const now = new Date();
  const filter = withFixtureExclusion({
    status: 'active',
    $and: [
      { $or: PUBLIC_APPROVAL_OR },
      { $or: PUBLIC_PUBLICATION_OR },
    ],
  });
  if (!allowHistorical) {
    filter.$and.push({ $or: [{ visibleUntil: { $exists: false } }, { visibleUntil: null }, { visibleUntil: { $gte: now } }] });
    filter.$and.push({ $or: [{ applicationsCloseAt: { $exists: false } }, { applicationsCloseAt: null }, { applicationsCloseAt: { $gte: now } }] });
    filter.$and.push({ $or: [{ deadline: { $exists: false } }, { deadline: null }, { deadline: { $gte: now } }] });
  }
  return filter;
}

function safeSearchRe(value) {
  const s = String(value || '').trim().slice(0, 200);
  if (!s) return null;
  return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function buildJobQuery(q) {
  const filter = buildPublicJobFilter();
  const extraAnd = [];
  const countryCode = normalizeCountryCode(q.countryCode);
  if (countryCode) {
    extraAnd.push({ countryCode });
  }
  const regionVal = q.region || q.province;
  if (regionVal) {
    const re = safeSearchRe(regionVal);
    if (re) {
      extraAnd.push({ $or: [{ region: re }, { province: re }] });
    }
  }
  if (q.city) {
    const re = safeSearchRe(q.city);
    if (re) filter.city = re;
  }
  if (q.jobFamily && isValidJobFamily(q.jobFamily)) {
    filter.jobFamily = q.jobFamily.trim();
  }
  if (q.specialization && q.jobFamily && isValidSpecialization(q.jobFamily, q.specialization)) {
    filter.specialization = q.specialization.trim();
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
  if (q.workMode === 'remote') extraAnd.push({ remote: true });
  else if (q.workMode === 'hybrid') extraAnd.push({ hybrid: true });
  else if (q.workMode === 'on_site') extraAnd.push({ remote: { $ne: true }, hybrid: { $ne: true } });
  if (q.search && q.search.trim()) {
    const re = safeSearchRe(q.search);
    if (re) {
      extraAnd.push({
        $or: [
          { title: re },
          { company: re },
          { organization: re },
          { location: re },
          { province: re },
          { region: re },
          { city: re },
        ],
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

/** GET /jobs/geo-facets — lightweight region/city/country facets from active jobs. */
export const getJobGeoFacets = asyncHandler(async (req, res) => {
  const baseMatch = buildPublicJobFilter();
  const countryCode = normalizeCountryCode(req.query.countryCode);
  const regionVal = String(req.query.region || req.query.province || '').trim();
  const match = { ...baseMatch };
  if (countryCode) match.countryCode = countryCode;
  if (regionVal) {
    match.$or = [{ region: regionVal }, { province: regionVal }];
  }

  const [countries, regions, cities] = await Promise.all([
    Job.aggregate([
      { $match: baseMatch },
      { $match: { countryCode: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$countryCode' } },
      { $sort: { _id: 1 } },
    ]),
    countryCode
      ? Job.aggregate([
          { $match: match },
          {
            $project: {
              regionLabel: {
                $cond: [
                  { $and: [{ $ne: ['$region', null] }, { $ne: ['$region', ''] }] },
                  '$region',
                  '$province',
                ],
              },
            },
          },
          { $match: { regionLabel: { $exists: true, $nin: [null, ''] } } },
          { $group: { _id: '$regionLabel' } },
          { $sort: { _id: 1 } },
        ])
      : Promise.resolve([]),
    countryCode
      ? Job.aggregate([
          { $match: match },
          { $match: { city: { $exists: true, $nin: [null, ''] } } },
          { $group: { _id: '$city' } },
          { $sort: { _id: 1 } },
        ])
      : Promise.resolve([]),
  ]);

  res.json({
    countries: countries.map((c) => c._id).filter(Boolean),
    regions: regions.map((r) => r._id).filter(Boolean),
    cities: cities.map((c) => c._id).filter(Boolean),
  });
});

export const getJobs = asyncHandler(async (req, res) => {
  const started = Date.now();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const sort = req.query.sort === 'deadline' ? 'deadline' : 'newest';
  const query = withListLocaleFilter(buildJobQuery(req.query), getRequestLocale(req));
  const [data, total] = await Promise.all([
    Job.find(query).sort(buildJobSort(sort)).skip(skip).limit(limit).lean(),
    Job.countDocuments(query),
  ]);
  // A completed first-page Jobs search is the measurement boundary. The
  // server's count is authoritative; pagination is not a second search.
  if (page === 1 && hasJobSearchIntent(req.query)) {
    void logSearchQuery(buildJobsSearchMeasurement({
      query: req.query,
      total,
      responseTimeMs: Date.now() - started,
      userId: req.user?.userId || null,
    }));
  }
  const logoMap = await fetchEmployerLogoMap(collectEmployerIdsForLogoFallback(data));
  const rowsWithLogos = attachEmployerLogos(data, logoMap);
  const items = [];
  for (const row of rowsWithLogos) {
    try {
      const item = projectPublicJobListItem(row);
      if (item && item._id) items.push(item);
    } catch {
      // One malformed record must not fail the catalog.
    }
  }
  res.json(listResponse(items, paginate(page, limit, total), req.query));
});

export const getJobByIdOrSlug = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const locale = getRequestLocale(req);
  const publicFilter = buildPublicJobFilter({ allowHistorical: true });
  const job = isObjectIdParam(idOrSlug)
    ? await findLocalizedById(Job, idOrSlug, publicFilter, locale)
    : await findLocalizedBySlug(Job, idOrSlug, publicFilter, locale);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.publicationState && PUBLIC_JOB_HIDDEN_PUBLICATION_STATES.includes(job.publicationState)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  let employerVerification = null;
  let employerLogoUrl = null;
  if (job.employerId) {
    const emp = await Employer.findById(job.employerId).select('verificationLevel verified companyName slug logoUrl').lean();
    if (emp) {
      employerVerification = {
        verificationLevel: emp.verificationLevel,
        verified: emp.verified === true && emp.verificationLevel && emp.verificationLevel !== 'basic',
        companyName: emp.companyName,
        slug: emp.slug,
      };
      employerLogoUrl = emp.logoUrl || null;
    }
  }
  await Job.findByIdAndUpdate(job._id, { $inc: { views: 1 } });
  const docLocale = job.locale || locale;
  const relatedFilter = withListLocaleFilter({ ...buildPublicJobFilter(), _id: { $ne: job._id } }, docLocale);
  const relatedCandidates = await Job.find(relatedFilter).sort({ createdAt: -1 }).limit(24).lean();
  const related = rankRelatedJobs(job, relatedCandidates, { limit: 4 });
  const relatedLogoMap = await fetchEmployerLogoMap(collectEmployerIdsForLogoFallback(related));
  const relatedWithLogos = attachEmployerLogos(related, relatedLogoMap);
  const relatedResources = clusterResourceLinks('career', {
    maxItems: 4,
    currentPath: `/jobs/${job.slug}`,
  });
  res.json(projectPublicJob(job, {
    related: relatedWithLogos,
    relatedResources,
    employerVerification,
    employerLogoUrl,
  }));
});
