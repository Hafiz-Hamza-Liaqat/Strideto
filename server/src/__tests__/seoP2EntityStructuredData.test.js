/**
 * SEO-P2 — Entity graph + structured-data normalization regression coverage.
 *
 * Run: node server/src/__tests__/seoP2EntityStructuredData.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import { PRODUCTION_PUBLIC_ORIGIN } from '../../../shared/seo/publicSiteOrigin.js';
import { organizationSameAsUrls } from '../../../shared/social/officialSocialLinks.js';
import { isPrivateSeoPath } from '../../../shared/seo/robotsPolicy.js';
import { JOB_POSTING_SURFACES } from '../../../shared/seo/jobPostingEligibility.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '../../..');
const read = (rel) => readFileSync(path.join(repo, rel), 'utf8');

const schemasSource = read('client/src/seo/schemas.js');
const entityIdsSource = read('client/src/seo/entityIds.js');
const sanitizeSource = read('client/src/seo/sanitize.js');
const globalSeoSource = read('client/src/components/seo/GlobalSeo.jsx');
const seoHeadSource = read('client/src/components/seo/SeoHead.jsx');
const personaSource = read('client/src/components/static/PersonaAcquisitionPage.jsx');
const blogPostSource = read('client/src/pages/Blog/BlogPost.jsx');
const jobDetailSource = read('client/src/pages/Jobs/JobDetail.jsx');
const internshipDetailSource = read('client/src/pages/Internships/InternshipDetail.jsx');
const jobsListSource = read('client/src/pages/Jobs/Jobs.jsx');

const fileUrl = (rel) => pathToFileURL(path.join(repo, rel)).href;
const configStub = [
  `const SITE_URL = ${JSON.stringify(PRODUCTION_PUBLIC_ORIGIN)};`,
  "const SITE_NAME = 'Strideto';",
  "const DEFAULT_DESCRIPTION = 'test description';",
  `const DEFAULT_OG_IMAGE = ${JSON.stringify(`${PRODUCTION_PUBLIC_ORIGIN}/og-image.png`)};`,
  `export function buildCanonicalUrl(path = '/') {
    if (!path) return SITE_URL;
    if (path.startsWith('http')) return path.replace(/\\/$/, '') || path;
    const normalized = path.startsWith('/') ? path : \`/\${path}\`;
    if (normalized === '/') return SITE_URL;
    return \`\${SITE_URL}\${normalized.replace(/\\/$/, '')}\`;
  }`,
  'export { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE };',
].join('\n');

const stripConfigImport = (source) =>
  source.replace(/^import\s*\{[\s\S]*?\}\s*from\s*'\.\/config\.js';\n?/m, '');

const entityIdsModuleSource = stripConfigImport(entityIdsSource);

const schemasBundled = `${configStub}\n${entityIdsModuleSource}\n${stripConfigImport(schemasSource)
  .replace(/^import \{[^}]*\} from '\.\/entityIds\.js';\n/m, '')
  .replace(/^export \{[\s\S]*?\} from '\.\/entityIds\.js';\n/m, '')}`;

const schemasModule = await import(
  `data:text/javascript;base64,${Buffer.from(
    schemasBundled
      .replace(/'\.\/sanitize\.js'/, `'${fileUrl('client/src/seo/sanitize.js')}'`)
      .replace(
        /'@shared\/seo\/organizationIdentity\.js'/,
        `'${fileUrl('shared/seo/organizationIdentity.js')}'`
      )
      .replace(
        /'@shared\/seo\/jobPostingEligibility\.js'/,
        `'${fileUrl('shared/seo/jobPostingEligibility.js')}'`
      ),
    'utf8'
  ).toString('base64')}`
);

const {
  organizationSchema,
  websiteSchema,
  webPageSchema,
  breadcrumbSchema,
  blogPostingSchema,
  combineSchemas,
  jobPostingSchema,
  collectionPageSchema,
  courseSchema,
  scholarshipSchema,
  ORGANIZATION_ID,
  WEBSITE_ID,
  ORGANIZATION_LOGO_URL,
  buildPageId,
  buildBreadcrumbId,
} = schemasModule;

const ORIGIN = PRODUCTION_PUBLIC_ORIGIN;

function graphNodes(jsonLd) {
  if (!jsonLd) return [];
  if (Array.isArray(jsonLd['@graph'])) return jsonLd['@graph'];
  if (jsonLd['@type']) return [jsonLd];
  return [];
}

function collectIds(nodes) {
  return nodes.map((n) => n['@id']).filter(Boolean);
}

function countType(nodes, type) {
  return nodes.filter((n) => n['@type'] === type || (Array.isArray(n['@type']) && n['@type'].includes(type))).length;
}

// ---------------------------------------------------------------------------
// SEO-P2-01 — one canonical Organization identity
// ---------------------------------------------------------------------------
const org = organizationSchema();
check(org['@id'] === `${ORIGIN}/#organization`, 'SEO-P2-01: Organization @id is canonical');
check(org.name === 'Strideto', 'SEO-P2-01: Organization name is Strideto');

const globalGraph = graphNodes({ '@graph': [organizationSchema(), websiteSchema()] });
check(countType(globalGraph, 'Organization') === 1, 'SEO-P2-01: global graph has one Organization node');

// ---------------------------------------------------------------------------
// SEO-P2-02 — Organization canonical URL = www origin
// ---------------------------------------------------------------------------
check(org.url === ORIGIN, 'SEO-P2-02: Organization url is www origin');
check(entityIdsSource.includes('resolvePublicSiteOrigin') || entityIdsSource.includes('buildCanonicalUrl'), 'SEO-P2-02: entity IDs use canonical builders');

// ---------------------------------------------------------------------------
// SEO-P2-03 — Organization logo valid canonical/public URL
// ---------------------------------------------------------------------------
check(ORGANIZATION_LOGO_URL === `${ORIGIN}/branding/logo-symbol.svg`, 'SEO-P2-03: logo URL is public canonical asset');
check(org.logo?.url === ORGANIZATION_LOGO_URL, 'SEO-P2-03: Organization logo matches constant');

// ---------------------------------------------------------------------------
// SEO-P2-04 — sameAs absent or contains only configured official URLs
// ---------------------------------------------------------------------------
const sameAs = organizationSameAsUrls();
check(Array.isArray(org.sameAs), 'SEO-P2-04: sameAs is an array');
for (const url of org.sameAs) {
  check(sameAs.includes(url), `SEO-P2-04: sameAs entry is configured official URL: ${url}`);
}
check(!org.sameAs.some((u) => /twitter\.com|facebook\.com|instagram\.com/i.test(u)), 'SEO-P2-04: no unverified social URLs in sameAs');

// ---------------------------------------------------------------------------
// SEO-P2-05 — one canonical WebSite identity
// ---------------------------------------------------------------------------
const site = websiteSchema();
check(site['@id'] === `${ORIGIN}/#website`, 'SEO-P2-05: WebSite @id is canonical');
check(countType(globalGraph, 'WebSite') === 1, 'SEO-P2-05: global graph has one WebSite node');

// ---------------------------------------------------------------------------
// SEO-P2-06 — WebSite publisher references Organization @id
// ---------------------------------------------------------------------------
check(site.publisher?.['@id'] === ORGANIZATION_ID, 'SEO-P2-06: WebSite.publisher references Organization @id');

// ---------------------------------------------------------------------------
// SEO-P2-07 — WebPage references WebSite
// ---------------------------------------------------------------------------
const studentPage = webPageSchema({
  name: 'Students',
  description: 'Student opportunities',
  url: '/students',
});
check(studentPage.isPartOf?.['@id'] === WEBSITE_ID, 'SEO-P2-07: WebPage.isPartOf references WebSite @id');
check(studentPage.publisher?.['@id'] === ORGANIZATION_ID, 'SEO-P2-07: WebPage.publisher references Organization @id');

// ---------------------------------------------------------------------------
// SEO-P2-08 — public canonical matches structured-data URL
// ---------------------------------------------------------------------------
check(studentPage.url === `${ORIGIN}/students`, 'SEO-P2-08: WebPage.url matches canonical path');
check(studentPage['@id'] === `${ORIGIN}/students#webpage`, 'SEO-P2-08: WebPage @id uses canonical origin');

// ---------------------------------------------------------------------------
// SEO-P2-09 — breadcrumb uses absolute canonical URLs
// ---------------------------------------------------------------------------
const crumbs = breadcrumbSchema(
  [
    { name: 'Home', url: '/' },
    { name: 'Students', url: '/students' },
  ],
  '/students'
);
check(crumbs['@id'] === `${ORIGIN}/students#breadcrumb`, 'SEO-P2-09: breadcrumb @id is stable');
for (const item of crumbs.itemListElement) {
  check(item.item.startsWith(ORIGIN), `SEO-P2-09: breadcrumb item URL is absolute: ${item.item}`);
  check(typeof item.position === 'number', 'SEO-P2-09: breadcrumb positions are sequential');
}

// ---------------------------------------------------------------------------
// SEO-P2-10 — pages do not generate duplicate schema identities
// ---------------------------------------------------------------------------
const personaGraph = graphNodes(
  combineSchemas(
    breadcrumbSchema(
      [
        { name: 'Home', url: '/' },
        { name: 'Students', url: '/students' },
      ],
      '/students'
    ),
    webPageSchema({ name: 'Students', description: 'desc', url: '/students' })
  )
);
const ids = collectIds(personaGraph);
check(new Set(ids).size === ids.length, 'SEO-P2-10: persona page graph has unique @id values');

// ---------------------------------------------------------------------------
// SEO-P2-11 — Student acquisition graph consistent
// ---------------------------------------------------------------------------
check(personaSource.includes('webPageSchema'), 'SEO-P2-11: persona page uses webPageSchema');
check(personaSource.includes('breadcrumbSchema'), 'SEO-P2-11: persona page uses breadcrumbSchema');
check(personaGraph.some((n) => n['@type'] === 'WebPage'), 'SEO-P2-11: student graph includes WebPage');
check(!personaGraph.some((n) => n['@type'] === 'Organization'), 'SEO-P2-11: persona page does not duplicate Organization');

// ---------------------------------------------------------------------------
// SEO-P2-12 — Employer acquisition graph consistent
// ---------------------------------------------------------------------------
const employerGraph = graphNodes(
  combineSchemas(
    breadcrumbSchema([{ name: 'Home', url: '/' }, { name: 'Employers', url: '/employers' }], '/employers'),
    webPageSchema({ name: 'Employers', description: 'desc', url: '/employers' })
  )
);
check(employerGraph.find((n) => n['@type'] === 'WebPage')?.url === `${ORIGIN}/employers`, 'SEO-P2-12: employer WebPage canonical URL');

// ---------------------------------------------------------------------------
// SEO-P2-13 — Institution acquisition graph consistent
// ---------------------------------------------------------------------------
const institutionGraph = graphNodes(
  combineSchemas(
    breadcrumbSchema(
      [{ name: 'Home', url: '/' }, { name: 'Institutions', url: '/for-institutions' }],
      '/for-institutions'
    ),
    webPageSchema({ name: 'Institutions', description: 'desc', url: '/for-institutions' })
  )
);
check(
  institutionGraph.find((n) => n['@type'] === 'WebPage')?.['@id'] === `${ORIGIN}/for-institutions#webpage`,
  'SEO-P2-13: institution acquisition WebPage @id'
);

// ---------------------------------------------------------------------------
// SEO-P2-14 — BlogPosting publisher references Organization
// ---------------------------------------------------------------------------
const blog = blogPostingSchema(
  {
    title: 'Test Post',
    slug: 'test-post',
    author: 'Jane Doe',
    content: 'Hello world content here.',
    publishedAt: '2026-01-01T00:00:00.000Z',
  },
  { readingMinutes: 2, canonicalUrl: `${ORIGIN}/blog/test-post` }
);
check(blog.publisher?.['@id'] === ORGANIZATION_ID, 'SEO-P2-14: BlogPosting.publisher references Organization @id');
check(blog.publisher?.name === undefined, 'SEO-P2-14: BlogPosting.publisher is not inline duplicate Organization');

// ---------------------------------------------------------------------------
// SEO-P2-15 — BlogPosting mainEntityOfPage canonical
// ---------------------------------------------------------------------------
check(blog.mainEntityOfPage?.['@id'] === `${ORIGIN}/blog/test-post#webpage`, 'SEO-P2-15: mainEntityOfPage references page @id');
check(blog.url === `${ORIGIN}/blog/test-post`, 'SEO-P2-15: BlogPosting url is canonical');
check(blogPostSource.includes('canonicalUrl: buildCanonicalUrl'), 'SEO-P2-15: BlogPost passes canonicalUrl to schema');

// ---------------------------------------------------------------------------
// SEO-P2-16 — Blog author Person truthful/minimal
// ---------------------------------------------------------------------------
check(blog.author?.['@type'] === 'Person', 'SEO-P2-16: author is Person');
check(blog.author?.name === 'Jane Doe', 'SEO-P2-16: author name is truthful');
check(blog.author?.url === undefined, 'SEO-P2-16: no invented author profile URL');
const blogNoAuthor = blogPostingSchema({ title: 'No author', slug: 'no-author' });
check(blogNoAuthor.author === undefined, 'SEO-P2-16: missing author omits Person node');

// ---------------------------------------------------------------------------
// SEO-P2-17 — no FAQPage introduced
// ---------------------------------------------------------------------------
check(!schemasSource.includes("export function eventSchema"), 'SEO-P2-17: dead Event schema helper removed');
check(!personaSource.includes('FAQPage'), 'SEO-P2-17: persona pages have no FAQPage');

// ---------------------------------------------------------------------------
// SEO-P2-18 — no Service introduced for gated products
// ---------------------------------------------------------------------------
check(!personaSource.includes('Service'), 'SEO-P2-18: persona pages do not add Service schema');
check(!schemasSource.includes("export function serviceSchema"), 'SEO-P2-18: no new Service schema helper added');

// ---------------------------------------------------------------------------
// SEO-P2-19 — no Event fabricated from deadlines
// ---------------------------------------------------------------------------
check(!schemasSource.includes('@type: \'Event\''), 'SEO-P2-19: no Event schema helper in schemas.js');

// ---------------------------------------------------------------------------
// SEO-P2-20 — eligible employer JobPosting policy unchanged
// ---------------------------------------------------------------------------
check(
  /evaluateJobPostingEligibility/.test(schemasSource),
  'SEO-P2-20: JobPosting still gated by eligibility policy'
);
check(
  jobDetailSource.includes('JOB_POSTING_SURFACES.DETAIL'),
  'SEO-P2-20: JobDetail still uses detail surface'
);

// ---------------------------------------------------------------------------
// SEO-P2-21 — curated jobs still zero JobPosting
// ---------------------------------------------------------------------------
const curatedJob = {
  title: 'Programme Officer',
  slug: 'programme-officer-unicef',
  description: 'Curated external listing',
  publishedAt: '2026-01-01',
  jobsGraphEligible: false,
  applyType: 'external',
  applicationLink: 'https://www.unicef.org/careers/example',
};
check(
  jobPostingSchema(curatedJob, { surface: JOB_POSTING_SURFACES.DETAIL }) === null,
  'SEO-P2-21: curated job emits no JobPosting'
);

// ---------------------------------------------------------------------------
// SEO-P2-22 — internships still zero JobPosting
// ---------------------------------------------------------------------------
check(!/jobPostingSchema/.test(internshipDetailSource), 'SEO-P2-22: internship detail does not call jobPostingSchema');
check(/webPageSchema\(/.test(internshipDetailSource), 'SEO-P2-22: internship detail uses WebPage');

// ---------------------------------------------------------------------------
// SEO-P2-23 — STRIDETO Organization is not employer hiringOrganization
// ---------------------------------------------------------------------------
const eligibleJob = {
  title: 'Senior Backend Engineer',
  slug: 'senior-backend-engineer-acme-lahore',
  company: 'Acme Technologies',
  organization: 'Acme Technologies',
  description: 'Build and operate the billing platform.',
  city: 'Lahore',
  province: 'Punjab',
  countryCode: 'PK',
  createdAt: new Date('2020-01-01T00:00:00.000Z'),
  deadline: new Date('2027-01-01T00:00:00.000Z'),
  status: 'active',
  publicationState: 'active',
  acceptingApplications: true,
  availability: 'open',
  jobsGraphEligible: true,
};
const posting = jobPostingSchema(eligibleJob, {
  surface: JOB_POSTING_SURFACES.DETAIL,
  now: new Date('2026-01-01T00:00:00.000Z'),
});
check(posting !== null, 'SEO-P2-23: eligible employer job emits JobPosting');
check(posting?.hiringOrganization?.name === 'Acme Technologies', 'SEO-P2-23: hiringOrganization is employer');
check(posting?.hiringOrganization?.['@id'] !== ORGANIZATION_ID, 'SEO-P2-23: hiringOrganization is not Strideto org @id');

// ---------------------------------------------------------------------------
// SEO-P2-24 — private pages remain noindex
// ---------------------------------------------------------------------------
for (const p of ['/dashboard', '/employer/jobs', '/institution/profile', '/auth/login']) {
  check(isPrivateSeoPath(p), `SEO-P2-24: ${p} remains private SEO path`);
}
check(globalSeoSource.includes('isPrivateSeoPath'), 'SEO-P2-24: GlobalSeo respects private paths');

// ---------------------------------------------------------------------------
// SEO-P2-25 — no localhost/Vercel/Render identity URLs
// ---------------------------------------------------------------------------
check(!entityIdsSource.includes('localhost'), 'SEO-P2-25: entityIds has no localhost literals');
check(!schemasSource.includes('vercel.app'), 'SEO-P2-25: schemas has no Vercel URLs');
check(!schemasSource.includes('onrender.com'), 'SEO-P2-25: schemas has no Render URLs');
check(ORGANIZATION_ID.startsWith(ORIGIN), 'SEO-P2-25: Organization @id uses production www origin in tests');

// ---------------------------------------------------------------------------
// SEO-P2-26 — JSON-LD serialization remains safe
// ---------------------------------------------------------------------------
check(sanitizeSource.includes('replace(/<\\/script/gi'), 'SEO-P2-26: sanitize escapes script breakouts');
check(seoHeadSource.includes('safeJsonLd'), 'SEO-P2-26: SeoHead uses safeJsonLd');
const malicious = blogPostingSchema({
  title: '</script><script>alert(1)</script>',
  slug: 'x',
  author: 'A',
});
check(!JSON.stringify(malicious).includes('</script>'), 'SEO-P2-26: headline sanitization prevents script breakout');

// ---------------------------------------------------------------------------
// SEO-P2-27 — homepage entity graph coherent
// ---------------------------------------------------------------------------
const homeGraph = graphNodes(
  combineSchemas(
    breadcrumbSchema([{ name: 'Home', url: '/' }], '/'),
    webPageSchema({ name: 'Strideto', description: 'Home', url: '/' })
  )
);
check(homeGraph.find((n) => n['@type'] === 'WebPage')?.['@id'] === `${ORIGIN}/#webpage`, 'SEO-P2-27: homepage WebPage @id');
check(globalSeoSource.includes('organizationSchema'), 'SEO-P2-27: GlobalSeo emits Organization');
check(globalSeoSource.includes('websiteSchema'), 'SEO-P2-27: GlobalSeo emits WebSite');

// ---------------------------------------------------------------------------
// SEO-P2-28 — CollectionPage schema normalized truthfully
// ---------------------------------------------------------------------------
const jobsCollection = collectionPageSchema({ name: 'Jobs', description: 'Jobs', url: '/jobs' });
check(jobsCollection['@type'] === 'CollectionPage', 'SEO-P2-28: collectionPageSchema type is CollectionPage');
check(jobsCollection['@id'] === `${ORIGIN}/jobs#webpage`, 'SEO-P2-28: CollectionPage has page @id');
check(!/itemListSchema/.test(jobsListSource.split('collectionPageSchema')[1] || ''), 'SEO-P2-28: /jobs list does not auto-add ItemList');

// ---------------------------------------------------------------------------
// SEO-P2-29 — sitemap consistency decisions enforced
// ---------------------------------------------------------------------------
const indexable = read('shared/seo/publicIndexablePages.js');
check(indexable.includes("'/students'"), 'SEO-P2-29: P1 persona routes remain in sitemap list');
check(indexable.includes("'/institutions'"), 'SEO-P2-29: /institutions sitemap gap resolved in P3');
check(indexable.includes("'/scholarship-intelligence'"), 'SEO-P2-29: scholarship-intelligence sitemap gap resolved in P3');

// ---------------------------------------------------------------------------
// SEO-P2-30 — P1 persona schema regression green
// ---------------------------------------------------------------------------
check(personaSource.includes('combineSchemas'), 'SEO-P2-30: persona acquisition still composes schema graph');
check(buildPageId('/students') === `${ORIGIN}/students#webpage`, 'SEO-P2-30: student page id helper stable');
check(buildBreadcrumbId('/employers') === `${ORIGIN}/employers#breadcrumb`, 'SEO-P2-30: employer breadcrumb id helper stable');

// ---------------------------------------------------------------------------
// SEO-P2-PROVIDER-01 — course without explicit provider does NOT default to STRIDETO
// ---------------------------------------------------------------------------
const courseNoProvider = courseSchema({ name: 'PPSC Screening Test', slug: 'ppsc-screening' });
check(courseNoProvider !== null, 'SEO-P2-PROVIDER-01: course schema still emitted');
check(courseNoProvider.provider === undefined, 'SEO-P2-PROVIDER-01: course omits provider when none is known');

// ---------------------------------------------------------------------------
// SEO-P2-PROVIDER-02 — course with explicit provider preserves that provider
// ---------------------------------------------------------------------------
const courseWithAuthority = courseSchema({
  name: 'NTS NAT',
  slug: 'nts-nat',
  authority: 'National Testing Service',
});
check(
  courseWithAuthority.provider?.name === 'National Testing Service',
  'SEO-P2-PROVIDER-02: course uses explicit authority as provider'
);
check(
  courseWithAuthority.provider?.['@id'] !== ORGANIZATION_ID,
  'SEO-P2-PROVIDER-02: explicit course provider is not Strideto @id'
);

// ---------------------------------------------------------------------------
// SEO-P2-PROVIDER-03 — scholarship without provider does NOT default to STRIDETO
// ---------------------------------------------------------------------------
const scholarshipNoProvider = scholarshipSchema({
  title: 'Open Merit Award',
  slug: 'open-merit-award',
  description: 'Needs-based support.',
});
check(scholarshipNoProvider.provider === undefined, 'SEO-P2-PROVIDER-03: scholarship omits provider when absent');

// ---------------------------------------------------------------------------
// SEO-P2-PROVIDER-04 — scholarship with explicit provider preserves that provider
// ---------------------------------------------------------------------------
const scholarshipWithProvider = scholarshipSchema({
  title: 'HEC Overseas Scholarship',
  slug: 'hec-overseas',
  provider: 'Higher Education Commission',
});
check(
  scholarshipWithProvider.provider?.name === 'Higher Education Commission',
  'SEO-P2-PROVIDER-04: scholarship preserves explicit provider name'
);
check(
  scholarshipWithProvider.provider?.['@id'] !== ORGANIZATION_ID,
  'SEO-P2-PROVIDER-04: explicit scholarship provider is not Strideto @id'
);

// ---------------------------------------------------------------------------
// SEO-P2-PROVIDER-05 — scholarship funder alone does NOT become provider
// ---------------------------------------------------------------------------
const scholarshipFunderOnly = scholarshipSchema({
  title: 'Fulbright',
  slug: 'fulbright',
  funder: 'U.S. Department of State',
});
check(scholarshipFunderOnly.provider === undefined, 'SEO-P2-PROVIDER-05: funder alone does not map to provider');

// ---------------------------------------------------------------------------
// SEO-P2-PROVIDER-06 — scholarship sponsor alone does NOT become provider
// ---------------------------------------------------------------------------
const scholarshipSponsorOnly = scholarshipSchema({
  title: 'Corporate Award',
  slug: 'corporate-award',
  sponsor: 'Acme Corp',
});
check(scholarshipSponsorOnly.provider === undefined, 'SEO-P2-PROVIDER-06: sponsor alone does not map to provider');

// ---------------------------------------------------------------------------
// SEO-P2-PROVIDER-07 — organization not mapped (not a persisted scholarship read field)
// ---------------------------------------------------------------------------
const scholarshipOrgOnly = scholarshipSchema({
  title: 'Merit Award',
  slug: 'merit-award',
  organization: 'Higher Education Commission',
});
check(
  scholarshipOrgOnly.provider === undefined,
  'SEO-P2-PROVIDER-07: organization alone does not map to provider (CMS stores as provider field)'
);
const scholarshipProviderObject = scholarshipSchema({
  title: 'Canonical Award',
  slug: 'canonical-award',
  provider: { name: 'University of Example' },
});
check(
  scholarshipProviderObject.provider?.name === 'University of Example',
  'SEO-P2-PROVIDER-07: explicit provider object name is preserved'
);

// ---------------------------------------------------------------------------
// SEO-P2-PROVIDER-08 — BlogPosting publisher still references STRIDETO Organization
// ---------------------------------------------------------------------------
check(blog.publisher?.['@id'] === ORGANIZATION_ID, 'SEO-P2-PROVIDER-08: BlogPosting.publisher still references Organization @id');

// ---------------------------------------------------------------------------
// SEO-P2-PROVIDER-09 — WebSite publisher still references STRIDETO Organization
// ---------------------------------------------------------------------------
check(site.publisher?.['@id'] === ORGANIZATION_ID, 'SEO-P2-PROVIDER-09: WebSite.publisher still references Organization @id');

// ---------------------------------------------------------------------------
// SEO-P2-PROVIDER-10 — hiringOrganization never becomes STRIDETO through this change
// ---------------------------------------------------------------------------
check(posting?.hiringOrganization?.['@id'] !== ORGANIZATION_ID, 'SEO-P2-PROVIDER-10: hiringOrganization is not Strideto org @id');
check(posting?.hiringOrganization?.name === 'Acme Technologies', 'SEO-P2-PROVIDER-10: hiringOrganization remains employer name');
check(
  !JSON.stringify(scholarshipNoProvider).includes('Strideto'),
  'SEO-P2-PROVIDER-10: missing-provider scholarship JSON-LD has no Strideto provider fabrication'
);
check(
  !JSON.stringify(courseNoProvider).includes('Strideto'),
  'SEO-P2-PROVIDER-10: missing-provider course JSON-LD has no Strideto provider fabrication'
);

console.log(`seoP2EntityStructuredData: ${count} checks passed`);
