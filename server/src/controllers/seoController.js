import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { Blog } from '../models/Blog.js';
import { Internship } from '../models/Internship.js';
import { IntlScholarship } from '../models/IntlScholarship.js';
import { Institution } from '../models/Institution.js';
import { ForeignStudy } from '../models/ForeignStudy.js';
import { Program } from '../models/education/Program.js';
import { CanonicalInstitution } from '../models/education/CanonicalInstitution.js';
import { CanonicalScholarship } from '../models/education/CanonicalScholarship.js';
import { Test } from '../models/education/Test.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentMarketplacePost } from '../models/agent/AgentMarketplacePost.js';
import { OrganizationVerification } from '../models/OrganizationVerification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { resolvePublicSiteOrigin } from '../../../shared/seo/publicSiteOrigin.js';
import { buildRobotsTxt } from '../../../shared/seo/robotsPolicy.js';
import { INDEXABLE_STATIC_PATHS, isForbiddenSitemapPath } from '../../../shared/seo/publicIndexablePages.js';
import {
  APPROVED_SEO_LANDING_PATHS,
  SEO_JOB_SOURCE_SLUGS,
} from '../../../shared/seo/seoLandingRegistry.js';
import { resolveSitemapLastmod, isSitemapEligiblePath } from '../../../shared/seo/sitemapPolicy.js';
import {
  resolveEntitySitemapLastmod,
  SEO_ENTITY_TYPES,
} from '../../../shared/seo/freshnessPolicy.js';
import {
  isJobDetailPubliclyEligible,
  isCanonicalInstitutionDetailEligible,
  isCanonicalScholarshipDetailEligible,
  isIntlScholarshipDetailEligible,
  isProgramDetailIndexable,
} from '../../../shared/seo/entityDetailSeoPolicy.js';
import { buildPublicJobFilter } from './jobsController.js';
import { projectPublicJob } from '../../../shared/publicDiscovery/projectPublicDiscovery.js';
import { getRequestLocale, findLocalizedBySlug } from '../utils/localeQuery.js';
import { PUB_STATUSES } from '../../../shared/education/taxonomy.js';
import { VERIFICATION_STATUSES } from '../../../shared/international/verification.js';
import {
  MARKETPLACE_PUBLICATION_STATUSES,
  MARKETPLACE_MODERATION_STATUSES,
} from '../../../shared/agent/marketplace.js';
import { AGENT_PROFILE_STATUSES } from '../../../shared/agent/constants.js';
import { withFixtureExclusion } from '../../../shared/publicDiscovery/fixtureExclusion.js';
import { listEligibleMarketplaceSitemapPaths } from '../services/gbs/gbsMarketplaceService.js';
import { isTestPubliclyPromotable } from '../../../shared/education/testPublicationPolicy.js';
import { publicHttpUrlOrNull } from '../../../shared/publicDiscovery/safePublicUrl.js';
import { projectPublicBlog, projectPublicTest } from '../../../shared/publicDiscovery/projectPublicDiscovery.js';
import {
  canonicalInstitutionEligibilityFacts,
  getCanonicalInstitutionEligibilityContext,
} from '../utils/canonicalInstitutionEligibility.js';

const NON_JOB_SEO_TYPES = new Set(['scholarship', 'blog', 'institution', 'test', 'program']);

function publicSeoText(value, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function seoFacts(...facts) {
  return facts.filter((fact) => fact && publicSeoText(fact.value, 500));
}

function stripId(value) {
  if (Array.isArray(value)) return value.map(stripId);
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (key !== '_id' && key !== '__v') out[key] = stripId(item);
  }
  return out;
}

