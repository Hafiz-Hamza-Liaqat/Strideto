/**
 * SEO-P5 — truthful public freshness and sitemap lastmod policy.
 */
import { PUB_STATUSES } from '../education/taxonomy.js';
import { resolveSitemapLastmod } from './sitemapPolicy.js';
import {
  isJobDetailPubliclyEligible,
  isCmsScholarshipDetailEligible,
  isIntlScholarshipDetailEligible,
  isCanonicalScholarshipDetailEligible,
  isCanonicalInstitutionDetailEligible,
  isProgramDetailIndexable,
} from './entityDetailSeoPolicy.js';

/** Fields that must not alone trigger freshness / IndexNow on jobs. */
export const JOB_NON_CONTENT_FIELDS = Object.freeze([
  'views',
  'applicationsCount',
  'isFeatured',
  'isSponsored',
  'priority',
  'urgent',
  'boostLevel',
  'paidUntil',
  'planId',
  'planType',
  'chargedSubmissionAt',
  'submittedAt',
  'scrapedAt',
  'updatedAt',
  'createdAt',
]);

export const BLOG_NON_CONTENT_FIELDS = Object.freeze([
  'views',
  'isFeatured',
  'readingTime',
  'updatedAt',
  'createdAt',
]);

export const CMS_NON_CONTENT_FIELDS = Object.freeze([
  'views',
  'isFeatured',
  'isPaid',
  'paidUntil',
  'launchEligible',
  'updatedAt',
  'createdAt',
]);

export const SEO_ENTITY_TYPES = Object.freeze({
  JOB: 'job',
  BLOG: 'blog',
  SCHOLARSHIP: 'scholarship',
  INTL_SCHOLARSHIP: 'intl-scholarship',
  CANONICAL_SCHOLARSHIP: 'canonical-scholarship',
  ADMISSION: 'admission',
  FOREIGN_STUDY: 'foreign-study',
  INTERNSHIP: 'internship',
  CANONICAL_INSTITUTION: 'canonical-institution',
  PROGRAM: 'program',
});

export function resolveSeoEntityPath(entityType, doc) {
  if (!doc?.slug) return null;
  const slug = String(doc.slug).trim();
  if (!slug) return null;
  switch (entityType) {
    case SEO_ENTITY_TYPES.JOB:
      return `/jobs/${slug}`;
    case SEO_ENTITY_TYPES.BLOG:
      return `/blog/${slug}`;
    case SEO_ENTITY_TYPES.SCHOLARSHIP:
      return `/scholarships/${slug}`;
    case SEO_ENTITY_TYPES.INTL_SCHOLARSHIP:
      return `/intl-scholarships/${slug}`;
    case SEO_ENTITY_TYPES.CANONICAL_SCHOLARSHIP:
      return `/scholarship-intelligence/${slug}`;
    case SEO_ENTITY_TYPES.ADMISSION:
      return `/admissions/${slug}`;
    case SEO_ENTITY_TYPES.FOREIGN_STUDY:
      return `/foreign-studies/${slug}`;
    case SEO_ENTITY_TYPES.INTERNSHIP:
      return `/internships/${slug}`;
    case SEO_ENTITY_TYPES.CANONICAL_INSTITUTION:
      return `/institutions/${slug}`;
    case SEO_ENTITY_TYPES.PROGRAM:
      return `/program-explorer/${slug}`;
    default:
      return null;
  }
}

export function isSeoEntityIndexable(entityType, doc, context = {}) {
  if (!doc) return false;
  switch (entityType) {
    case SEO_ENTITY_TYPES.JOB:
      return isJobDetailPubliclyEligible(doc);
    case SEO_ENTITY_TYPES.BLOG:
      return Boolean(doc.slug) && doc.status === 'published';
    case SEO_ENTITY_TYPES.SCHOLARSHIP:
      return isCmsScholarshipDetailEligible(doc);
    case SEO_ENTITY_TYPES.INTL_SCHOLARSHIP:
      return isIntlScholarshipDetailEligible(doc);
    case SEO_ENTITY_TYPES.CANONICAL_SCHOLARSHIP:
      return isCanonicalScholarshipDetailEligible(doc);
    case SEO_ENTITY_TYPES.ADMISSION:
      return Boolean(doc.slug) && doc.status === 'active';
    case SEO_ENTITY_TYPES.FOREIGN_STUDY:
      return Boolean(doc.slug) && doc.status === 'active';
    case SEO_ENTITY_TYPES.INTERNSHIP:
      return Boolean(doc.slug) && doc.status === 'active';
    case SEO_ENTITY_TYPES.CANONICAL_INSTITUTION:
      return isCanonicalInstitutionDetailEligible(doc, {
        programCount: context.programCount ?? 0,
        acceptedTestCount: context.acceptedTestCount ?? 0,
      });
    case SEO_ENTITY_TYPES.PROGRAM:
      return isProgramDetailIndexable(doc);
    default:
      return false;
  }
}

