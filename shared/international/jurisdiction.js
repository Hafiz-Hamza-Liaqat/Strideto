/** Jurisdiction policy resolution built on the Mission 1 rollout boundary. */
import { normalizeCountryCode } from './country.js';
import { resolveFeature, validateRolloutTable } from './rolloutConfig.js';

export const JURISDICTION_POLICY_STATES = Object.freeze({
  REQUIRED: 'required',
  OPTIONAL: 'optional',
  NOT_APPLICABLE: 'not_applicable',
  NOT_CONFIGURED: 'not_configured',
});

const VALID_STATES = new Set(Object.values(JURISDICTION_POLICY_STATES));

export function resolveJurisdictionPolicy(table, context = {}) {
  const countryCode = normalizeCountryCode(context.countryCode);
  if (!countryCode || !validateRolloutTable(table).ok) {
    return { state: JURISDICTION_POLICY_STATES.NOT_CONFIGURED, configured: false, countryCode };
  }
  const state = resolveFeature(table, { ...context, countryCode }, null);
  if (!VALID_STATES.has(state)) {
    return { state: JURISDICTION_POLICY_STATES.NOT_CONFIGURED, configured: false, countryCode };
  }
  return { state, configured: true, countryCode };
}
