/**
 * SEO-P8 — truthful measurement states.
 * UNKNOWN data must not be displayed as zero.
 */

export const MEASUREMENT_STATE = Object.freeze({
  CONNECTED: 'connected',
  NOT_CONFIGURED: 'not_configured',
  NOT_CONNECTED: 'not_connected',
  NO_DATA_AVAILABLE: 'no_data_available',
  REPORT_NOT_AVAILABLE: 'report_not_available',
  NOT_AVAILABLE_TO_PROPERTY: 'not_available_to_property',
  NO_SUFFICIENT_DATA: 'no_sufficient_data',
  ZERO: 'zero',
  STALE: 'stale',
  ERROR: 'error',
  VALID_DATA: 'valid_data',
  AWAITING_DATA: 'awaiting_data',
  HEALTHY: 'healthy',
  UNAVAILABLE: 'unavailable',
  MANUAL_IMPORT_REQUIRED: 'manual_import_required',
});

export const TREND_DIRECTION = Object.freeze({
  INCREASE: 'increase',
  DECREASE: 'decrease',
  FLAT: 'flat',
  INSUFFICIENT_DATA: 'insufficient_data',
  NOT_AVAILABLE: 'not_available',
  NEW_ACTIVITY: 'new_activity',
  NOT_COMPARABLE: 'not_comparable',
});

/**
 * @param {number|null|undefined} value
 * @param {string} state
 */
export function formatMetricValue(value, state) {
  if (state && state !== MEASUREMENT_STATE.VALID_DATA && state !== MEASUREMENT_STATE.ZERO) {
    return null;
  }
  if (value === null || value === undefined) return null;
  return value;
}

/**
 * Distinguish explicit zero from missing data.
 * @param {number|null|undefined} value
 * @param {{ hasSource?: boolean, sourceReportedZero?: boolean }} [opts]
 */
export function resolveNumericMetricState(value, opts = {}) {
  if (!opts.hasSource) return MEASUREMENT_STATE.NOT_CONFIGURED;
  if (opts.sourceError) return MEASUREMENT_STATE.ERROR;
  if (opts.reportUnavailable) return MEASUREMENT_STATE.REPORT_NOT_AVAILABLE;
  if (value === null || value === undefined) {
    if (opts.awaitingData) return MEASUREMENT_STATE.AWAITING_DATA;
    return MEASUREMENT_STATE.NO_DATA_AVAILABLE;
  }
  if (value === 0 && opts.sourceReportedZero) return MEASUREMENT_STATE.ZERO;
  if (value === 0 && !opts.sourceReportedZero) return MEASUREMENT_STATE.NO_DATA_AVAILABLE;
  return MEASUREMENT_STATE.VALID_DATA;
}
