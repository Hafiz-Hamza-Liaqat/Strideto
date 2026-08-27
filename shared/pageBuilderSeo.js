/**
 * Page Builder SEO resolution & validation (C.6.4.15).
 */
import { parseJsonArray } from './blockSchema.js';
import { collectDynamicBlockJsonLd, dedupeDynamicJsonLd } from './dynamicBlocks/seo.js';

const DEFAULT_SITE_URL = 'https://www.strideto.com';

/**
 * @param {string} [html]
 */
export function stripHtmlToText(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {import('./blockSchema.js').PageBlock[]} blocks
 */
export function extractOgImageFromBlocks(blocks) {
  for (const block of blocks || []) {
    if (block.enabled === false) continue;
    const cfg = block.config || {};
    if (block.type === 'hero' && cfg.backgroundImageUrl) return String(cfg.backgroundImageUrl);
    if (block.type === 'cta' && cfg.backgroundImageUrl) return String(cfg.backgroundImageUrl);
    if (block.type === 'gallery') {
      if (cfg.mode === 'single' && cfg.imageUrl) return String(cfg.imageUrl);
      const images = parseJsonArray(cfg.imagesJson);
      const first = images.find((img) => img?.url);
      if (first?.url) return String(first.url);
    }
    if (block.type === 'feature-cards') {
      const cards = parseJsonArray(cfg.cardsJson);
      const withImg = cards.find((c) => c?.imageUrl);
      if (withImg?.imageUrl) return String(withImg.imageUrl);
    }
    if (block.type === 'logo-grid') {
      const logos = parseJsonArray(cfg.logosJson);
      const first = logos.find((l) => l?.url);
      if (first?.url) return String(first.url);
    }
  }
  return '';
}

/**
 * @param {object} layout
 * @param {import('./blockSchema.js').PageBlock[]} blocks
 * @param {string} [fallback]
 */
export function buildMetaDescriptionFallback(layout, blocks, fallback = '') {
  const explicit = String(layout?.metaDescription || fallback || '').trim();
  if (explicit) return explicit;

  for (const block of blocks || []) {
    if (block.enabled === false) continue;
    const cfg = block.config || {};
    if (block.type === 'hero' && cfg.subheadline) return String(cfg.subheadline).trim();
    if (block.type === 'rich-text') {
      const text = stripHtmlToText(cfg.htmlContent || cfg.body);
      if (text) return text.slice(0, 160);
    }
    if (block.type === 'cta' && cfg.description) return String(cfg.description).trim();
  }

  return String(layout?.title || layout?.pageKey || '').trim();
}

/**
 * @param {object} layout
 * @param {string} [fallback]
 */
export function buildPageTitleFallback(layout, fallback = '') {
  return String(layout?.seoTitle || layout?.title || fallback || layout?.pageKey || '').trim();
}

/**
 * @param {import('./blockSchema.js').PageBlock[]} blocks
 */
export function collectFaqStructuredData(blocks) {
  /** @type {object[]} */
  const entities = [];

  for (const block of blocks || []) {
    if (block.enabled === false || block.type !== 'faq') continue;
    const items = parseJsonArray(block.config?.itemsJson).filter((i) => i?.question && i?.answer);
    for (const item of items) {
      entities.push({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      });
    }
  }

  if (!entities.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entities,
  };
}

/**
 * @param {unknown} schema
 */
export function validateJsonLdSchema(schema) {
  /** @type {string[]} */
  const errors = [];
  if (!schema || typeof schema !== 'object') {
    errors.push('JSON-LD schema is empty');
    return { ok: false, errors };
  }
  const s = /** @type {Record<string, unknown>} */ (schema);
  if (!s['@context']) errors.push('JSON-LD missing @context');
  if (!s['@type'] && !s['@graph']) errors.push('JSON-LD missing @type or @graph');
  return { ok: errors.length === 0, errors };
}

/**
 * @param {unknown[]} schemas
 */
export function dedupeStructuredData(schemas) {
  const list = (schemas || []).filter(Boolean);
  let faqMerged = false;
  /** @type {object[]} */
  const faqEntities = [];
  /** @type {object[]} */
  const rest = [];

  for (const schema of list) {
    if (schema['@type'] === 'FAQPage') {
      faqMerged = true;
      const entities = schema.mainEntity;
      if (Array.isArray(entities)) faqEntities.push(...entities);
    } else {
      rest.push(schema);
    }
  }

  if (faqMerged && faqEntities.length) {
    rest.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqEntities,
    });
  }

  return rest;
}

