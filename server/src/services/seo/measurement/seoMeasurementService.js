/**
 * SEO-P8 — orchestrates SEO measurement dashboard data (cached snapshots).
 */
import { cacheGet, cacheSet } from '../../../config/redis.js';
import { SeoMetricsSnapshot } from '../../../models/SeoMetricsSnapshot.js';
import { MEASUREMENT_STATE } from '../../../../../shared/seo/measurement/dataStates.js';
import { compareTrend, resolveComparisonDateRanges } from '../../../../../shared/seo/measurement/trendComparison.js';
import { deriveContentOpportunities } from '../../../../../shared/seo/measurement/contentOpportunities.js';
import { validateManualSeoSnapshotInput } from '../../../../../shared/seo/measurement/snapshotValidation.js';
import {
  resolveGoogleGenAiSnapshotMetrics,
  resolveGoogleGenAiSnapshotState,
} from '../../../../../shared/seo/measurement/genaiMetricPolicy.js';
import { getGscConnectionStatus, fetchGscSearchPerformance } from './gscSearchAnalyticsService.js';
import { getGoogleGenAiApiAvailability } from './gscConfig.js';
import { getBingConnectionStatus, fetchBingQueryStats } from './bingSearchStatsService.js';
import { getBingAiPerformanceApiAvailability } from './bingWebmasterConfig.js';
import { getSeoTechnicalHealth } from './seoTechnicalHealthService.js';
import {
  aggregateChatGptReferralMetrics,
  aggregatePageGroupMetrics,
} from './seoFirstPartyMetricsService.js';

const CACHE_TTL_SECONDS = 300;
const SNAPSHOT_STALE_MS = 7 * 86400000;

function formatGscDate(date) {
  return date.toISOString().slice(0, 10);
}

async function getLatestSnapshot(provider, dataset) {
  return SeoMetricsSnapshot.findOne({ provider, dataset }).sort({ capturedAt: -1 }).lean();
}

function snapshotState(snapshot) {
  if (!snapshot) return { state: MEASUREMENT_STATE.NO_DATA_AVAILABLE, snapshot: null, resolvedMetrics: null };
  const age = Date.now() - new Date(snapshot.capturedAt).getTime();
  const stale = age > SNAPSHOT_STALE_MS;

  let resolvedMetrics = null;
  let state = snapshot.state || MEASUREMENT_STATE.VALID_DATA;
  if (snapshot.provider === 'google' && snapshot.dataset === 'generative_ai_performance') {
    resolvedMetrics = resolveGoogleGenAiSnapshotMetrics(snapshot.metrics || {}, snapshot.metricStates || {});
    state = stale ? MEASUREMENT_STATE.STALE : resolveGoogleGenAiSnapshotState(resolvedMetrics);
  }

  return {
    state: stale ? MEASUREMENT_STATE.STALE : state,
    snapshot,
    stale,
    resolvedMetrics,
  };
}

/**
 * @param {'7d'|'28d'|'90d'} [rangePreset]
 */
