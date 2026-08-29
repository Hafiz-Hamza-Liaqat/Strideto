import { isValidHttpUrl } from './employerProfileValidation.js';

const FORBIDDEN_SCHEMES = new Set(['javascript:', 'data:', 'file:', 'ftp:', 'vbscript:']);

/**
 * Validate employer-supplied interview meeting URLs.
 * Production requires HTTPS; development allows HTTP for local testing.
 */
export function validateInterviewMeetingUrl(value, { requireHttps = process.env.NODE_ENV === 'production' } = {}) {
  const raw = String(value || '').trim();
  if (!raw) return { ok: true, url: '' };
  if (!isValidHttpUrl(raw)) {
    return { ok: false, error: 'Meeting URL must be a valid HTTP or HTTPS link' };
  }
  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.toLowerCase();
    if (FORBIDDEN_SCHEMES.has(protocol)) {
      return { ok: false, error: 'Meeting URL uses a forbidden scheme' };
    }
    if (requireHttps && protocol !== 'https:') {
      return { ok: false, error: 'Meeting URL must use HTTPS' };
    }
    return { ok: true, url: raw };
  } catch {
    return { ok: false, error: 'Meeting URL must be a valid HTTP or HTTPS link' };
  }
}
