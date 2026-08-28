/**
 * SEO-P8 — Bing Webmaster traditional query stats (REST JSON only).
 */
import { readBingWebmasterConfig, BING_WEBMASTER_REST_BASE } from './bingWebmasterConfig.js';
import { MEASUREMENT_STATE } from '../../../../../shared/seo/measurement/dataStates.js';

const TIMEOUT_MS = 15000;

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function fetchBingQueryStats(env = process.env) {
  const config = readBingWebmasterConfig(env);
  if (!config.configured) {
    return {
      state: config.state,
      reason: config.reason,
      metrics: null,
    };
  }

  const url = new URL(`${BING_WEBMASTER_REST_BASE}/GetQueryStats`);
  url.searchParams.set('apikey', config.apiKey);
  url.searchParams.set('siteUrl', config.siteUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      return {
        state: MEASUREMENT_STATE.ERROR,
        reason: 'bing_query_stats_failed',
        httpStatus: res.status,
        metrics: null,
      };
    }

    const data = await res.json();
    const queries = Array.isArray(data?.d) ? data.d : [];
    let clicks = 0;
    let impressions = 0;

    for (const row of queries) {
      clicks += Number(row.Clicks || row.clicks || 0);
      impressions += Number(row.Impressions || row.impressions || 0);
    }

    return {
      state: queries.length === 0 ? MEASUREMENT_STATE.NO_DATA_AVAILABLE : MEASUREMENT_STATE.VALID_DATA,
      metrics: {
        clicks,
        impressions,
        queryCount: queries.length,
      },
      rows: queries.slice(0, 50),
      sourceReportedZero: queries.length > 0,
    };
  } catch (err) {
    return {
      state: MEASUREMENT_STATE.ERROR,
      reason: err.message || 'bing_api_error',
      metrics: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function getBingConnectionStatus(env = process.env) {
  const config = readBingWebmasterConfig(env);
  const ai = getBingAiImportStatus();
  return {
    search: {
      state: config.configured ? MEASUREMENT_STATE.CONNECTED : config.state,
      reason: config.reason || null,
      siteUrl: config.siteUrl || null,
      apiStyle: 'rest_json',
    },
    aiPerformance: ai,
  };
}

function getBingAiImportStatus() {
  return {
    state: MEASUREMENT_STATE.MANUAL_IMPORT_REQUIRED,
    automated: false,
    reason: 'no_official_ai_performance_rest_api',
  };
}
