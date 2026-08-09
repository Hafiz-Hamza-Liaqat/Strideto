/** Deterministic operational projection; never asserts production readiness. */
import { normalizeCountryCode } from './country.js';

export const COUNTRY_READINESS_STATES = Object.freeze({
  NOT_CONFIGURED: 'not_configured',
  PARTIAL: 'partial',
  READY_FOR_INTERNAL_TESTING: 'ready_for_internal_testing',
  REQUIRES_REVIEW: 'requires_review',
});

const DIMENSIONS = Object.freeze([
  'countryConfiguration',
  'educationDataReady',
  'verificationPolicyConfigured',
  'currencySupported',
  'providerReady',
  'sourceFreshnessReady',
]);

export function assessCountryReadiness(countryCode, evidence = {}) {
  const code = normalizeCountryCode(countryCode);
  if (!code) return { countryCode: null, state: COUNTRY_READINESS_STATES.NOT_CONFIGURED, dimensions: {} };
  const dimensions = Object.fromEntries(DIMENSIONS.map(key => [key, evidence[key] === true]));
  const readyCount = Object.values(dimensions).filter(Boolean).length;
  let state = COUNTRY_READINESS_STATES.REQUIRES_REVIEW;
  if (readyCount === 0) state = COUNTRY_READINESS_STATES.NOT_CONFIGURED;
  else if (readyCount < DIMENSIONS.length) state = COUNTRY_READINESS_STATES.PARTIAL;
  else state = COUNTRY_READINESS_STATES.READY_FOR_INTERNAL_TESTING;
  return { countryCode: code, state, dimensions, productionReady: false };
}
