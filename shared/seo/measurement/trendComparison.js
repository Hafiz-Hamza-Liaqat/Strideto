/**
 * SEO-P8 — trend comparison with divide-by-zero and low-volume safety.
 */
import { TREND_DIRECTION } from './dataStates.js';

const LOW_VOLUME_THRESHOLD = 5;

/**
 * @param {number|null|undefined} current
 * @param {number|null|undefined} previous
 * @param {{ lowerIsBetter?: boolean, minVolume?: number }} [opts]
 */
export function compareTrend(current, previous, opts = {}) {
  const minVolume = opts.minVolume ?? LOW_VOLUME_THRESHOLD;

  if (current === null || current === undefined || previous === null || previous === undefined) {
    return { direction: TREND_DIRECTION.NOT_AVAILABLE, percentChange: null, rawCurrent: current, rawPrevious: previous };
  }

  if (previous === 0 && current === 0) {
    return { direction: TREND_DIRECTION.FLAT, percentChange: 0, rawCurrent: current, rawPrevious: previous };
  }

  if (previous === 0 && current > 0) {
    return { direction: TREND_DIRECTION.NEW_ACTIVITY, percentChange: null, rawCurrent: current, rawPrevious: previous };
  }

  if (previous > 0 && current === 0) {
    return {
      direction: opts.lowerIsBetter ? TREND_DIRECTION.INCREASE : TREND_DIRECTION.DECREASE,
      percentChange: -100,
      rawCurrent: current,
      rawPrevious: previous,
    };
  }

  const percentChange = ((current - previous) / previous) * 100;
  const combinedVolume = current + previous;
  if (combinedVolume < minVolume) {
    return {
      direction: TREND_DIRECTION.INSUFFICIENT_DATA,
      percentChange,
      rawCurrent: current,
      rawPrevious: previous,
    };
  }

  if (Math.abs(percentChange) < 2) {
    return { direction: TREND_DIRECTION.FLAT, percentChange, rawCurrent: current, rawPrevious: previous };
  }

  const increased = current > previous;
  if (opts.lowerIsBetter) {
    return {
      direction: increased ? TREND_DIRECTION.DECREASE : TREND_DIRECTION.INCREASE,
      percentChange,
      rawCurrent: current,
      rawPrevious: previous,
    };
  }

  return {
    direction: increased ? TREND_DIRECTION.INCREASE : TREND_DIRECTION.DECREASE,
    percentChange,
    rawCurrent: current,
    rawPrevious: previous,
  };
}

/**
 * @param {'7d'|'28d'|'90d'} preset
 * @param {Date} [now]
 */
export function resolveComparisonDateRanges(preset, now = new Date()) {
  const dayMs = 86400000;
  const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 28;
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  const currentStart = new Date(end.getTime() - (days * dayMs) + 1);
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - (days * dayMs) + 1);
  return {
    current: { start: currentStart, end },
    previous: { start: previousStart, end: previousEnd },
    days,
  };
}
