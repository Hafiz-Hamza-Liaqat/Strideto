/**
 * SEO-P0A (production indexability truth) + SEO-P0B (structured-data policy
 * safety) regression coverage.
 *
 * Run: node server/src/__tests__/seoP0IndexabilityAndJobPostingPolicy.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import {
  resolvePublicSiteOrigin,
  PRODUCTION_PUBLIC_ORIGIN,
  CANONICAL_APEX_HOST,
  CANONICAL_WWW_HOST,
  LOCAL_PUBLIC_ORIGIN,
} from '../../../shared/seo/publicSiteOrigin.js';
import {
  buildRobotsTxt,
  isPrivateSeoPath,
  isRobotsDisallowedPath,
  robotsRulesForPath,
  ROBOTS_DISALLOW_PATHS,
  PRIVATE_SEO_PREFIXES,
} from '../../../shared/seo/robotsPolicy.js';
import {
  INDEXABLE_STATIC_PATHS,
  isForbiddenSitemapPath,
} from '../../../shared/seo/publicIndexablePages.js';
import {
  JOB_POSTING_SURFACES,
  JOB_POSTING_INELIGIBLE_REASONS,
  evaluateJobPostingEligibility,
  isJobsGraphAuthorized,
  isFullyRemoteJob,
  jobPostingCountry,
  missingJobPostingRequiredFields,
} from '../../../shared/seo/jobPostingEligibility.js';
import {
  JOB_DUPLICATE_PRESERVE_FIELDS,
  JOB_DUPLICATE_RESET_FIELDS,
  buildJobDuplicateProjection,
} from '../services/jobWriteBoundary.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '../../..');
const read = (rel) => readFileSync(path.join(repo, rel), 'utf8');

// Line endings are a checkout artifact on Windows (core.autocrlf), not policy —
// compare content, not CR bytes.
const lf = (value) => value.split('\r\n').join('\n');
const staticRobots = lf(read('client/public/robots.txt'));
const robotsLines = (txt) => txt.split(String.fromCharCode(10));
const seoController = read('server/src/controllers/seoController.js');
const schemasSource = read('client/src/seo/schemas.js');
const jobDetailSource = read('client/src/pages/Jobs/JobDetail.jsx');
const internshipDetailSource = read('client/src/pages/Internships/InternshipDetail.jsx');
const jobsListSource = read('client/src/pages/Jobs/Jobs.jsx');
const seoJobsPageSource = read('client/src/pages/SEO/SEOJobsPage.jsx');
const jobsCategorySource = read('client/src/pages/Landing/JobsCategoryLanding.jsx');
const jobsProvinceSource = read('client/src/pages/Landing/JobsProvinceLanding.jsx');
const notFoundSource = read('client/src/pages/Static/NotFound.jsx');
const vercelConfig = JSON.parse(read('client/vercel.json'));
const jobModelSource = read('server/src/models/Job.js');
const employerControllerSource = read('server/src/controllers/employerController.js');
const adminJobsSource = read('server/src/controllers/admin/adminJobsController.js');
const projectionSource = read('shared/publicDiscovery/projectPublicDiscovery.js');

// ---------------------------------------------------------------------------
// SEO-P0A-01 — robots static/shared policy consistency
// ---------------------------------------------------------------------------
check(
  staticRobots === buildRobotsTxt(PRODUCTION_PUBLIC_ORIGIN),
  'SEO-P0A-01: client/public/robots.txt is byte-identical to buildRobotsTxt(PRODUCTION_PUBLIC_ORIGIN)'
);
check(
  staticRobots.includes(`Sitemap: ${PRODUCTION_PUBLIC_ORIGIN}/sitemap.xml`),
  'SEO-P0A-01: static robots points at the canonical (non-redirecting) sitemap URL'
);
check(
  !robotsLines(staticRobots).includes('Disallow: /business'),
  'SEO-P0A-01: no bare prefix "/business" rule (it would also block public /business-services)'
);
check(
  seoController.includes('buildRobotsTxt(getPublicOrigin())'),
  'SEO-P0A-01: the dynamic robots route is generated from the same shared policy'
);

// ---------------------------------------------------------------------------
// SEO-P0A-02 — private routes remain blocked and noindexed
// ---------------------------------------------------------------------------
const privateProbes = [
  '/admin/users',
  '/dashboard',
  '/employer/jobs',
  '/agent/leads',
  '/institution/profile',
  '/business',
  '/business/requests',
  '/vault',
  '/applications',
  '/account',
];
for (const p of privateProbes) {
  check(isPrivateSeoPath(p) === true, `SEO-P0A-02: ${p} is noindex (private SEO path)`);
  check(isRobotsDisallowedPath(p), `SEO-P0A-02: ${p} is covered by a robots Disallow rule`);
}
check(
  PRIVATE_SEO_PREFIXES.includes('/business/'),
  'SEO-P0A-02: the private buyer workspace is a noindex prefix'
);

// ---------------------------------------------------------------------------
// SEO-P0A-03 — public acquisition routes remain crawlable
// ---------------------------------------------------------------------------
const publicProbes = [
  '/',
  '/jobs',
  '/jobs/some-job-slug',
  '/scholarships',
  '/intl-scholarships',
  '/internships',
  '/admissions',
  '/program-explorer',
  '/tests',
  '/blog',
  '/foreign-studies',
  '/agents',
  '/agents/marketplace',
  '/business-services',
  '/business-services/some-listing',
  '/schools-and-colleges',
];
for (const p of publicProbes) {
  check(isPrivateSeoPath(p) === false, `SEO-P0A-03: ${p} is not marked noindex`);
  check(!isForbiddenSitemapPath(p), `SEO-P0A-03: ${p} is not excluded from the sitemap`);
  check(!isRobotsDisallowedPath(p), `SEO-P0A-03: ${p} is not blocked by robots`);
}
check(
  INDEXABLE_STATIC_PATHS.includes('/jobs') && INDEXABLE_STATIC_PATHS.includes('/blog'),
  'SEO-P0A-03: core public hubs are in the sitemap allowlist'
);

// ---------------------------------------------------------------------------
// SEO-P0A-07 — private BASE path and subtree, public sibling untouched
//
// The bare base and the subtree are two different things and a single prefix
// rule cannot express both without collateral damage:
//   `Disallow: /business`  also blocks public /business-services
//   `Disallow: /business/` leaves the bare /business page crawlable
// So a trailing-slash policy entry generates an exact-match `$` rule for the
// base plus the trailing-slash rule for the subtree. The generated file and the
// application-side noindex helper must agree on every probe.
// ---------------------------------------------------------------------------
const robotsFileLines = robotsLines(staticRobots);
const exactBasePairs = [
  ['/agent/', ['/agent', '/agent/leads', '/agent/business-services/quotes'], ['/agents', '/agents/marketplace']],
  ['/institution/', ['/institution', '/institution/profile'], ['/institutions', '/institutions/some-slug']],
  ['/business/', ['/business', '/business/requests'], ['/business-services', '/business-services/some-listing']],
];
for (const [policyPath, privatePaths, publicSiblings] of exactBasePairs) {
  const base = policyPath.slice(0, -1);
  check(
    ROBOTS_DISALLOW_PATHS.includes(policyPath) && PRIVATE_SEO_PREFIXES.includes(policyPath),
    `SEO-P0A-07: ${policyPath} is a private base path in both shared policy lists`
  );
  assert.deepEqual(
    robotsRulesForPath(policyPath),
    [`Disallow: ${base}$`, `Disallow: ${policyPath}`],
    `SEO-P0A-07: ${policyPath} generates an exact-base rule and a subtree rule`
  );
  count += 1;
  check(
    robotsFileLines.includes(`Disallow: ${base}$`),
    `SEO-P0A-07: the static robots file carries the exact-match rule for ${base}`
  );
  check(
    robotsFileLines.includes(`Disallow: ${policyPath}`),
    `SEO-P0A-07: the static robots file carries the subtree rule for ${policyPath}`
  );
  check(
    !robotsFileLines.includes(`Disallow: ${base}`),
    `SEO-P0A-07: the static robots file carries no bare prefix rule for ${base}`
  );
  for (const p of privatePaths) {
    check(isRobotsDisallowedPath(p), `SEO-P0A-07: ${p} is robots-disallowed`);
    check(isPrivateSeoPath(p), `SEO-P0A-07: ${p} is noindex`);
    check(isForbiddenSitemapPath(p), `SEO-P0A-07: ${p} can never enter the sitemap`);
  }
  for (const p of publicSiblings) {
    check(!isRobotsDisallowedPath(p), `SEO-P0A-07: public sibling ${p} is not robots-disallowed`);
    check(!isPrivateSeoPath(p), `SEO-P0A-07: public sibling ${p} is not noindex`);
    check(!isForbiddenSitemapPath(p), `SEO-P0A-07: public sibling ${p} may enter the sitemap`);
  }
}
// Every trailing-slash policy entry is generated the same way — the exact-base
// rules are never hand-edited into the static file for some paths only.
for (const policyPath of ROBOTS_DISALLOW_PATHS) {
  for (const rule of robotsRulesForPath(policyPath)) {
    check(
      robotsFileLines.includes(rule),
      `SEO-P0A-07: the static robots file is generated, not hand-edited (${rule})`
    );
  }
}

// ---------------------------------------------------------------------------
// SEO-P0A-04 — sitemap excludes draft / archived / fixture / private
// ---------------------------------------------------------------------------
check(
  seoController.includes('withFixtureExclusion'),
  'SEO-P0A-04: sitemap queries exclude fixture records'
);
check(
  seoController.includes("Job.find(withFixtureExclusion({ status: 'active'"),
  'SEO-P0A-04: only active jobs enter the sitemap'
);
check(
  seoController.includes("Blog.find({ status: 'published'"),
  'SEO-P0A-04: only published blog posts enter the sitemap'
);
check(
  seoController.includes('status: PUB_STATUSES.PUBLISHED'),
  'SEO-P0A-04: education records enter the sitemap only when published'
);
check(
  seoController.includes('if (!path || isForbiddenSitemapPath(path)) return;'),
  'SEO-P0A-04: every sitemap URL passes the forbidden-path guard'
);
for (const p of ['/admin/x', '/dashboard', '/employer/jobs', '/business', '/business/requests', '/vault']) {
  check(isForbiddenSitemapPath(p), `SEO-P0A-04: ${p} can never be added to the sitemap`);
}

// ---------------------------------------------------------------------------
// SEO-P0A-05 — canonical origin consistency (apex never emitted)
// ---------------------------------------------------------------------------
check(
  PRODUCTION_PUBLIC_ORIGIN === `https://${CANONICAL_WWW_HOST}`,
  'SEO-P0A-05: the canonical production origin is the www host'
);
check(
  resolvePublicSiteOrigin('') === PRODUCTION_PUBLIC_ORIGIN,
  'SEO-P0A-05: an unset origin falls back to the canonical origin'
);
for (const configured of [
  `https://${CANONICAL_APEX_HOST}`,
  `https://${CANONICAL_APEX_HOST}/`,
  `http://${CANONICAL_APEX_HOST}`,
  `https://${CANONICAL_WWW_HOST}`,
]) {
  check(
    resolvePublicSiteOrigin(configured) === PRODUCTION_PUBLIC_ORIGIN,
    `SEO-P0A-05: "${configured}" resolves to the canonical non-redirecting origin`
  );
}
check(
  resolvePublicSiteOrigin('https://localhost:8443') === LOCAL_PUBLIC_ORIGIN,
  'SEO-P0A-05: local HTTPS origin is untouched by apex normalization'
);
check(
  resolvePublicSiteOrigin('https://staging.example.com') === 'https://staging.example.com',
  'SEO-P0A-05: unrelated hosts are not rewritten'
);
check(
  read('client/src/design-system/brand.js').includes(`https://${CANONICAL_WWW_HOST}`),
  'SEO-P0A-05: the brand site URL uses the canonical host'
);
check(
  !/https:\/\/strideto\.com/.test(read('client/index.html')),
  'SEO-P0A-05: the HTML shell social URLs use the canonical host'
);
check(
  vercelConfig.rewrites.some(
    (r) => r.source === '/sitemap.xml' && /\/sitemap\.xml$/.test(r.destination) && r.destination.startsWith('http')
  ),
  'SEO-P0A-05: /sitemap.xml is routed to the generator instead of the SPA shell'
);
check(
  vercelConfig.rewrites.findIndex((r) => r.source === '/sitemap.xml') <
    vercelConfig.rewrites.findIndex((r) => r.destination === '/index.html'),
  'SEO-P0A-05: the sitemap rewrite is ordered before the SPA catch-all'
);

// ---------------------------------------------------------------------------
// SEO-P0A-06 — query/filter URLs do not create duplicate indexable URLs
// ---------------------------------------------------------------------------
check(
  /canonical=\{ROUTES\.JOBS\}/.test(jobsListSource),
  'SEO-P0A-06: /jobs self-canonicalizes, so ?filter= variants do not become separate index URLs'
);
check(
  !/canonical=\{[^}]*location\.search/.test(jobsListSource),
  'SEO-P0A-06: the jobs canonical never embeds the live query string'
);
for (const [name, src] of [
  ['SEOJobsPage', seoJobsPageSource],
  ['JobsCategoryLanding', jobsCategorySource],
  ['JobsProvinceLanding', jobsProvinceSource],
]) {
  check(/canonical=\{canonical\}/.test(src), `SEO-P0A-06: ${name} emits one stable canonical`);
}
check(
  /noindex/.test(notFoundSource),
  'SEO-P0A-06: the SPA 404 view is noindex (the edge still answers 200 — see the audit)'
);

// ---------------------------------------------------------------------------
// SEO-P0B — JobPosting structured-data policy
// ---------------------------------------------------------------------------
const FUTURE = new Date('2030-01-01T00:00:00.000Z');
const PAST = new Date('2020-01-01T00:00:00.000Z');
const NOW = new Date('2026-01-01T00:00:00.000Z');

const authorizedJob = Object.freeze({
  title: 'Senior Backend Engineer',
  slug: 'senior-backend-engineer-acme-lahore',
  company: 'Acme Technologies',
  organization: 'Acme Technologies',
  description: 'Build and operate the billing platform.',
  city: 'Lahore',
  province: 'Punjab',
  countryCode: 'PK',
  createdAt: PAST,
  deadline: FUTURE,
  status: 'active',
  publicationState: 'active',
  acceptingApplications: true,
  availability: 'open',
  jobsGraphEligible: true,
});

const curatedExternalJob = Object.freeze({
  ...authorizedJob,
  slug: 'programme-officer-unicef-islamabad',
  company: 'UNICEF',
  organization: 'UNICEF',
  applyType: 'external',
  applicationLink: 'https://www.unicef.org/careers/example',
  sourceUrl: 'https://www.unicef.org/careers/example',
  sourceWebsite: 'UNICEF',
  jobsGraphEligible: false,
});

// SEO-P0B-01 — authorized/native eligible job detail may emit JobPosting
{
  const result = evaluateJobPostingEligibility(authorizedJob, {
    surface: JOB_POSTING_SURFACES.DETAIL,
    now: NOW,
  });
  check(result.eligible === true, 'SEO-P0B-01: authorized, open, complete job detail is eligible');
  check(result.reason === null, 'SEO-P0B-01: an eligible job reports no denial reason');
}
check(
  jobDetailSource.includes('JOB_POSTING_SURFACES.DETAIL'),
  'SEO-P0B-01: the job detail page declares the detail surface'
);
check(
  /jobPostingSchema\(job, \{ surface: JOB_POSTING_SURFACES\.DETAIL \}\)/.test(jobDetailSource),
  'SEO-P0B-01: the job detail page is the only surface asking for JobPosting'
);

// SEO-P0B-02 — curated external job detail does NOT emit JobPosting
{
  const result = evaluateJobPostingEligibility(curatedExternalJob, {
    surface: JOB_POSTING_SURFACES.DETAIL,
    now: NOW,
  });
  check(result.eligible === false, 'SEO-P0B-02: a curated external job is never eligible');
  check(
    result.reason === JOB_POSTING_INELIGIBLE_REASONS.NOT_AUTHORIZED,
    'SEO-P0B-02: the denial reason is missing authorization, not a missing field'
  );
}
check(
  isJobsGraphAuthorized({ applicationLink: 'https://example.com/apply' }) === false,
  'SEO-P0B-02: an external apply URL is not authorization'
);
check(
  isJobsGraphAuthorized({ sourceUrl: 'https://example.com/job', sourceWebsite: 'Example' }) === false,
  'SEO-P0B-02: a source URL/website is not authorization'
);
check(
  isJobsGraphAuthorized({ company: 'Acme', organization: 'Acme', employerId: 'abc' }) === false,
  'SEO-P0B-02: an employer name or id is not authorization'
);
check(
  isJobsGraphAuthorized({ jobsGraphEligible: 'true' }) === false,
  'SEO-P0B-02: only a real boolean true grants authorization'
);

// SEO-P0B-03 — job listing pages do NOT emit JobPosting
{
  const result = evaluateJobPostingEligibility(authorizedJob, {
    surface: JOB_POSTING_SURFACES.LISTING,
    now: NOW,
  });
  check(
    result.eligible === false && result.reason === JOB_POSTING_INELIGIBLE_REASONS.LISTING_SURFACE,
    'SEO-P0B-03: even an authorized job is ineligible on a listing surface'
  );
}
check(
  evaluateJobPostingEligibility(authorizedJob, { now: NOW }).eligible === false,
  'SEO-P0B-03: an omitted surface defaults to ineligible (fail closed)'
);
check(
  !/jobPostingSchema/.test(jobsListSource),
  'SEO-P0B-03: the /jobs listing page never calls jobPostingSchema'
);

// SEO-P0B-04 — SEO landing pages do NOT emit JobPosting
check(
  !/jobPostingSchema/.test(schemasSource.split('export function itemListSchema')[1] || ''),
  'SEO-P0B-04: itemListSchema no longer builds JobPosting objects'
);
check(
  !/itemType === 'JobPosting'/.test(schemasSource),
  'SEO-P0B-04: no JobPosting branch remains in ItemList construction'
);
for (const [name, src] of [
  ['SEOJobsPage', seoJobsPageSource],
  ['JobsCategoryLanding', jobsCategorySource],
  ['JobsProvinceLanding', jobsProvinceSource],
]) {
  check(!/jobPostingSchema/.test(src), `SEO-P0B-04: ${name} never calls jobPostingSchema`);
  check(/itemListSchema/.test(src), `SEO-P0B-04: ${name} still describes its items as a plain ItemList`);
}

// SEO-P0B-05 — expired / closed / draft jobs do NOT emit JobPosting
const notOpenCases = [
  ['deadline passed', { ...authorizedJob, deadline: PAST }],
  ['applications closed', { ...authorizedJob, applicationsCloseAt: PAST }],
  ['visibility window ended', { ...authorizedJob, visibleUntil: PAST }],
  ['status draft', { ...authorizedJob, status: 'draft' }],
  ['status closed', { ...authorizedJob, status: 'closed' }],
  ['publicationState expired', { ...authorizedJob, publicationState: 'expired' }],
  ['publicationState closed', { ...authorizedJob, publicationState: 'closed' }],
  ['publicationState draft', { ...authorizedJob, publicationState: 'draft' }],
  ['publicationState pending_review', { ...authorizedJob, publicationState: 'pending_review' }],
  ['publicationState rejected', { ...authorizedJob, publicationState: 'rejected' }],
  ['not accepting applications', { ...authorizedJob, acceptingApplications: false }],
  ['availability deadline_passed', { ...authorizedJob, availability: 'deadline_passed' }],
];
for (const [label, job] of notOpenCases) {
  const result = evaluateJobPostingEligibility(job, {
    surface: JOB_POSTING_SURFACES.DETAIL,
    now: NOW,
  });
  check(
    result.eligible === false && result.reason === JOB_POSTING_INELIGIBLE_REASONS.NOT_PUBLICLY_OPEN,
    `SEO-P0B-05: ${label} → no JobPosting`
  );
}

// SEO-P0B-06 — eligibility defaults to false
check(
  /jobsGraphEligible: \{ type: Boolean, default: false \}/.test(jobModelSource),
  'SEO-P0B-06: the Job schema defaults jobsGraphEligible to false'
);
check(
  evaluateJobPostingEligibility({ ...authorizedJob, jobsGraphEligible: undefined }, {
    surface: JOB_POSTING_SURFACES.DETAIL,
    now: NOW,
  }).eligible === false,
  'SEO-P0B-06: a legacy record with no flag is ineligible'
);
check(
  projectionSource.includes('jobsGraphEligible: job.jobsGraphEligible === true'),
  'SEO-P0B-06: the public projection normalises a missing flag to false'
);
check(
  /jobsGraphEligible: true,/.test(employerControllerSource),
  'SEO-P0B-06: the employer self-service workflow is the grant point'
);
check(
  (employerControllerSource.match(/jobsGraphEligible/g) || []).length === 1,
  'SEO-P0B-06: exactly one grant point exists in the employer controller'
);
check(
  !/jobsGraphEligible/.test(adminJobsSource),
  'SEO-P0B-06: the admin CMS cannot set eligibility (no accidental implied authorization)'
);
check(
  JOB_DUPLICATE_RESET_FIELDS.includes('jobsGraphEligible'),
  'SEO-P0B-06: duplicating a job resets eligibility rather than copying authorization'
);

// SEO-P0B-07 — structured-data / visible-content parity
{
  const incomplete = [
    ['title', { ...authorizedJob, title: '' }],
    ['description', { ...authorizedJob, description: '   ' }],
    ['hiringOrganization', { ...authorizedJob, company: '', organization: '' }],
    ['datePosted', { ...authorizedJob, createdAt: null, publishedAt: null }],
    ['jobLocation', { ...authorizedJob, city: '', province: '', region: '', location: '' }],
    ['jobLocation.addressCountry', { ...authorizedJob, countryCode: '', country: '' }],
  ];
  for (const [field, job] of incomplete) {
    const result = evaluateJobPostingEligibility(job, {
      surface: JOB_POSTING_SURFACES.DETAIL,
      now: NOW,
    });
    check(
      result.eligible === false &&
        result.reason === JOB_POSTING_INELIGIBLE_REASONS.INCOMPLETE_REQUIRED_FIELDS &&
        result.missingFields.includes(field),
      `SEO-P0B-07: a job missing ${field} does not emit a JobPosting claiming it`
    );
  }
  check(
    missingJobPostingRequiredFields(authorizedJob).length === 0,
    'SEO-P0B-07: a complete job reports no missing required fields'
  );
  check(
    evaluateJobPostingEligibility(
      { ...authorizedJob, city: '', province: '', region: '', location: '', workMode: 'remote' },
      { surface: JOB_POSTING_SURFACES.DETAIL, now: NOW }
    ).eligible === true,
    'SEO-P0B-07: a genuinely remote job satisfies location without inventing a place'
  );
  check(
    /jobLocationType/.test(schemasSource),
    'SEO-P0B-07: a remote job declares jobLocationType instead of a fabricated address'
  );
  check(
    /datePosted: toDateOnly\(job\.publishedAt \|\| job\.createdAt\)/.test(schemasSource),
    'SEO-P0B-07: emitted datePosted uses the same source the eligibility gate checked'
  );
  check(
    /validThrough: toDateOnly\(job\.applicationsCloseAt \|\| job\.deadline\)/.test(schemasSource),
    'SEO-P0B-07: emitted validThrough uses the product application-closing precedence'
  );
  check(
    /const \{ eligible \} = evaluateJobPostingEligibility\(job, \{ surface, now \}\);\s*\n\s*if \(!eligible\) return null;/.test(
      schemasSource
    ),
    'SEO-P0B-07: jobPostingSchema emits nothing unless the shared policy says eligible'
  );
}

// SEO-P0B-08 — curated external internships get no automatic JobPosting
check(
  !/jobPostingSchema/.test(internshipDetailSource),
  'SEO-P0B-08: the internship detail page does not emit JobPosting'
);
check(
  /webPageSchema\(/.test(internshipDetailSource),
  'SEO-P0B-08: the internship detail page stays ordinary indexable WebPage content'
);
check(
  /canonical=\{canonicalPath\}/.test(internshipDetailSource),
  'SEO-P0B-08: the internship detail page remains canonical and indexable'
);
check(
  evaluateJobPostingEligibility(
    { ...authorizedJob, jobsGraphEligible: undefined, type: 'internship' },
    { surface: JOB_POSTING_SURFACES.DETAIL, now: NOW }
  ).eligible === false,
  'SEO-P0B-08: an internship with no authorization model can never become eligible'
);

// ---------------------------------------------------------------------------
// Live schema module under test.
//
// client/src/seo/schemas.js is browser code: it resolves `@shared/*` through the
// Vite alias and pulls SITE_URL out of `import.meta.env` via ./config.js. To
// assert on the JSON-LD it actually emits (rather than on regexes over its
// source) the module is loaded here with those two boundaries substituted: the
// alias becomes the real shared file, and SITE_URL becomes the same canonical
// production origin the rest of this suite asserts on. Every line of schema
// logic under test is the real, unmodified source.
// ---------------------------------------------------------------------------
const fileUrl = (rel) => pathToFileURL(path.join(repo, rel)).href;
const schemasModule = await import(
  `data:text/javascript;base64,${Buffer.from(
    schemasSource
      .replace(
        /^import \{[^}]*\} from '\.\/config\.js';$/m,
        [
          `const SITE_URL = ${JSON.stringify(PRODUCTION_PUBLIC_ORIGIN)};`,
          "const SITE_NAME = 'Strideto';",
          "const DEFAULT_DESCRIPTION = 'test description';",
          `const DEFAULT_OG_IMAGE = ${JSON.stringify(`${PRODUCTION_PUBLIC_ORIGIN}/og-image.png`)};`,
        ].join('\n')
      )
      .replace(/'\.\/sanitize\.js'/, `'${fileUrl('client/src/seo/sanitize.js')}'`)
      .replace(
        /'@shared\/social\/officialSocialLinks\.js'/,
        `'${fileUrl('shared/social/officialSocialLinks.js')}'`
      )
      .replace(
        /'@shared\/seo\/jobPostingEligibility\.js'/,
        `'${fileUrl('shared/seo/jobPostingEligibility.js')}'`
      ),
    'utf8'
  ).toString('base64')}`
);
const { jobPostingSchema, itemListSchema, scholarshipSchema } = schemasModule;
const detail = (job) => jobPostingSchema(job, { surface: JOB_POSTING_SURFACES.DETAIL, now: NOW });

// ---------------------------------------------------------------------------
// SEO-P0B-09 — remote JobPosting: TELECOMMUTE is never emitted unqualified
//
// Google's work-from-home JobPosting requirements pair jobLocationType
// TELECOMMUTE with applicantLocationRequirements naming at least one country an
// applicant may actually be based in. STRIDETO's only truthful source for that
// is the job's own country (Job.countryCode), so a remote job without one fails
// closed instead of shipping a bare TELECOMMUTE claim.
// ---------------------------------------------------------------------------
const remoteAuthorizedJob = Object.freeze({
  ...authorizedJob,
  slug: 'remote-platform-engineer-acme',
  city: '',
  province: '',
  region: '',
  location: '',
  workMode: 'remote',
  remote: true,
  countryCode: 'PK',
});

// REMOTE-01 — remote authorized job with a truthful country
{
  check(isFullyRemoteJob(remoteAuthorizedJob), 'REMOTE-01: the fixture derives as fully remote');
  check(jobPostingCountry(remoteAuthorizedJob) === 'PK', 'REMOTE-01: the country comes from countryCode');
  const schema = detail(remoteAuthorizedJob);
  check(schema !== null, 'REMOTE-01: a remote authorized job with a truthful country is eligible');
  check(schema.jobLocationType === 'TELECOMMUTE', 'REMOTE-01: it declares TELECOMMUTE');
  assert.deepEqual(
    schema.applicantLocationRequirements,
    { '@type': 'Country', name: 'PK' },
    'REMOTE-01: TELECOMMUTE is paired with a truthful applicantLocationRequirements country'
  );
  count += 1;
  check(
    schema.jobLocation === undefined,
    'REMOTE-01: a remote job gets no fabricated PostalAddress / Place'
  );
}

// REMOTE-02 — remote authorized job with no truthful applicant country
for (const [label, job] of [
  ['no country at all', { ...remoteAuthorizedJob, countryCode: undefined, country: undefined }],
  ['blank country', { ...remoteAuthorizedJob, countryCode: '   ', country: '' }],
]) {
  const result = evaluateJobPostingEligibility(job, {
    surface: JOB_POSTING_SURFACES.DETAIL,
    now: NOW,
  });
  check(
    result.eligible === false &&
      result.reason === JOB_POSTING_INELIGIBLE_REASONS.INCOMPLETE_REQUIRED_FIELDS &&
      result.missingFields.includes('applicantLocationRequirements'),
    `REMOTE-02: remote job with ${label} is ineligible (fail closed)`
  );
  check(detail(job) === null, `REMOTE-02: remote job with ${label} emits no JobPosting at all`);
}

// REMOTE-03 — a curated remote job is ineligible however good its geography is
{
  const curatedRemote = {
    ...curatedExternalJob,
    city: '',
    province: '',
    region: '',
    location: '',
    workMode: 'remote',
    remote: true,
    countryCode: 'PK',
  };
  const result = evaluateJobPostingEligibility(curatedRemote, {
    surface: JOB_POSTING_SURFACES.DETAIL,
    now: NOW,
  });
  check(
    result.eligible === false && result.reason === JOB_POSTING_INELIGIBLE_REASONS.NOT_AUTHORIZED,
    'REMOTE-03: a curated remote job is denied for authorization, not geography'
  );
  check(detail(curatedRemote) === null, 'REMOTE-03: a curated remote job emits no JobPosting');
}

// REMOTE-04 — a physical job's location is never fabricated
{
  const schema = detail(authorizedJob);
  check(schema !== null, 'REMOTE-04: the physical fixture is eligible');
  check(
    schema.jobLocationType === undefined && schema.applicantLocationRequirements === undefined,
    'REMOTE-04: a physical job is not labelled TELECOMMUTE'
  );
  assert.deepEqual(
    schema.jobLocation,
    {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Lahore',
        addressRegion: 'Punjab',
        addressCountry: 'PK',
      },
    },
    'REMOTE-04: the emitted address is exactly the job\'s own city/region/country'
  );
  count += 1;
  const noCountry = { ...authorizedJob, countryCode: '', country: '' };
  const result = evaluateJobPostingEligibility(noCountry, {
    surface: JOB_POSTING_SURFACES.DETAIL,
    now: NOW,
  });
  check(
    result.eligible === false && result.missingFields.includes('jobLocation.addressCountry'),
    'REMOTE-04: a physical job with no truthful country is ineligible rather than back-filled'
  );
  check(
    detail(noCountry) === null,
    'REMOTE-04: no addressCountry is ever invented for a physical job'
  );
  // Hybrid has real premises: it must keep its physical address, not TELECOMMUTE.
  const hybrid = { ...authorizedJob, workMode: 'hybrid', hybrid: true, remote: true };
  check(!isFullyRemoteJob(hybrid), 'REMOTE-04: hybrid is not fully remote');
  check(
    detail(hybrid).jobLocationType === undefined && detail(hybrid).jobLocation !== undefined,
    'REMOTE-04: a hybrid job keeps its physical jobLocation'
  );
}

// ---------------------------------------------------------------------------
// SEO-P0B-10 — datePosted / validThrough semantics
//
// datePosted is the date the employer's posting became public. STRIDETO's
// canonical publication timestamp is Job.publishedAt (Job.js requires it for the
// `active` publication state); createdAt is the legacy/pre-canonical fallback.
// The detail page renders exactly `publishedAt || createdAt` as its visible
// "Posted" fact, so the markup and the page cannot disagree.
//
// validThrough is optional: emitted only when the job genuinely has a closing
// date, resolved with the product's own precedence
// (`applicationsCloseAt || deadline`, the same order deriveJobAvailability uses).
// ---------------------------------------------------------------------------
check(
  /const posted = formatDate\(job\.publishedAt \|\| job\.createdAt\)/.test(jobDetailSource),
  'DATE-00: the visible "Posted" fact on the detail page is publishedAt || createdAt'
);
{
  const published = new Date('2025-06-15T09:00:00.000Z');
  const created = new Date('2025-06-01T09:00:00.000Z');
  check(
    detail({ ...authorizedJob, createdAt: created, publishedAt: published }).datePosted ===
      '2025-06-15',
    'DATE-01: datePosted is the publication date, not the draft-creation date'
  );
  check(
    detail({ ...authorizedJob, createdAt: created, publishedAt: null }).datePosted === '2025-06-01',
    'DATE-01: a legacy record with no publishedAt falls back to createdAt'
  );
  check(
    evaluateJobPostingEligibility(
      { ...authorizedJob, createdAt: null, publishedAt: published },
      { surface: JOB_POSTING_SURFACES.DETAIL, now: NOW }
    ).eligible === true,
    'DATE-01: publishedAt alone satisfies the datePosted requirement'
  );
}
// DATE-02 — known expiry is emitted, using the canonical closing field
{
  const closeAt = new Date('2026-09-30T00:00:00.000Z');
  check(
    detail({ ...authorizedJob, applicationsCloseAt: closeAt, deadline: FUTURE }).validThrough ===
      '2026-09-30',
    'DATE-02: validThrough is the canonical applicationsCloseAt when the job has one'
  );
  check(
    detail({ ...authorizedJob, applicationsCloseAt: null, deadline: closeAt }).validThrough ===
      '2026-09-30',
    'DATE-02: validThrough falls back to the employer-supplied deadline'
  );
}
// DATE-03 — no known expiry: still eligible, validThrough simply omitted
{
  const openEnded = {
    ...authorizedJob,
    deadline: null,
    applicationsCloseAt: null,
    visibleUntil: null,
  };
  const result = evaluateJobPostingEligibility(openEnded, {
    surface: JOB_POSTING_SURFACES.DETAIL,
    now: NOW,
  });
  check(
    result.eligible === true,
    'DATE-03: an authorized open job with no known expiry stays eligible'
  );
  check(
    missingJobPostingRequiredFields(openEnded).includes('validThrough') === false,
    'DATE-03: validThrough is not a required field'
  );
  const schema = detail(openEnded);
  check(
    schema !== null && schema.validThrough === undefined,
    'DATE-03: validThrough is omitted rather than invented'
  );
}
// DATE-04 — a past expiry still fails eligibility, on either field
for (const [label, job] of [
  ['deadline in the past', { ...authorizedJob, deadline: PAST }],
  ['applicationsCloseAt in the past', { ...authorizedJob, deadline: null, applicationsCloseAt: PAST }],
]) {
  const result = evaluateJobPostingEligibility(job, {
    surface: JOB_POSTING_SURFACES.DETAIL,
    now: NOW,
  });
  check(
    result.eligible === false && result.reason === JOB_POSTING_INELIGIBLE_REASONS.NOT_PUBLICLY_OPEN,
    `DATE-04: ${label} → no JobPosting`
  );
  check(detail(job) === null, `DATE-04: ${label} emits nothing`);
}

// ---------------------------------------------------------------------------
// SEO-P0B-11 — itemListSchema stays genuinely generic
//
// The list helper serves jobs, scholarships and anything else. It must not route
// a non-job item through a job URL builder: a Scholarship that came out as
// /jobs/:slug would advertise a URL that does not exist and mislabel the entity.
// ---------------------------------------------------------------------------
const jobItems = [
  { title: 'Senior Backend Engineer', slug: 'senior-backend-engineer-acme-lahore' },
  { title: 'Data Analyst', slug: 'data-analyst-acme-karachi' },
];
const scholarshipItems = [
  {
    title: 'HEC Overseas Scholarship',
    slug: 'hec-overseas-scholarship-2026',
    description: 'Fully funded postgraduate study abroad.',
    provider: 'Higher Education Commission',
    country: 'Pakistan',
    deadline: '2026-11-30',
    level: 'Masters',
  },
];

// ITEMLIST-01 — job list items resolve into the job URL space, as summaries
{
  const list = itemListSchema({ name: 'Jobs in Lahore', description: 'd', items: jobItems });
  check(list['@type'] === 'ItemList', 'ITEMLIST-01: the list is an ItemList');
  check(list.numberOfItems === 2, 'ITEMLIST-01: numberOfItems reflects the items');
  const [first] = list.itemListElement;
  check(
    first.url === `${PRODUCTION_PUBLIC_ORIGIN}/jobs/senior-backend-engineer-acme-lahore`,
    'ITEMLIST-01: a job list item URL is /jobs/:slug'
  );
  check(first.name === 'Senior Backend Engineer', 'ITEMLIST-01: the item carries its name');
  check(first.item === undefined, 'ITEMLIST-01: a job list item embeds no JobPosting object');
  check(
    list.itemListElement.every((el) => el['@type'] === 'ListItem'),
    'ITEMLIST-01: every entry is a plain ListItem'
  );
  const legacy = itemListSchema({ name: 'n', description: 'd', items: jobItems, itemType: 'JobPosting' });
  check(
    legacy.itemListElement[0].url === `${PRODUCTION_PUBLIC_ORIGIN}/jobs/senior-backend-engineer-acme-lahore` &&
      legacy.itemListElement[0].item === undefined,
    'ITEMLIST-01: the legacy JobPosting itemType is still a summary in the job URL space'
  );
}

// ITEMLIST-02 — a Scholarship never lands in the job URL space
{
  const list = itemListSchema({
    name: 'Scholarships in Pakistan',
    description: 'd',
    items: scholarshipItems,
    itemType: 'Scholarship',
  });
  const [entry] = list.itemListElement;
  check(
    !entry.url.includes('/jobs/'),
    'ITEMLIST-02: a scholarship list item URL is NOT /jobs/:slug'
  );
  check(
    entry.url === `${PRODUCTION_PUBLIC_ORIGIN}/scholarships/hec-overseas-scholarship-2026`,
    'ITEMLIST-02: a scholarship list item URL is its own /scholarships/:slug canonical'
  );

  // ITEMLIST-03 — the Scholarship entity itself is preserved and still valid
  check(entry.item['@type'] === 'Scholarship', 'ITEMLIST-03: the nested entity is a Scholarship');
  assert.deepEqual(
    entry.item,
    scholarshipSchema(scholarshipItems[0]),
    'ITEMLIST-03: the nested entity is exactly what scholarshipSchema produces'
  );
  count += 1;
  check(
    entry.item.url === `${PRODUCTION_PUBLIC_ORIGIN}/scholarships/hec-overseas-scholarship-2026`,
    'ITEMLIST-03: the Scholarship entity keeps its own canonical URL'
  );
  check(
    entry.item.name === 'HEC Overseas Scholarship' &&
      entry.item.provider['@type'] === 'Organization' &&
      entry.item.applicationDeadline === '2026-11-30',
    'ITEMLIST-03: the Scholarship entity keeps its provider, name and deadline'
  );
  check(
    !JSON.stringify(list).includes('JobPosting'),
    'ITEMLIST-03: no JobPosting appears anywhere in a scholarship ItemList'
  );
}

// ITEMLIST-04 — an unrelated item type keeps its own @type / name / url
{
  const courses = [
    { name: 'CSS Exam Preparation', url: '/exam-prep/css' },
    { name: 'Absolute URL Course', url: 'https://partner.example.com/course' },
    { name: 'No URL Course', slug: 'no-url-course' },
  ];
  const list = itemListSchema({ name: 'Courses', description: 'd', items: courses, itemType: 'Course' });
  const [relative, absolute, slugOnly] = list.itemListElement;
  check(
    relative.url === `${PRODUCTION_PUBLIC_ORIGIN}/exam-prep/css`,
    'ITEMLIST-04: a supplied relative URL is kept (site-absolute), not rewritten to /jobs/'
  );
  check(
    absolute.url === 'https://partner.example.com/course',
    'ITEMLIST-04: a supplied absolute URL is kept verbatim'
  );
  check(
    slugOnly.url === undefined,
    'ITEMLIST-04: an unknown type with only a slug gets no guessed URL'
  );
  check(
    relative.item['@type'] === 'Course' && relative.item.name === 'CSS Exam Preparation',
    'ITEMLIST-04: the nested entity keeps the supplied @type and name'
  );
  check(
    relative.item.url === `${PRODUCTION_PUBLIC_ORIGIN}/exam-prep/css`,
    'ITEMLIST-04: the nested entity keeps the supplied URL'
  );
  check(
    !JSON.stringify(list).includes('/jobs/'),
    'ITEMLIST-04: no item of an unrelated type is routed through the job URL space'
  );
}

// ---------------------------------------------------------------------------
// SEO-P0B-12 — employer authorization boundary for jobsGraphEligible
//
// jobsGraphEligible may only become true where the authenticated hiring
// organization is publishing its OWN vacancy. The chain is:
//   requireAuth -> secureAccessAuthorization -> req.employer.employerId
//     (the JWT principal's subjectId; middleware/auth.js is the only writer of
//      req.employer)
//   -> hiringOwnerIdFrom(req) -> scopeEmployerId(req) -> employerId
//   -> Job.create({ ..., employerId, jobsGraphEligible: true })
// The request body never participates: createJob builds an explicit field list
// with no body spread, and updateJob writes through a field allowlist that does
// not contain the flag.
// ---------------------------------------------------------------------------
const createJobBlock = employerControllerSource.slice(
  employerControllerSource.indexOf('export const createJob'),
  employerControllerSource.indexOf('export const updateJob')
);
const updateJobBlock = employerControllerSource.slice(
  employerControllerSource.indexOf('export const updateJob'),
  employerControllerSource.indexOf('export const closeJob')
);
const authMiddlewareSource = read('server/src/middleware/auth.js');
const employerOrgSource = read('server/src/services/employer/employerOrganizationService.js');
const employerRoutesSource = read('server/src/routes/employer.js');

// EMPAUTH-01 — the employer identity is authenticated server context only
check(
  /req\.employer = \{\s*\n\s*employerId: principal\.subjectId,/.test(authMiddlewareSource),
  'EMPAUTH-01: req.employer.employerId comes from the verified access principal'
);
check(
  (employerControllerSource.match(/req\.employer = /g) || []).length === 0,
  'EMPAUTH-01: the employer controller never re-assigns req.employer itself'
);
check(
  /export function hiringOwnerIdFrom\(req\) \{\s*\n\s*return req\.employer\?\.hiringOwnerId \|\| req\.employer\?\.employerId;/.test(
    employerOrgSource
  ),
  'EMPAUTH-01: hiringOwnerIdFrom reads only req.employer, never req.body/req.query'
);
check(
  /req\.employer\.hiringOwnerId = String\(organization\.legacyEmployerId \|\| membership\.employerId\)/.test(
    employerOrgSource
  ),
  'EMPAUTH-01: hiringOwnerId is derived from the stored organization membership'
);
check(
  /employerRouter\.post\(\s*\n\s*'\/employer\/jobs',\s*\n\s*requireAuth,\s*\n\s*requireEmployerAuth,/.test(
    employerRoutesSource
  ),
  'EMPAUTH-01: POST /employer/jobs is behind requireAuth + requireEmployerAuth'
);

// EMPAUTH-02 — body/query input cannot choose the employer or set the flag
check(
  /const employerId = scopeEmployerId\(req\);/.test(createJobBlock),
  'EMPAUTH-02: createJob takes the employer from the authenticated scope'
);
check(
  !/\.\.\.body/.test(createJobBlock) && !/\.\.\.req\.body/.test(createJobBlock),
  'EMPAUTH-02: createJob never spreads the request body into the Job document'
);
for (const forbidden of ['body.employerId', 'body.postedByEmployerId', 'body.jobsGraphEligible', 'query.employerId']) {
  check(
    !createJobBlock.includes(forbidden),
    `EMPAUTH-02: createJob never reads ${forbidden}`
  );
}
check(
  /employerId,\s*\n\s*postedByEmployerId: req\.employer\.employerId,/.test(createJobBlock),
  'EMPAUTH-02: ownership fields are written from server context, side by side with the grant'
);
check(
  /jobsGraphEligible: true,/.test(createJobBlock),
  'EMPAUTH-02: the grant lives inside createJob and nowhere else in the controller'
);
check(
  !/jobsGraphEligible/.test(updateJobBlock),
  'EMPAUTH-02: updateJob cannot set or clear the flag'
);
check(
  /const job = await Job\.findOne\(\{ _id: req\.params\.id, employerId \}\);/.test(updateJobBlock),
  'EMPAUTH-02: updateJob only ever loads a job owned by the authenticated employer'
);

// EMPAUTH-03 — the curated/admin CMS workflow cannot manufacture authorization
check(
  !/jobsGraphEligible/.test(adminJobsSource),
  'EMPAUTH-03: the admin jobs controller never mentions the flag'
);
for (const rel of [
  'server/src/services/importHandlers.js',
  'server/src/services/scraperService.js',
]) {
  check(
    !/jobsGraphEligible/.test(read(rel)),
    `EMPAUTH-03: ${rel} creates curated/scraped jobs without the flag`
  );
}
check(
  (read('server/src/models/Job.js').match(/jobsGraphEligible/g) || []).length === 1,
  'EMPAUTH-03: the flag is declared once, with its default, and never mutated in the model'
);

// EMPAUTH-04 — a duplicate/fork resets, it never inherits authorization
check(
  JOB_DUPLICATE_RESET_FIELDS.includes('jobsGraphEligible'),
  'EMPAUTH-04: duplication resets the flag to the schema default'
);
check(
  !JOB_DUPLICATE_PRESERVE_FIELDS.includes('jobsGraphEligible'),
  'EMPAUTH-04: duplication never preserves the flag'
);
{
  const forked = buildJobDuplicateProjection({
    title: 'Senior Backend Engineer',
    company: 'Acme Technologies',
    employerId: 'employer-1',
    jobsGraphEligible: true,
  });
  check(
    forked.jobsGraphEligible === undefined,
    'EMPAUTH-04: an admin fork of an authorized job carries no authorization forward'
  );
  check(
    isJobsGraphAuthorized(forked) === false,
    'EMPAUTH-04: the forked projection is unauthorized'
  );
}

// EMPAUTH-05 — moderation approval does not manufacture authorization
{
  const approveBlock = adminJobsSource.slice(adminJobsSource.indexOf('const set = {'));
  check(
    !/jobsGraphEligible/.test(approveBlock),
    'EMPAUTH-05: approving a job sets status/approvalStatus only, never eligibility'
  );
}
check(
  evaluateJobPostingEligibility(
    { ...curatedExternalJob, status: 'active', approvalStatus: 'approved' },
    { surface: JOB_POSTING_SURFACES.DETAIL, now: NOW }
  ).reason === JOB_POSTING_INELIGIBLE_REASONS.NOT_AUTHORIZED,
  'EMPAUTH-05: an approved curated job is still unauthorized'
);

// EMPAUTH-06 — existing/legacy jobs stay false, with no migration or backfill
check(
  isJobsGraphAuthorized({ title: 'Legacy job', employerId: 'employer-1', source: 'employer' }) === false,
  'EMPAUTH-06: a legacy employer-sourced job is not retroactively authorized'
);
check(
  detail({ ...authorizedJob, jobsGraphEligible: undefined }) === null,
  'EMPAUTH-06: a legacy record emits no JobPosting'
);

// Repository-wide guard: JobPosting may only be produced in one place.
const emitters = [
  'client/src/pages/Jobs/JobDetail.jsx',
  'client/src/pages/Internships/InternshipDetail.jsx',
  'client/src/pages/Jobs/Jobs.jsx',
  'client/src/pages/SEO/SEOJobsPage.jsx',
  'client/src/pages/SEO/SEOScholarshipsPage.jsx',
  'client/src/pages/Landing/JobsCategoryLanding.jsx',
  'client/src/pages/Landing/JobsProvinceLanding.jsx',
];
const callers = emitters.filter((f) => /jobPostingSchema\s*\(/.test(read(f)));
assert.deepEqual(
  callers,
  ['client/src/pages/Jobs/JobDetail.jsx'],
  'SEO-P0B: exactly one surface in the product calls jobPostingSchema'
);
count += 1;
check(
  (schemasSource.match(/'@type': 'JobPosting'/g) || []).length === 1,
  'SEO-P0B: JobPosting is constructed in exactly one helper'
);

console.log(`SEO-P0A + SEO-P0B policy: ${count} checks passed`);