export const getSeoEntityBySlug = asyncHandler(async (req, res) => {
  const type = String(req.params.type || '').toLowerCase();
  const slug = String(req.params.slug || '').trim();
  if (!NON_JOB_SEO_TYPES.has(type) || !/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
    return res.status(404).json({ error: 'Public entity not found' });
  }

  let entity = null;
  if (type === 'scholarship') {
    const doc = await findLocalizedBySlug(
      Scholarship,
      slug,
      withFixtureExclusion({ status: 'active' }),
      getRequestLocale(req),
    );
    if (doc) entity = {
      type,
      slug: doc.slug,
      title: doc.title,
      provider: doc.provider || doc.university || '',
      description: doc.description || '',
      facts: seoFacts(
        { label: 'Provider', value: doc.provider || doc.university },
        { label: 'Country', value: doc.country },
        { label: 'Level', value: doc.level || doc.degreeLevel },
        { label: 'Funding', value: doc.fundingType || doc.amount },
        { label: 'Deadline', value: doc.deadline },
      ),
    };
  } else if (type === 'blog') {
    const doc = await findLocalizedBySlug(Blog, slug, { status: 'published' }, getRequestLocale(req));
    const blog = projectPublicBlog(doc);
    if (blog) entity = {
      type,
      slug: blog.slug,
      title: blog.title,
      excerpt: blog.excerpt,
      description: blog.excerpt,
      seoTitle: blog.seoTitle,
      metaDescription: blog.metaDescription,
      author: blog.authorDisplay || '',
      publishedAt: blog.publishedAt,
      updatedAt: blog.updatedAt,
      facts: seoFacts(
        { label: 'Category', value: blog.category },
        { label: 'Author', value: blog.authorDisplay },
        { label: 'Published', value: blog.publishedAt },
      ),
    };
  } else if (type === 'institution') {
    const doc = await CanonicalInstitution.findOne(withFixtureExclusion({ slug, status: PUB_STATUSES.PUBLISHED }))
      .select('officialName slug countryCode city region officialWebsite institutionType status sources')
      .lean();
    // Uses the same program + current TestAcceptance fact builder as sitemap;
    // that builder applies currentAcceptanceMongoFilter().
    const context = doc ? await getCanonicalInstitutionEligibilityContext([doc._id]) : null;
    const eligibilityFacts = context
      ? canonicalInstitutionEligibilityFacts(context, doc._id)
      : { programCount: 0, acceptedTestCount: 0 };
    if (doc && isCanonicalInstitutionDetailEligible(
      doc,
      eligibilityFacts,
    )) entity = {
      type,
      slug: doc.slug,
      name: doc.officialName,
      officialName: doc.officialName,
      institutionType: doc.institutionType,
      countryCode: doc.countryCode,
      city: doc.city,
      region: doc.region,
      officialWebsite: publicHttpUrlOrNull(doc.officialWebsite),
      description: `${doc.officialName}${doc.institutionType ? ` is a ${doc.institutionType}` : ''}${doc.city || doc.countryCode ? ` in ${[doc.city, doc.countryCode].filter(Boolean).join(', ')}` : ''}.`,
      facts: seoFacts(
        { label: 'Type', value: doc.institutionType },
        { label: 'Location', value: [doc.city, doc.region, doc.countryCode].filter(Boolean).join(', ') },
        { label: 'Programs', value: eligibilityFacts.programCount ? String(eligibilityFacts.programCount) : '' },
      ),
    };
  } else if (type === 'test') {
    const doc = await Test.findOne({ slug, status: PUB_STATUSES.PUBLISHED })
      .populate('providerId', 'name officialWebsite status')
      .select('slug name shortName category description overview purposes deliveryModes totalDurationMinutes scoreScale officialWebsite providerId status')
      .lean();
    const test = projectPublicTest(doc);
    if (test && isTestPubliclyPromotable(doc)) entity = {
      type,
      slug: test.slug,
      name: test.name,
      description: test.description || test.overview || '',
      provider: test.providerId?.name || '',
      facts: seoFacts(
        { label: 'Provider', value: test.providerId?.name },
        { label: 'Purpose', value: Array.isArray(test.purposes) ? test.purposes.join(', ') : '' },
        { label: 'Format', value: Array.isArray(test.deliveryModes) ? test.deliveryModes.join(', ') : '' },
        { label: 'Score scale', value: test.scoreScale },
        { label: 'Duration', value: test.totalDurationMinutes ? `${test.totalDurationMinutes} minutes` : '' },
      ),
    };
  } else if (type === 'program') {
    const doc = await Program.findOne(withFixtureExclusion({ slug, status: PUB_STATUSES.PUBLISHED }))
      .populate('institutionId', 'officialName slug countryCode city region institutionType')
      .select('name slug degreeLevel field studyMode durationMonths country campus instructionLanguage officialProgramUrl institutionId description summary status')
      .lean();
    if (doc && isProgramDetailIndexable(doc)) entity = {
      type,
      slug: doc.slug,
      name: doc.name,
      description: doc.description || doc.summary || '',
      institutionName: doc.institutionId?.officialName || '',
      degreeLevel: doc.degreeLevel,
      durationMonths: doc.durationMonths,
      facts: seoFacts(
        { label: 'Institution', value: doc.institutionId?.officialName },
        { label: 'Degree', value: doc.degreeLevel },
        { label: 'Field', value: doc.field },
        { label: 'Study mode', value: doc.studyMode },
        { label: 'Location', value: [doc.campus, doc.country || doc.institutionId?.countryCode].filter(Boolean).join(', ') },
        { label: 'Duration', value: doc.durationMonths ? `${doc.durationMonths} months` : '' },
      ),
    };
  }

  if (!entity) return res.status(404).json({ error: 'Public entity not found' });
  res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  return res.json(stripId(entity));
});

