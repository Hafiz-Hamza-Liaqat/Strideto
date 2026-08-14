import { sanitizeString } from './sanitize.js';
import { canonicalizeStoredPhone } from '../../../shared/international/phone.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidHttpUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return true;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidEmail(value) {
  const raw = String(value || '').trim();
  if (!raw) return true;
  return EMAIL_RE.test(raw) && raw.length <= 254;
}

const PROFILE_FIELDS = [
  'companyName',
  'phone',
  'website',
  'companyDescription',
  'industry',
  'companySize',
  'location',
  'city',
  'province',
  'isPublicProfile',
  'logoUrl',
];

/**
 * @param {object} body
 * @returns {{ ok: boolean, error?: string, updates?: object }}
 */
export function buildEmployerProfileUpdates(body = {}) {
  const updates = {};
  for (const key of PROFILE_FIELDS) {
    if (body[key] === undefined) continue;
    if (key === 'isPublicProfile') {
      updates.isPublicProfile = Boolean(body.isPublicProfile);
      continue;
    }
    if (key === 'logoUrl') {
      const url = String(body.logoUrl || '').trim();
      if (url && !isValidHttpUrl(url)) {
        return { ok: false, error: 'logoUrl must be a valid http(s) URL' };
      }
      updates.logoUrl = url;
      continue;
    }
    if (key === 'website') {
      const url = String(body.website || '').trim();
      if (url && !isValidHttpUrl(url)) {
        return { ok: false, error: 'website must be a valid http(s) URL' };
      }
      updates.website = url;
      continue;
    }
    if (key === 'phone') {
      const result = canonicalizeStoredPhone(body.phone);
      if (!result.ok) return { ok: false, error: result.error };
      updates.phone = result.value;
      continue;
    }
    if (key === 'companyName') {
      const name = sanitizeString(String(body.companyName || '').trim());
      if (!name) return { ok: false, error: 'companyName is required' };
      updates.companyName = name.slice(0, 200);
      continue;
    }
    updates[key] = sanitizeString(String(body[key] || '').trim()).slice(0, key === 'companyDescription' ? 5000 : 200);
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: 'No valid fields to update' };
  }
  return { ok: true, updates };
}