/**
 * @param {{ name: string; url: string }[]} items
 */
export function validateBreadcrumbItems(items) {
  /** @type {string[]} */
  const errors = [];
  if (!items?.length) errors.push('Breadcrumb requires at least one item');
  items?.forEach((item, i) => {
    if (!String(item?.name || '').trim()) errors.push(`Breadcrumb item ${i + 1}: name required`);
    if (!String(item?.url || '').trim()) errors.push(`Breadcrumb item ${i + 1}: url required`);
  });
  return { ok: errors.length === 0, errors };
}

/**
 * @param {{
 *   layout?: object;
 *   blocks?: import('./blockSchema.js').PageBlock[];
 *   canonical?: string;
 *   seoFallback?: object | null;
 *   siteUrl?: string;
 *   preview?: boolean;
 * }} input
 */
export function resolvePageBuilderSeo(input) {
  const layout = input.layout || {};
  const blocks = input.blocks || layout.blocks || [];
  const fallback = input.seoFallback || {};
  const siteUrl = (input.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, '');
  const preview = Boolean(input.preview);

  const title = buildPageTitleFallback(layout, fallback.seoTitle || fallback.title);
  const description = buildMetaDescriptionFallback(layout, blocks, fallback.metaDescription);
  const canonicalPath = layout.canonicalUrl || fallback.canonicalUrl || input.canonical || '';
  const canonicalUrl = canonicalPath
    ? (canonicalPath.startsWith('http') ? canonicalPath : `${siteUrl}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`)
    : (input.canonical?.startsWith('http') ? input.canonical : `${siteUrl}${input.canonical || ''}`);

  const ogImage = layout.ogImageUrl || fallback.ogImageUrl || extractOgImageFromBlocks(blocks) || `${siteUrl}/og-default.png`;
  const twitterCard = layout.twitterCard || fallback.twitterCard || 'summary_large_image';
  const robots = preview ? 'noindex, nofollow' : 'index, follow';

  const faqSchema = collectFaqStructuredData(blocks);
  const dynamicSchemas = dedupeDynamicJsonLd(collectDynamicBlockJsonLd(blocks, siteUrl));

  return {
    title,
    description,
    canonicalUrl,
    ogImage,
    ogImageAlt: title,
    twitterCard,
    robots,
    faqSchema,
    dynamicSchemas,
    preview,
  };
}

/**
 * @param {ReturnType<typeof resolvePageBuilderSeo>} seo
 */
export function validatePageBuilderSeo(seo) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!seo.title) warnings.push('Page title fallback empty');
  if (!seo.description) warnings.push('Meta description fallback empty');
  if (seo.description && seo.description.length < 50) warnings.push('Meta description is short');
  if (!seo.canonicalUrl) errors.push('Canonical URL missing');
  if (!seo.ogImage) warnings.push('OG image missing');
  if (!['summary', 'summary_large_image'].includes(seo.twitterCard)) {
    warnings.push('Unusual twitter:card value');
  }
  if (seo.faqSchema) {
    const faqVal = validateJsonLdSchema(seo.faqSchema);
    errors.push(...faqVal.errors.map((e) => `FAQ schema: ${e}`));
  }

  return { ok: errors.length === 0, errors, warnings };
}
