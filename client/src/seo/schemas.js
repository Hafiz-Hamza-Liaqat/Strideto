import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, buildCanonicalUrl } from './config.js';
import { sanitizeJsonLdString } from './sanitize.js';
import { organizationSameAsUrls } from '@shared/social/officialSocialLinks.js';
import {
  ORGANIZATION_ID,
  WEBSITE_ID,
  ORGANIZATION_LOGO_URL,
  buildPageId,
  buildBreadcrumbId,
  buildBlogPostingId,
  normalizeSchemaPath,
} from './entityIds.js';
import {
  JOB_POSTING_SURFACES,
  evaluateJobPostingEligibility,
  isFullyRemoteJob,
  jobPostingCountry,
} from '@shared/seo/jobPostingEligibility.js';

function mapEmploymentType(type) {
  const t = String(type || '').toUpperCase();
  if (t.includes('PART')) return 'PART_TIME';
  if (t.includes('INTERN')) return 'INTERN';
  if (t.includes('CONTRACT')) return 'CONTRACTOR';
  if (t.includes('TEMP')) return 'TEMPORARY';
  return 'FULL_TIME';
}

function toDateOnly(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

function toIsoDate(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function stripUndefined(obj) {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    const arr = obj.map(stripUndefined).filter((v) => v !== undefined);
    return arr.length ? arr : undefined;
  }
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = stripUndefined(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return obj;
}

function resolveCanonicalPageUrl(url) {
  if (!url) return SITE_URL;
  return url.startsWith('http') ? url.replace(/\/$/, '') || url : buildCanonicalUrl(url);
}

export function organizationSchema() {
  return stripUndefined({
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: ORGANIZATION_LOGO_URL,
    },
    description: DEFAULT_DESCRIPTION,
    areaServed: 'Worldwide',
    sameAs: organizationSameAsUrls(),
  });
}

export function websiteSchema() {
  return stripUndefined({
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    publisher: { '@id': ORGANIZATION_ID },
    inLanguage: ['en-PK', 'ur-PK'],
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/jobs?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  });
}

export function breadcrumbSchema(items, pageUrl) {
  if (!items?.length) return null;
  const pagePath = pageUrl ?? items[items.length - 1]?.url ?? '/';
  return stripUndefined({
    '@type': 'BreadcrumbList',
    '@id': buildBreadcrumbId(pagePath),
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url?.startsWith('http') ? item.url : `${SITE_URL}${item.url || ''}`,
    })),
  });
}

export function webPageSchema({ name, description, url, type = 'WebPage' }) {
  const canonicalUrl = resolveCanonicalPageUrl(url);
  return stripUndefined({
    '@type': type,
    '@id': buildPageId(url || '/'),
    name,
    description,
    url: canonicalUrl,
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORGANIZATION_ID },
    breadcrumb: { '@id': buildBreadcrumbId(url || '/') },
  });
}

export function collectionPageSchema({ name, description, url }) {
  return webPageSchema({ name, description, url, type: 'CollectionPage' });
}

export function contactPageSchema({ name = 'Contact Strideto', description, url = '/contact' }) {
  return webPageSchema({
    name,
    description: description || 'Contact Strideto for support, partnerships, or to submit opportunities.',
    url,
    type: 'ContactPage',
  });
}

export function aboutPageSchema({ name = 'About Strideto', description, url = '/about' }) {
  return webPageSchema({
    name,
    description: description || "Learn about Strideto — your career journey starts here with jobs, scholarships, admissions, and skills.",
    url,
    type: 'AboutPage',
  });
}

export function faqPageSchema(faqs) {
  if (!faqs?.length) return null;
  return stripUndefined({
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  });
}

/**
 * JobPosting JSON-LD for a SINGLE eligible job detail page (SEO-P0B).
 *
 * Every caller must pass `surface`. Anything other than the detail surface —
 * a collection, search, category, city, province or other ItemList landing —
 * returns null by policy, and so does any job STRIDETO is not authorized to
 * publish on behalf of. See shared/seo/jobPostingEligibility.js.
 */
