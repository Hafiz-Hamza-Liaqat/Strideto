/**
 * SEO-P8 — Google Generative AI manual snapshot zero/unavailable policy.
 *
 * GSC exports convert UI `~` / `-` to numeric 0. Exported zero ≠ confirmed zero
 * unless the operator explicitly confirms metric state.
 */
import { MEASUREMENT_STATE } from './dataStates.js';

export const GENAI_EXPORT_ZERO_AMBIGUITY_REASON = 'google_export_tilde_dash_converted_to_zero';

/** Metric keys allowed for google / generative_ai_performance snapshots. */
export const GOOGLE_GENAI_METRIC_KEYS = Object.freeze(['impressions', 'visiblePages']);

/**
 * @param {string} metricKey
 * @param {number|null|undefined} value
 * @param {Record<string, string>} [metricStates]
 * @returns {{ value: number|null, state: string, ambiguityReason?: string }}
 */
export function resolveGoogleGenAiMetric(metricKey, value, metricStates = {}) {
  const operatorState = metricStates[metricKey];

  if (value === null || value === undefined) {
    if (operatorState === MEASUREMENT_STATE.ZERO) {
      return { value: 0, state: MEASUREMENT_STATE.ZERO };
    }
    if (operatorState === MEASUREMENT_STATE.UNAVAILABLE) {
      return { value: null, state: MEASUREMENT_STATE.UNAVAILABLE };
    }
    if (operatorState === MEASUREMENT_STATE.NO_SUFFICIENT_DATA) {
      return { value: null, state: MEASUREMENT_STATE.NO_SUFFICIENT_DATA };
    }
    return { value: null, state: MEASUREMENT_STATE.NO_DATA_AVAILABLE };
  }

  if (!Number.isFinite(value)) {
    return { value: null, state: MEASUREMENT_STATE.ERROR };
  }

  if (value > 0) {
    return { value, state: MEASUREMENT_STATE.VALID_DATA };
  }

  if (value === 0) {
    if (operatorState === MEASUREMENT_STATE.ZERO) {
      return { value: 0, state: MEASUREMENT_STATE.ZERO };
    }
    return {
      value: null,
      state: MEASUREMENT_STATE.NO_SUFFICIENT_DATA,
      ambiguityReason: GENAI_EXPORT_ZERO_AMBIGUITY_REASON,
    };
  }

  return { value: null, state: MEASUREMENT_STATE.ERROR };
}

/**
 * @param {Record<string, number>} metrics
 * @param {Record<string, string>} [metricStates]
 */
export function resolveGoogleGenAiSnapshotMetrics(metrics = {}, metricStates = {}) {
  const resolved = {};
  for (const key of GOOGLE_GENAI_METRIC_KEYS) {
    if (metrics[key] !== undefined) {
      resolved[key] = resolveGoogleGenAiMetric(key, metrics[key], metricStates);
    }
  }
  return resolved;
}

/**
 * Aggregate snapshot-level state from resolved metrics.
 * @param {Record<string, { state: string }>} resolvedMetrics
 */
export function resolveGoogleGenAiSnapshotState(resolvedMetrics = {}) {
  const states = Object.values(resolvedMetrics).map((m) => m.state);
  if (!states.length) return MEASUREMENT_STATE.NO_DATA_AVAILABLE;
  if (states.every((s) => s === MEASUREMENT_STATE.ZERO)) return MEASUREMENT_STATE.ZERO;
  if (states.some((s) => s === MEASUREMENT_STATE.VALID_DATA)) return MEASUREMENT_STATE.VALID_DATA;
  if (states.some((s) => s === MEASUREMENT_STATE.NO_SUFFICIENT_DATA)) {
    return MEASUREMENT_STATE.NO_SUFFICIENT_DATA;
  }
  if (states.some((s) => s === MEASUREMENT_STATE.UNAVAILABLE)) return MEASUREMENT_STATE.UNAVAILABLE;
  return states[0] || MEASUREMENT_STATE.NO_DATA_AVAILABLE;
}
