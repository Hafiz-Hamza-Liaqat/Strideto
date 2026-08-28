/**
 * SEO-P8 — Google Search Console configuration (server-only, fail-closed).
 */
import { MEASUREMENT_STATE } from '../../../../../shared/seo/measurement/dataStates.js';

export const GSC_READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
export const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3';

function parseCredentialsJson(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.client_email && parsed?.private_key) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function readGscConfig(env = process.env) {
  const siteUrl = String(env.GSC_SITE_URL || '').trim();
  const credentialsJson = parseCredentialsJson(env.GSC_CREDENTIALS_JSON);
  const serviceEmail = String(env.GSC_SERVICE_ACCOUNT_EMAIL || credentialsJson?.client_email || '').trim();
  let privateKey = String(env.GSC_SERVICE_ACCOUNT_PRIVATE_KEY || credentialsJson?.private_key || '').trim();
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (!siteUrl) {
    return {
      configured: false,
      state: MEASUREMENT_STATE.NOT_CONFIGURED,
      reason: 'missing_gsc_site_url',
    };
  }

  if (!serviceEmail || !privateKey) {
    return {
      configured: false,
      state: MEASUREMENT_STATE.NOT_CONFIGURED,
      reason: 'missing_gsc_service_account',
      siteUrl,
    };
  }

  if (String(env.NODE_ENV || '') !== 'production' && env.GSC_ALLOW_NON_PRODUCTION !== '1') {
    return {
      configured: false,
      state: MEASUREMENT_STATE.NOT_CONFIGURED,
      reason: 'non_production_gated',
      siteUrl,
    };
  }

  return {
    configured: true,
    state: MEASUREMENT_STATE.CONNECTED,
    siteUrl,
    serviceEmail,
    privateKey,
    scope: GSC_READONLY_SCOPE,
  };
}

/**
 * Generative AI Performance report has no official Search Analytics API filter (SEO-P8).
 */
export function getGoogleGenAiApiAvailability() {
  return {
    automated: false,
    state: MEASUREMENT_STATE.MANUAL_IMPORT_REQUIRED,
    reason: 'no_official_genai_searchanalytics_api',
    manualWorkflow: 'export_from_gsc_generative_ai_performance_ui',
  };
}
