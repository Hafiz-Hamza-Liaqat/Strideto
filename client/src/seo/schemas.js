import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE } from './config.js';
import { sanitizeJsonLdString } from './sanitize.js';
import { organizationSameAsUrls } from '@shared/social/officialSocialLinks.js';

function mapEmploymentType(type) {
  const t = String(type || '').toUpperCase();
  if (t.includes('PART')) return 'PART_TIME';
  if (t.includes('INTERN')) return 'INTERN';
  if (t.includes('CONTRACT')) return 'CONTRACTOR';
  if (t.includes('TEMP')) return 'TEMPORARY';
  return 'FULL_TIME';
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
    areaServed: { '@type': 'Country', name: 'Pakistan' },
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

export function jobPostingSchema(job) {
  if (!job) return null;
  const org = job.organization || job.company;
  const desc = sanitizeJsonLdString(job.description || `${job.title}${org ? ` at ${org}` : ''}`, 5000);
  return stripUndefined({
    '@type': 'JobPosting',
    title: sanitizeJsonLdString(job.title, 200),
    description: desc,
    datePosted: job.createdAt ? new Date(job.createdAt).toISOString().slice(0, 10) : undefined,
    validThrough: job.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : undefined,
    employmentType: mapEmploymentType(job.type),
    hiringOrganization: org
      ? { '@type': 'Organization', name: org }
      : undefined,
    jobLocation: job.province || job.location || job.city
      ? {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: job.city,
            addressRegion: job.province || job.location,
            addressCountry: 'PK',
          },
        }
      : undefined,
    url: job.slug ? `${SITE_URL}/jobs/${job.slug}` : undefined,
  });
}

export function itemListSchema({ name, description, items, itemType = 'JobPosting' }) {
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
      item:
        itemType === 'JobPosting'
          ? jobPostingSchema(item)
          : itemType === 'Scholarship'
            ? scholarshipSchema(item)
            : { '@type': itemType, name: item.title || item.name, url: item.url },
    })),
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
    eligibleRegion: item.country || 'Pakistan',
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
