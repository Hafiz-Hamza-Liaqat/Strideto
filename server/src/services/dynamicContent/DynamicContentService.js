import { Job } from '../../models/Job.js';
import { Scholarship } from '../../models/Scholarship.js';
import { Admission } from '../../models/Admission.js';
import { University } from '../../models/University.js';
import { Blog } from '../../models/Blog.js';
import { CareerArticle } from '../../models/CareerArticle.js';
import { CmsHomepage } from '../../models/CmsHomepage.js';
import { mongoLocaleFilter } from '../../../../shared/localization/localeFallback.js';
import { normalizeLocale } from '../../../../shared/localization/localeResolver.js';
import { buildLocalizedSlugUrl } from '../../../../shared/localization/localeUtils.js';
import { withFixtureExclusion } from '../../../../shared/publicDiscovery/fixtureExclusion.js';
import { resolvePublicJobLogoUrl } from '../../../../shared/publicDiscovery/projectPublicDiscovery.js';
import {
  attachEmployerLogos,
  collectEmployerIdsForLogoFallback,
  fetchEmployerLogoMap,
} from '../../utils/employerLogoProjection.js';

const JOB_PROJECTION = 'title slug company organization province category jobType deadline logoUrl remote isFeatured createdAt source employerId';
const SCHOLARSHIP_PROJECTION = 'title slug provider country level degreeLevel deadline logoUrl isFeatured amount';
const ADMISSION_PROJECTION = 'program slug institution university province degree deadline logoUrl isFeatured';
const UNIVERSITY_PROJECTION = 'name slug country province city type ranking logoUrl isFeatured description';
const BLOG_PROJECTION = 'title slug excerpt category imageUrl publishedAt isFeatured';
const CAREER_PROJECTION = 'title slug excerpt category imageUrl publishedAt isFeatured views';

function clampCount(count) {
  return Math.min(24, Math.max(1, Number(count) || 6));
}

function activeJobFilter(extra = {}) {
  return withFixtureExclusion({
    status: 'active',
    $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }],
    ...extra,
  });
}

/**
 * @param {string} source
 * @param {object} query
 */
export async function queryDynamicContent(source, query = {}) {
  const count = clampCount(query.count);
  const locale = query.locale || 'en';

  switch (source) {
    case 'latest-jobs':
      return queryJobs(query, count);
    case 'featured-scholarships':
      return queryScholarships(query, count);
    case 'admissions':
      return queryAdmissions(query, count);
    case 'universities':
      return queryUniversities(query, count);
    case 'latest-blogs':
      return queryBlogs(query, count);
    case 'career-guidance':
      return queryCareerArticles(query, count);
    case 'testimonials':
      return queryTestimonials(query, count, locale);
    case 'partners':
      return queryPartners(query, count, locale);
    default:
      return { items: [], total: 0 };
  }
}

async function queryJobs(query, count) {
  const filter = { ...activeJobFilter(), ...mongoLocaleFilter(normalizeLocale(query.locale)) };
  if (query.featuredOnly) filter.isFeatured = true;
  if (query.governmentOnly) filter.jobType = 'Government';
  if (query.province) filter.province = new RegExp(String(query.province).trim(), 'i');
  if (query.category) filter.category = new RegExp(String(query.category).trim(), 'i');
  if (query.remote) filter.remote = true;

  const sort = query.sort === 'deadline' ? { deadline: 1, createdAt: -1 } : { createdAt: -1 };
  const rows = await Job.find(filter).select(JOB_PROJECTION).sort(sort).limit(count).lean();
  const logoMap = await fetchEmployerLogoMap(collectEmployerIdsForLogoFallback(rows));
  const items = attachEmployerLogos(rows, logoMap);
  return { items: items.map(transformJob), total: items.length };
}