function getPublicOrigin() {
  return resolvePublicSiteOrigin(process.env.SITE_URL || process.env.FRONTEND_URL || '');
}

const JOB_SOURCE_SLUGS = SEO_JOB_SOURCE_SLUGS;

/**
 * Read-only public Job projection for request-time HTML rendering.
 * Unlike the normal detail API, this endpoint must not increment views or
 * perform any other write as part of a crawler request.
 */
export const getSeoJobBySlug = asyncHandler(async (req, res) => {
  const locale = getRequestLocale(req);
  const job = await findLocalizedBySlug(
    Job,
    req.params.slug,
    buildPublicJobFilter({ allowHistorical: true }),
    locale,
  );
  if (!job || (job.publicationState && ['draft', 'pending_review', 'rejected', 'closed', 'expired'].includes(job.publicationState))) {
    return res.status(404).json({ error: 'Job not found' });
  }
  return res.json(projectPublicJob(job));
});

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function formatLastmod(entityType, doc) {
  return resolveEntitySitemapLastmod(entityType, doc) || '';
}

function urlEntry(base, path, { entityType, doc, lastmod } = {}) {
  const loc = `${base}${path}`.replace(/([^:]\/)\/+/g, '$1');
  const resolved = entityType && doc
    ? formatLastmod(entityType, doc)
    : (lastmod ? resolveSitemapLastmod(lastmod) || '' : '');
  return { loc, lastmod: resolved || undefined };
}

function hasSlug(doc) {
  return Boolean(doc?.slug && String(doc.slug).trim());
}

/**
 * GET /sitemap.xml - public indexable routes only
 */
