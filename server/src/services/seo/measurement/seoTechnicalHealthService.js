/**
 * SEO-P8 — operational technical SEO health probes (non-blocking).
 */
import { readIndexNowConfig } from '../indexNowConfig.js';
import { MEASUREMENT_STATE } from '../../../../../shared/seo/measurement/dataStates.js';
import { buildRobotsTxt } from '../../../../../shared/seo/robotsPolicy.js';
import { PRODUCTION_PUBLIC_ORIGIN } from '../../../../../shared/seo/publicSiteOrigin.js';

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function getSeoTechnicalHealth(env = process.env) {
  const origin = String(env.SITE_URL || env.FRONTEND_URL || PRODUCTION_PUBLIC_ORIGIN).replace(/\/$/, '');
  const indexNow = readIndexNowConfig(env);
  const robotsTxt = buildRobotsTxt(origin);

  return {
    homepage: {
      state: origin ? MEASUREMENT_STATE.HEALTHY : MEASUREMENT_STATE.NOT_CONFIGURED,
      canonicalOrigin: origin || null,
    },
    robots: {
      state: robotsTxt.includes('User-agent:') ? MEASUREMENT_STATE.HEALTHY : MEASUREMENT_STATE.ERROR,
      available: true,
    },
    sitemap: {
      state: origin ? MEASUREMENT_STATE.HEALTHY : MEASUREMENT_STATE.NOT_CONFIGURED,
      path: '/sitemap.xml',
      url: origin ? `${origin}/sitemap.xml` : null,
    },
    indexNow: {
      state: indexNow.enabled ? MEASUREMENT_STATE.HEALTHY : MEASUREMENT_STATE.NOT_CONFIGURED,
      enabled: !!indexNow.enabled,
      reason: indexNow.reason || null,
      keyEndpoint: '/indexnow-key.txt',
    },
    canonicalPolicy: {
      state: MEASUREMENT_STATE.HEALTHY,
      origin: PRODUCTION_PUBLIC_ORIGIN,
    },
  };
}
