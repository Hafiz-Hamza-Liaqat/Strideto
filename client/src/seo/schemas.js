import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE } from './config.js';
import { sanitizeJsonLdString } from './sanitize.js';
import { organizationSameAsUrls } from '@shared/social/officialSocialLinks.js';
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

export function organizationSchema() {
  return stripUndefined({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/branding/logo-symbol.svg`,
    },
    description: DEFAULT_DESCRIPTION,
    areaServed: 'Worldwide',
    sameAs: organizationSameAsUrls(),
  });
}

export function websiteSchema() {
  return stripUndefined({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    publisher: { '@id': `${SITE_URL}/#organization` },
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

export function breadcrumbSchema(items) {
  if (!items?.length) return null;
  return stripUndefined({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url?.startsWith('http') ? item.url : `${SITE_URL}${item.url || ''}`,
    })),
  });
}

export function webPageSchema({ name, description, url, type = 'WebPage' }) {
  return stripUndefined({
    '@context': 'https://schema.org',
    '@type': type,
    name,
    description,
    url: url?.startsWith('http') ? url : `${SITE_URL}${url || ''}`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` },
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
    '@context': 'https://schema.org',
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
  // Both branches below are guaranteed non-empty by the eligibility gate: a
  // fully remote job without a truthful applicant country, and a physical job
  // without a truthful addressCountry, are both already ineligible. Nothing
  // here invents geography.
  const remote = isFullyRemoteJob(job);
  const country = jobPostingCountry(job) || undefined;
  return stripUndefined({
    '@type': 'JobPosting',
    title: sanitizeJsonLdString(job.title, 200),
    description: desc,
    // datePosted — the date the employer's posting became public. STRIDETO's
    // canonical publication field is `publishedAt` (Job.js requires it for the
    // `active` publication state); `createdAt` is the fallback for legacy and
    // pre-canonical records that never received one. This is deliberately the
    // same expression the visible "Posted" fact renders on the detail page
    // (JobDetail.jsx: `formatDate(job.publishedAt || job.createdAt)`), so the
    // markup and the page can never disagree about when the job was posted.
    datePosted: toDateOnly(job.publishedAt || job.createdAt),
    // validThrough is optional in the Google contract and is emitted only when
    // the job genuinely has a closing date. The precedence is the product's own
    // application-closing semantics — deriveJobAvailability() in
    // shared/publicDiscovery/publicTruth.js resolves `applicationsCloseAt ||
    // deadline` to decide whether a job still accepts applications, so the same
    // field, in the same order, is what expires the posting here.
    validThrough: toDateOnly(job.applicationsCloseAt || job.deadline),
    employmentType: mapEmploymentType(job.type),
    hiringOrganization: org
      ? { '@type': 'Organization', name: org }
      : undefined,
    // A fully remote job has no physical premises: emitting a PostalAddress for
    // it would fabricate a workplace. It carries TELECOMMUTE plus the truthful
    // applicant-location country instead.
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
 *
 * SEO-P0B: a list page may point at its detail pages, but it must never embed
 * `JobPosting` objects — that would claim Google for Jobs eligibility for the
 * list itself, for every item on it, regardless of authorization. Job items are
 * therefore emitted as plain summary ListItems carrying a name and the detail
 * URL. The JobPosting claim, when it is allowed at all, lives only on the
 * single job detail page.
 *
 * Every other item type keeps its own semantics: a Scholarship keeps its
 * Scholarship entity and its /scholarships/:slug canonical, and an unrecognised
 * type keeps the `@type`, name and URL it was supplied with.
 */
export function itemListSchema({ name, description, items, itemType = 'Job' }) {
  if (!items?.length) return null;
  return stripUndefined({
    '@context': 'https://schema.org',
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

/**
 * Detail path per item type. A type that is not listed here has no STRIDETO URL
 * space we may assume, so its URL can only come from the item itself — guessing
 * one would publish a link to a page that does not exist.
 */
const LIST_ITEM_DETAIL_PATHS = Object.freeze({
  Job: '/jobs',
  // Legacy caller spelling for the same job collection surface. It still gets a
  // summary ListItem, never a nested JobPosting.
  JobPosting: '/jobs',
  Scholarship: '/scholarships',
});

/** Item types listed as bare summaries — never a nested entity object. */
const SUMMARY_ONLY_LIST_ITEM_TYPES = Object.freeze(['Job', 'JobPosting']);

/** Canonical detail URL for a summary list entry, in that type's own URL space. */
function listItemUrl(item, itemType) {
  if (item?.url) {
    return item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`;
  }
  const basePath = LIST_ITEM_DETAIL_PATHS[itemType];
  return basePath && item?.slug ? `${SITE_URL}${basePath}/${item.slug}` : undefined;
}

/** The nested entity for a list position, if the type has one. */
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
  const url = canonicalUrl || (post.slug ? `${SITE_URL}/blog/${post.slug}` : SITE_URL);
  const image = post.featuredImage || post.imageUrl
    ? ((post.featuredImage || post.imageUrl).startsWith('http') ? (post.featuredImage || post.imageUrl) : `${SITE_URL}${post.featuredImage || post.imageUrl}`)
    : DEFAULT_OG_IMAGE;
  return stripUndefined({
    '@type': 'BlogPosting',
    headline: sanitizeJsonLdString(post.title, 200),
    description: sanitizeJsonLdString(post.excerpt || post.metaDescription || post.title, 500),
    image,
    datePublished: toIsoDate(post.publishedAt || post.createdAt),
    dateModified: toIsoDate(post.updatedAt || post.publishedAt || post.createdAt),
    author: {
      '@type': 'Person',
      name: sanitizeJsonLdString(typeof post.author === 'object' ? post.author?.name : post.author, 100) || SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/branding/logo-symbol.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
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

export function scholarshipSchema(item) {
  if (!item) return null;
  return stripUndefined({
    '@context': 'https://schema.org',
    '@type': 'Scholarship',
    name: item.title,
    description: item.description || item.title,
    url: item.slug ? `${SITE_URL}/scholarships/${item.slug}` : undefined,
    provider: item.provider
      ? { '@type': 'Organization', name: item.provider }
      : { '@type': 'Organization', name: SITE_NAME },
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
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name,
    description,
    url: url?.startsWith('http') ? url : `${SITE_URL}${url || ''}`,
  });
}

export function courseSchema(exam) {
  if (!exam) return null;
  return stripUndefined({
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: exam.name,
    description: exam.description || `${exam.name} exam preparation with syllabus, past papers, and quizzes.`,
    provider: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    url: exam.slug ? `${SITE_URL}/exam-prep/${exam.slug}` : `${SITE_URL}/exam-prep`,
  });
}

export function eventSchema(webinar) {
  if (!webinar) return null;
  return stripUndefined({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: webinar.title,
    description: webinar.description,
    startDate: webinar.scheduledAt || webinar.date,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'VirtualLocation', url: SITE_URL },
    organizer: { '@type': 'Organization', name: SITE_NAME },
  });
}

export { JOB_POSTING_SURFACES };

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
