/**
 * Shared email-verification UI contract (Phase 17C-VR).
 * Pure helpers — no React, no network, no token persistence.
 */

export const VERIFY_EMAIL_STATES = Object.freeze({
  IDLE: 'IDLE',
  VERIFYING: 'VERIFYING',
  VERIFIED: 'VERIFIED',
  PENDING_EMAIL_INPUT: 'PENDING_EMAIL_INPUT',
  INVALID_OR_EXPIRED: 'INVALID_OR_EXPIRED',
  ALREADY_USED: 'ALREADY_USED',
  RATE_LIMITED: 'RATE_LIMITED',
  RESEND_ACCEPTED: 'RESEND_ACCEPTED',
  ERROR_SAFE: 'ERROR_SAFE',
});

export const VERIFY_EMAIL_REALMS = Object.freeze(['user', 'employer', 'agent', 'institution']);

export const VERIFY_EMAIL_MESSAGES = Object.freeze({
  SUCCESS: 'Email verified successfully.',
  VERIFYING: 'Verifying…',
  INVALID_OR_EXPIRED: 'This verification link is invalid or has expired. Request a new verification link.',
  ALREADY_USED: 'This verification link can no longer be used. Request a new link if needed.',
  RATE_LIMITED: 'Too many verification attempts. Try again later.',
  ERROR_SAFE: 'Verification could not be completed. Request a new link if needed.',
  RESEND_ACCEPTED: 'If an unverified account exists for this email, a new verification link has been sent.',
  RESEND_RATE_LIMITED: 'Too many verification email requests. Try again later.',
  RESEND_ERROR: 'Could not resend verification email.',
  EMAIL_REQUIRED: 'Enter your email to resend verification.',
});

const RAW_TOKEN_RE = /^[a-f0-9]{64}$/i;

export function parseSearchParams(search) {
  if (search instanceof URLSearchParams) return search;
  const raw = String(search || '');
  return new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
}

export function captureVerifyEmailSecrets(search) {
  const params = parseSearchParams(search);
  const token = String(params.get('token') || '').trim();
  const realmRaw = String(params.get('realm') || 'user').trim().toLowerCase();
  const realm = VERIFY_EMAIL_REALMS.includes(realmRaw) ? realmRaw : 'user';
  return {
    token,
    realm,
    pending: params.get('pending') === '1',
    verified: params.get('verified') === '1',
    deliveryUnavailable: params.get('delivery') === 'unavailable',
  };
}

export function isWellFormedVerifyToken(token) {
  return RAW_TOKEN_RE.test(String(token || ''));
}

export function initialVerifyEmailStatus({ token, pending, verified } = {}) {
  if (verified) return VERIFY_EMAIL_STATES.VERIFIED;
  if (token) return VERIFY_EMAIL_STATES.VERIFYING;
  if (pending) return VERIFY_EMAIL_STATES.PENDING_EMAIL_INPUT;
  return VERIFY_EMAIL_STATES.IDLE;
}

export function shouldStartVerification({ token, alreadyStarted } = {}) {
  return Boolean(token) && !alreadyStarted;
}

/**
 * StrictMode/remount contract: the first invocation may start work; a second
 * invocation with the same captured token must not start another consume.
 */
export function nextConsumeGate(alreadyStarted) {
  if (alreadyStarted) return { start: false, alreadyStarted: true };
  return { start: true, alreadyStarted: true };
}

export function stripSecretQueryParams(search, keys = ['token', 'email']) {
  const next = new URLSearchParams(parseSearchParams(search));
  for (const key of keys) next.delete(key);
  return next;
}

export function verifiedSearchParams(realm = 'user') {
  const next = new URLSearchParams();
  next.set('verified', '1');
  if (realm && realm !== 'user') next.set('realm', realm);
  return next;
}

function responseCode(err) {
  return err?.response?.data?.code || err?.code || '';
}

function responseStatus(err) {
  return err?.response?.status || err?.status || 0;
}

export function mapVerifyEmailHttpError(err) {
  const status = responseStatus(err);
  const code = String(responseCode(err));
  if (status === 429 || code === 'RATE_LIMITED') {
    return { state: VERIFY_EMAIL_STATES.RATE_LIMITED, message: VERIFY_EMAIL_MESSAGES.RATE_LIMITED };
  }
  if (code === 'ALREADY_USED' || code === 'TOKEN_INVALID') {
    return { state: VERIFY_EMAIL_STATES.ALREADY_USED, message: VERIFY_EMAIL_MESSAGES.ALREADY_USED };
  }
  if (code === 'INVALID_OR_EXPIRED' || code === 'TOKEN_EXPIRED' || status === 400) {
    return {
      state: VERIFY_EMAIL_STATES.INVALID_OR_EXPIRED,
      message: VERIFY_EMAIL_MESSAGES.INVALID_OR_EXPIRED,
    };
  }
  return { state: VERIFY_EMAIL_STATES.ERROR_SAFE, message: VERIFY_EMAIL_MESSAGES.ERROR_SAFE };
}

export function mapResendHttpResult(err) {
  if (!err) {
    return { state: VERIFY_EMAIL_STATES.RESEND_ACCEPTED, message: VERIFY_EMAIL_MESSAGES.RESEND_ACCEPTED };
  }
  const status = responseStatus(err);
  if (status === 429) {
    return {
      state: VERIFY_EMAIL_STATES.RATE_LIMITED,
      message: VERIFY_EMAIL_MESSAGES.RESEND_RATE_LIMITED,
    };
  }
  return { state: VERIFY_EMAIL_STATES.ERROR_SAFE, message: VERIFY_EMAIL_MESSAGES.RESEND_ERROR };
}

export function safeVerifyUserMessage(state, fallback) {
  if (state === VERIFY_EMAIL_STATES.VERIFIED) return VERIFY_EMAIL_MESSAGES.SUCCESS;
  if (state === VERIFY_EMAIL_STATES.INVALID_OR_EXPIRED) return VERIFY_EMAIL_MESSAGES.INVALID_OR_EXPIRED;
  if (state === VERIFY_EMAIL_STATES.ALREADY_USED) return VERIFY_EMAIL_MESSAGES.ALREADY_USED;
  if (state === VERIFY_EMAIL_STATES.RATE_LIMITED) return VERIFY_EMAIL_MESSAGES.RATE_LIMITED;
  if (state === VERIFY_EMAIL_STATES.ERROR_SAFE) return VERIFY_EMAIL_MESSAGES.ERROR_SAFE;
  return fallback || VERIFY_EMAIL_MESSAGES.ERROR_SAFE;
}