export const getSitemap = asyncHandler(async (_req, res) => {
  const base = getPublicOrigin();
  const urlMap = new Map();

  const addUrl = (path, opts) => {
    if (!path || !isSitemapEligiblePath(path)) return;
    if (isForbiddenSitemapPath(path)) return;
    const entry = urlEntry(base, path, opts);
    urlMap.set(entry.loc, entry);
  };

  INDEXABLE_STATIC_PATHS.forEach((path) => addUrl(path));
  APPROVED_SEO_LANDING_PATHS.forEach((path) => addUrl(path));

  const slugFilter = { slug: { $exists: true, $nin: [null, ''] } };

  const [
    jobs,
    scholarships,
    admissions,
    blogs,
    internships,
    intlScholarships,
    institutions,
    foreignStudies,
    programs,
    tests,
    canonicalInstitutions,
    canonicalScholarships,
    approvedOrgs,
    marketplacePosts,
  ] = await Promise.all([
    Job.find(buildPublicJobFilter()).select('slug status approvalStatus publicationState updatedAt publishedAt publicationUpdatedAt').limit(5000).lean(),
    Scholarship.find(withFixtureExclusion({ status: 'active', ...slugFilter })).select('slug updatedAt').limit(2000).lean(),
    Admission.find(withFixtureExclusion({ status: 'active', ...slugFilter })).select('slug updatedAt').limit(2000).lean(),
    Blog.find({ status: 'published', ...slugFilter }).select('slug updatedAt publishedAt').limit(2000).lean(),
    Internship.find(withFixtureExclusion({ status: 'active', ...slugFilter })).select('slug updatedAt').limit(1000).lean(),
    IntlScholarship.find({ status: 'active', ...slugFilter }).select('slug updatedAt').limit(500).lean(),
    Institution.find({ status: 'active', ...slugFilter }).select('slug updatedAt').limit(1000).lean(),
    ForeignStudy.find({ status: 'active', ...slugFilter }).select('slug updatedAt').limit(500).lean(),
    Program.find(withFixtureExclusion({ status: PUB_STATUSES.PUBLISHED, ...slugFilter }))
      .select('slug name institutionId description degreeLevels fields updatedAt status')
      .limit(2000)
      .lean(),
    Test.find({ status: PUB_STATUSES.PUBLISHED, ...slugFilter })
      .populate('providerId', 'name officialWebsite status')
      .select('name slug updatedAt status officialWebsite registrationUrl sources providerId')
      .limit(500)
      .lean(),
    CanonicalInstitution.find(withFixtureExclusion({ status: PUB_STATUSES.PUBLISHED, ...slugFilter }))
      .select('slug officialName countryCode sources officialWebsite updatedAt status')
      .limit(2000)
      .lean(),
    CanonicalScholarship.find(withFixtureExclusion({ status: PUB_STATUSES.PUBLISHED, ...slugFilter }))
      .select('slug updatedAt status')
      .limit(2000)
      .lean(),
    OrganizationVerification.find({ status: VERIFICATION_STATUSES.APPROVED }, { organizationId: 1 }).lean(),
    AgentMarketplacePost.find(withFixtureExclusion({
      publicationStatus: MARKETPLACE_PUBLICATION_STATUSES.PUBLISHED,
      moderationStatus: MARKETPLACE_MODERATION_STATUSES.APPROVED,
      ...slugFilter,
    })).select('slug updatedAt publishedAt').limit(500).lean(),
  ]);

  const approvedOrgIds = approvedOrgs.map((r) => r.organizationId).filter(Boolean);
  const agentProfiles = approvedOrgIds.length
    ? await AgentProfile.find(withFixtureExclusion({
      organizationId: { $in: approvedOrgIds },
      profileStatus: AGENT_PROFILE_STATUSES.APPROVED,
      ...slugFilter,
    })).select('slug updatedAt').limit(500).lean()
    : [];

  const canonicalInstitutionIds = canonicalInstitutions.map((i) => i._id);
  const institutionEligibilityContext = await getCanonicalInstitutionEligibilityContext(canonicalInstitutionIds);
  const { programCountByInstitutionId, acceptedTestCountByInstitutionId } = institutionEligibilityContext;

  jobs.filter(isJobDetailPubliclyEligible).forEach((j) =>
    addUrl(`/jobs/${j.slug}`, { entityType: SEO_ENTITY_TYPES.JOB, doc: j })
  );
  scholarships.filter(hasSlug).forEach((s) =>
    addUrl(`/scholarships/${s.slug}`, { entityType: SEO_ENTITY_TYPES.SCHOLARSHIP, doc: s })
  );
  admissions.filter(hasSlug).forEach((a) =>
    addUrl(`/admissions/${a.slug}`, { entityType: SEO_ENTITY_TYPES.ADMISSION, doc: a })
  );
  blogs.filter(hasSlug).forEach((b) =>
    addUrl(`/blog/${b.slug}`, { entityType: SEO_ENTITY_TYPES.BLOG, doc: b })
  );
  internships.filter(hasSlug).forEach((i) =>
    addUrl(`/internships/${i.slug}`, { entityType: SEO_ENTITY_TYPES.INTERNSHIP, doc: i })
  );
  intlScholarships.filter(isIntlScholarshipDetailEligible).forEach((s) =>
    addUrl(`/intl-scholarships/${s.slug}`, { entityType: SEO_ENTITY_TYPES.INTL_SCHOLARSHIP, doc: s })
  );
  institutions.filter(hasSlug).forEach((i) => addUrl(`/schools-and-colleges/${i.slug}`, { lastmod: i.updatedAt }));
  canonicalInstitutions
    .filter((i) =>
      isCanonicalInstitutionDetailEligible(i, {
        programCount: programCountByInstitutionId.get(String(i._id)) || 0,
        acceptedTestCount: acceptedTestCountByInstitutionId.get(String(i._id)) || 0,
      })
    )
    .forEach((i) =>
      addUrl(`/institutions/${i.slug}`, { entityType: SEO_ENTITY_TYPES.CANONICAL_INSTITUTION, doc: i })
    );
  canonicalScholarships.filter(isCanonicalScholarshipDetailEligible).forEach((s) =>
    addUrl(`/scholarship-intelligence/${s.slug}`, { entityType: SEO_ENTITY_TYPES.CANONICAL_SCHOLARSHIP, doc: s })
  );
  foreignStudies.filter(hasSlug).forEach((f) =>
    addUrl(`/foreign-studies/${f.slug}`, { entityType: SEO_ENTITY_TYPES.FOREIGN_STUDY, doc: f })
  );
  programs.filter(isProgramDetailIndexable).forEach((p) =>
    addUrl(`/program-explorer/${p.slug}`, { entityType: SEO_ENTITY_TYPES.PROGRAM, doc: p })
  );
  tests.filter((t) => hasSlug(t) && isTestPubliclyPromotable(t)).forEach((t) => addUrl(`/tests/${t.slug}`, { lastmod: t.updatedAt }));
  agentProfiles.filter(hasSlug).forEach((a) => addUrl(`/agents/${a.slug}`, { lastmod: a.updatedAt }));
  marketplacePosts.filter(hasSlug).forEach((p) => addUrl(`/agents/marketplace/${p.slug}`, { lastmod: p.updatedAt || p.publishedAt }));

  const gbsPaths = await listEligibleMarketplaceSitemapPaths(process.env);
  gbsPaths.forEach((p) => addUrl(p));

  const urls = [...urlMap.values()];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.type('application/xml').send(xml);
});