export async function buildSeoMeasurementDashboard(rangePreset = '28d', env = process.env) {
  const cacheKey = `seo:measurement:${rangePreset}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const ranges = resolveComparisonDateRanges(rangePreset);
  const currentStart = ranges.current.start;
  const currentEnd = ranges.current.end;
  const prevStart = ranges.previous.start;
  const prevEnd = ranges.previous.end;

  const [
    gscCurrent,
    gscPrevious,
    bingSearch,
    chatgptCurrent,
    chatgptPrevious,
    pageGroups,
    googleGenAiSnapshot,
    bingAiSnapshot,
  ] = await Promise.all([
    fetchGscSearchPerformance({
      startDate: formatGscDate(currentStart),
      endDate: formatGscDate(currentEnd),
      dimensions: ['page'],
      rowLimit: 25,
    }, env),
    fetchGscSearchPerformance({
      startDate: formatGscDate(prevStart),
      endDate: formatGscDate(prevEnd),
      dimensions: [],
      rowLimit: 1,
    }, env),
    fetchBingQueryStats(env),
    aggregateChatGptReferralMetrics(currentStart, currentEnd),
    aggregateChatGptReferralMetrics(prevStart, prevEnd),
    aggregatePageGroupMetrics(currentStart, currentEnd),
    getLatestSnapshot('google', 'generative_ai_performance'),
    getLatestSnapshot('bing', 'ai_performance'),
  ]);

  const gscTrend = compareTrend(
    gscCurrent.metrics?.impressions ?? null,
    gscPrevious.metrics?.impressions ?? null,
  );

  const chatgptTrend = compareTrend(
    chatgptCurrent.sessions ?? null,
    chatgptPrevious.sessions ?? null,
  );

  const googleGenAi = snapshotState(googleGenAiSnapshot);
  const bingAi = snapshotState(bingAiSnapshot);

  const opportunities = deriveContentOpportunities({
    impressions: gscCurrent.metrics?.impressions ?? null,
    ctr: gscCurrent.metrics?.ctr ?? null,
    impressionTrend: gscTrend.direction,
    aiCitations: bingAi.snapshot?.metrics?.totalCitations ?? null,
    referralSessions: chatgptCurrent.sessions ?? null,
    applicationClicks: chatgptCurrent.applicationClicks ?? null,
    isImportantPage: true,
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    rangePreset,
    comparison: {
      current: { start: currentStart.toISOString(), end: currentEnd.toISOString() },
      previous: { start: prevStart.toISOString(), end: prevEnd.toISOString() },
    },
    connections: {
      googleSearchConsole: getGscConnectionStatus(env),
      googleGenerativeAi: {
        ...getGoogleGenAiApiAvailability(),
        import: googleGenAi,
      },
      bing: getBingConnectionStatus(env),
      bingAiPerformance: getBingAiPerformanceApiAvailability(),
    },
    googleSearch: {
      state: gscCurrent.state,
      metrics: gscCurrent.metrics,
      topPages: (gscCurrent.rows || []).slice(0, 10),
      trend: gscTrend,
    },
    googleGenerativeAi: {
      state: googleGenAi.state,
      metrics: googleGenAi.snapshot?.metrics || null,
      resolvedMetrics: googleGenAi.resolvedMetrics || null,
      metricStates: googleGenAi.snapshot?.metricStates || null,
      exportZeroAmbiguity: true,
      capturedAt: googleGenAi.snapshot?.capturedAt || null,
      manualImportRequired: true,
    },
    bingSearch: {
      state: bingSearch.state,
      metrics: bingSearch.metrics,
    },
    bingAi: {
      state: bingAi.state,
      metrics: bingAi.snapshot?.metrics || null,
      capturedAt: bingAi.snapshot?.capturedAt || null,
      manualImportRequired: true,
    },
    chatgptReferrals: {
      state: chatgptCurrent.state,
      sessions: chatgptCurrent.sessions,
      landingPages: chatgptCurrent.landingPages,
      applicationClicks: chatgptCurrent.applicationClicks,
      trend: chatgptTrend,
      attributionRule: 'utm_source=chatgpt.com',
    },
    contentPerformance: pageGroups,
    technicalHealth: getSeoTechnicalHealth(env),
    opportunities,
    workerStatus: 'stopped_by_policy',
  };

  await cacheSet(cacheKey, payload, CACHE_TTL_SECONDS);
  return payload;
}

/**
 * @param {object} input
 */
export async function importManualSeoSnapshot(input = {}) {
  const validated = validateManualSeoSnapshotInput(input);
  if (!validated.ok) {
    const err = new Error(validated.errors.join('; '));
    err.status = 400;
    err.details = validated.errors;
    throw err;
  }

  const value = validated.value;
  const doc = await SeoMetricsSnapshot.create({
    ...value,
    capturedAt: new Date(),
  });

  return doc.toObject();
}
