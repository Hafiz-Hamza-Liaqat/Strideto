/**
 * SEO-P8 — Google Search Console Search Analytics API (traditional search only).
 */
import { readGscConfig, GSC_API_BASE } from './gscConfig.js';
import { getGscAccessToken } from './gscAuth.js';
import { MEASUREMENT_STATE } from '../../../../../shared/seo/measurement/dataStates.js';

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_ROW_LIMIT = 25000;

/**
 * @param {object} config
 * @param {object} body
 */
async function querySearchAnalytics(config, body) {
  const token = await getGscAccessToken(config);
  const site = encodeURIComponent(config.siteUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${GSC_API_BASE}/sites/${site}/searchAnalytics/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = new Error('gsc_search_analytics_failed');
      err.status = res.status;
      throw err;
    }

    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @param {{ startDate: string, endDate: string, dimensions?: string[], rowLimit?: number }} params
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function fetchGscSearchPerformance(params, env = process.env) {
  const config = readGscConfig(env);
  if (!config.configured) {
    return {
      state: config.state,
      reason: config.reason,
      metrics: null,
    };
  }

  const startDate = params.startDate;
  const endDate = params.endDate;
  if (!startDate || !endDate) {
    return { state: MEASUREMENT_STATE.ERROR, reason: 'missing_date_range', metrics: null };
  }

  try {
    const summary = await querySearchAnalytics(config, {
      startDate,
      endDate,
      dimensions: params.dimensions || [],
      rowLimit: Math.min(params.rowLimit || 1000, MAX_ROW_LIMIT),
      aggregationType: 'auto',
    });

    const rows = Array.isArray(summary.rows) ? summary.rows : [];
    let clicks = 0;
    let impressions = 0;
    let positionWeighted = 0;

    for (const row of rows) {
      clicks += row.clicks || 0;
      impressions += row.impressions || 0;
      positionWeighted += (row.position || 0) * (row.impressions || 0);
    }

    const ctr = impressions > 0 ? clicks / impressions : null;
    const avgPosition = impressions > 0 ? positionWeighted / impressions : null;

    return {
      state: rows.length === 0 && impressions === 0
        ? MEASUREMENT_STATE.NO_DATA_AVAILABLE
        : MEASUREMENT_STATE.VALID_DATA,
      metrics: {
        clicks,
        impressions,
        ctr,
        averagePosition: avgPosition,
      },
      rows: rows.map((row) => ({
        keys: row.keys || [],
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? null,
        position: row.position ?? null,
      })),
      sourceReportedZero: rows.length > 0,
      period: { startDate, endDate },
    };
  } catch (err) {
    return {
      state: MEASUREMENT_STATE.ERROR,
      reason: err.message || 'gsc_api_error',
      httpStatus: err.status || null,
      metrics: null,
    };
  }
}

export function getGscConnectionStatus(env = process.env) {
  const config = readGscConfig(env);
  return {
    state: config.configured ? MEASUREMENT_STATE.CONNECTED : config.state,
    reason: config.reason || null,
    siteUrl: config.siteUrl || null,
    scope: config.scope || null,
    hasCredentials: !!(config.serviceEmail && config.privateKey),
  };
}