const SLUG_TO_PROVINCE = {
  'khyber-pakhtunkhwa': 'Khyber Pakhtunkhwa',
  kpk: 'Khyber Pakhtunkhwa',
  punjab: 'Punjab',
  sindh: 'Sindh',
  balochistan: 'Balochistan',
  islamabad: 'Islamabad',
  'gilgit-baltistan': 'Gilgit-Baltistan',
  ajk: 'AJK',
};
const SLUG_TO_JOB_TYPE = { 'government-jobs': 'Government', 'private-jobs': 'Private', internships: 'Internship', 'internship-jobs': 'Internship' };

export const getSeoJobsPage = asyncHandler(async (req, res) => {
  const slug = (req.params.slug || '').toLowerCase().replace(/\s+/g, '-');
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 24);
  const filter = { status: 'active' };
  const province = SLUG_TO_PROVINCE[slug];
  if (province) {
    filter.province = new RegExp(province, 'i');
  } else {
    filter.$or = [
      { city: new RegExp(slug.replace(/-/g, ' '), 'i') },
      { province: new RegExp(slug.replace(/-/g, ' '), 'i') },
      { location: new RegExp(slug.replace(/-/g, ' '), 'i') },
    ];
  }
  const jobs = await Job.find(withFixtureExclusion(filter)).sort({ createdAt: -1 }).limit(limit).lean();
  const title = province
    ? `Latest Government & Private Jobs in ${province} 2026 | Strideto`
    : `Latest Jobs in ${slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} 2026 | Strideto`;
  const description = `Find the latest government and private jobs in ${slug.replace(/-/g, ' ')}. Updated daily with verified opportunities.`;
  const base = getPublicOrigin();
  res.json({
    meta: { title, description, canonical: `${base}/jobs-in-${slug}` },
    data: jobs,
    total: jobs.length,
  });
});