async function queryScholarships(query, count) {
  const filter = withFixtureExclusion({ status: 'active', ...mongoLocaleFilter(normalizeLocale(query.locale)) });
  if (query.featured) filter.isFeatured = true;
  if (query.country) filter.country = new RegExp(String(query.country).trim(), 'i');
  if (query.degree) {
    filter.$or = [
      { level: new RegExp(String(query.degree).trim(), 'i') },
      { degreeLevel: new RegExp(String(query.degree).trim(), 'i') },
    ];
  }
  const sort = query.sort === 'deadline' ? { deadline: 1 } : { createdAt: -1 };
  const items = await Scholarship.find(filter).select(SCHOLARSHIP_PROJECTION).sort(sort).limit(count).lean();
  return { items: items.map(transformScholarship), total: items.length };
}

async function queryAdmissions(query, count) {
  const filter = withFixtureExclusion({ status: 'active', ...mongoLocaleFilter(normalizeLocale(query.locale)) });
  if (query.university) {
    const re = new RegExp(String(query.university).trim(), 'i');
    filter.$or = [{ institution: re }, { university: re }];
  }
  if (query.province) filter.province = new RegExp(String(query.province).trim(), 'i');
  if (query.degree) filter.degree = new RegExp(String(query.degree).trim(), 'i');
  if (query.upcomingOnly) filter.deadline = { $gte: new Date() };

  const sort = query.sort === 'deadline' ? { deadline: 1 } : { createdAt: -1 };
  const items = await Admission.find(filter).select(ADMISSION_PROJECTION).sort(sort).limit(count).lean();
  return { items: items.map(transformAdmission), total: items.length };
}

async function queryUniversities(query, count) {
  const filter = withFixtureExclusion({ status: 'active', ...mongoLocaleFilter(normalizeLocale(query.locale)) });
  if (query.featured) filter.isFeatured = true;
  if (query.type) filter.type = query.type;
  if (query.province) filter.province = new RegExp(String(query.province).trim(), 'i');
  const sort = query.sort === 'ranking' ? { ranking: 1, name: 1 } : { createdAt: -1 };
  const items = await University.find(filter).select(UNIVERSITY_PROJECTION).sort(sort).limit(count).lean();
  return { items: items.map(transformUniversity), total: items.length };
}

async function queryBlogs(query, count) {
  const filter = { status: 'published', ...mongoLocaleFilter(normalizeLocale(query.locale)) };
  if (query.featured) filter.isFeatured = true;
  if (query.category) filter.category = new RegExp(String(query.category).trim(), 'i');
  const items = await Blog.find(filter).select(BLOG_PROJECTION).sort({ publishedAt: -1 }).limit(count).lean();
  return { items: items.map(transformBlog), total: items.length };
}

async function queryCareerArticles(query, count) {
  const filter = { status: 'published', ...mongoLocaleFilter(normalizeLocale(query.locale)) };
  if (query.category) filter.category = new RegExp(String(query.category).trim(), 'i');
  const sort = query.sort === 'popular' ? { views: -1, publishedAt: -1 } : { publishedAt: -1 };
  const items = await CareerArticle.find(filter).select(CAREER_PROJECTION).sort(sort).limit(count).lean();
  return { items: items.map(transformCareer), total: items.length };
}

async function queryTestimonials(query, count, locale) {
  const doc = await CmsHomepage.findOne({ locale, status: 'published' }).select('sections.testimonials').lean();
  let items = doc?.sections?.testimonials?.items || [];
  if (query.featured) items = items.filter((t) => t.quote);
  if (query.random) items = [...items].sort(() => Math.random() - 0.5);
  items = items.slice(0, count);
  return {
    items: items.map((t, i) => ({
      id: `testimonial-${i}`,
      title: t.author,
      subtitle: t.role,
      description: t.quote,
      imageUrl: t.avatarUrl,
      href: '',
      meta: [],
    })),
    total: items.length,
  };
}

