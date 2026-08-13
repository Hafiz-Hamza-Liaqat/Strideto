import { turnstileConfig, turnstileSecret, TURNSTILE_ACTIONS } from '../../../shared/security/turnstile.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function requireTurnstileWhenEnabled(action) {
  if (!TURNSTILE_ACTIONS.includes(action)) {
    throw new TypeError(`Unknown Turnstile action: ${action}`);
  }

  return async function turnstileGuard(req, res, next) {
    const config = turnstileConfig(process.env);
    if (!config.enabled) {
      req.turnstile = { state: 'not_configured', skipped: true };
      return next();
    }

    const token = String(req.body?.turnstileToken || req.headers['cf-turnstile-response'] || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'Human verification is required' });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const body = new URLSearchParams({
        secret: turnstileSecret(process.env),
        response: token,
        remoteip: req.ip || '',
      });
      const response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!payload?.success) {
        return res.status(403).json({ error: 'Human verification failed' });
      }
      req.turnstile = { state: 'verified', action };
      return next();
    } catch {
      return res.status(503).json({ error: 'Human verification is temporarily unavailable' });
    } finally {
      clearTimeout(timer);
    }
  };
}
