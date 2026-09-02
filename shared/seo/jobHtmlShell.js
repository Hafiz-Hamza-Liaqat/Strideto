import { buildJobDiscoverySummary } from '../jobs/jobDiscovery.js';
import { normalizeJobSkills } from '../jobs/jobSkills.js';
import { normalizeJobTextList } from '../jobs/jobTextLists.js';
import { deriveJobAvailability, JOB_AVAILABILITY } from '../publicDiscovery/publicTruth.js';
import {
  evaluateJobPostingEligibility,
  JOB_POSTING_SURFACES,
  isFullyRemoteJob,
  jobPostingCountry,
} from './jobPostingEligibility.js';

export const SEO_ORIGIN = 'https://www.strideto.com';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function sanitizeSchemaString(value, maxLength = 5000) {
  if (value == null) return undefined;
  const cleaned = String(value)
    .replace(/<\/script/gi, '<\\/script')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return (code >= 32 && code !== 127) || code === 10 || code === 13;
    })
    .join('')
    .trim()
    .slice(0, maxLength);
  return cleaned || undefined;
}

function stripUndefined(value) {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value.map(stripUndefined).filter((item) => item !== undefined);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .map(([key, item]) => [key, stripUndefined(item)])
      .filter(([, item]) => item !== undefined));
  }
  return value;
}

function toDateOnly(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function mapEmploymentType(type) {
  const normalized = String(type || '').toUpperCase();
  if (normalized.includes('PART')) return 'PART_TIME';
  if (normalized.includes('INTERN')) return 'INTERN';
  if (normalized.includes('CONTRACT')) return 'CONTRACTOR';
  if (normalized.includes('TEMP')) return 'TEMPORARY';
  return 'FULL_TIME';
}

function upsertTitle(html, title) {
  const tag = `<title data-rh="true">${escapeHtml(title)}</title>`;
  return /<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, tag)
    : html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function upsertMeta(html, name, content) {
  const tag = `<meta name="${name}" data-rh="true" content="${escapeHtml(content)}" />`;
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\bname=["']${name}["'])[^>]*>`, 'gi');
  return html.replace(pattern, '').replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function upsertCanonical(html, href) {
  const pattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi;
  return html.replace(pattern, '').replace(/<\/head>/i, `  <link rel="canonical" data-rh="true" href="${escapeHtml(href)}" />\n</head>`);
}

export function renderSeoShell(baseHtml, route) {
  let html = upsertTitle(baseHtml, route.title);
  html = upsertMeta(html, 'description', route.description);
  html = upsertMeta(html, 'robots', route.robots);
  html = route.robots.startsWith('index')
    ? upsertCanonical(html, `${SEO_ORIGIN}${route.path}`)
    : html.replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, '');
  return html;
}

function jobShellDescription(job) {
  return String(job.metaDescription || buildJobDiscoverySummary(job) || `${job.title || 'Job'} on STRIDETO`).trim();
}

function jobShellTitle(job) {
  return String(job.seoTitle || `${job.title || 'Job'} - Jobs | STRIDETO`).trim();
}

export function buildJobPostingSchema(job, { surface, now, siteUrl = SEO_ORIGIN } = {}) {
  const eligibility = evaluateJobPostingEligibility(job, { surface, now });
  if (!eligibility.eligible) return null;
  const remote = isFullyRemoteJob(job);
  const country = jobPostingCountry(job) || undefined;
  const skills = normalizeJobSkills(job.skillsRequired);
  const benefits = normalizeJobTextList(job.benefits);
  const organization = job.organization || job.company;
  const place = job.city || job.province || job.region || job.location;
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: sanitizeSchemaString(job.title, 200),
    description: sanitizeSchemaString(job.description || `${job.title}${organization ? ` at ${organization}` : ''}`),
    datePosted: toDateOnly(job.publishedAt || job.createdAt),
    validThrough: toDateOnly(job.applicationsCloseAt || job.deadline),
    employmentType: mapEmploymentType(job.type),
    hiringOrganization: organization ? { '@type': 'Organization', name: organization } : undefined,
    jobLocation: !remote && place ? {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.city || undefined,
        addressRegion: job.province || job.region || job.location || undefined,
        addressCountry: country,
      },
    } : undefined,
    jobLocationType: remote ? 'TELECOMMUTE' : undefined,
    applicantLocationRequirements: remote && country ? { '@type': 'Country', name: country } : undefined,
    skills: skills.length ? skills.join(', ') : undefined,
    experienceRequirements: job.experience || undefined,
    educationRequirements: job.educationRequirement || undefined,
    qualifications: Array.isArray(job.requirements) && job.requirements.length ? job.requirements : undefined,
    responsibilities: Array.isArray(job.responsibilities) && job.responsibilities.length ? job.responsibilities : undefined,
    jobBenefits: benefits.length ? benefits : undefined,
    occupationalCategory: job.jobFamily || job.category || undefined,
    url: job.slug ? `${siteUrl.replace(/\/$/, '')}/jobs/${job.slug}` : undefined,
  };
}

export function renderJobShell(baseHtml, job) {
  const slug = String(job.slug || '').replace(/^\/+/, '');
  const route = {
    path: `/jobs/${slug}`,
    title: jobShellTitle(job),
    description: jobShellDescription(job),
    robots: 'index, follow',
  };
  let html = renderSeoShell(baseHtml, route);
  const location = [job.city, job.region || job.province, job.countryCode].filter(Boolean).join(', ');
  const mode = job.workMode || (job.remote ? 'remote' : job.hybrid ? 'hybrid' : '');
  const summary = [job.organization || job.company, location, mode].filter(Boolean).join(' | ');
  const schema = buildJobPostingSchema(job, { surface: JOB_POSTING_SURFACES.DETAIL });
  const listSection = (heading, items) => {
    const values = Array.isArray(items) ? items.filter(Boolean) : [];
    return values.length
      ? `<section><h2>${heading}</h2><ul>${values.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`
      : '';
  };
  const description = String(job.description || '').trim();
  const availability = job.availability || deriveJobAvailability(job);
  const availabilityMessage = availability !== JOB_AVAILABILITY.OPEN
    ? '<p>Applications are closed for this opportunity.</p>'
    : '';
  const shell = `<main data-seo-shell="job"><article><h1>${escapeHtml(job.title || 'Job')}</h1><p>${escapeHtml(summary)}</p>${availabilityMessage}<p>${escapeHtml(jobShellDescription(job))}</p>${description ? `<section><h2>Job description</h2><p>${escapeHtml(description)}</p></section>` : ''}${listSection('Responsibilities', job.responsibilities)}${listSection('Requirements', job.requirements)}${listSection('Skills', normalizeJobSkills(job.skillsRequired))}${listSection('Compensation / Benefits', normalizeJobTextList(job.benefits))}${job.locationEligibility ? `<section><h2>Location Eligibility</h2><p>${escapeHtml(job.locationEligibility)}</p></section>` : ''}</article></main>`
    + (schema ? `<script type="application/ld+json">${escapeJson(schema)}</script>` : '');
  return html.replace('<div id="root"></div>', `<div id="root">${shell}</div>`);
}
