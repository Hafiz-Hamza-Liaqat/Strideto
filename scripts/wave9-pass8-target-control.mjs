export const TARGET_MIN = 48;
export const TARGET_MAX = 50;
export const PRE_PASS8_POOL = 43;

export function additionalBounds(poolCount = PRE_PASS8_POOL) {
  if (!Number.isInteger(poolCount) || poolCount < 0) throw new TypeError('poolCount must be a non-negative integer');
  return { minAdditional: Math.max(0, TARGET_MIN - poolCount), maxAdditional: Math.max(0, TARGET_MAX - poolCount) };
}

export function shouldStopAccepting(poolCount, acceptedCount = 0) {
  if (!Number.isInteger(poolCount) || !Number.isInteger(acceptedCount) || poolCount < 0 || acceptedCount < 0) throw new TypeError('counts must be non-negative integers');
  return poolCount + acceptedCount >= TARGET_MAX;
}

export function canAccept(poolCount, acceptedCount = 0) {
  return !shouldStopAccepting(poolCount, acceptedCount);
}

export function parseTargetValue(value) {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new TypeError('targets must be explicit integers, not prose or ranges');
  return value;
}

export function noFallbackTarget() {
  return { targetMin: TARGET_MIN, targetMax: TARGET_MAX, fallbackApplied: false };
}
