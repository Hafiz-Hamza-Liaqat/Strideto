import { PRODUCTION_PUBLIC_ORIGIN } from './publicSiteOrigin.js';

const MAX_TEXT = 5000;

export const ENTITY_ROUTE_TYPES = Object.freeze({
  scholarship: '/scholarships/',
  blog: '/blog/',
  institution: '/institutions/',
  test: '/tests/',
  program: '/program-explorer/',
});

function text(value, max = MAX_TEXT) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function first(...values) {
  return values.map((value) => text(value, 1000)).find(Boolean) || '';
}

export function entityCanonicalPath(type, slug) {
  const prefix = ENTITY_ROUTE_TYPES[type];
  const safeSlug = text(slug, 180);
  return prefix && safeSlug && /^[a-z0-9][a-z0-9-]*$/i.test(safeSlug)
    ? `${prefix}${encodeURIComponent(safeSlug)}`
    : null;
}

export function entityCanonicalUrl(type, slug) {
  const path = entityCanonicalPath(type, slug);
  return path ? `${PRODUCTION_PUBLIC_ORIGIN}${path}` : null;
}

export function buildEntityDiscovery(type, entity) {
  if (!entity || !ENTITY_ROUTE_TYPES[type]) return null;
  const title = first(entity.seoTitle, entity.title, entity.name, entity.officialName) || 'STRIDETO';
  const description = first(entity.metaDescription, entity.description, entity.excerpt, entity.summary)
    || `${title} on STRIDETO.`;
  const canonicalPath = entityCanonicalPath(type, entity.slug);
  if (!canonicalPath) return null;
  const canonical = entityCanonicalUrl(type, entity.slug);
  const facts = Array.isArray(entity.facts)
    ? entity.facts.filter((fact) => fact && text(fact.label, 120) && text(fact.value, 500))
      .slice(0, 12)
      .map((fact) => ({ label: text(fact.label, 120), value: text(fact.value, 500) }))
    : [];
  return {
    status: 'public',
    canonicalPath,
    canonical,
    title,
    description,
    robots: 'index, follow',
    heading: title,
    summary: text(entity.summary || description),
    facts,
    jsonLd: entity.jsonLd || null,
  };
}

export function buildEntityJsonLd(type, entity) {
  if (!entity || !entity.slug) return null;
  const url = entityCanonicalUrl(type, entity.slug);
  const description = first(entity.description, entity.excerpt, entity.summary);
  const base = { '@context': 'https://schema.org', name: first(entity.title, entity.name, entity.officialName), description, url };
  if (type === 'blog') {
    return {
      ...base,
      '@type': 'BlogPosting',
      headline: base.name,
      ...(entity.author ? { author: { '@type': 'Person', name: text(entity.author, 300) } } : {}),
      ...(entity.publishedAt ? { datePublished: entity.publishedAt } : {}),
      ...(entity.updatedAt ? { dateModified: entity.updatedAt } : {}),
    };
  }
  if (type === 'institution') {
    return {
      ...base,
      '@type': entity.institutionType === 'university' ? 'CollegeOrUniversity' : 'EducationalOrganization',
      ...(entity.officialWebsite ? { sameAs: entity.officialWebsite } : {}),
      ...(entity.city || entity.region || entity.countryCode ? {
        address: {
          '@type': 'PostalAddress',
          ...(entity.city ? { addressLocality: entity.city } : {}),
          ...(entity.region ? { addressRegion: entity.region } : {}),
          ...(entity.countryCode ? { addressCountry: entity.countryCode } : {}),
        },
      } : {}),
    };
  }
  if (type === 'program') {
    return {
      ...base,
      '@type': 'Course',
      ...(entity.degreeLevel ? { educationalLevel: entity.degreeLevel } : {}),
      ...(entity.institutionName ? { provider: { '@type': 'EducationalOrganization', name: entity.institutionName } } : {}),
      ...(entity.durationMonths ? { timeRequired: `P${entity.durationMonths}M` } : {}),
    };
  }
  if (type === 'scholarship') {
    return { ...base, '@type': 'Scholarship', ...(entity.provider ? { provider: { '@type': 'Organization', name: entity.provider } } : {}) };
  }
  return { ...base, '@type': 'WebPage' };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003C').replace(/>/g, '\\u003E').replace(/&/g, '\\u0026');
}

function replaceMeta(html, selector, tag) {
  const pattern = selector === 'title'
    ? /<title[^>]*>[\s\S]*?<\/title>/i
    : new RegExp(`<meta\\s+name=["']${selector}["'][^>]*>`, 'i');
  return html.match(pattern) ? html.replace(pattern, tag) : html.replace('</head>', `${tag}</head>`);
}

export function renderEntitySeoShell(baseHtml, discovery) {
  const safe = discovery || { title: 'STRIDETO', description: 'Public STRIDETO content.', robots: 'noindex, follow', canonical: null, heading: 'Content not found', summary: 'The requested content could not be found.', facts: [], jsonLd: null };
  let html = replaceMeta(baseHtml, 'title', `<title>${escapeHtml(safe.title)}</title>`);
  html = replaceMeta(html, 'description', `<meta name="description" content="${escapeHtml(safe.description)}">`);
  html = replaceMeta(html, 'robots', `<meta name="robots" content="${escapeHtml(safe.robots || 'noindex, follow')}">`);
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '');
  if (safe.canonical && safe.robots === 'index, follow') {
    html = html.replace('</head>', `<link rel="canonical" href="${escapeHtml(safe.canonical)}"></head>`);
  }
  html = html.replace(/<div id="seo-discovery"[\s\S]*?<\/div>\s*/i, '');
  const facts = (safe.facts || []).map((fact) => `<dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd>`).join('');
  const jsonLd = safe.jsonLd ? `<script type="application/ld+json">${escapeJson(safe.jsonLd)}</script>` : '';
  const discoveryHtml = `<div id="seo-discovery"><main><h1>${escapeHtml(safe.heading)}</h1><p>${escapeHtml(safe.summary)}</p>${facts ? `<dl>${facts}</dl>` : ''}</main>${jsonLd}</div>`;
  if (html.includes('<div id="root"></div>')) return html.replace('<div id="root"></div>', `${discoveryHtml}<div id="root"></div>`);
  if (html.includes('<div id="root">')) return html.replace('<div id="root">', `${discoveryHtml}<div id="root">`);
  return html.replace('<body>', `<body>${discoveryHtml}`);
}

export function buildNotFoundDiscovery(type, slug) {
  return {
    status: 'not_found',
    canonicalPath: entityCanonicalPath(type, slug),
    canonical: null,
    title: 'Content not found | STRIDETO',
    description: 'The requested public content could not be found.',
    robots: 'noindex, follow',
    heading: 'Content not found',
    summary: 'The requested public content could not be found.',
    facts: [],
    jsonLd: null,
  };
}
