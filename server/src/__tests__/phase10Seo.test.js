import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolvePublicSiteOrigin, PRODUCTION_PUBLIC_ORIGIN, LOCAL_PUBLIC_ORIGIN } from '../../../shared/seo/publicSiteOrigin.js';
import { buildRobotsTxt, isPrivateSeoPath } from '../../../shared/seo/robotsPolicy.js';
import { INDEXABLE_STATIC_PATHS, isForbiddenSitemapPath } from '../../../shared/seo/publicIndexablePages.js';
import { sanitizePublicCopyright, isForbiddenPublicHref } from '../../../shared/seo/publicCopyright.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const controller = readFileSync(path.join(here, '../controllers/seoController.js'), 'utf8');
const schemas = readFileSync(path.join(here, '../../../client/src/seo/schemas.js'), 'utf8');
const config = readFileSync(path.join(here, '../../../client/src/seo/config.js'), 'utf8');
const globalSeo = readFileSync(path.join(here, '../../../client/src/components/seo/GlobalSeo.jsx'), 'utf8');
const loginReturn = readFileSync(path.join(here, '../../../client/src/utils/loginReturn.js'), 'utf8');

check(resolvePublicSiteOrigin('') === PRODUCTION_PUBLIC_ORIGIN, 'unset origin → strideto.com');
check(resolvePublicSiteOrigin('https://strideto.com/') === PRODUCTION_PUBLIC_ORIGIN, 'production origin canonical');
check(resolvePublicSiteOrigin('https://localhost:8443') === LOCAL_PUBLIC_ORIGIN, 'local 8443 preserved');
check(resolvePublicSiteOrigin('http://localhost:8080') === LOCAL_PUBLIC_ORIGIN, 'retired 8080 remapped away');
check(!String(resolvePublicSiteOrigin('http://localhost:8080')).includes('8080'), 'no 8080 in origin output');

const robots = buildRobotsTxt('https://strideto.com');
check(robots.includes('Allow: /'), 'robots allow public');
check(robots.includes('Disallow: /admin'), 'robots disallow admin');
check(robots.includes('Disallow: /dashboard'), 'robots disallow dashboard');
check(robots.includes('Disallow: /vault'), 'robots disallow vault');
check(robots.includes('Disallow: /agent/'), 'robots disallow /agent/ not /agents');
check(!robots.includes('Disallow: /agents'), 'robots does not disallow public /agents');
check(robots.includes('Disallow: /employer'), 'robots disallow employer portal');
check(robots.includes('Disallow: /institution/'), 'robots disallow institution portal');
check(robots.includes('Sitemap: https://strideto.com/sitemap.xml'), 'robots sitemap reference');
check(controller.includes('Not an authorization boundary') || controller.includes('crawler hints only'), 'robots is not treated as auth');

check(isPrivateSeoPath('/admin/users') === true, 'admin is private SEO');
check(isPrivateSeoPath('/agents') === false, 'public agents is not private SEO');
check(isPrivateSeoPath('/agent/leads') === true, 'agent portal is private SEO');
check(isPrivateSeoPath('/jobs') === false, 'jobs is public SEO');
check(isPrivateSeoPath('/vault') === true, 'vault is private SEO');
check(isPrivateSeoPath('/auth/login') === true, 'login is private SEO / noindex');

check(INDEXABLE_STATIC_PATHS.includes('/'), 'indexable home');
check(INDEXABLE_STATIC_PATHS.includes('/jobs'), 'indexable jobs');
check(INDEXABLE_STATIC_PATHS.includes('/sitemap'), 'indexable human sitemap');
check(!INDEXABLE_STATIC_PATHS.includes('/license'), 'license not indexable');
check(!INDEXABLE_STATIC_PATHS.includes('/admin'), 'admin not indexable');
check(isForbiddenSitemapPath('/license') === true, 'license forbidden in XML');
check(isForbiddenSitemapPath('/admin/moderation') === true, 'admin forbidden in XML');
check(isForbiddenSitemapPath('/jobs/foo') === false, 'public job detail not forbidden');

check(controller.includes("status: 'active'"), 'jobs sitemap uses active');
check(controller.includes('PUB_STATUSES.PUBLISHED'), 'programs/tests require published');
check(controller.includes('VERIFICATION_STATUSES.APPROVED'), 'agents require approved orgs');
check(controller.includes('MARKETPLACE_PUBLICATION_STATUSES.PUBLISHED'), 'marketplace published only');
check(!controller.includes('/license'), 'XML generator has no /license');
check(!controller.includes('systems-limited'), 'no hardcoded company URL');
check(!controller.includes('changefreq'), 'no fabricated changefreq');
check(!controller.includes('priority'), 'no fabricated priority');
check(!controller.includes('localhost:8080'), 'no retired 8080 sitemap origin');
check(controller.includes('application/xml'), 'XML content type');

// SEO-P0B moved the non-active/expired/draft suppression (and the new
// authorization + detail-surface gates) into shared/seo/jobPostingEligibility.js,
// which seoP0IndexabilityAndJobPostingPolicy.test.js covers case by case.
check(/evaluateJobPostingEligibility\(job, \{ surface, now \}\)/.test(schemas), 'JobPosting delegates emission to the shared eligibility policy');
check(/if \(!eligible\) return null/.test(schemas), 'JobPosting emits nothing when the policy denies it');
check(!/baseSalary|salaryCurrency/.test(schemas), 'JobPosting does not emit salary');
check(!/AggregateRating|aggregateRating/.test(schemas), 'no fake ratings schema');

check(/isPrivateSeoPath/.test(globalSeo), 'GlobalSeo noindexes private prefixes');
check(/noindex, nofollow/.test(globalSeo), 'private pages get noindex');
check(/resolvePublicSiteOrigin/.test(config), 'client canonical uses public origin helper');
check(/undefined\|null\|\\\[object Object\\\]/.test(config), 'titles sanitize undefined/null');

check(sanitizePublicCopyright('© 2026 Strideto. All rights reserved. · Open source under MIT License.') === '© 2026 Strideto. All rights reserved.', 'MIT promo stripped from copyright');
check(isForbiddenPublicHref('/license') === true, 'license href forbidden');
check(isForbiddenPublicHref('https://github.com/SyedDaniyal31/Strideto') === true, 'github href forbidden');
check(isForbiddenPublicHref('http://localhost:8080/sitemap.xml') === true, 'localhost href forbidden');
check(isForbiddenPublicHref('/jobs') === false, 'jobs href allowed');

check(/loginLocationState|safeReturnPath|realm/.test(loginReturn), 'Phase-8 login-return helper still present');
check(!/window\.location\s*=/.test(loginReturn), 'login-return is not an open redirect into window.location');

console.log(`phase10Seo.test.js: ${count} assertions passed`);