export const getSeoJobsByCategory = asyncHandler(async (req, res) => {
  const slug = (req.params.slug || '').toLowerCase();
  const jobType = SLUG_TO_JOB_TYPE[slug];
  if (!jobType) return res.status(404).json({ error: 'Invalid category' });
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 24);
  const jobs = await Job.find(withFixtureExclusion({ status: 'active', jobType })).sort({ createdAt: -1 }).limit(limit).lean();
  const title = `Latest ${jobType} in Pakistan 2026 | Strideto`;
  const description = `Find the latest ${jobType.toLowerCase()} in Pakistan. Updated daily with verified opportunities.`;
  const base = getPublicOrigin();
  res.json({
    meta: { title, description, canonical: `${base}/${slug}` },
    data: jobs,
    total: jobs.length,
  });
});

export const getSeoJobsBySource = asyncHandler(async (req, res) => {
  const source = (req.params.source || '').toLowerCase().replace(/\s+/g, '-');
  if (!JOB_SOURCE_SLUGS.includes(source)) return res.status(404).json({ error: 'Invalid source' });
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 24);
  const sourceWebsite = source.toUpperCase().replace(/-/g, ' ');
  const jobs = await Job.find(withFixtureExclusion({ status: 'active', sourceWebsite: new RegExp(sourceWebsite, 'i') }))
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const sourceName = source.toUpperCase();
  const title = `Latest ${sourceName} Jobs in Pakistan 2026 | Strideto`;
  const description = `Find the latest ${sourceName} jobs and vacancies. Apply before deadline. Updated regularly.`;
  const base = getPublicOrigin();
  res.json({
    meta: { title, description, canonical: `${base}/${source}-jobs` },
    data: jobs,
    total: jobs.length,
  });
});

export const getLatestGovernmentJobs = asyncHandler(async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 24);
  const jobs = await Job.find(withFixtureExclusion({ status: 'active', jobType: 'Government' }))
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const title = 'Latest Government Jobs in Pakistan 2026 | FPSC, PPSC, NTS, WAPDA | Strideto';
  const description = 'Find the latest government jobs in Pakistan. FPSC, PPSC, NTS, WAPDA and more. Updated every 6 hours.';
  const base = getPublicOrigin();
  res.json({
    meta: { title, description, canonical: `${base}/latest-government-jobs` },
    data: jobs,
    total: jobs.length,
  });
});

export const getSeoScholarshipsPage = asyncHandler(async (req, res) => {
  const country = (req.params.country || '').toLowerCase().replace(/-/g, ' ');
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 24);
  const filter = { status: 'active', country: new RegExp(country, 'i') };
  const scholarships = await Scholarship.find(withFixtureExclusion(filter)).sort({ deadline: 1 }).limit(limit).lean();
  const countryTitle = country.replace(/\b\w/g, (c) => c.toUpperCase());
  const title = `Scholarships in ${countryTitle} | Strideto`;
  const description = `Find scholarships in ${countryTitle}. Fully funded and partial scholarships on Strideto.`;
  const base = getPublicOrigin();
  res.json({
    meta: { title, description, canonical: `${base}/scholarships-in-${req.params.country}` },
    data: scholarships,
    total: scholarships.length,
  });
});

/**
 * GET /robots.txt — crawler hints only. Not an authorization boundary.
 */
export const getRobots = (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.type('text/plain').send(buildRobotsTxt(getPublicOrigin()));
};
