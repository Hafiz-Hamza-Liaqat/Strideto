/**
 * Document expiry state computation (Mission 10 §K).
 * Deterministic: driven by expiresAt field only.
 * Does NOT invent expiry dates or modify records.
 */
import { VAULT_EXPIRY_WARNING_DAYS } from '../../../../shared/vault/constants.js';

/**
 * Compute expiry state for a vault document.
 * @param {Date|null|undefined} expiresAt
 * @returns {'valid'|'expiring_soon'|'expired'|'unknown'}
 */
export function computeExpiryState(expiresAt) {
  if (!expiresAt) return 'unknown';

  const now = Date.now();
  const exp = new Date(expiresAt).getTime();

  if (Number.isNaN(exp)) return 'unknown';
  if (exp <= now) return 'expired';

  const daysUntilExpiry = (exp - now) / (1000 * 60 * 60 * 24);
  if (daysUntilExpiry <= VAULT_EXPIRY_WARNING_DAYS) return 'expiring_soon';

  return 'valid';
}

/**
 * Annotate a plain vault document object with its expiry state.
 * Returns a new object — does not mutate.
 */
export function withExpiryState(doc) {
  return {
    ...doc,
    expiryState: computeExpiryState(doc.expiresAt),
  };
}
