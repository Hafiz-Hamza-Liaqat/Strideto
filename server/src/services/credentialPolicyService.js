/**
 * credentialPolicyService — jurisdiction-aware credential policy resolution.
 *
 * Uses Mission 1's rolloutConfig resolver to determine whether a professional
 * license/credential is REQUIRED, OPTIONAL, or NOT_APPLICABLE for a given
 * organization type + country combination.
 *
 * Mission 2 ships the boundary and example table only — actual legal rule
 * tables are populated by later missions / compliance configuration.
 * "No license" ≠ automatically invalid organization.
 */
import {
  resolveFeature,
  validateRolloutTable,
} from '../../../shared/international/rolloutConfig.js';
import {
  CREDENTIAL_POLICY,
  isValidCredentialPolicy,
} from '../../../shared/international/verification.js';

/**
 * Example policy table — not exhaustive, illustrates the pattern.
 * Real jurisdiction tables are configured externally; this ensures
 * the resolver works out of the box and tests can verify behavior.
 *
 * Rules:
 *   - Agents in PK require a license (PEMRA/SECP/etc. depending on service).
 *   - Agencies in PK require a license.
 *   - For other countries/types: optional unless a jurisdiction rule overrides.
 *   - If no rule matches: not_applicable (never blocks approval silently).
 */
const DEFAULT_CREDENTIAL_POLICY_TABLE = {
  feature: 'credential_requirement',
  rules: [
    // Country + type (most specific)
    { countryCode: 'PK', organizationType: 'agent', value: CREDENTIAL_POLICY.REQUIRED },
    { countryCode: 'PK', organizationType: 'agency', value: CREDENTIAL_POLICY.REQUIRED },
    // Type-only fallbacks
    { organizationType: 'employer', value: CREDENTIAL_POLICY.NOT_APPLICABLE },
    { organizationType: 'university', value: CREDENTIAL_POLICY.OPTIONAL },
    { organizationType: 'college', value: CREDENTIAL_POLICY.OPTIONAL },
    { organizationType: 'institute', value: CREDENTIAL_POLICY.OPTIONAL },
    // Default (no match)
    { value: CREDENTIAL_POLICY.OPTIONAL },
  ],
};

// In-memory table store — populated from DEFAULT and overridable for tests
let _policyTable = DEFAULT_CREDENTIAL_POLICY_TABLE;

/**
 * Replace the active policy table. Validates table before accepting.
 * Used by config loading and tests.
 *
 * @param {object} table rollout table
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
export function setPolicyTable(table) {
  const result = validateRolloutTable(table);
  if (!result.ok) return result;
  _policyTable = table;
  return { ok: true };
}

/** Reset to the built-in default policy table (useful in tests). */
export function resetPolicyTable() {
  _policyTable = DEFAULT_CREDENTIAL_POLICY_TABLE;
}

/**
 * Resolve the credential policy for a given context.
 *
 * @param {object} context
 * @param {string} context.organizationType
 * @param {string} [context.countryCode] ISO 3166-1 alpha-2
 * @returns {string} one of CREDENTIAL_POLICY values
 */
export function resolveCredentialPolicy(context = {}) {
  const value = resolveFeature(_policyTable, context, CREDENTIAL_POLICY.OPTIONAL);
  return isValidCredentialPolicy(value) ? value : CREDENTIAL_POLICY.OPTIONAL;
}

/**
 * True when a license/credential is legally required for this context.
 * When true, Admin review MUST verify valid credential evidence before approving.
 * (The service does not auto-block approval — the Admin review step is authoritative.)
 */
export function isCredentialRequired(context = {}) {
  return resolveCredentialPolicy(context) === CREDENTIAL_POLICY.REQUIRED;
}

/**
 * True when a credential is clearly not applicable (e.g. regular employers).
 */
export function isCredentialNotApplicable(context = {}) {
  return resolveCredentialPolicy(context) === CREDENTIAL_POLICY.NOT_APPLICABLE;
}
