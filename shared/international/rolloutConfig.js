/**
 * Feature / country rollout configuration boundary (Mission 1 — Foundation).
 *
 * A safe resolution PATTERN letting future behavior vary by country,
 * organization type, feature and rollout market. Mission 1 provides ONLY the
 * boundary and resolver — it hardcodes NO legal or jurisdiction rules. Later
 * missions supply concrete rule tables (credential requirements, payment
 * availability, agent service availability, institution verification rules).
 *
 * Resolution is deterministic and specificity-ordered: the most specific
 * matching rule wins, falling back through less specific scopes to a default.
 *
 * Client- and server-safe: pure JS.
 */
import { normalizeCountryCode } from './country.js';
import { isValidOrganizationType } from './organization.js';

/**
 * A rollout table for one feature is a list of rules. Each rule may narrow by
 * `countryCode` and/or `organizationType`; a rule with neither is the default.
 *
 *   { feature, rules: [{ countryCode?, organizationType?, value }] }
 *
 * Specificity score: country + type (3) > single dimension (1) > default (0).
 */
function specificity(rule) {
  return (rule.countryCode ? 2 : 0) + (rule.organizationType ? 1 : 0);
}

/**
 * Validate a rollout table. Ensures every rule's narrowing fields are canonical
 * so a typo'd country/type can't create a silently-unmatchable rule.
 *
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
export function validateRolloutTable(table = {}) {
  const errors = [];
  if (typeof table.feature !== 'string' || !table.feature.trim()) {
    errors.push('feature is required');
  }
  if (!Array.isArray(table.rules)) {
    errors.push('rules must be an array');
    return { ok: false, errors };
  }
  table.rules.forEach((rule, i) => {
    if (!rule || typeof rule !== 'object') {
      errors.push(`rule[${i}] must be an object`);
      return;
    }
    if (rule.countryCode != null && !normalizeCountryCode(rule.countryCode)) {
      errors.push(`rule[${i}].countryCode is not a valid ISO 3166 code`);
    }
    if (rule.organizationType != null && !isValidOrganizationType(rule.organizationType)) {
      errors.push(`rule[${i}].organizationType is invalid`);
    }
    if (!('value' in rule)) {
      errors.push(`rule[${i}].value is required`);
    }
  });
  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * Resolve a feature value for a given context.
 *
 * @param {object} table a rollout table (see above)
 * @param {object} [context]
 * @param {string} [context.countryCode]
 * @param {string} [context.organizationType]
 * @param {*} [fallback] returned when no rule matches (default `undefined`)
 * @returns {*} the winning rule's `value`, or `fallback`
 */
export function resolveFeature(table, context = {}, fallback = undefined) {
  if (!table || !Array.isArray(table.rules)) return fallback;
  const ctxCountry = context.countryCode ? normalizeCountryCode(context.countryCode) : null;
  const ctxType = context.organizationType || null;

  let best = null;
  let bestScore = -1;
  for (const rule of table.rules) {
    if (rule.countryCode) {
      const rc = normalizeCountryCode(rule.countryCode);
      if (!rc || rc !== ctxCountry) continue;
    }
    if (rule.organizationType && rule.organizationType !== ctxType) continue;
    const score = specificity(rule);
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return best ? best.value : fallback;
}
