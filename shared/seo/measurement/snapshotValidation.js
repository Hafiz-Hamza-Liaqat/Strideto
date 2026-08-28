/**
 * SEO-P8 — strict validation for manual SEO metrics snapshots.
 */
import { MEASUREMENT_STATE } from './dataStates.js';
import { GOOGLE_GENAI_METRIC_KEYS } from './genaiMetricPolicy.js';

export const SNAPSHOT_PROVIDERS = Object.freeze(['google', 'bing']);

export const SNAPSHOT_DATASETS = Object.freeze({
  google: ['generative_ai_performance'],
  bing: ['ai_performance'],
});

export const SNAPSHOT_SOURCE_TYPES = Object.freeze(['manual_import']);

export const SNAPSHOT_STATES = Object.freeze([
  MEASUREMENT_STATE.VALID_DATA,
  MEASUREMENT_STATE.ZERO,
  MEASUREMENT_STATE.NO_DATA_AVAILABLE,
  MEASUREMENT_STATE.NO_SUFFICIENT_DATA,
  MEASUREMENT_STATE.UNAVAILABLE,
  MEASUREMENT_STATE.REPORT_NOT_AVAILABLE,
  MEASUREMENT_STATE.NOT_AVAILABLE_TO_PROPERTY,
  MEASUREMENT_STATE.STALE,
  MEASUREMENT_STATE.ERROR,
]);

export const METRIC_STATES = Object.freeze([
  MEASUREMENT_STATE.ZERO,
  MEASUREMENT_STATE.VALID_DATA,
  MEASUREMENT_STATE.UNAVAILABLE,
  MEASUREMENT_STATE.NO_SUFFICIENT_DATA,
  MEASUREMENT_STATE.NO_DATA_AVAILABLE,
]);

const MAX_PAYLOAD_BYTES = 65536;
const MAX_NOTES_LENGTH = 500;
const MAX_DIMENSION_KEYS = 20;

const FORBIDDEN_KEY_PATTERN = /(?:^|_)(?:password|secret|token|apikey|api_key|credential|private_key|refresh_token|access_token)(?:$|_)/i;
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const NON_NEGATIVE_METRICS = new Set([
  'impressions',
  'visiblePages',
  'totalCitations',
  'averageCitedPages',
  'clicks',
]);

const DATASET_METRIC_KEYS = Object.freeze({
  'google:generative_ai_performance': GOOGLE_GENAI_METRIC_KEYS,
  'bing:ai_performance': ['totalCitations', 'averageCitedPages'],
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasForbiddenKey(key) {
  return FORBIDDEN_OBJECT_KEYS.has(key) || FORBIDDEN_KEY_PATTERN.test(key);
}

/**
 * @param {unknown} obj
 * @param {string} path
 * @param {string[]} errors
 * @param {number} depth
 */
function walkObject(obj, path, errors, depth = 0) {
  if (depth > 4) {
    errors.push(`${path}: nested object too deep`);
    return;
  }
  if (!isPlainObject(obj)) return;
  for (const [key, value] of Object.entries(obj)) {
    if (hasForbiddenKey(key)) {
      errors.push(`${path}.${key}: forbidden field`);
      continue;
    }
    if (typeof value === 'string' && value.length > 2000) {
      errors.push(`${path}.${key}: string value too long`);
    }
    if (isPlainObject(value)) {
      walkObject(value, `${path}.${key}`, errors, depth + 1);
    }
  }
}

function parseDate(value, field) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { ok: false, error: `${field} invalid` };
  return { ok: true, value: d };
}

/**
 * @param {object} input
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validateManualSeoSnapshotInput(input = {}) {
  const errors = [];

  if (!isPlainObject(input)) {
    return { ok: false, errors: ['body must be an object'] };
  }

  if (JSON.stringify(input).length > MAX_PAYLOAD_BYTES) {
    errors.push('payload too large');
  }

  const provider = String(input.provider || '').trim().toLowerCase();
  const dataset = String(input.dataset || '').trim().toLowerCase();

  if (!SNAPSHOT_PROVIDERS.includes(provider)) {
    errors.push('provider not allowlisted');
  }
  if (!provider || !SNAPSHOT_DATASETS[provider]?.includes(dataset)) {
    errors.push('dataset not allowlisted for provider');
  }

  const start = parseDate(input.periodStart, 'periodStart');
  const end = parseDate(input.periodEnd, 'periodEnd');
  if (!start.ok) errors.push(start.error);
  if (!end.ok) errors.push(end.error);
  if (start.ok && end.ok && end.value < start.value) {
    errors.push('periodEnd must be >= periodStart');
  }

  const sourceType = String(input.sourceType || 'manual_import').trim();
  if (!SNAPSHOT_SOURCE_TYPES.includes(sourceType)) {
    errors.push('sourceType invalid');
  }

  const state = String(input.state || MEASUREMENT_STATE.VALID_DATA).trim();
  if (!SNAPSHOT_STATES.includes(state)) {
    errors.push('state invalid');
  }

  const metrics = isPlainObject(input.metrics) ? input.metrics : {};
  const dimensions = isPlainObject(input.dimensions) ? input.dimensions : {};
  const metricStates = isPlainObject(input.metricStates) ? input.metricStates : {};

  walkObject(metrics, 'metrics', errors);
  walkObject(dimensions, 'dimensions', errors);
  walkObject(metricStates, 'metricStates', errors);
  walkObject(input, 'body', errors);

  if (Object.keys(dimensions).length > MAX_DIMENSION_KEYS) {
    errors.push('dimensions: too many keys');
  }

  const allowedMetricKeys = DATASET_METRIC_KEYS[`${provider}:${dataset}`] || [];
  for (const key of Object.keys(metrics)) {
    if (!allowedMetricKeys.includes(key)) {
      errors.push(`metrics.${key}: not allowed for dataset`);
    }
    const val = metrics[key];
    if (val !== null && val !== undefined && !Number.isFinite(val)) {
      errors.push(`metrics.${key}: must be finite number`);
    }
    if (NON_NEGATIVE_METRICS.has(key) && typeof val === 'number' && val < 0) {
      errors.push(`metrics.${key}: cannot be negative`);
    }
  }

  for (const [key, val] of Object.entries(metricStates)) {
    if (!allowedMetricKeys.includes(key)) {
      errors.push(`metricStates.${key}: not allowed for dataset`);
    }
    if (!METRIC_STATES.includes(String(val))) {
      errors.push(`metricStates.${key}: invalid metric state`);
    }
  }

  if (input.notes !== undefined && String(input.notes).length > MAX_NOTES_LENGTH) {
    errors.push('notes too long');
  }

  if (input.capturedAt !== undefined) {
    const captured = parseDate(input.capturedAt, 'capturedAt');
    if (!captured.ok) errors.push(captured.error);
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      provider,
      dataset,
      periodStart: start.value,
      periodEnd: end.value,
      sourceType,
      state,
      metrics,
      dimensions,
      metricStates,
      notes: String(input.notes || '').slice(0, MAX_NOTES_LENGTH),
      schemaVersion: 1,
    },
  };
}
