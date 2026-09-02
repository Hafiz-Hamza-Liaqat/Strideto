/**
 * MKT-P8-A1 — public route ownership and sitemap parity.
 *
 * Source-level contract test: no database or network access.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  INDEXABLE_STATIC_PATHS,
  isForbiddenSitemapPath,
} from '../../../shared/seo/publicIndexablePages.js';
import {
  evaluateCollectionSeo,
} from '../../../shared/seo/collectionSeoPolicy.js';
import {
  isQueryStringSitemapUrl,
  isSitemapEligiblePath,
} from '../../../shared/seo/sitemapPolicy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '../../..');
const read = (relativePath) => readFileSync(path.join(repo, relativePath), 'utf8');

const routes = read('client/src/routes/index.jsx');
const constants = read('client/src/constants/index.js');
const sitemap = read('server/src/controllers/seoController.js');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

// A1/A2 — every static sitemap route has a corresponding public route or an
// explicitly registered SEO landing route. The route expressions below map
// the concrete sitemap paths to the actual React route declarations.
const staticRouteEvidence = new Map([
  ['/', 'index route'],
  ['/jobs', 'ROUTES.JOBS'],
  ['/scholarships', 'ROUTES.SCHOLARSHIPS'],
  ['/admissions', 'ROUTES.ADMISSIONS'],
  ['/internships', 'ROUTES.INTERNSHIPS'],
  ['/program-explorer', 'ROUTES.PROGRAM_EXPLORER'],
  ['/tests', 'ROUTES.TEST_HUB'],
  ['/tests/compare', 'ROUTES.TEST_COMPARE'],
  ['/schools-and-colleges', 'ROUTES.SCHOOLS_AND_COLLEGES'],
  ['/foreign-studies', 'ROUTES.FOREIGN_STUDIES'],
  ['/intl-scholarships', 'ROUTES.INTL_SCHOLARSHIPS'],
  ['/institutions', 'ROUTES.EDUCATION_INSTITUTIONS'],
  ['/scholarship-intelligence', 'ROUTES.CANONICAL_SCHOLARSHIPS'],
  ['/providers', 'ROUTES.PROVIDERS'],
  ['/providers/education-mobility', 'ROUTES.PROVIDERS_EDUCATION_MOBILITY'],
  ['/providers/business-formation', 'ROUTES.PROVIDERS_BUSINESS_FORMATION'],
  ['/agents', 'ROUTES.AGENT_PUBLIC_DIRECTORY'],
  ['/agents/marketplace', 'ROUTES.AGENT_PUBLIC_MARKETPLACE'],
  ['/services', 'ROUTES.SERVICES'],
  ['/career-guidance', 'ROUTES.CAREER_GUIDANCE'],
  ['/resume-builder', 'ROUTES.RESUME_BUILDER'],
  ['/blog', 'ROUTES.BLOG'],
  ['/webinars', 'ROUTES.WEBINARS'],
  ['/about', 'ROUTES.ABOUT'],
  ['/editorial-policy', 'ROUTES.EDITORIAL_POLICY'],
  ['/press', 'ROUTES.PRESS'],
  ['/students', 'ROUTES.FOR_STUDENTS'],
  ['/employers', 'ROUTES.FOR_EMPLOYERS'],
  ['/for-institutions', 'ROUTES.FOR_INSTITUTIONS'],
  ['/contact', 'ROUTES.CONTACT'],
  ['/help-center', 'ROUTES.HELP_CENTER'],
  ['/faq', 'ROUTES.FAQ'],
  ['/support', 'ROUTES.SUPPORT'],
  ['/sitemap', 'ROUTES.SITEMAP'],
  ['/advertise', 'ROUTES.ADVERTISE'],
  ['/submit-opportunity', 'ROUTES.SUBMIT_OPPORTUNITY'],
  ['/privacy-policy', 'ROUTES.PRIVACY_POLICY'],
  ['/terms', 'ROUTES.TERMS'],
  ['/cookie-policy', 'ROUTES.COOKIES'],
  ['/cookies', 'ROUTES.COOKIES_LEGACY'],
  ['/disclaimer', 'ROUTES.DISCLAIMER'],
  ['/refund-policy', 'ROUTES.REFUND_POLICY'],
  ['/careers', 'ROUTES.CAREERS'],
  ['/latest-government-jobs', "path: '/latest-government-jobs'"],
]);

check(
  staticRouteEvidence.size === INDEXABLE_STATIC_PATHS.length,
  'A1: static route evidence covers every indexable static sitemap path'
);
for (const route of INDEXABLE_STATIC_PATHS) {
  const evidence = staticRouteEvidence.get(route);
  check(evidence !== undefined, `A1: sitemap path has route evidence: ${route}`);
  if (route === '/') continue;
  if (evidence === 'ROUTES.PROVIDERS') {
    check(
      routes.includes("{ path: ROUTES.PROVIDERS, element: <LegacyProviderPortalLanding /> }") &&
        constants.includes("PROVIDERS: '/providers'"),
      'A2: /providers is a real public LegacyProviderPortalLanding route'
    );
    continue;
  }
  check(
    routes.includes(evidence) || routes.includes(evidence.replace('ROUTES.', '')),
    `A1: route tree contains ownership expression for ${route}`
  );
}

check(
  routes.includes("ROUTES.PROVIDERS_EDUCATION_MOBILITY") &&
    routes.includes("ROUTES.PROVIDERS_BUSINESS_FORMATION"),
  'A2: provider acquisition subroutes are explicitly present'
);
check(
  routes.includes("{ path: ROUTES.BUSINESS_SERVICES, element: <BusinessServicesMarketplace /> }") &&
    routes.includes("ROUTES.BUSINESS_SERVICES_LISTING"),
  'A1: business services has an explicit public route and detail route'
);
check(
  !sitemap.includes("'/providers',") || INDEXABLE_STATIC_PATHS.includes('/providers'),
  'A2: sitemap does not retain an unowned /providers entry'
);

// A3/A4/A5/A8 — collection query policy and sitemap URL safety.
for (const [pathName, query] of [
  ['/jobs', '?q=python'],
  ['/scholarships', '?country=ireland'],
  ['/blog', '?category=career'],
]) {
  const policy = evaluateCollectionSeo({ cleanPath: pathName, searchParams: query });
  check(!policy.indexable, `A4: ${pathName}${query} is not indexable`);
  check(policy.robots === 'noindex, follow', `A4: ${pathName}${query} uses noindex,follow`);
  check(policy.canonicalPath === pathName, `A5: ${pathName}${query} canonicalizes to clean route`);
}
check(!evaluateCollectionSeo({ cleanPath: '/jobs', searchParams: '' }).canonicalPath.includes('?'), 'A5: clean collection has no query canonical');
check(!isSitemapEligiblePath('/jobs?q=python'), 'A8: query-string paths are rejected from sitemap');
check(isQueryStringSitemapUrl('/jobs?page=2'), 'A8: query-string detector recognizes pagination');

// A6 — private routes are never sitemap-eligible.
for (const privatePath of ['/admin', '/dashboard', '/account', '/applications', '/messages', '/employer/jobs', '/agent/business-services', '/institution/profile']) {
  check(isForbiddenSitemapPath(privatePath), `A6: private route is forbidden: ${privatePath}`);
  check(!isSitemapEligiblePath(privatePath), `A6: private route cannot enter sitemap: ${privatePath}`);
}

// A7 — the controller deduplicates URLs before serializing one urlset.
check(sitemap.includes('const urlMap = new Map()'), 'A7: sitemap deduplicates by canonical URL');
check(sitemap.includes('urlMap.set(entry.loc, entry)'), 'A7: duplicate sitemap locations are replaced, not repeated');

// A9/A10 — Job and institution ownership remain on their existing policies.
check(sitemap.includes("addUrl(`/jobs/${j.slug}`"), 'A9: Jobs retain /jobs/:slug sitemap ownership');
check(sitemap.includes("addUrl(`/institutions/${i.slug}`"), 'A10: canonical institutions retain /institutions/:slug ownership');
check(sitemap.includes("addUrl(`/schools-and-colleges/${i.slug}`"), 'A10: legacy institutions retain their own proven route family');
check(
  routes.includes("`${ROUTES.SCHOOLS_AND_COLLEGES}/:slug`") &&
    routes.includes("`${ROUTES.EDUCATION_INSTITUTIONS}/:slug`") ,
  'A10: legacy and canonical institution detail routes remain distinct in the router'
);

console.log(`mktP8A1RouteOwnership: ${checks} checks passed`);