export function jobPostingSchema(job, { surface, now } = {}) {
  const { eligible } = evaluateJobPostingEligibility(job, { surface, now });
  if (!eligible) return null;
  const org = job.organization || job.company;
  const desc = sanitizeJsonLdString(job.description || `${job.title}${org ? ` at ${org}` : ''}`, 5000);
  const locality = job.city || undefined;
  const region = job.province || job.location || undefined;
  const remote = isFullyRemoteJob(job);
  const country = jobPostingCountry(job) || undefined;
  return stripUndefined({
    '@type': 'JobPosting',
    title: sanitizeJsonLdString(job.title, 200),
    description: desc,
    datePosted: toDateOnly(job.publishedAt || job.createdAt),
    validThrough: toDateOnly(job.applicationsCloseAt || job.deadline),
    employmentType: mapEmploymentType(job.type),
    hiringOrganization: org
      ? { '@type': 'Organization', name: org }
      : undefined,
    jobLocation: !remote && (locality || region)
      ? {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: locality,
            addressRegion: region,
            addressCountry: country,
          },
        }
      : undefined,
    jobLocationType: remote ? 'TELECOMMUTE' : undefined,
    applicantLocationRequirements: remote && country
      ? { '@type': 'Country', name: country }
      : undefined,
    url: job.slug ? `${SITE_URL}/jobs/${job.slug}` : undefined,
  });
}

/**
 * ItemList for a listing/landing surface. Genuinely generic: the item type
 * decides the shape and the URL space, and nothing is routed through another
 * content type's URL builder.
 */
export function itemListSchema({ name, description, items, itemType = 'Job' }) {
  if (!items?.length) return null;
  return stripUndefined({
    '@type': 'ItemList',
    name,
    description,
    numberOfItems: items.length,
    itemListElement: items.slice(0, 20).map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: sanitizeJsonLdString(item.title || item.name, 200),
      url: listItemUrl(item, itemType),
      item: listItemEntity(item, itemType),
    })),
  });
}

const LIST_ITEM_DETAIL_PATHS = Object.freeze({
  Job: '/jobs',
  JobPosting: '/jobs',
  Scholarship: '/scholarships',
});

const SUMMARY_ONLY_LIST_ITEM_TYPES = Object.freeze(['Job', 'JobPosting']);