function pickMeaningfulJobTimestamp(doc) {
  return doc.publicationUpdatedAt || doc.publishedAt || doc.updatedAt || doc.createdAt;
}

function pickMeaningfulBlogTimestamp(doc) {
  return doc.updatedAt || doc.publishedAt || doc.createdAt;
}

function pickMeaningfulCmsTimestamp(doc) {
  return doc.updatedAt || doc.createdAt;
}

function pickMeaningfulEducationTimestamp(doc) {
  return doc.updatedAt || doc.createdAt;
}

/**
 * Resolve truthful sitemap lastmod for an entity — never request time.
 */
export function resolveEntitySitemapLastmod(entityType, doc, options = {}) {
  if (!doc) return undefined;
  let source;
  switch (entityType) {
    case SEO_ENTITY_TYPES.JOB:
      source = pickMeaningfulJobTimestamp(doc);
      break;
    case SEO_ENTITY_TYPES.BLOG:
      source = pickMeaningfulBlogTimestamp(doc);
      break;
    case SEO_ENTITY_TYPES.SCHOLARSHIP:
    case SEO_ENTITY_TYPES.ADMISSION:
    case SEO_ENTITY_TYPES.FOREIGN_STUDY:
    case SEO_ENTITY_TYPES.INTERNSHIP:
    case SEO_ENTITY_TYPES.INTL_SCHOLARSHIP:
      source = pickMeaningfulCmsTimestamp(doc);
      break;
    case SEO_ENTITY_TYPES.CANONICAL_SCHOLARSHIP:
    case SEO_ENTITY_TYPES.CANONICAL_INSTITUTION:
    case SEO_ENTITY_TYPES.PROGRAM:
      source = pickMeaningfulEducationTimestamp(doc);
      break;
    default:
      source = doc.updatedAt || doc.publishedAt || doc.createdAt;
  }
  return resolveSitemapLastmod(source, options);
}

function stableJsonSubset(doc, excludeKeys = []) {
  if (!doc || typeof doc !== 'object') return '';
  const skip = new Set(excludeKeys);
  const out = {};
  for (const [key, value] of Object.entries(doc)) {
    if (skip.has(key)) continue;
    out[key] = value;
  }
  return JSON.stringify(out);
}

export function hasMeaningfulPublicContentChange(entityType, previous, next) {
  if (!previous || !next) return Boolean(next);
  switch (entityType) {
    case SEO_ENTITY_TYPES.JOB:
      return stableJsonSubset(previous, JOB_NON_CONTENT_FIELDS)
        !== stableJsonSubset(next, JOB_NON_CONTENT_FIELDS);
    case SEO_ENTITY_TYPES.BLOG:
      return stableJsonSubset(previous, BLOG_NON_CONTENT_FIELDS)
        !== stableJsonSubset(next, BLOG_NON_CONTENT_FIELDS);
    case SEO_ENTITY_TYPES.SCHOLARSHIP:
    case SEO_ENTITY_TYPES.ADMISSION:
    case SEO_ENTITY_TYPES.FOREIGN_STUDY:
    case SEO_ENTITY_TYPES.INTERNSHIP:
    case SEO_ENTITY_TYPES.INTL_SCHOLARSHIP:
      return stableJsonSubset(previous, CMS_NON_CONTENT_FIELDS)
        !== stableJsonSubset(next, CMS_NON_CONTENT_FIELDS);
    case SEO_ENTITY_TYPES.CANONICAL_SCHOLARSHIP:
    case SEO_ENTITY_TYPES.CANONICAL_INSTITUTION:
    case SEO_ENTITY_TYPES.PROGRAM:
      return stableJsonSubset(previous, ['updatedAt', 'createdAt', 'launchEligible'])
        !== stableJsonSubset(next, ['updatedAt', 'createdAt', 'launchEligible']);
    default:
      return stableJsonSubset(previous, ['updatedAt', 'createdAt'])
        !== stableJsonSubset(next, ['updatedAt', 'createdAt']);
  }
}

