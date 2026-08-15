import { randomBytes } from 'node:crypto';
import { GBS_SERVICE_REQUEST_BOUNDS } from '../../../shared/gbs/constants.js';

/**
 * Opaque, high-entropy, URL-safe public request identifier.
 * Not sequential and not a raw Mongo ObjectId.
 */
export function generatePublicRequestRef() {
  return randomBytes(18).toString('base64url').slice(0, GBS_SERVICE_REQUEST_BOUNDS.REQUEST_REF_MAX);
}

export function isOpaqueRequestRef(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 16 || trimmed.length > GBS_SERVICE_REQUEST_BOUNDS.REQUEST_REF_MAX) {
    return false;
  }
  if (/^SR-\d+$/i.test(trimmed)) return false;
  if (/^[a-f0-9]{24}$/i.test(trimmed)) return false;
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
}
