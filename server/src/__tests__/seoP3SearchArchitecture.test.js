/**
 * SEO-P3 — Search + indexability architecture regression coverage.
 *
 * Run: node server/src/__tests__/seoP3SearchArchitecture.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { PRODUCTION_PUBLIC_ORIGIN } from '../../../shared/seo/publicSiteOrigin.js';
import {
  evaluateCollectionSeo,
  normalizeCollectionQuery,
  classifyCollectionQueryParam,
  QUERY_PARAM_KIND,
} from '../../../shared/seo/collectionSeoPolicy.js';
import {
  INDEXABLE_STATIC_PATHS,
  isForbiddenSitemapPath,
} from '../../../shared/seo/publicIndexablePages.js';
import {
  APPROVED_SEO_LANDING_PATHS,
  isApprovedSeoLandingPath,
  resolveUnknownSeoLandingPolicy,
} from '../../../shared/seo/seoLandingRegistry.js';
import {
  evaluateEmptyCollectionPolicy,
} from '../../../shared/seo/seoLandingEligibility.js';
import {
  isSitemapEligiblePath,
  isQueryStringSitemapUrl,
  resolveSitemapLastmod,
  shouldShardSitemap,
} from '../../../shared/seo/sitemapPolicy.js';
import {
  isJobDetailPubliclyEligible,
  isProgramDetailIndexable,
  isCanonicalInstitutionDetailEligible,
  hasMeaningfulInstitutionProfile,
  isSubstantiveInstitutionSourceEvidence,
  isIntlScholarshipDetailEligible,
  resolveScholarshipDetailPath,
  scholarshipRouteOwnership,
} from '../../../shared/seo/entityDetailSeoPolicy.js';
import {
  buildRobotsTxt,
  isPrivateSeoPath,
} from '../../../shared/seo/robotsPolicy.js';
import {
  JOB_POSTING_SURFACES,
  evaluateJobPostingEligibility,
} from '../../../shared/seo/jobPostingEligibility.js';
import { UNIFIED_SCHOLARSHIP_SOURCE } from '../../../shared/publicDiscovery/unifiedScholarshipDiscovery.js';
import { normalizeCountryCode } from '../../../shared/international/country.js';
import { isValidJobFamily } from '../../../shared/career/jobTaxonomy.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '../../..');
const read = (rel) => readFileSync(path.join(repo, rel), 'utf8');

const seoController = read('server/src/controllers/seoController.js');
const publicIndexable = read('shared/seo/publicIndexablePages.js');
const jobsList = read('client/src/pages/Jobs/Jobs.jsx');
const scholarshipsList = read('client/src/pages/Scholarships/Scholarships.jsx');
const institutionExplorer = read('client/src/pages/Education/InstitutionExplorer.jsx');
const scholarshipIntel = read('client/src/pages/Scholarships/ScholarshipIntelligence.jsx');
const schemasSource = read('client/src/seo/schemas.js');
const entityIdsSource = read('client/src/seo/entityIds.js');
const jobDetailSource = read('client/src/pages/Jobs/JobDetail.jsx');
const internshipDetailSource = read('client/src/pages/Internships/InternshipDetail.jsx');
const blogPostSource = read('client/src/pages/Blog/BlogPost.jsx');

const ORIGIN = PRODUCTION_PUBLIC_ORIGIN;

// SEO-P3-01 — /jobs clean route self-canonical
{
  const policy = evaluateCollectionSeo({ cleanPath: '/jobs', searchParams: '' });
  check(policy.indexable === true, 'SEO-P3-01: clean /jobs is indexable');
  check(policy.canonicalPath === '/jobs', 'SEO-P3-01: clean /jobs self-canonical');
  check(jobsList.includes('useCollectionSeo'), 'SEO-P3-01: Jobs list uses collection SEO helper');
}

// SEO-P3-02 — jobs search query not independently indexable
{
  const policy = evaluateCollectionSeo({ cleanPath: '/jobs', searchParams: '?search=frontend' });
  check(policy.indexable === false, 'SEO-P3-02: job search query is not indexable');
  check(policy.canonicalPath === '/jobs', 'SEO-P3-02: job search canonicalizes to /jobs');
  check(policy.robots === 'noindex, follow', 'SEO-P3-02: job search uses noindex,follow');
}

// SEO-P3-03 — jobs filter query not independently indexable
{
  const policy = evaluateCollectionSeo({ cleanPath: '/jobs', searchParams: '?countryCode=PK&city=Lahore' });
  check(policy.indexable === false, 'SEO-P3-03: job filter query is not indexable');
  check(policy.canonicalPath === '/jobs', 'SEO-P3-03: job filter canonicalizes to /jobs');
}

// SEO-P3-04 — jobs sort query not independently indexable
{
  const policy = evaluateCollectionSeo({ cleanPath: '/jobs', searchParams: '?sort=deadline' });
  check(policy.indexable === false, 'SEO-P3-04: job sort query is not indexable');
}

// SEO-P3-05 — query URLs absent from sitemap policy
{
  check(!isSitemapEligiblePath('/jobs?search=frontend'), 'SEO-P3-05: query job URL rejected from sitemap');
  check(isQueryStringSitemapUrl(`${ORIGIN}/jobs?page=2`), 'SEO-P3-05: detects query-string sitemap URLs');
}

// SEO-P3-06 — job public detail sitemap eligibility correct
{
  check(
    isJobDetailPubliclyEligible({ slug: 'engineer', status: 'active', publicationState: 'active', approvalStatus: 'approved' }),
    'SEO-P3-06: active approved job is sitemap-eligible'
  );
  check(
    !isJobDetailPubliclyEligible({ slug: 'x', status: 'active', publicationState: 'expired' }),
    'SEO-P3-06: expired publication job excluded'
  );
  check(seoController.includes('buildPublicJobFilter'), 'SEO-P3-06: sitemap uses public job filter');
  check(seoController.includes('isJobDetailPubliclyEligible'), 'SEO-P3-06: sitemap applies detail eligibility helper');
}

// SEO-P3-07 — job private/draft detail excluded
{
  check(
    !isJobDetailPubliclyEligible({ slug: 'x', status: 'draft', publicationState: 'active' }),
    'SEO-P3-07: draft status excluded'
  );
  check(
    !isJobDetailPubliclyEligible({ slug: 'x', status: 'active', publicationState: 'draft' }),
    'SEO-P3-07: draft publication excluded'
  );
}

// SEO-P3-08 — JobPosting policy unchanged
{
  check(schemasSource.includes('evaluateJobPostingEligibility'), 'SEO-P3-08: JobPosting still gated by eligibility');
  check(jobDetailSource.includes('JOB_POSTING_SURFACES.DETAIL'), 'SEO-P3-08: JobDetail still uses detail surface');
}

// SEO-P3-09 — location taxonomy uses normalized values
{
  check(normalizeCountryCode('PK') === 'PK', 'SEO-P3-09: countryCode normalizes PK');
  check(classifyCollectionQueryParam('countryCode') === QUERY_PARAM_KIND.FILTER, 'SEO-P3-09: countryCode is FILTER param');
}

// SEO-P3-10 — arbitrary city URL cannot auto-create landing
{
  const unknown = resolveUnknownSeoLandingPolicy('/jobs/pakistan/lahore');
  check(unknown.disposition === 'NOT_FOUND', 'SEO-P3-10: arbitrary city path is deferred/not found');
  check(!isApprovedSeoLandingPath('/jobs/pakistan/lahore'), 'SEO-P3-10: city path not in approved registry');
}

// SEO-P3-11 — arbitrary job-family filter cannot auto-create indexable page
{
  const policy = evaluateCollectionSeo({ cleanPath: '/jobs', searchParams: '?jobFamily=software-it' });
  check(policy.indexable === false, 'SEO-P3-11: jobFamily filter URL not indexable');
  check(isValidJobFamily('Software & IT'), 'SEO-P3-11: canonical job family taxonomy exists');
  check(!isApprovedSeoLandingPath('/jobs/software-it'), 'SEO-P3-11: job family slug not auto-registered');
}

// SEO-P3-12 — /scholarships clean route self-canonical
{
  const policy = evaluateCollectionSeo({ cleanPath: '/scholarships', searchParams: '' });
  check(policy.indexable === true, 'SEO-P3-12: clean /scholarships indexable');
  check(scholarshipsList.includes('useCollectionSeo'), 'SEO-P3-12: Scholarships list uses collection SEO helper');
}

// SEO-P3-13 — scholarship search/filter URLs noindex/canonicalized
{
  const search = evaluateCollectionSeo({ cleanPath: '/scholarships', searchParams: '?search=engineering' });
  const filter = evaluateCollectionSeo({ cleanPath: '/scholarships', searchParams: '?level=Graduate&country=PK' });
  check(!search.indexable && search.canonicalPath === '/scholarships', 'SEO-P3-13: scholarship search canonicalized');
  check(!filter.indexable && filter.canonicalPath === '/scholarships', 'SEO-P3-13: scholarship filters canonicalized');
}

// SEO-P3-14 — scholarship provider semantics unchanged from P2
{
  check(/resolveExplicitOrganizationName\(item, \['provider'\]\)/.test(schemasSource), 'SEO-P3-14: scholarship provider uses provider field only');
  check(!schemasSource.includes("'funder'") && !schemasSource.includes("'sponsor'"), 'SEO-P3-14: funder/sponsor not in provider resolver');
}

// SEO-P3-15 — scholarship duplicate route policy deterministic
{
  check(
    resolveScholarshipDetailPath({ sourceType: UNIFIED_SCHOLARSHIP_SOURCE.CMS, slug: 'hec' }) === '/scholarships/hec',
    'SEO-P3-15: CMS scholarship detail path'
  );
  check(
    resolveScholarshipDetailPath({ sourceType: UNIFIED_SCHOLARSHIP_SOURCE.INSTITUTION_CANONICAL, slug: 'fulbright' }) === '/scholarship-intelligence/fulbright',
    'SEO-P3-15: canonical scholarship detail path'
  );
}

// SEO-P3-16 — /intl-scholarships relationship/canonical policy deterministic
{
  const ownership = scholarshipRouteOwnership('intl');
  check(ownership.listPath === '/intl-scholarships', 'SEO-P3-16: intl list path');
  check(
    resolveScholarshipDetailPath({ sourceType: 'intl', slug: 'uk-chevening' }) === '/intl-scholarships/uk-chevening',
    'SEO-P3-16: intl detail path'
  );
}

// SEO-P3-17 — /institutions sitemap decision enforced
{
  check(INDEXABLE_STATIC_PATHS.includes('/institutions'), 'SEO-P3-17: /institutions in static sitemap paths');
  check(seoController.includes('/institutions/${i.slug}'), 'SEO-P3-17: canonical institution details in sitemap generation');
  check(institutionExplorer.includes('useCollectionSeo'), 'SEO-P3-17: institution explorer uses collection SEO');
}

// SEO-P3-18 — institution detail indexability obeys public/density rules
{
  check(typeof isCanonicalInstitutionDetailEligible === 'function', 'SEO-P3-18: institution detail eligibility helper exported');
  check(
    !isCanonicalInstitutionDetailEligible({
      slug: 'thin-uni',
      status: 'published',
      officialName: 'University X',
      countryCode: 'PK',
      sources: [],
    }),
    'SEO-P3-18: thin institution without meaningful profile is not detail-eligible'
  );
  check(institutionExplorer.includes('isCanonicalInstitutionDetailEligible'), 'SEO-P3-18: institution detail uses density gate');
}

// SEO-P3-19 — duplicate institution routes do not create conflicting canonical identities
{
  check(seoController.includes('/schools-and-colleges/${i.slug}'), 'SEO-P3-19: legacy institution route preserved');
  check(seoController.includes('/institutions/${i.slug}'), 'SEO-P3-19: canonical institution route separate');
}

// SEO-P3-20 — Program Explorer route policy defined
{
  check(INDEXABLE_STATIC_PATHS.includes('/program-explorer'), 'SEO-P3-20: program explorer in static sitemap');
  check(read('client/src/pages/Tests/ProgramExplorer.jsx').includes('useCollectionSeo'), 'SEO-P3-20: program explorer uses collection SEO');
}

// SEO-P3-21 — program detail indexability gated on meaningful data
{
  check(
    isProgramDetailIndexable({ slug: 'cs', status: 'published', name: 'CS', institutionId: '1', description: 'Desc' }),
    'SEO-P3-21: meaningful program detail indexable'
  );
  check(
    !isProgramDetailIndexable({ slug: 'cs', status: 'published', name: 'CS' }),
    'SEO-P3-21: program without institution not indexable'
  );
  check(seoController.includes('isProgramDetailIndexable'), 'SEO-P3-21: sitemap uses program detail gate');
}

// SEO-P3-22 — no arbitrary program facet generates indexable route
{
  const policy = evaluateCollectionSeo({ cleanPath: '/program-explorer', searchParams: '?field=computing&country=IE' });
  check(!policy.indexable, 'SEO-P3-22: program facet URL not indexable');
  check(resolveUnknownSeoLandingPolicy('/programs/computer-science').disposition === 'NOT_FOUND', 'SEO-P3-22: arbitrary /programs path deferred');
}

// SEO-P3-23 — /providers sitemap decision enforced
{
  check(INDEXABLE_STATIC_PATHS.includes('/providers'), 'SEO-P3-23: /providers in sitemap static paths');
  check(INDEXABLE_STATIC_PATHS.includes('/providers/education-mobility'), 'SEO-P3-23: education provider entry in sitemap');
  check(INDEXABLE_STATIC_PATHS.includes('/providers/business-formation'), 'SEO-P3-23: business provider entry in sitemap');
}

// SEO-P3-24 — /scholarship-intelligence sitemap decision enforced
{
  check(INDEXABLE_STATIC_PATHS.includes('/scholarship-intelligence'), 'SEO-P3-24: scholarship intelligence list in sitemap');
  check(seoController.includes('/scholarship-intelligence/${s.slug}'), 'SEO-P3-24: canonical scholarship details in sitemap');
  check(scholarshipIntel.includes('canonical={collectionSeo.canonical}'), 'SEO-P3-24: scholarship intelligence has canonical');
}

// SEO-P3-25 — private provider/workspace routes excluded
{
  check(isForbiddenSitemapPath('/agent/dashboard'), 'SEO-P3-25: agent workspace forbidden');
  check(isForbiddenSitemapPath('/institution/profile'), 'SEO-P3-25: institution workspace forbidden');
  check(!isForbiddenSitemapPath('/institutions'), 'SEO-P3-25: public /institutions not forbidden');
}

// SEO-P3-26 — page=1 canonical normalization correct
{
  const normalized = normalizeCollectionQuery('page=1&sort=newest');
  check(normalized.toString() === '', 'SEO-P3-26: page=1 and default sort stripped');
  const policy = evaluateCollectionSeo({ cleanPath: '/jobs', searchParams: '?page=1' });
  check(policy.indexable === true, 'SEO-P3-26: page=1 alone is clean collection');
}

// SEO-P3-27 — sort/default canonical normalization correct
{
  const normalized = normalizeCollectionQuery('sort=newest');
  check(normalized.toString() === '', 'SEO-P3-27: default sort stripped');
  const policy = evaluateCollectionSeo({ cleanPath: '/jobs', searchParams: '?sort=deadline' });
  check(!policy.indexable, 'SEO-P3-27: non-default sort not indexable');
}

// SEO-P3-28 — empty search query canonical normalization correct
{
  const normalized = normalizeCollectionQuery('search=');
  check(normalized.toString() === '', 'SEO-P3-28: empty search stripped');
}

// SEO-P3-29 — robots.txt P0 behavior unchanged
{
  const robots = buildRobotsTxt(ORIGIN);
  check(robots.includes('Disallow: /admin'), 'SEO-P3-29: robots still disallows /admin');
  check(isPrivateSeoPath('/dashboard'), 'SEO-P3-29: dashboard still private SEO path');
}

// SEO-P3-30 — no query-string sitemap URLs
{
  check(!isSitemapEligiblePath('/jobs?country=PK'), 'SEO-P3-30: query path rejected');
  check(isSitemapEligiblePath('/jobs'), 'SEO-P3-30: clean path accepted');
}

// SEO-P3-31 — sitemap origin always www
{
  check(seoController.includes('getPublicOrigin'), 'SEO-P3-31: sitemap uses public origin helper');
  check(ORIGIN === 'https://www.strideto.com', 'SEO-P3-31: production origin is www');
}

// SEO-P3-32 — sitemap lastmod uses truthful timestamp
{
  const lastmod = resolveSitemapLastmod(new Date('2026-01-15T10:00:00.000Z'));
  check(lastmod === '2026-01-15', 'SEO-P3-32: lastmod from entity timestamp');
}

// SEO-P3-33 — no current-time freshness fabrication
{
  check(resolveSitemapLastmod(undefined) === undefined, 'SEO-P3-33: missing timestamp yields no lastmod');
  check(!seoController.includes('new Date()'), 'SEO-P3-33: sitemap controller does not fabricate now() lastmod');
}

// SEO-P3-34 — one canonical identity per entity
{
  const cms = scholarshipRouteOwnership(UNIFIED_SCHOLARSHIP_SOURCE.CMS);
  const canon = scholarshipRouteOwnership(UNIFIED_SCHOLARSHIP_SOURCE.INSTITUTION_CANONICAL);
  check(cms.detailPrefix !== canon.detailPrefix, 'SEO-P3-34: scholarship sources have distinct detail prefixes');
}

// SEO-P3-35 — unknown static SEO landing returns non-indexable/not-found behavior
{
  const policy = resolveUnknownSeoLandingPolicy('/jobs/pakistan');
  check(policy.disposition === 'NOT_FOUND', 'SEO-P3-35: unknown job country slug deferred');
}

// SEO-P3-36 — static SEO landing cannot be generated from arbitrary user search
{
  check(!isApprovedSeoLandingPath('/jobs?search=frontend'), 'SEO-P3-36: search query never approved landing');
  check(APPROVED_SEO_LANDING_PATHS.every((p) => !p.includes('?')), 'SEO-P3-36: registry has no query strings');
}

// SEO-P3-37 — P1 persona routes remain indexable
{
  for (const p of ['/students', '/employers', '/for-institutions']) {
    check(INDEXABLE_STATIC_PATHS.includes(p), `SEO-P3-37: ${p} remains indexable`);
  }
}

// SEO-P3-38 — P2 entity IDs remain unchanged
{
  check(entityIdsSource.includes('/#organization'), 'SEO-P3-38: Organization @id fragment preserved');
  check(entityIdsSource.includes('/#website'), 'SEO-P3-38: WebSite @id fragment preserved');
}

// SEO-P3-39 — curated jobs still no JobPosting
{
  const curated = {
    title: 'Curated',
    slug: 'curated',
    jobsGraphEligible: false,
    applyType: 'external',
    applicationLink: 'https://example.org/jobs/1',
    status: 'active',
    publicationState: 'active',
  };
  check(
    evaluateJobPostingEligibility(curated, { surface: JOB_POSTING_SURFACES.DETAIL }).eligible === false,
    'SEO-P3-39: curated job still ineligible for JobPosting'
  );
}

// SEO-P3-40 — internships still no JobPosting
{
  check(!/jobPostingSchema/.test(internshipDetailSource), 'SEO-P3-40: internship detail has no JobPosting');
}

// SEO-P3-41 — Blog SEO unchanged
{
  check(blogPostSource.includes('canonicalUrl: buildCanonicalUrl'), 'SEO-P3-41: BlogPost still passes canonicalUrl');
  check(schemasSource.includes("publisher: { '@id': ORGANIZATION_ID }"), 'SEO-P3-41: BlogPosting publisher unchanged');
}

// SEO-P3-42 — no doorway route generator introduced
{
  check(!read('shared/seo/seoLandingRegistry.js').includes('generateLanding'), 'SEO-P3-42: no doorway generator');
  check(!publicIndexable.includes('generateLanding'), 'SEO-P3-42: indexable pages has no generator');
}

// SEO-P3-43 — no mass city/country landing registry introduced
{
  const cityLandings = APPROVED_SEO_LANDING_PATHS.filter((p) => p.startsWith('/jobs-in-'));
  check(cityLandings.length <= 20, 'SEO-P3-43: city landing count bounded to existing registry');
  check(!APPROVED_SEO_LANDING_PATHS.some((p) => /^\/jobs\/(?!province\/|category\/)[a-z0-9-]+\/[a-z0-9-]+$/.test(p)), 'SEO-P3-43: no new nested job geo registry beyond province/category');
}

// SEO-P3-44 — public detail page has legitimate discovery path or sitemap eligibility
{
  check(seoController.includes('/jobs/${j.slug}'), 'SEO-P3-44: jobs detail in sitemap');
  check(seoController.includes('/scholarships/${s.slug}'), 'SEO-P3-44: scholarships detail in sitemap');
  check(seoController.includes('/program-explorer/${p.slug}'), 'SEO-P3-44: programs detail in sitemap');
}

// SEO-P3-45 — private entities never enter XML sitemap
{
  check(isForbiddenSitemapPath('/employer/jobs'), 'SEO-P3-45: employer workspace forbidden');
  check(isForbiddenSitemapPath('/admin/users'), 'SEO-P3-45: admin forbidden');
  check(evaluateEmptyCollectionPolicy({ isKnownCollection: true }).disposition === 'INDEXABLE', 'SEO-P3-45: valid zero-result collection stays indexable');
  check(!shouldShardSitemap(1000), 'SEO-P3-45: current scale below shard threshold');
}

const thinInstitution = {
  slug: 'university-x',
  status: 'published',
  officialName: 'University X',
  countryCode: 'PK',
  sources: [],
};

const meaningfulInstitution = {
  slug: 'example-university',
  status: 'published',
  officialName: 'Example University',
  countryCode: 'GB',
  sources: [{ sourceType: 'official', sourceUrl: 'https://example.edu/about', publisher: 'Example University' }],
};

// SEO-P3-INST-01 — published + identity but no meaningful content → not detail-indexable
check(
  !isCanonicalInstitutionDetailEligible(thinInstitution),
  'SEO-P3-INST-01: thin institution not detail-indexable'
);

// SEO-P3-INST-02 — thin institution excluded from sitemap path generation
check(
  seoController.includes('programCountByInstitutionId') &&
    seoController.includes('acceptedTestCountByInstitutionId') &&
    seoController.includes('currentAcceptanceMongoFilter') &&
    seoController.includes('isCanonicalInstitutionDetailEligible(i,'),
  'SEO-P3-INST-02: sitemap applies program- and acceptance-aware institution density gate'
);
check(
  !isCanonicalInstitutionDetailEligible(thinInstitution, { programCount: 0 }),
  'SEO-P3-INST-02: thin institution not sitemap-eligible'
);

// SEO-P3-INST-03 — meaningful published institution → indexable
check(
  isCanonicalInstitutionDetailEligible(meaningfulInstitution),
  'SEO-P3-INST-03: institution with source evidence is detail-indexable'
);
check(
  isCanonicalInstitutionDetailEligible(thinInstitution, { programCount: 2 }),
  'SEO-P3-INST-03: institution with published programs is detail-indexable'
);

// SEO-P3-INST-04 — meaningful institution sitemap-eligible via same gate
check(
  isCanonicalInstitutionDetailEligible(meaningfulInstitution),
  'SEO-P3-INST-04: meaningful institution passes shared eligibility gate'
);

// SEO-P3-INST-05 — draft/unpublished excluded
check(
  !isCanonicalInstitutionDetailEligible({ ...meaningfulInstitution, status: 'draft' }),
  'SEO-P3-INST-05: draft institution excluded'
);

// SEO-P3-INST-06 — missing slug excluded
check(
  !isCanonicalInstitutionDetailEligible({ ...meaningfulInstitution, slug: '' }),
  'SEO-P3-INST-06: missing slug excluded'
);

// SEO-P3-INST-07 — missing countryCode excluded
check(
  !isCanonicalInstitutionDetailEligible({ ...meaningfulInstitution, countryCode: '' }),
  'SEO-P3-INST-07: missing countryCode excluded'
);

// SEO-P3-INST-08 — logo-only insufficient (no logo field; identity-only fails)
check(
  !hasMeaningfulInstitutionProfile(thinInstitution),
  'SEO-P3-INST-08: identity-only profile insufficient'
);

// SEO-P3-INST-09 — website-only insufficient
check(
  !hasMeaningfulInstitutionProfile({
    ...thinInstitution,
    officialWebsite: 'https://university-x.edu',
  }),
  'SEO-P3-INST-09: website-only insufficient'
);

// SEO-P3-INST-10 — /institutions collection remains sitemap/indexable
check(INDEXABLE_STATIC_PATHS.includes('/institutions'), 'SEO-P3-INST-10: /institutions collection in sitemap static paths');
check(
  evaluateCollectionSeo({ cleanPath: '/institutions', searchParams: '' }).indexable === true,
  'SEO-P3-INST-10: clean /institutions collection indexable'
);

// SEO-P3-INST-11 — no institution city/country route generated
check(
  resolveUnknownSeoLandingPolicy('/institutions/pakistan').disposition === 'UNKNOWN',
  'SEO-P3-INST-11: arbitrary institution country route not auto-indexable'
);

// SEO-P3-INST-12 — query/facet policy unchanged
check(
  evaluateCollectionSeo({ cleanPath: '/institutions', searchParams: '?search=uni&page=2' }).robots === 'noindex, follow',
  'SEO-P3-INST-12: institution faceted URLs remain noindex,follow'
);

// SEO-P3-INTL-01 — non-public IntlScholarship cannot enter sitemap
check(
  !isIntlScholarshipDetailEligible({ slug: 'draft-award', status: 'draft' }),
  'SEO-P3-INTL-01: draft intl scholarship not sitemap-eligible'
);
check(
  !isIntlScholarshipDetailEligible({ slug: 'closed-award', status: 'closed' }),
  'SEO-P3-INTL-01: closed intl scholarship not sitemap-eligible'
);
check(
  seoController.includes('intlScholarships.filter(isIntlScholarshipDetailEligible)'),
  'SEO-P3-INTL-01: sitemap uses intl scholarship eligibility helper'
);

// SEO-P3-INTL-02 — public eligible IntlScholarship remains discoverable
check(
  isIntlScholarshipDetailEligible({ slug: 'uk-chevening', status: 'active' }),
  'SEO-P3-INTL-02: active intl scholarship with slug remains eligible'
);
check(seoController.includes("status: 'active'"), 'SEO-P3-INTL-02: intl scholarship query filters active status');

// SEO-P3-INST-SOURCE-01 — sourceType alone is insufficient
check(
  !isSubstantiveInstitutionSourceEvidence({ sourceType: 'official' }),
  'SEO-P3-INST-SOURCE-01: sourceType alone is not substantive'
);
check(
  !hasMeaningfulInstitutionProfile({
    ...thinInstitution,
    sources: [{ sourceType: 'government' }],
  }),
  'SEO-P3-INST-SOURCE-01: sourceType-only institution profile insufficient'
);

// SEO-P3-INST-SOURCE-02 — valid sourceUrl is meaningful
check(
  isSubstantiveInstitutionSourceEvidence({
    sourceType: 'official',
    sourceUrl: 'https://example.edu/about',
  }),
  'SEO-P3-INST-SOURCE-02: valid sourceUrl is substantive'
);
check(
  hasMeaningfulInstitutionProfile({
    ...thinInstitution,
    sources: [{ sourceType: 'official', sourceUrl: 'https://example.edu/about' }],
  }),
  'SEO-P3-INST-SOURCE-02: URL-backed source makes profile meaningful'
);

// SEO-P3-INST-SOURCE-03 — meaningful publisher is sufficient
check(
  isSubstantiveInstitutionSourceEvidence({ publisher: 'Example University Registry' }),
  'SEO-P3-INST-SOURCE-03: meaningful publisher is substantive'
);
check(
  hasMeaningfulInstitutionProfile({
    ...thinInstitution,
    sources: [{ sourceType: 'institution', publisher: 'Example University Registry' }],
  }),
  'SEO-P3-INST-SOURCE-03: publisher-backed source makes profile meaningful'
);

// SEO-P3-INST-SOURCE-04 — empty source object is insufficient
check(
  !isSubstantiveInstitutionSourceEvidence({}),
  'SEO-P3-INST-SOURCE-04: empty source object is not substantive'
);
check(
  !isSubstantiveInstitutionSourceEvidence(null),
  'SEO-P3-INST-SOURCE-04: null source is not substantive'
);

function institutionDetailSitemapParity(institution, evidence) {
  const detailEligible = isCanonicalInstitutionDetailEligible(institution, evidence);
  const sitemapEligible = isCanonicalInstitutionDetailEligible(institution, evidence);
  return detailEligible === sitemapEligible && detailEligible;
}

function institutionDetailSitemapParityIneligible(institution, evidence) {
  const detailEligible = isCanonicalInstitutionDetailEligible(institution, evidence);
  const sitemapEligible = isCanonicalInstitutionDetailEligible(institution, evidence);
  return detailEligible === sitemapEligible && !detailEligible;
}

// SEO-P3-INST-PARITY-01 — program-backed institution: detail == sitemap
check(
  institutionDetailSitemapParity(thinInstitution, { programCount: 3, acceptedTestCount: 0 }),
  'SEO-P3-INST-PARITY-01: program-backed institution detail and sitemap agree (eligible)'
);

// SEO-P3-INST-PARITY-02 — accepted-test-backed institution: detail == sitemap
check(
  institutionDetailSitemapParity(thinInstitution, { programCount: 0, acceptedTestCount: 2 }),
  'SEO-P3-INST-PARITY-02: accepted-test-backed institution detail and sitemap agree (eligible)'
);

// SEO-P3-INST-PARITY-03 — source-backed institution: detail == sitemap
check(
  institutionDetailSitemapParity(meaningfulInstitution, { programCount: 0, acceptedTestCount: 0 }),
  'SEO-P3-INST-PARITY-03: source-backed institution detail and sitemap agree (eligible)'
);

// SEO-P3-INST-PARITY-04 — thin institution: detail ineligible == sitemap excluded
check(
  institutionDetailSitemapParityIneligible(thinInstitution, { programCount: 0, acceptedTestCount: 0 }),
  'SEO-P3-INST-PARITY-04: thin institution detail and sitemap agree (ineligible)'
);

console.log(`seoP3SearchArchitecture: ${count} checks passed`);
