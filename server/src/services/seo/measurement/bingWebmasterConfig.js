/**
 * SEO-P8 — Bing Webmaster configuration (REST-only; no SOAP/POX).
 */
import { MEASUREMENT_STATE } from '../../../../../shared/seo/measurement/dataStates.js';

export const BING_WEBMASTER_REST_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function readBingWebmasterConfig(env = process.env) {
  const apiKey = String(env.BING_WEBMASTER_API_KEY || '').trim();
  const siteUrl = String(env.BING_SITE_URL || env.SITE_URL || env.FRONTEND_URL || '').trim();

  if (!apiKey) {
    return {
      configured: false,
      state: MEASUREMENT_STATE.NOT_CONFIGURED,
      reason: 'missing_bing_webmaster_api_key',
    };
  }

  if (!siteUrl) {
    return {
      configured: false,
      state: MEASUREMENT_STATE.NOT_CONFIGURED,
      reason: 'missing_bing_site_url',
      hasApiKey: true,
    };
  }

  if (String(env.NODE_ENV || '') !== 'production' && env.BING_ALLOW_NON_PRODUCTION !== '1') {
    return {
      configured: false,
      state: MEASUREMENT_STATE.NOT_CONFIGURED,
      reason: 'non_production_gated',
      siteUrl,
      hasApiKey: true,
    };
  }

  return {
    configured: true,
    state: MEASUREMENT_STATE.CONNECTED,
    apiKey,
    siteUrl,
    apiStyle: 'rest_json',
  };
}

/**
 * Bing AI Performance has no official REST API as of SEO-P8 baseline.
 */
export function getBingAiPerformanceApiAvailability() {
  return {
    automated: false,
    state: MEASUREMENT_STATE.MANUAL_IMPORT_REQUIRED,
    reason: 'no_official_ai_performance_rest_api',
    manualWorkflow: 'export_from_bing_webmaster_ai_performance_ui',
    legacyApiProhibited: ['soap', 'pox'],
  };
}
