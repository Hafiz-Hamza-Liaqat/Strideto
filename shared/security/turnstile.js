/**
 * Cloudflare Turnstile boundary. Launch default is not_configured.
 * Production secrets must never be committed. Local may use official test keys.
 */
export const TURNSTILE_ACTIONS = Object.freeze([
  'register',
  'password_recovery',
  'otp_resend',
  'suspicious_auth',
]);

export function turnstileConfig(env = process.env) {
  const enabled = env.TURNSTILE_ENABLED === '1';
  const siteKey = String(env.VITE_TURNSTILE_SITE_KEY || env.TURNSTILE_SITE_KEY || '').trim();
  const secret = String(env.TURNSTILE_SECRET_KEY || '').trim();
  if (!enabled || !siteKey || !secret) {
    return Object.freeze({
      state: 'not_configured',
      enabled: false,
      siteKey: '',
    });
  }
  return Object.freeze({
    state: 'configured',
    enabled: true,
    siteKey,
  });
}

export function turnstileSecret(env = process.env) {
  return String(env.TURNSTILE_SECRET_KEY || '').trim();
}