export const SEO_CHANGE_ACTION = Object.freeze({
  NO_OP: 'no_op',
  URL_UPDATED: 'url_updated',
  URL_REMOVED: 'url_removed',
});

/** Dedupe canonical paths while preserving order. */
export function dedupeSeoNotificationUrls(urls) {
  if (!Array.isArray(urls)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of urls) {
    const path = String(raw || '').trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push(path);
  }
  return out;
}

/**
 * Pure policy: decide whether a lifecycle event should notify search engines.
 */
export function evaluateSeoChange({
  entityType,
  previous = null,
  next = null,
  action = 'save',
  context = {},
}) {
  const prevPath = previous ? resolveSeoEntityPath(entityType, previous) : null;
  const nextPath = next ? resolveSeoEntityPath(entityType, next) : null;
  const prevIndexable = previous
    ? isSeoEntityIndexable(entityType, previous, context)
    : false;
  const nextIndexable = next ? isSeoEntityIndexable(entityType, next, context) : false;

  if (action === 'delete') {
    if (prevIndexable && prevPath) {
      return { action: SEO_CHANGE_ACTION.URL_REMOVED, urls: [prevPath] };
    }
    return { action: SEO_CHANGE_ACTION.NO_OP, urls: [] };
  }

  if (!previous && nextIndexable && nextPath) {
    return { action: SEO_CHANGE_ACTION.URL_UPDATED, urls: [nextPath] };
  }

  if (previous && !prevIndexable && nextIndexable && nextPath) {
    return { action: SEO_CHANGE_ACTION.URL_UPDATED, urls: [nextPath] };
  }

  if (previous && prevIndexable && !nextIndexable && prevPath) {
    return { action: SEO_CHANGE_ACTION.URL_REMOVED, urls: [prevPath] };
  }

  if (previous && prevIndexable && nextIndexable) {
    if (prevPath && nextPath && prevPath !== nextPath) {
      return {
        action: SEO_CHANGE_ACTION.URL_UPDATED,
        urls: dedupeSeoNotificationUrls([prevPath, nextPath]),
      };
    }
    const path = nextPath || prevPath;
    if (!path) return { action: SEO_CHANGE_ACTION.NO_OP, urls: [] };
    if (!hasMeaningfulPublicContentChange(entityType, previous, next)) {
      return { action: SEO_CHANGE_ACTION.NO_OP, urls: [] };
    }
    return { action: SEO_CHANGE_ACTION.URL_UPDATED, urls: [path] };
  }

  return { action: SEO_CHANGE_ACTION.NO_OP, urls: [] };
}

/** Map contentIntegration resource keys to SEO entity types. */
export function contentResourceToSeoEntity(resource) {
  const map = {
    job: SEO_ENTITY_TYPES.JOB,
    jobs: SEO_ENTITY_TYPES.JOB,
    blog: SEO_ENTITY_TYPES.BLOG,
    blogs: SEO_ENTITY_TYPES.BLOG,
    scholarship: SEO_ENTITY_TYPES.SCHOLARSHIP,
    scholarships: SEO_ENTITY_TYPES.SCHOLARSHIP,
    admission: SEO_ENTITY_TYPES.ADMISSION,
    admissions: SEO_ENTITY_TYPES.ADMISSION,
    university: SEO_ENTITY_TYPES.INTL_SCHOLARSHIP,
    universities: SEO_ENTITY_TYPES.INTL_SCHOLARSHIP,
    'intl-scholarship': SEO_ENTITY_TYPES.INTL_SCHOLARSHIP,
    'intl-scholarships': SEO_ENTITY_TYPES.INTL_SCHOLARSHIP,
    internship: SEO_ENTITY_TYPES.INTERNSHIP,
    internships: SEO_ENTITY_TYPES.INTERNSHIP,
    'foreign-study': SEO_ENTITY_TYPES.FOREIGN_STUDY,
    'foreign-studies': SEO_ENTITY_TYPES.FOREIGN_STUDY,
    'canonical-institution': SEO_ENTITY_TYPES.CANONICAL_INSTITUTION,
    program: SEO_ENTITY_TYPES.PROGRAM,
    'canonical-scholarship': SEO_ENTITY_TYPES.CANONICAL_SCHOLARSHIP,
  };
  return map[resource] || null;
}

export function isPublishedEducationStatus(status) {
  return status === PUB_STATUSES.PUBLISHED || status === 'published';
}
