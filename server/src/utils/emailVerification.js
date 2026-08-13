import crypto from 'crypto';
import { hashResetToken } from './tokenStore.js';

/** Verification link TTL — 30 minutes */
export const VERIFY_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * New accounts created on/after this instant must verify before login.
 * Legacy accounts created earlier remain usable even if emailVerified is false.
 * Override with AUTH_EMAIL_VERIFY_ENFORCE_FROM (ISO-8601).
 */
export const EMAIL_VERIFY_ENFORCE_FROM =
  process.env.AUTH_EMAIL_VERIFY_ENFORCE_FROM || '2026-07-26T11:00:00.000Z';

/** B2B accounts created before this instant are grandfathered (no email-verify lock). */
export const B2B_EMAIL_VERIFY_ENFORCE_FROM =
  process.env.B2B_EMAIL_VERIFY_ENFORCE_FROM || '2026-08-13T00:00:00.000Z';

const STAFF_ROLES = new Set(['Admin', 'SuperAdmin', 'Editor', 'Moderator']);

export function frontendBaseUrl() {
  return (
    process.env.FRONTEND_URL
    || process.env.APP_URL
    || process.env.SITE_URL
    || 'http://localhost:5173'
  ).replace(/\/$/, '');
}

export function createRawVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashVerificationToken(rawToken) {
  return hashResetToken(String(rawToken || ''));
}

export function buildVerifyEmailUrl(rawToken, realm = 'user') {
  const token = encodeURIComponent(rawToken);
  if (realm && realm !== 'user') {
    return `${frontendBaseUrl()}/auth/verify-email?token=${token}&realm=${encodeURIComponent(realm)}`;
  }
  return `${frontendBaseUrl()}/auth/verify-email?token=${token}`;
}

/**
 * Whether login must be blocked pending email verification.
 * Staff and grandfathered legacy accounts are never blocked.
 */
export function isEmailVerificationRequired(user) {
  if (!user) return false;
  if (user.emailVerified === true) return false;
  if (STAFF_ROLES.has(user.role)) return false;

  const from = new Date(EMAIL_VERIFY_ENFORCE_FROM);
  if (!Number.isNaN(from.getTime()) && user.createdAt) {
    if (new Date(user.createdAt) < from) return false;
  }
  return true;
}

export function applyVerificationTokenFields(user, rawToken = createRawVerificationToken()) {
  user.emailVerificationToken = hashVerificationToken(rawToken);
  user.emailVerificationExpires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  return rawToken;
}

export function clearVerificationTokenFields(user) {
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
}
