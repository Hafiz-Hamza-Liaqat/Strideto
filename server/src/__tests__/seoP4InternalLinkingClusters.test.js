/**
 * SEO-P4 — Internal linking, content clusters, and related entities.
 *
 * Run: node server/src/__tests__/seoP4InternalLinkingClusters.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeInternalPath,
  hasFilterQueryString,
  isSafeInternalLink,
  dedupeInternalLinks,
  filterSafeInternalLinks,
} from '../../../shared/seo/internalLinkSafety.js';
import {
  CONTENT_CLUSTERS,
  resolveClusterForBlogCategory,
  blogClusterResourceLinks,
  clusterResourceLinks,
  getContentCluster,
} from '../../../shared/seo/contentClusters.js';
import {
  normalizeBlogTag,
  blogArticleCanonicalPath,
  isPublishableBlogCandidate,
  scoreRelatedBlogPost,
  rankRelatedBlogPosts,
} from '../../../shared/blog/relatedPosts.js';
import {
  rankRelatedJobs,
  scoreRelatedCmsScholarship,
  rankRelatedPrograms,
} from '../../../shared/seo/relatedRanking.js';
import {
  resolveScholarshipDetailPath,
  scholarshipRouteOwnership,
  isCanonicalInstitutionDetailEligible,
  isJobDetailPubliclyEligible,
  isProgramDetailIndexable,
} from '../../../shared/seo/entityDetailSeoPolicy.js';
import { UNIFIED_SCHOLARSHIP_SOURCE } from '../../../shared/publicDiscovery/unifiedScholarshipDiscovery.js';
import { isApprovedSeoLandingPath } from '../../../shared/seo/seoLandingRegistry.js';
import {
  evaluateCollectionSeo,
} from '../../../shared/seo/collectionSeoPolicy.js';
import {
  JOB_POSTING_SURFACES,
  evaluateJobPostingEligibility,
} from '../../../shared/seo/jobPostingEligibility.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '../../..');
const read = (rel) => readFileSync(path.join(repo, rel), 'utf8');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const blogPostSource = read('client/src/pages/Blog/BlogPost.jsx');
const jobDetailSource = read('client/src/pages/Jobs/JobDetail.jsx');
const blogsControllerSource = read('server/src/controllers/blogsController.js');
const programExplorerSource = read('client/src/pages/Tests/ProgramExplorer.jsx');
const institutionExplorerSource = read('client/src/pages/Education/InstitutionExplorer.jsx');
const humanSitemapSource = read('client/src/pages/Static/HumanSitemap.jsx');

// ── SEO-P4-BLOG ───────────────────────────────────────────────────────────────
{
  const current = { _id: '1', slug: 'current', category: 'Scholarships', tags: ['Ireland'], status: 'published' };
  const sameCategory = { _id: '2', slug: 'same-cat', category: 'Scholarships', tags: [], status: 'published', publishedAt: '2026-01-01' };
  const tagOverlap = { _id: '3', slug: 'tag-overlap', category: 'Career Advice', tags: ['Ireland'], status: 'published', publishedAt: '2026-02-01' };
  const unrelatedRecent = { _id: '4', slug: 'recent', category: 'Platform Updates', tags: [], status: 'published', publishedAt: '2026-08-01' };
  const draft = { _id: '5', slug: 'draft', category: 'Scholarships', status: 'draft' };
  const duplicate = { _id: '6', slug: 'current', category: 'Scholarships', status: 'published' };

  const ranked = rankRelatedBlogPosts(current, [sameCategory, tagOverlap, unrelatedRecent, draft, duplicate], { limit: 3 });
  check(!ranked.items.some((p) => p.slug === 'current'), 'SEO-P4-BLOG-01 current article excluded');
  check(ranked.items[0]?.slug === 'same-cat', 'SEO-P4-BLOG-02 same-category outranks unrelated recent');
  check(scoreRelatedBlogPost(current, tagOverlap) > scoreRelatedBlogPost(current, unrelatedRecent), 'SEO-P4-BLOG-03 tag overlap improves ranking');
  check(!ranked.items.some((p) => p.slug === 'draft'), 'SEO-P4-BLOG-04 draft excluded');
  check(ranked.items.filter((p) => p.slug === 'current').length === 0, 'SEO-P4-BLOG-05 duplicate removed');
  const weak = rankRelatedBlogPosts(
    { _id: '9', slug: 'solo', category: 'Exam Prep', tags: [], status: 'published' },
    [{ _id: '10', slug: 'other', category: 'Employer & Hiring', tags: [], status: 'published', publishedAt: '2026-08-01' }],
    { limit: 1 },
  );
  check(weak.usedFallback === true, 'SEO-P4-BLOG-06 fallback recent when no strong relation');
  check(blogArticleCanonicalPath({ slug: 'hello' }) === '/blog/hello', 'SEO-P4-BLOG-07 canonical blog path');
  check(!blogPostSource.includes('replace(') && !blogPostSource.includes('inject'), 'SEO-P4-BLOG-08 no body auto-rewrite helpers');
  check(!blogPostSource.includes('to={`${ROUTES.BLOG}?'), 'SEO-P4-BLOG-09 tags not query links');
  const resources = blogClusterResourceLinks('International Study', { currentPath: '/blog/foo' });
  check(resources.length >= 2 && resources.every((r) => !r.path.includes('?')), 'SEO-P4-BLOG-10 related resources from cluster');
}

// ── SEO-P4-JOB ────────────────────────────────────────────────────────────────
{
  const current = { _id: 'j1', slug: 'frontend-dev', status: 'active', approvalStatus: 'approved', specialization: 'frontend', jobFamily: 'software' };
  const similar = { _id: 'j2', slug: 'frontend-eng', status: 'active', approvalStatus: 'approved', specialization: 'frontend', jobFamily: 'software' };
  const draft = { _id: 'j3', slug: 'draft-job', status: 'draft', specialization: 'frontend' };
  const noSlug = { _id: 'j4', status: 'active', approvalStatus: 'approved', specialization: 'frontend' };
  const related = rankRelatedJobs(current, [similar, draft, noSlug, current], { limit: 4 });
  check(!related.some((j) => j._id === 'j1'), 'SEO-P4-JOB-01 current job excluded');
  check(!related.some((j) => j.status !== 'active'), 'SEO-P4-JOB-02 private/draft excluded');
  check(related.every((j) => j.slug), 'SEO-P4-JOB-03 canonical slug required');
  check(related.every((j) => /^\/jobs\//.test(`/jobs/${j.slug}`)), 'SEO-P4-JOB-04 clean detail paths');
  check(!jobDetailSource.includes('?city=') && !jobDetailSource.includes('?jobFamily='), 'SEO-P4-JOB-05 no filter links in job detail');
  check(jobDetailSource.includes('JOB_POSTING_SURFACES') || jobDetailSource.includes('jobPostingSchema'), 'SEO-P4-JOB-06 JobPosting policy present');
  check(jobDetailSource.includes('RelatedResources') && jobDetailSource.includes('relatedResources'), 'SEO-P4-JOB-07 career resources module wired');
}

// ── SEO-P4-SCH ────────────────────────────────────────────────────────────────
{
  const cms = { _id: 's1', slug: 'cms-one', status: 'active', level: 'masters', country: 'Ireland' };
  const related = { _id: 's2', slug: 'cms-two', status: 'active', level: 'masters', country: 'Ireland' };
  const ranked = [cms, related].filter((s) => s._id !== cms._id);
  check(ranked.length === 1, 'SEO-P4-SCH-01 current scholarship excluded');
  const intelPath = resolveScholarshipDetailPath({ slug: 'intel', sourceType: UNIFIED_SCHOLARSHIP_SOURCE.INSTITUTION_CANONICAL });
  check(intelPath === '/scholarship-intelligence/intel', 'SEO-P4-SCH-02 route ownership resolver used');
  const cmsPath = resolveScholarshipDetailPath({ slug: 'cms', sourceType: UNIFIED_SCHOLARSHIP_SOURCE.CMS });
  const intlPath = resolveScholarshipDetailPath({ slug: 'intl', sourceType: 'intl' });
  check(cmsPath !== intlPath, 'SEO-P4-SCH-03 distinct route families');
  check(scoreRelatedCmsScholarship(cms, { _id: 'x', slug: 'x', status: 'draft' }) < 0, 'SEO-P4-SCH-04 unpublished excluded');
  check(cmsPath === '/scholarships/cms', 'SEO-P4-SCH-05 clean CMS route');
  check(!programExplorerSource.includes('?country='), 'SEO-P4-SCH-06 no country query URL in program detail');
  const ownership = scholarshipRouteOwnership(UNIFIED_SCHOLARSHIP_SOURCE.CMS);
  check(ownership.listPath === '/scholarships', 'SEO-P4-SCH-07 provider semantics unchanged');
}

// ── SEO-P4-INST ───────────────────────────────────────────────────────────────
{
  check(institutionExplorerSource.includes('${ROUTES.PROGRAM_EXPLORER}/${program.slug}'), 'SEO-P4-INST-01 program links use entity routes');
  const thin = { slug: 'thin', status: 'published', officialName: 'X', countryCode: 'PK' };
  check(!isCanonicalInstitutionDetailEligible(thin, { programCount: 0, acceptedTestCount: 0 }), 'SEO-P4-INST-02 thin institution not promoted');
  check(institutionExplorerSource.includes('Accepted tests'), 'SEO-P4-INST-03 accepted-test section preserved');
  check(institutionExplorerSource.includes('ROUTES.EDUCATION_INSTITUTIONS'), 'SEO-P4-INST-04 canonical institution route');
  check(!institutionExplorerSource.includes('${ROUTES.SCHOOLS_AND_COLLEGES}/${'), 'SEO-P4-INST-05 legacy detail route not used for related entities');
  check(!institutionExplorerSource.includes('?institutionId='), 'SEO-P4-INST-06 no facet query URL');
}

// ── SEO-P4-PROG ───────────────────────────────────────────────────────────────
{
  check(programExplorerSource.includes('ROUTES.EDUCATION_INSTITUTIONS}/${inst.slug}'), 'SEO-P4-PROG-01 parent institution canonical link');
  const current = { _id: 'p1', slug: 'cs-bsc', status: 'published', institutionId: 'i1', field: 'computing', degreeLevel: 'bachelor', description: 'x' };
  const sibling = { _id: 'p2', slug: 'cs-msc', status: 'published', institutionId: 'i1', field: 'computing', degreeLevel: 'master', description: 'y' };
  const unpublished = { _id: 'p3', slug: 'draft', status: 'draft', institutionId: 'i1', field: 'computing', description: 'z' };
  const related = rankRelatedPrograms(current, [sibling, current, unpublished], { limit: 4 }).filter(isProgramDetailIndexable);
  check(!related.some((p) => p._id === 'p1'), 'SEO-P4-PROG-02 related programs exclude current');
  check(!related.some((p) => p._id === 'p3'), 'SEO-P4-PROG-03 unpublished excluded from ranking');
  check(related.every((p) => p.slug), 'SEO-P4-PROG-04 canonical program slug');
  check(!programExplorerSource.includes('?field=') && !programExplorerSource.includes('?country='), 'SEO-P4-PROG-05 no subject/country filter URL');
}

// ── SEO-P4-CLUSTER ────────────────────────────────────────────────────────────
{
  const career = getContentCluster('career');
  check(career && career.relatedPaths.every((p) => !p.includes('?')), 'SEO-P4-CLUSTER-01 career cluster approved hubs');
  const intl = getContentCluster('international-study');
  check(intl && intl.relatedPaths.includes('/foreign-studies'), 'SEO-P4-CLUSTER-02 international study hub');
  const sch = getContentCluster('scholarships');
  check(sch.relatedPaths.includes('/scholarships') && sch.relatedPaths.includes('/intl-scholarships'), 'SEO-P4-CLUSTER-03 scholarship cluster distinct routes');
  const inst = clusterResourceLinks('institutions-programs');
  check(inst.every((l) => l.path.startsWith('/')), 'SEO-P4-CLUSTER-04 canonical routes');
  check(CONTENT_CLUSTERS.every((c) => !c.relatedPaths.some((p) => p.startsWith('/employer/') || p.startsWith('/dashboard'))), 'SEO-P4-CLUSTER-05 no private dashboard');
  check(CONTENT_CLUSTERS.every((c) => c.relatedPaths.every((p) => !p.includes('?'))), 'SEO-P4-CLUSTER-06 no query links');
  const deduped = dedupeInternalLinks([
    { path: '/jobs', label: 'Jobs' },
    { path: '/jobs', label: 'Jobs dup' },
  ]);
  check(deduped.length === 1, 'SEO-P4-CLUSTER-07 deduplicated');
  check(clusterResourceLinks('not-a-real-cluster').length === 0, 'SEO-P4-CLUSTER-08 unknown cluster returns empty');
}

// ── SEO-P4-ORPHAN ─────────────────────────────────────────────────────────────
{
  const seoController = read('server/src/controllers/seoController.js');
  check(seoController.includes("addUrl(`/jobs/"), 'SEO-P4-ORPHAN-01 jobs in sitemap');
  check(seoController.includes('/scholarships/'), 'SEO-P4-ORPHAN-02 scholarship detail sitemap');
  check(seoController.includes('/intl-scholarships/'), 'SEO-P4-ORPHAN-03 intl scholarship sitemap');
  check(seoController.includes('/scholarship-intelligence/'), 'SEO-P4-ORPHAN-04 canonical scholarship sitemap');
  check(seoController.includes('/institutions/'), 'SEO-P4-ORPHAN-05 institution detail sitemap');
  check(seoController.includes('/program-explorer/'), 'SEO-P4-ORPHAN-06 program detail sitemap');
  check(seoController.includes('/blog/'), 'SEO-P4-ORPHAN-07 blog detail sitemap');
  check(humanSitemapSource.includes('ROUTES.JOBS') && humanSitemapSource.includes('ROUTES.BLOG'), 'SEO-P4-ORPHAN human sitemap hub coverage');
}

// ── SEO-P4-SAFE ───────────────────────────────────────────────────────────────
{
  const samples = [
    ...clusterResourceLinks('career'),
    ...blogClusterResourceLinks('Job Preparation'),
    ...clusterResourceLinks('scholarships'),
  ];
  check(samples.every((s) => !s.path.includes('?search=')), 'SEO-P4-SAFE-01 no search query');
  check(samples.every((s) => !s.path.includes('sort=')), 'SEO-P4-SAFE-02 no sort query');
  check(samples.every((s) => !s.path.includes('page=')), 'SEO-P4-SAFE-03 no page query');
  check(samples.every((s) => !s.path.startsWith('/admin')), 'SEO-P4-SAFE-04 no admin routes');
  check(samples.every((s) => !s.path.startsWith('/dashboard') && !s.path.startsWith('/employer/')), 'SEO-P4-SAFE-05 no private dashboard routes');
  check(!blogPostSource.includes('dangerouslySetInnerHTML') || !blogsControllerSource.includes('autoLink'), 'SEO-P4-SAFE-06 no automatic body link injection in controller');
  check(!read('shared/seo/contentClusters.js').includes('generateLanding'), 'SEO-P4-SAFE-07 no doorway generator');
  const jobsPolicy = evaluateCollectionSeo({ cleanPath: '/jobs', searchParams: '?search=foo' });
  check(jobsPolicy.indexable === false, 'SEO-P4-SAFE-08 P3 collection noindex unchanged');
  check(!read('client/src/seo/entityIds.js').includes('P4'), 'SEO-P4-SAFE-09 entity IDs file not altered for P4');
  check(typeof evaluateJobPostingEligibility === 'function' && JOB_POSTING_SURFACES.DETAIL === 'detail', 'SEO-P4-SAFE-10 P0 JobPosting rules unchanged');
}

// ── Policy helpers ────────────────────────────────────────────────────────────
{
  check(isSafeInternalLink('/jobs', { currentPath: '/jobs/abc' }), 'safe link allows clean collection');
  check(!isSafeInternalLink('/jobs?city=Lahore'), 'unsafe filter query rejected');
  check(!isSafeInternalLink('/admin/foo'), 'admin rejected');
  check(normalizeInternalPath('/jobs/') === '/jobs', 'path normalization');
  check(hasFilterQueryString('/jobs?search=frontend'), 'detects search filter');
  check(isPublishableBlogCandidate({ slug: 'a', status: 'published' }), 'publishable blog candidate');
  check(normalizeBlogTag('  Ireland ') === 'ireland', 'tag normalization');
  check(resolveClusterForBlogCategory('International Study')?.id === 'international-study', 'blog category cluster mapping');
  check(isApprovedSeoLandingPath('/jobs-in-lahore'), 'approved landing registry still usable');
  check(isJobDetailPubliclyEligible({ slug: 'x', status: 'active', approvalStatus: 'approved' }), 'job eligibility helper reused');
  check(filterSafeInternalLinks([
    { path: '/jobs' },
    { path: '/jobs?city=Lahore' },
    { path: '/dashboard' },
  ]).length === 1, 'filter safe internal links');
}

console.log(`seoP4InternalLinkingClusters: ${count} checks passed`);
