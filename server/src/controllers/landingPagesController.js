import { asyncHandler } from '../utils/asyncHandler.js';
import { sanitizeString } from '../utils/sanitize.js';
import { resolvePublicSiteOrigin } from '../../../shared/seo/publicSiteOrigin.js';

const SITE_URL = resolvePublicSiteOrigin(process.env.SITE_URL || process.env.VITE_APP_URL || '');

/**
 * Return SEO meta and schema for province/category landing pages.
 * GET /api/v1/landing-pages/:type/:slug e.g. province/punjab, category/engineering
 */
export const getLandingPage = asyncHandler(async (req, res) => {
  const { type, slug } = req.params;
  const safeSlug = sanitizeString(slug || '');
  const safeType = type === 'province' ? 'province' : type === 'category' ? 'category' : null;
  if (!safeType || !safeSlug) return res.status(400).json({ error: 'Invalid type or slug' });

  const title = safeType === 'province'
    ? `Jobs & Scholarships in ${safeSlug} – Strideto Pakistan`
    : `${safeSlug} Jobs & Scholarships – Strideto Pakistan`;
  const description = safeType === 'province'
    ? `Find jobs, scholarships, and admissions in ${safeSlug}. Updated listings for students and job seekers.`
    : `Browse ${safeSlug} jobs, scholarships, and education opportunities in Pakistan.`;

  const canonical = `${SITE_URL}/${safeType === 'province' ? 'jobs' : 'jobs'}/${safeType}/${safeSlug}`;
  const meta = {
    title,
    description,
    canonical,
    og: {
      title,
      description,
      url: canonical,
      type: 'website',
    },
  };

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonical,
    publisher: { '@id': `${SITE_URL}/#organization` },
  };

  res.json({ meta, schema });
});
