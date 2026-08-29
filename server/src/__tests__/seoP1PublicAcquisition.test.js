/**
 * SEO-P1 — Public persona + service acquisition pages regression coverage.
 *
 * Run: node server/src/__tests__/seoP1PublicAcquisition.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { PRODUCTION_PUBLIC_ORIGIN } from '../../../shared/seo/publicSiteOrigin.js';
import {
  buildRobotsTxt,
  isPrivateSeoPath,
  isRobotsDisallowedPath,
} from '../../../shared/seo/robotsPolicy.js';
import {
  INDEXABLE_STATIC_PATHS,
  isForbiddenSitemapPath,
} from '../../../shared/seo/publicIndexablePages.js';
import { isWorkspaceLaunched, WORKSPACE_LAUNCH_IDS } from '../../../shared/launch/workspaceLaunchGates.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '../../..');
const read = (rel) => readFileSync(path.join(repo, rel), 'utf8');

const routesSource = read('client/src/routes/index.jsx');
const constantsSource = read('client/src/constants/index.js');
const studentPage = read('client/src/pages/Public/StudentAcquisition.jsx');
const employerPage = read('client/src/pages/Public/EmployerAcquisition.jsx');
const institutionPage = read('client/src/pages/Public/InstitutionAcquisition.jsx');
const personaLayout = read('client/src/components/static/PersonaAcquisitionPage.jsx');
const footerSource = read('client/src/components/layout/Footer.jsx');
const humanSitemap = read('client/src/pages/Static/HumanSitemap.jsx');
const staticRobots = read('client/public/robots.txt').split('\r\n').join('\n');
const schemasSource = read('client/src/seo/schemas.js');
const jobDetailSource = read('client/src/pages/Jobs/JobDetail.jsx');
const blogPostSource = read('client/src/pages/Blog/BlogPost.jsx');

const ACQUISITION_ROUTES = Object.freeze({
  students: '/students',
  employers: '/employers',
  institutions: '/for-institutions',
});

// ---------------------------------------------------------------------------
// SEO-P1-01 — Student acquisition route public/indexable
// ---------------------------------------------------------------------------
check(routesSource.includes("path: ROUTES.FOR_STUDENTS"), 'SEO-P1-01: student route registered');
check(!isPrivateSeoPath(ACQUISITION_ROUTES.students), 'SEO-P1-01: /students is not a private SEO path');
check(!isRobotsDisallowedPath(ACQUISITION_ROUTES.students), 'SEO-P1-01: /students is not robots-disallowed');
check(INDEXABLE_STATIC_PATHS.includes(ACQUISITION_ROUTES.students), 'SEO-P1-01: /students is in static sitemap list');

// ---------------------------------------------------------------------------
// SEO-P1-02 — Student canonical correct
// ---------------------------------------------------------------------------
check(
  studentPage.includes('canonical={ROUTES.FOR_STUDENTS}'),
  'SEO-P1-02: student page uses ROUTES.FOR_STUDENTS canonical'
);
check(constantsSource.includes("FOR_STUDENTS: '/students'"), 'SEO-P1-02: FOR_STUDENTS constant is /students');
check(
  personaLayout.includes('canonical={canonical}') && !personaLayout.includes('http://'),
  'SEO-P1-02: PersonaAcquisitionPage delegates canonical to SeoHead without hard-coded origins'
);

// ---------------------------------------------------------------------------
// SEO-P1-03 — Student unique title/description/H1
// ---------------------------------------------------------------------------
check(
  studentPage.includes('Jobs, Internships & Scholarships for Students | Strideto'),
  'SEO-P1-03: student page has distinct title'
);
check(
  studentPage.includes('Browse opportunities for free'),
  'SEO-P1-03: student page has unique meta description'
);
check(
  studentPage.includes('heading="Discover your next job, internship, or scholarship"'),
  'SEO-P1-03: student page has distinct H1'
);
check(
  !employerPage.includes('Career, Internship & Study Opportunities for Students'),
  'SEO-P1-03: student title not reused on employer page'
);

// ---------------------------------------------------------------------------
// SEO-P1-04 — Student real internal links
// ---------------------------------------------------------------------------
const studentLinks = [
  'ROUTES.JOBS',
  'ROUTES.INTERNSHIPS',
  'ROUTES.SCHOLARSHIPS',
  'ROUTES.ADMISSIONS',
  'ROUTES.FOREIGN_STUDIES',
  'ROUTES.RESUME_BUILDER',
  'ROUTES.REGISTER',
];
for (const link of studentLinks) {
  check(studentPage.includes(link), `SEO-P1-04: student page links via ${link}`);
}
check(!studentPage.includes('/jobs-pakistan'), 'SEO-P1-04: no doorway location job pages');
check(!studentPage.includes('/study-in-'), 'SEO-P1-04: no doorway destination study pages');

// ---------------------------------------------------------------------------
// SEO-P1-05 — Employer public/indexable
// ---------------------------------------------------------------------------
check(routesSource.includes("path: ROUTES.FOR_EMPLOYERS"), 'SEO-P1-05: employer acquisition route registered');
check(!isPrivateSeoPath(ACQUISITION_ROUTES.employers), 'SEO-P1-05: /employers is public SEO');
check(!isRobotsDisallowedPath(ACQUISITION_ROUTES.employers), 'SEO-P1-05: /employers not robots-disallowed');
check(INDEXABLE_STATIC_PATHS.includes(ACQUISITION_ROUTES.employers), 'SEO-P1-05: /employers in sitemap static paths');
check(
  isPrivateSeoPath('/employer/login') && !isPrivateSeoPath('/employers'),
  'SEO-P1-05: /employer portal private but /employers acquisition public'
);

// ---------------------------------------------------------------------------
// SEO-P1-06 — Employer canonical correct
// ---------------------------------------------------------------------------
check(
  employerPage.includes('canonical={ROUTES.FOR_EMPLOYERS}'),
  'SEO-P1-06: employer page canonical uses FOR_EMPLOYERS'
);
check(constantsSource.includes("FOR_EMPLOYERS: '/employers'"), 'SEO-P1-06: FOR_EMPLOYERS constant');

// ---------------------------------------------------------------------------
// SEO-P1-07 — Employer content does not claim unsupported features
// ---------------------------------------------------------------------------
const unsupportedEmployerClaims = [
  'AI matching',
  'ATS',
  'analytics dashboard',
  'bulk job',
  'bulk upload',
  'talent matching',
];
for (const claim of unsupportedEmployerClaims) {
  check(!employerPage.toLowerCase().includes(claim.toLowerCase()), `SEO-P1-07: employer page does not claim "${claim}"`);
}
check(employerPage.includes('Post and manage job listings'), 'SEO-P1-07: employer page claims real posting capability');
check(
  employerPage.includes('submitted through STRIDETO') || employerPage.includes('Review and manage applications'),
  'SEO-P1-07: employer page qualifies application workflow'
);

// ---------------------------------------------------------------------------
// SEO-P1-08 — Institution acquisition truthfully shows gated status
// ---------------------------------------------------------------------------
check(
  institutionPage.includes('isInstitutionWorkspaceLaunched'),
  'SEO-P1-08: institution page reads institution launch gate'
);
check(
  institutionPage.includes('coming soon'),
  'SEO-P1-08: institution page mentions coming soon when gated'
);
check(
  institutionPage.includes('workspaceAvailable={workspaceOpen}'),
  'SEO-P1-08: institution page surfaces workspace badge from gate'
);
check(
  !institutionPage.includes('waitlist') && !institutionPage.includes('Waitlist'),
  'SEO-P1-08: no fake waitlist behavior'
);

// ---------------------------------------------------------------------------
// SEO-P1-09 — Institution private workspace remains gated/noindex
// ---------------------------------------------------------------------------
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.INSTITUTION, {}) === false,
  'SEO-P1-09: institution workspace defaults OFF'
);
check(isPrivateSeoPath('/institution/login'), 'SEO-P1-09: institution login is private SEO');
check(isPrivateSeoPath('/institution/profile'), 'SEO-P1-09: institution dashboard is private SEO');
check(isPrivateSeoPath('/institution/login'), 'SEO-P1-09: institution login path is private SEO (GlobalSeo noindex)');
check(
  isWorkspaceLaunched(WORKSPACE_LAUNCH_IDS.INSTITUTION, { WORKSPACE_LAUNCH_INSTITUTION: '0' }) === false,
  'SEO-P1-09: institution workspace not launched when env is 0'
);

// ---------------------------------------------------------------------------
// SEO-P1-10 — one H1 per acquisition page
// ---------------------------------------------------------------------------
for (const [name, source] of [
  ['student', studentPage],
  ['employer', employerPage],
  ['institution', institutionPage],
]) {
  const h1InPage = (source.match(/heading="/g) || []).length;
  check(h1InPage === 1, `SEO-P1-10: ${name} page has exactly one heading prop (H1)`);
}
check(
  (personaLayout.match(/<h1/g) || []).length === 1,
  'SEO-P1-10: PersonaAcquisitionPage renders exactly one <h1>'
);

// ---------------------------------------------------------------------------
// SEO-P1-11 — sitemap contains new canonical public routes
// ---------------------------------------------------------------------------
for (const route of Object.values(ACQUISITION_ROUTES)) {
  check(INDEXABLE_STATIC_PATHS.includes(route), `SEO-P1-11: sitemap static list includes ${route}`);
}

// ---------------------------------------------------------------------------
// SEO-P1-12 — private routes excluded
// ---------------------------------------------------------------------------
const privateRoutes = [
  '/employer/login',
  '/employer/register',
  '/institution/login',
  '/auth/login',
  '/dashboard',
  '/admin',
];
for (const p of privateRoutes) {
  check(!INDEXABLE_STATIC_PATHS.includes(p), `SEO-P1-12: ${p} not in static sitemap`);
  check(isForbiddenSitemapPath(p) || isPrivateSeoPath(p), `SEO-P1-12: ${p} excluded from public index`);
}

// ---------------------------------------------------------------------------
// SEO-P1-13 — robots SEO-P0 behavior unchanged
// ---------------------------------------------------------------------------
check(
  staticRobots === buildRobotsTxt(PRODUCTION_PUBLIC_ORIGIN),
  'SEO-P1-13: static robots.txt unchanged vs shared policy'
);
check(staticRobots.includes('Disallow: /employer'), 'SEO-P1-13: employer portal still disallowed');
check(!staticRobots.includes('Disallow: /employers'), 'SEO-P1-13: /employers acquisition not disallowed');
check(staticRobots.includes('Disallow: /institution/'), 'SEO-P1-13: institution portal still disallowed');
check(!staticRobots.includes('Disallow: /institutions'), 'SEO-P1-13: /institutions discovery not disallowed');

// ---------------------------------------------------------------------------
// SEO-P1-14 — JobPosting policy unchanged
// ---------------------------------------------------------------------------
check(
  /evaluateJobPostingEligibility/.test(schemasSource),
  'SEO-P1-14: JobPosting still uses eligibility policy'
);
check(
  jobDetailSource.includes('jobPostingSchema') || jobDetailSource.includes('evaluateJobPostingEligibility'),
  'SEO-P1-14: JobDetail still wired to JobPosting policy'
);
check(!studentPage.includes('JobPosting'), 'SEO-P1-14: acquisition pages do not emit JobPosting');

// ---------------------------------------------------------------------------
// SEO-P1-15 — Blog SEO unchanged
// ---------------------------------------------------------------------------
check(blogPostSource.includes('SeoHead'), 'SEO-P1-15: BlogPost still uses SeoHead');
check(!blogPostSource.includes('FOR_STUDENTS'), 'SEO-P1-15: blog architecture not modified for acquisition');

// ---------------------------------------------------------------------------
// SEO-P1-16 — no duplicate canonical acquisition routes
// ---------------------------------------------------------------------------
check(
  routesSource.includes("path: ROUTES.FOR_STUDENTS"),
  'SEO-P1-16: student route uses ROUTES constant'
);
check(
  !/\/students['"]/.test(routesSource.replace(/FOR_STUDENTS/g, '')),
  'SEO-P1-16: no duplicate raw /students route string outside FOR_STUDENTS constant'
);
const staticAcquisitionCount = INDEXABLE_STATIC_PATHS.filter((p) =>
  Object.values(ACQUISITION_ROUTES).includes(p)
).length;
check(staticAcquisitionCount === 3, 'SEO-P1-16: exactly three acquisition paths in sitemap static list');
check(
  INDEXABLE_STATIC_PATHS.includes('/institutions'),
  'SEO-P1-16: /institutions discovery is indexable (P3 sitemap resolution)'
);
check(
  INDEXABLE_STATIC_PATHS.includes('/for-institutions') && INDEXABLE_STATIC_PATHS.includes('/institutions'),
  'SEO-P1-16: acquisition (/for-institutions) and discovery (/institutions) remain distinct'
);

// ---------------------------------------------------------------------------
// SEO-P1-17 — responsive structure contracts
// ---------------------------------------------------------------------------
check(personaLayout.includes('max-w-3xl'), 'SEO-P1-17: content constrained width');
check(personaLayout.includes('min-h-[44px]'), 'SEO-P1-17: touch targets meet minimum height');
check(personaLayout.includes('flex-wrap'), 'SEO-P1-17: CTA row wraps on narrow viewports');
check(personaLayout.includes('px-4'), 'SEO-P1-17: horizontal padding for mobile');

// ---------------------------------------------------------------------------
// SEO-P1-18 — breadcrumbs/schema valid if implemented
// ---------------------------------------------------------------------------
check(personaLayout.includes('breadcrumbSchema'), 'SEO-P1-18: breadcrumb schema used');
check(personaLayout.includes('webPageSchema'), 'SEO-P1-18: WebPage schema used');
check(personaLayout.includes('aria-label="Breadcrumb"'), 'SEO-P1-18: visible breadcrumb nav');
check(!personaLayout.includes('FAQPage'), 'SEO-P1-18: no FAQPage schema on acquisition pages');
check(!personaLayout.includes('Organization'), 'SEO-P1-18: no duplicate Organization schema');

// ---------------------------------------------------------------------------
// Navigation / footer wiring
// ---------------------------------------------------------------------------
check(footerSource.includes('ROUTES.FOR_STUDENTS'), 'footer links to student acquisition');
check(footerSource.includes('ROUTES.FOR_EMPLOYERS'), 'footer links to employer acquisition');
check(footerSource.includes('ROUTES.FOR_INSTITUTIONS'), 'footer links to institution acquisition');
check(humanSitemap.includes('ROUTES.FOR_STUDENTS'), 'human sitemap includes student acquisition');

console.log(`seoP1PublicAcquisition: ${count} checks passed`);