async function queryPartners(query, count, locale) {
  const doc = await CmsHomepage.findOne({ locale, status: 'published' }).select('sections.partners').lean();
  let items = doc?.sections?.partners?.logos || [];
  if (query.random) items = [...items].sort(() => Math.random() - 0.5);
  items = items.slice(0, count);
  return {
    items: items.map((p, i) => ({
      id: `partner-${i}`,
      title: p.name,
      imageUrl: p.imageUrl,
      href: p.url || '',
      meta: [],
    })),
    total: items.length,
  };
}

function transformJob(doc) {
  const loc = normalizeLocale(doc.locale);
  return {
    id: String(doc._id),
    title: doc.title,
    subtitle: doc.company || doc.organization,
    description: '',
    imageUrl: resolvePublicJobLogoUrl(doc, doc._employerLogoUrl),
    href: buildLocalizedSlugUrl('/jobs', doc.slug, loc),
    meta: [
      doc.province,
      doc.category,
      doc.jobType,
      doc.deadline ? `Deadline: ${new Date(doc.deadline).toLocaleDateString()}` : null,
    ].filter(Boolean),
    deadline: doc.deadline,
  };
}

function transformScholarship(doc) {
  const loc = normalizeLocale(doc.locale);
  return {
    id: String(doc._id),
    title: doc.title,
    subtitle: doc.provider,
    description: doc.amount || '',
    imageUrl: doc.logoUrl,
    href: buildLocalizedSlugUrl('/scholarships', doc.slug, loc),
    meta: [doc.country, doc.level, doc.deadline ? `Deadline: ${new Date(doc.deadline).toLocaleDateString()}` : null].filter(Boolean),
    deadline: doc.deadline,
  };
}

function transformAdmission(doc) {
  const loc = normalizeLocale(doc.locale);
  return {
    id: String(doc._id),
    title: doc.program,
    subtitle: doc.institution || doc.university,
    description: '',
    imageUrl: doc.logoUrl,
    href: buildLocalizedSlugUrl('/admissions', doc.slug, loc),
    meta: [doc.province, doc.degree, doc.deadline ? `Deadline: ${new Date(doc.deadline).toLocaleDateString()}` : null].filter(Boolean),
    deadline: doc.deadline,
  };
}

function transformUniversity(doc) {
  const loc = normalizeLocale(doc.locale);
  return {
    id: String(doc._id),
    title: doc.name,
    subtitle: [doc.city, doc.province].filter(Boolean).join(', '),
    description: doc.description ? String(doc.description).slice(0, 120) : '',
    imageUrl: doc.logoUrl,
    href: buildLocalizedSlugUrl('/university', doc.slug, loc),
    meta: [doc.type, doc.ranking ? `Rank #${doc.ranking}` : null].filter(Boolean),
  };
}

function transformBlog(doc) {
  const loc = normalizeLocale(doc.locale);
  return {
    id: String(doc._id),
    title: doc.title,
    subtitle: doc.category,
    description: doc.excerpt || '',
    imageUrl: doc.imageUrl,
    href: buildLocalizedSlugUrl('/blog', doc.slug, loc),
    meta: doc.publishedAt ? [new Date(doc.publishedAt).toLocaleDateString()] : [],
  };
}

function transformCareer(doc) {
  const loc = normalizeLocale(doc.locale);
  return {
    id: String(doc._id),
    title: doc.title,
    subtitle: doc.category,
    description: doc.excerpt || '',
    imageUrl: doc.imageUrl,
    href: buildLocalizedSlugUrl('/career-guidance', doc.slug, loc),
    meta: doc.views ? [`${doc.views} views`] : [],
  };
}

/**
 * Batch query for multiple blocks on one page (avoids N+1 round-trips).
 * @param {{ source: string; query?: object }[]} requests
 */
export async function batchQueryDynamicContent(requests = []) {
  const results = await Promise.all(
    requests.map(async (req) => ({
      source: req.source,
      ...(await queryDynamicContent(req.source, req.query || {})),
    })),
  );
  return results;
}