function listItemUrl(item, itemType) {
  if (item?.url) {
    return item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`;
  }
  const basePath = LIST_ITEM_DETAIL_PATHS[itemType];
  return basePath && item?.slug ? `${SITE_URL}${basePath}/${item.slug}` : undefined;
}

function listItemEntity(item, itemType) {
  if (SUMMARY_ONLY_LIST_ITEM_TYPES.includes(itemType)) return undefined;
  if (itemType === 'Scholarship') return scholarshipSchema(item);
  return stripUndefined({
    '@type': itemType,
    name: item?.title || item?.name,
    url: listItemUrl(item, itemType),
  });
}

export function blogPostingSchema(post, { readingMinutes, canonicalUrl } = {}) {
  if (!post) return null;
  const path = post.slug ? `/blog/${post.slug}` : '/blog';
  const url = canonicalUrl || buildCanonicalUrl(path);
  const pagePath = normalizeSchemaPath(canonicalUrl || path);
  const image = post.featuredImage || post.imageUrl
    ? ((post.featuredImage || post.imageUrl).startsWith('http') ? (post.featuredImage || post.imageUrl) : `${SITE_URL}${post.featuredImage || post.imageUrl}`)
    : DEFAULT_OG_IMAGE;
  const authorName = sanitizeJsonLdString(
    typeof post.author === 'object' ? post.author?.name : post.author,
    100
  );
  return stripUndefined({
    '@type': 'BlogPosting',
    '@id': buildBlogPostingId(pagePath),
    headline: sanitizeJsonLdString(post.title, 200),
    description: sanitizeJsonLdString(post.excerpt || post.metaDescription || post.title, 500),
    image,
    datePublished: toIsoDate(post.publishedAt || post.createdAt),
    dateModified: toIsoDate(post.updatedAt || post.publishedAt || post.createdAt),
    author: authorName
      ? { '@type': 'Person', name: authorName }
      : undefined,
    publisher: { '@id': ORGANIZATION_ID },
    mainEntityOfPage: { '@id': buildPageId(pagePath) },
    url,
    wordCount: post.content ? post.content.trim().split(/\s+/).length : undefined,
    timeRequired: readingMinutes ? `PT${readingMinutes}M` : undefined,
    keywords: post.tags?.join(', ') || post.keywords,
  });
}

export function articleSchema(post, options) {
  const blog = blogPostingSchema(post, options);
  if (blog) blog['@type'] = 'Article';
  return blog;
}

function resolveExplicitOrganizationName(item, fields) {
  if (!item) return undefined;
  for (const field of fields) {
    const value = item[field];
    if (!value) continue;
    if (typeof value === 'object' && value.name) {
      const name = sanitizeJsonLdString(value.name, 200);
      return name ? { '@type': 'Organization', name } : undefined;
    }
    const name = sanitizeJsonLdString(String(value).trim(), 200);
    if (name) return { '@type': 'Organization', name };
  }
  return undefined;
}

function resolveScholarshipProvider(item) {
  // CMS Scholarship persists only `provider` (required). Admin API accepts
  // `organization` as a write alias that is stored as `provider` — it is not
  // a persisted/read field. funder/sponsor are not provider equivalents (P3).
  return resolveExplicitOrganizationName(item, ['provider']);
}

function resolveCourseProvider(exam) {
  if (!exam) return undefined;
  if (exam.providerId === ORGANIZATION_ID || exam.providerRef === ORGANIZATION_ID) {
    return { '@id': ORGANIZATION_ID };
  }
  return resolveExplicitOrganizationName(exam, ['provider', 'authority']);
}

export function scholarshipSchema(item) {
  if (!item) return null;
  return stripUndefined({
    '@type': 'Scholarship',
    name: item.title,
    description: item.description || item.title,
    url: item.slug ? `${SITE_URL}/scholarships/${item.slug}` : undefined,
    provider: resolveScholarshipProvider(item),
    eligibleRegion: item.country || undefined,
    applicationDeadline: item.deadline,
    amount: item.amount
      ? { '@type': 'MonetaryAmount', currency: 'PKR', value: item.amount }
      : undefined,
    educationalLevel: item.level,
  });
}

export function educationalOrganizationSchema({ name, description, url }) {
  return stripUndefined({
    '@type': 'EducationalOrganization',
    name,
    description,
    url: url?.startsWith('http') ? url : `${SITE_URL}${url || ''}`,
  });
}

export function courseSchema(exam) {
  if (!exam) return null;
  return stripUndefined({
    '@type': 'Course',
    name: exam.name,
    description: exam.description || `${exam.name} exam preparation with syllabus, past papers, and quizzes.`,
    provider: resolveCourseProvider(exam),
    url: exam.slug ? `${SITE_URL}/exam-prep/${exam.slug}` : `${SITE_URL}/exam-prep`,
  });
}

export { JOB_POSTING_SURFACES };
export {
  ORGANIZATION_ID,
  WEBSITE_ID,
  ORGANIZATION_LOGO_URL,
  buildPageId,
  buildBreadcrumbId,
  buildBlogPostingId,
  buildEntityId,
} from './entityIds.js';

export function combineSchemas(...schemas) {
  const flat = schemas.flat().filter(Boolean);
  if (!flat.length) return null;
  const normalized = flat.map((s) => {
    if (!s || typeof s !== 'object') return s;
    const rest = { ...s };
    delete rest['@context'];
    return rest;
  });
  if (normalized.length === 1) {
    return { '@context': 'https://schema.org', ...normalized[0] };
  }
  return { '@context': 'https://schema.org', '@graph': normalized };
}
