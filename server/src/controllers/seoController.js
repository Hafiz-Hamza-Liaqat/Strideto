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
import { TestAcceptance } from '../models/education/TestAcceptance.js';
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
import { currentAcceptanceMongoFilter } from '../../../shared/publicDiscovery/publicTruth.js';
import { buildPublicJobFilter } from './jobsController.js';
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

function getPublicOrigin() {
  return resolvePublicSiteOrigin(process.env.SITE_URL || process.env.FRONTEND_URL || '');
}

const JOB_SOURCE_SLUGS = SEO_JOB_SOURCE_SLUGS;

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
  const institutionProgramCounts = canonicalInstitutionIds.length
    ? await Program.aggregate([
      {
        $match: withFixtureExclusion({
          status: PUB_STATUSES.PUBLISHED,
          institutionId: { $in: canonicalInstitutionIds },
        }),
      },
      { $group: { _id: '$institutionId', count: { $sum: 1 } } },
    ])
    : [];
  const programCountByInstitutionId = new Map(
    institutionProgramCounts.map((row) => [String(row._id), row.count])
  );

  const institutionAcceptanceCounts = canonicalInstitutionIds.length
    ? await TestAcceptance.aggregate([
      {
        $match: {
          institutionId: { $in: canonicalInstitutionIds },
          ...currentAcceptanceMongoFilter(),
        },
      },
      { $group: { _id: '$institutionId', count: { $sum: 1 } } },
    ])
    : [];
  const acceptedTestCountByInstitutionId = new Map(
    institutionAcceptanceCounts.map((row) => [String(row._id), row.count])
  );

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
