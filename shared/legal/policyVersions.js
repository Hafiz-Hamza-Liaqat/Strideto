/**
 * Server-authoritative legal document versions.
 * Clients may display these; they must never supply the stored timestamps.
 */
export const TERMS_VERSION = '2026-08-01';
export const PRIVACY_VERSION = '2026-08-01';

export function legalAcceptanceMetadata(now = new Date()) {
  const acceptedAt = now instanceof Date ? now : new Date(now);
  return Object.freeze({
    termsAcceptedAt: acceptedAt,
    termsVersion: TERMS_VERSION,
    privacyAcknowledgedAt: acceptedAt,
    privacyVersion: PRIVACY_VERSION,
  });
}

export function requireAcceptedTerms(body = {}) {
  return body.acceptedTerms === true;
}
