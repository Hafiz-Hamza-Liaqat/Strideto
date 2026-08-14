/**
 * Store-only provider reference URL validation (Phase 17D-3).
 * Never fetch. Rejects private/local hosts and non-http(s) schemes.
 */
import { validateOfficialSourceUrl } from './officialSourceUrl.js';
import { GBS_PROVIDER_BOUNDS } from './constants.js';

export function validateStoredReferenceUrl(raw, { requireHttps = true } = {}) {
  if (raw == null || raw === '') return { ok: true, value: '' };
  if (typeof raw !== 'string') return { ok: false, error: 'reference_url_invalid' };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: '' };
  if (trimmed.length > GBS_PROVIDER_BOUNDS.URL_MAX) {
    return { ok: false, error: 'reference_url_too_long' };
  }
  return validateOfficialSourceUrl(trimmed, { requireHttps });
}
