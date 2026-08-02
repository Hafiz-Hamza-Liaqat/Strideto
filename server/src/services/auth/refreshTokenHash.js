import crypto from 'crypto';

/**
 * Canonical, narrowly scoped SHA-256 refresh-token hash primitive.
 * Deterministic lowercase hex output, one-way only — no
 * reversible encryption, no plaintext persistence, never logs its input or
 * output.
 *
 * SEC-3B.1: a whitespace-only string (e.g. `"   "`) is rejected — it is
 * not meaningful token material. A valid, non-whitespace-only token is
 * hashed using its exact supplied bytes; it is never trimmed before
 * hashing, since trimming would silently change which raw token value a
 * given hash corresponds to.
 */
export function hashRefreshToken(token) {
  if (
    typeof token !== 'string' ||
    token.length === 0 ||
    token.trim().length === 0
  ) {
    throw new TypeError(
      'hashRefreshToken requires a non-empty, non-whitespace-only string token'
    );
  }
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}
