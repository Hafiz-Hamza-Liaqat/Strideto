/**
 * Map source entities → canonical search documents (C.7.0.4).
 */
import { normalizeSearchDocument } from '../../../../shared/search/searchDocument.js';
import { buildLocalizedSlugUrl } from '../../../../shared/localization/localeUtils.js';
import { normalizeLocale } from '../../../../shared/localization/localeResolver.js';
import { isPubliclyLaunchVisible } from '../../../../shared/publicDiscovery/fixtureExclusion.js';
import { isTestPubliclyPromotable } from '../../../../shared/education/testPublicationPolicy.js';
import { buildJobDiscoverySummary } from '../../../../shared/jobs/jobDiscovery.js';

function docLocale(doc) {
  return normalizeLocale(doc?.locale || 'en');
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractBlockText(blocks = []) {
  const parts = [];
  for (const block of blocks) {
    if (block?.enabled === false) continue;
    const c = block.config || {};
    ['title', 'headline', 'subheadline', 'subtitle', 'buttonText', 'primaryCtaLabel'].forEach((k) => {
      if (c[k]) parts.push(String(c[k]));
    });
    if (c.html) parts.push(stripHtml(c.html));
    if (c.content) parts.push(stripHtml(c.content));
    if (c.itemsJson) {
      try {
        const items = JSON.parse(c.itemsJson);
        if (Array.isArray(items)) {
          items.forEach((item) => {
            if (item?.question) parts.push(item.question);
            if (item?.answer) parts.push(stripHtml(item.answer));
            if (item?.title) parts.push(item.title);
          });
        }
      } catch { /* ignore */ }
    }
  }
  return parts.join(' ');
}

/**
 * @param {import('../../models/Job.js').Job} doc
 */
export function mapJobToSearchDocument(doc) {
  if (!doc) return null;
  const id = String(doc._id);
  return normalizeSearchDocument({
    entityType: 'job',
    entityId: id,
    title: doc.title,
    slug: doc.slug,
    url: buildLocalizedSlugUrl('/jobs', doc.slug, docLocale(doc)),
    summary: (stripHtml(doc.description) || buildJobDiscoverySummary(doc)).slice(0, 300),
    keywords: [doc.company, doc.organization, doc.category, doc.jobFamily, doc.specialization, doc.jobType, doc.type, doc.workMode].filter(Boolean),
    category: doc.category,
    jobFamily: doc.jobFamily,
    province: doc.province || doc.region,
    country: doc.countryCode || null,
    tags: doc.skillsRequired || [],
    searchText: [
      doc.title, doc.company, doc.organization, doc.category, doc.jobFamily,
      doc.specialization, doc.type, doc.jobType, doc.workMode, doc.countryCode,
      doc.region, doc.province, doc.city, ...(Array.isArray(doc.skillsRequired) ? doc.skillsRequired : []),
    ].filter(Boolean).join(' '),
    publishedAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    featured: Boolean(doc.isFeatured),
    status: doc.status === 'active' ? 'active' : doc.status,
    searchable: doc.status === 'active' && isPubliclyLaunchVisible(doc),
    locale: docLocale(doc),
    metadata: {
      adminEditUrl: `/admin/jobs`,
      icon: 'job',
      company: doc.company || doc.organization,
      launchEligible: isPubliclyLaunchVisible(doc),
    },
  });
}

export function mapScholarshipToSearchDocument(doc) {
  if (!doc) return null;
  const id = String(doc._id);
  return normalizeSearchDocument({
    entityType: 'scholarship',
    entityId: id,
    title: doc.title,
    slug: doc.slug,
    url: buildLocalizedSlugUrl('/scholarships', doc.slug, docLocale(doc)),
    summary: [doc.amount, doc.provider].filter(Boolean).join(' · '),
    keywords: [doc.provider, doc.level, doc.degreeLevel].filter(Boolean),
    category: doc.level,
    country: doc.country,
    publishedAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    featured: Boolean(doc.isFeatured),
    status: doc.status === 'active' ? 'active' : doc.status,
    searchable: doc.status === 'active' && isPubliclyLaunchVisible(doc),
    locale: docLocale(doc),
    metadata: { adminEditUrl: '/admin/scholarships', icon: 'scholarship', launchEligible: isPubliclyLaunchVisible(doc) },
  });
}

export function mapAdmissionToSearchDocument(doc) {
  if (!doc) return null;
  const id = String(doc._id);
  return normalizeSearchDocument({
    entityType: 'admission',
    entityId: id,
    title: doc.program,
    slug: doc.slug,
    url: buildLocalizedSlugUrl('/admissions', doc.slug, docLocale(doc)),
    summary: doc.institution || doc.university || '',
    keywords: [doc.institution, doc.university, doc.degree].filter(Boolean),
    category: doc.degree,
    province: doc.province,
    country: doc.countryCode || null,
    publishedAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    featured: Boolean(doc.isFeatured),
    status: doc.status === 'active' ? 'active' : doc.status,
    searchable: doc.status === 'active' && isPubliclyLaunchVisible(doc),
    locale: docLocale(doc),
    metadata: { adminEditUrl: '/admin/admissions', icon: 'admission', launchEligible: isPubliclyLaunchVisible(doc) },
  });
}

export function mapUniversityToSearchDocument(doc) {
  if (!doc) return null;
  const id = String(doc._id);
  return normalizeSearchDocument({
    entityType: 'university',
    entityId: id,
    title: doc.name,
    slug: doc.slug,
    url: buildLocalizedSlugUrl('/university', doc.slug, docLocale(doc)),
    summary: stripHtml(doc.description).slice(0, 300),
    keywords: [doc.type, doc.city].filter(Boolean),
    category: doc.type,
    province: doc.province,
    country: doc.country,
    publishedAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    featured: Boolean(doc.isFeatured),
    status: doc.status === 'active' ? 'active' : doc.status,
    searchable: doc.status === 'active',
    locale: docLocale(doc),
    metadata: { adminEditUrl: '/admin/universities', icon: 'university' },
  });
}

export function mapBlogToSearchDocument(doc) {
  if (!doc) return null;
  const id = String(doc._id);
  return normalizeSearchDocument({
    entityType: 'blog',
    entityId: id,
    title: doc.title,
    slug: doc.slug,
    url: buildLocalizedSlugUrl('/blog', doc.slug, docLocale(doc)),
    summary: doc.excerpt || stripHtml(doc.content).slice(0, 300),
    keywords: doc.tags || [],
    category: doc.category,
    publishedAt: doc.publishedAt || doc.createdAt,
    updatedAt: doc.updatedAt,
    featured: Boolean(doc.isFeatured),
    status: doc.status === 'published' ? 'published' : doc.status,
    searchable: doc.status === 'published',
    locale: docLocale(doc),
    metadata: { adminEditUrl: '/admin/blogs', icon: 'blog' },
  });
}

export function mapCareerArticleToSearchDocument(doc) {
  if (!doc) return null;
  const id = String(doc._id);
  return normalizeSearchDocument({
    entityType: 'career-guidance',
    entityId: id,
    title: doc.title,
    slug: doc.slug,
    url: buildLocalizedSlugUrl('/career-guidance', doc.slug, docLocale(doc)),
    summary: doc.excerpt || stripHtml(doc.content).slice(0, 300),
    category: doc.category,
    tags: doc.tags || [],
    publishedAt: doc.publishedAt || doc.createdAt,
    updatedAt: doc.updatedAt,
    featured: Boolean(doc.isFeatured),
    status: doc.status === 'published' ? 'published' : doc.status,
    searchable: doc.status === 'published',
    locale: docLocale(doc),
    metadata: { adminEditUrl: '/admin/career-guidance', icon: 'career' },
  });
}

export function mapCmsPageToSearchDocument(doc) {
  if (!doc) return null;
  const id = String(doc._id);
  const url = doc.canonicalUrl || `/${doc.slug}`;
  const sectionText = (doc.sections || []).map((s) => `${s.title || ''} ${s.body || ''}`).join(' ');
  return normalizeSearchDocument({
    entityType: 'cms-page',
    entityId: id,
    title: doc.title,
    slug: doc.slug,
    url,
    summary: doc.metaDescription || stripHtml(doc.content).slice(0, 300),
    keywords: [doc.pageType, doc.heading].filter(Boolean),
    category: doc.pageType,
    publishedAt: doc.publishedAt || doc.createdAt,
    updatedAt: doc.updatedAt,
    status: doc.status === 'published' ? 'published' : doc.status,
    searchable: doc.status === 'published',
    locale: doc.locale || 'en',
    metadata: { adminEditUrl: '/admin/site-cms', icon: 'page' },
    searchText: [doc.title, doc.heading, stripHtml(doc.content), sectionText].join(' '),
  });
}

export function mapPageLayoutToSearchDocument(doc) {
  if (!doc) return null;
  const id = String(doc._id);
  const blockText = extractBlockText(doc.publishedBlocks || []);
  const url = doc.canonicalUrl || `/${doc.pageKey}`;
  return normalizeSearchDocument({
    entityType: 'page-builder-page',
    entityId: id,
    title: doc.title || doc.pageKey,
    slug: doc.pageKey,
    url,
    summary: doc.metaDescription || blockText.slice(0, 300),
    keywords: [doc.pageKey],
    publishedAt: doc.publishedAt || doc.updatedAt,
    updatedAt: doc.updatedAt,
    status: doc.status === 'published' ? 'published' : doc.status,
    searchable: doc.status === 'published',
    locale: doc.locale || 'en',
    metadata: { adminEditUrl: '/admin/page-builder', icon: 'page', pageKey: doc.pageKey },
    searchText: [doc.title, doc.seoTitle, doc.metaDescription, blockText].join(' '),
  });
}

export function mapFormToSearchDocument(doc) {
  if (!doc) return null;
  const id = String(doc._id);
  return normalizeSearchDocument({
    entityType: 'form',
    entityId: id,
    title: doc.name,
    slug: doc.slug,
    url: '',
    summary: doc.description || '',
    category: doc.category,
    publishedAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    status: doc.status,
    searchable: doc.status === 'published',
    locale: docLocale(doc),
    metadata: { adminEditUrl: '/admin/forms', icon: 'form' },
  });
}

export function mapMediaToSearchDocument(doc) {
  if (!doc) return null;
  const id = String(doc._id);
  return normalizeSearchDocument({
    entityType: 'media',
    entityId: id,
    title: doc.originalFilename || doc.filename,
    slug: doc.filename,
    url: doc.publicUrl || '',
    summary: [doc.altText, doc.caption].filter(Boolean).join(' · '),
    keywords: doc.tags || [],
    category: doc.mimeType,
    publishedAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    status: doc.status || 'active',
    searchable: true,
    locale: docLocale(doc),
    metadata: { adminEditUrl: '/admin/media', icon: 'media' },
  });
}

/**
 * @param {import('../../models/career/TalentProfile.js').TalentProfile} doc
 */
export function mapTalentProfileToSearchDocument(doc) {
  if (!doc || doc.visibility !== 'public' || doc.status === 'archived') return null;
  const id = String(doc._id);
  const skillNames = (doc.skills || []).map((s) => s.name).filter(Boolean);
  return normalizeSearchDocument({
    entityType: 'talent-profile',
    entityId: id,
    title: doc.displayName || 'Talent Profile',
    slug: doc.publicSlug || id,
    url: doc.publicSlug ? `/talent/${doc.publicSlug}` : `/talent/${id}`,
    summary: String(doc.headline || doc.summary || '').slice(0, 300),
    keywords: skillNames,
    category: doc.preferences?.preferredIndustries?.[0] || '',
    country: doc.preferences?.preferredCountries?.[0] || doc.market || '',
    tags: skillNames,
    publishedAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    status: doc.status === 'active' ? 'active' : doc.status,
    searchable: doc.visibility === 'public' && doc.status !== 'archived',
    locale: docLocale(doc),
    metadata: {
      icon: 'user',
      headline: doc.headline,
      workMode: doc.preferences?.workMode,
    },
  });
}

export function mapCredentialToSearchDocument(doc) {
  if (!doc || doc.verificationStatus !== 'active') return null;
  const id = String(doc._id);
  return normalizeSearchDocument({
    entityType: 'credential',
    entityId: id,
    title: doc.title,
    slug: id,
    url: `/talent/credentials/${id}`,
    summary: String(doc.description || `${doc.skillName || ''} ${doc.score != null ? `${doc.score}%` : ''}`.trim()).slice(0, 300),
    keywords: [doc.issuer, doc.skillName].filter(Boolean),
    tags: [doc.skillName, doc.source].filter(Boolean),
    publishedAt: doc.issuedAt || doc.createdAt,
    updatedAt: doc.updatedAt,
    status: doc.verificationStatus,
    searchable: doc.verificationStatus === 'active',
    locale: docLocale(doc),
    metadata: {
      icon: 'badge',
      issuer: doc.issuer,
      score: doc.score,
      skillName: doc.skillName,
    },
  });
}

export function mapTestToSearchDocument(doc) {
  if (!doc || !isTestPubliclyPromotable(doc)) return null;
  const provider = doc.providerId || {};
  return normalizeSearchDocument({
    entityType: 'test',
    entityId: String(doc._id),
    title: doc.name,
    slug: doc.slug,
    url: `/tests/${doc.slug}`,
    summary: doc.description || doc.overview || '',
    keywords: [doc.shortName, provider.name, doc.category, ...(doc.purposes || [])].filter(Boolean),
    category: doc.category,
    country: doc.countryCodes || [],
    publishedAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    status: 'published',
    searchable: true,
    locale: 'en',
    metadata: { adminEditUrl: '/admin/education/tests', icon: 'test', provider: provider.name || '' },
  });
}

export const SEARCH_DOCUMENT_MAPPERS = {
  job: mapJobToSearchDocument,
  scholarship: mapScholarshipToSearchDocument,
  admission: mapAdmissionToSearchDocument,
  university: mapUniversityToSearchDocument,
  blog: mapBlogToSearchDocument,
  'career-guidance': mapCareerArticleToSearchDocument,
  'cms-page': mapCmsPageToSearchDocument,
  'page-builder-page': mapPageLayoutToSearchDocument,
  form: mapFormToSearchDocument,
  media: mapMediaToSearchDocument,
  'talent-profile': mapTalentProfileToSearchDocument,
  credential: mapCredentialToSearchDocument,
  test: mapTestToSearchDocument,
};
