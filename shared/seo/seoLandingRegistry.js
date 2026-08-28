/**
 * SEO-P3 — intentionally approved static SEO landing routes.
 *
 * Reuses the hard-coded landing taxonomy already emitted by seoController and
 * landingPagesController. Does NOT derive routes from arbitrary query params.
 */
import { PAKISTAN_PROVINCES } from '../constants/pakistan.js';

export const SEO_JOB_CITY_SLUGS = Object.freeze([
  'lahore',
  'karachi',
  'islamabad',
  'rawalpindi',
  'faisalabad',
  'multan',
  'peshawar',
  'quetta',
  'sialkot',
  'gujranwala',
]);

export const SEO_JOB_PROVINCE_SLUGS = Object.freeze(
  PAKISTAN_PROVINCES.filter((p) => p !== 'Other').map((p) => p.toLowerCase().replace(/\s+/g, '-'))
);

export const SEO_JOB_CATEGORY_SLUGS = Object.freeze([
  'government-jobs',
  'private-jobs',
  'internships',
  'internship-jobs',
]);

export const SEO_JOB_SOURCE_SLUGS = Object.freeze(['fpsc', 'ppsc', 'nts', 'wapda']);

export const SEO_SCHOLARSHIP_COUNTRY_SLUGS = Object.freeze([
  'turkey',
  'germany',
  'china',
  'uk',
  'usa',
  'australia',
  'canada',
  'hungary',
  'italy',
]);

function pathsFromSlugs(prefix, slugs, suffix = '') {
  return slugs.map((slug) => `${prefix}${slug}${suffix}`);
}

/** All intentionally registered static SEO landing paths (no query strings). */
export const APPROVED_SEO_LANDING_PATHS = Object.freeze([
  '/latest-government-jobs',
  ...pathsFromSlugs('/jobs-in-', SEO_JOB_CITY_SLUGS),
  ...pathsFromSlugs('/jobs-in-', SEO_JOB_PROVINCE_SLUGS),
  ...SEO_JOB_PROVINCE_SLUGS.map((slug) => `/jobs/province/${slug}`),
  ...SEO_JOB_CATEGORY_SLUGS.flatMap((slug) => [`/${slug}`, `/jobs/category/${slug}`]),
  ...pathsFromSlugs('/', SEO_JOB_SOURCE_SLUGS, '-jobs'),
  ...pathsFromSlugs('/scholarships-in-', SEO_SCHOLARSHIP_COUNTRY_SLUGS),
]);

const APPROVED_SEO_LANDING_SET = new Set(APPROVED_SEO_LANDING_PATHS);

export function isApprovedSeoLandingPath(path) {
  const p = String(path || '').split('?')[0].replace(/\/$/, '') || '/';
  return APPROVED_SEO_LANDING_SET.has(p);
}

/**
 * Unknown paths matching landing-like patterns are not auto-indexable.
 * Actual city/country/program facet routes are deferred until density gates pass.
 */
export function isDeferredAutoLandingCandidate(path) {
  const p = String(path || '').split('?')[0];
  return (
    /^\/jobs\/[a-z0-9-]+$/i.test(p) ||
    /^\/jobs\/[a-z0-9-]+\/[a-z0-9-]+$/i.test(p) ||
    /^\/scholarships\/[a-z]{2,3}$/i.test(p) ||
    /^\/programs\//i.test(p)
  );
}

export function resolveUnknownSeoLandingPolicy(path) {
  if (isApprovedSeoLandingPath(path)) {
    return { disposition: 'INDEXABLE', reason: 'approved_registry' };
  }
  if (isDeferredAutoLandingCandidate(path)) {
    return { disposition: 'NOT_FOUND', reason: 'deferred_auto_landing' };
  }
  return { disposition: 'UNKNOWN', reason: 'not_registered' };
}
