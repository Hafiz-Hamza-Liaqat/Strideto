/**
 * Spam protection for form submissions (C.7.0.2).
 *
 * CAPTCHA verification contract (STRIDETO-SEC-2). The provider set below is
 * reconstructed from the only place a provider value is ever produced —
 * FormDefinition.js's `spamSettings.captchaProvider` enum (['none', 'recaptcha',
 * 'turnstile']) — no provider is added or invented beyond what that schema
 * already recognizes. Verification endpoints are a fixed, trusted,
 * server-side-only mapping; no request or config value can influence which
 * host is contacted, eliminating SSRF/caller-controlled-endpoint risk.
 *
 * checkFormSpam() and verifyCaptchaToken() are asynchronous because real
 * provider verification requires a network round trip. See
 * docs/STRIDETO_INPUT_AND_ABUSE_SECURITY_HARDENING_REPORT.md for why this
 * correction could not be safely wired into the live submitForm() endpoint
 * within this task's authorized file set (its one call site in
 * formPublicController.js is outside SEC-2 scope, and calling this function
 * without `await` would silently treat every submission as unblocked).
 */

const CAPTCHA_PROVIDER_ENDPOINTS = Object.freeze({
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
});

const CAPTCHA_PROVIDER_SECRET_ENV = Object.freeze({
  recaptcha: 'RECAPTCHA_SECRET_KEY',
  turnstile: 'TURNSTILE_SECRET_KEY',
});

const MAX_TOKEN_LENGTH = 4096;
const VERIFICATION_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 65536;

/** Internal-only failure classification. Never sent to a public client. */
export const CAPTCHA_ERROR_CODES = Object.freeze({
  TOKEN_REQUIRED: 'CAPTCHA_TOKEN_REQUIRED',
  PROVIDER_UNSUPPORTED: 'CAPTCHA_PROVIDER_UNSUPPORTED',
  NOT_CONFIGURED: 'CAPTCHA_NOT_CONFIGURED',
  VERIFICATION_REJECTED: 'CAPTCHA_VERIFICATION_REJECTED',
  VERIFICATION_TIMEOUT: 'CAPTCHA_VERIFICATION_TIMEOUT',
  VERIFICATION_UNAVAILABLE: 'CAPTCHA_VERIFICATION_UNAVAILABLE',
  RESPONSE_INVALID: 'CAPTCHA_RESPONSE_INVALID',
});

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function ok() {
  return { ok: true, code: null };
}

function fail(code) {
  return { ok: false, code };
}

/**
 * Reads at most `MAX_RESPONSE_BYTES` from a fetch Response body and parses it
 * as JSON. Bounds memory use against an unexpectedly large provider response
 * and never throws — parse/size failures resolve to `null`.
 */
async function readBoundedJson(response) {
  const reader = response.body?.getReader ? response.body.getReader() : null;
  if (!reader) {
    // Environments without a streamable body (e.g. some fetch polyfills/mocks)
    // fall back to a single bounded read.
    try {
      const text = await response.text();
      if (text.length > MAX_RESPONSE_BYTES) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  let received = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value?.byteLength || 0;
      if (received > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  try {
    const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString(
      'utf8'
    );
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Verifies a CAPTCHA token against the fixed, trusted provider endpoint and
 * returns a bounded internal result — never throws, never exposes provider
 * detail. `options` (expectedHostname/expectedAction/minScore) are honored
 * when supplied but are not currently populated by any caller — the platform's
 * only CAPTCHA-config source (FormDefinition.js's `spamSettings`) does not yet
 * define hostname/action/score fields, so those checks are dormant until a
 * future config surface supplies them; see the SEC-2 report.
 *
 * @param {string} provider
 * @param {unknown} token
 * @param {{ expectedHostname?: string, expectedAction?: string, minScore?: number, remoteIp?: string }} [options]
 * @returns {Promise<{ ok: boolean, code: string|null }>}
 */
export async function verifyCaptchaTokenDetailed(
  provider,
  token,
  options = {}
) {
  if (!provider || provider === 'none') return ok();

  if (
    !Object.prototype.hasOwnProperty.call(CAPTCHA_PROVIDER_ENDPOINTS, provider)
  ) {
    return fail(CAPTCHA_ERROR_CODES.PROVIDER_UNSUPPORTED);
  }

  if (
    typeof token !== 'string' ||
    !token.trim() ||
    token.length > MAX_TOKEN_LENGTH
  ) {
    return fail(CAPTCHA_ERROR_CODES.TOKEN_REQUIRED);
  }

  const secretEnvVar = CAPTCHA_PROVIDER_SECRET_ENV[provider];
  const secret = process.env[secretEnvVar];
  if (!secret || !String(secret).trim()) {
    return fail(CAPTCHA_ERROR_CODES.NOT_CONFIGURED);
  }

  const endpoint = CAPTCHA_PROVIDER_ENDPOINTS[provider];
  const params = new URLSearchParams();
  params.set('secret', secret);
  params.set('response', token);
  if (options.remoteIp && typeof options.remoteIp === 'string') {
    params.set('remoteip', options.remoteIp.slice(0, 64));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFICATION_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      redirect: 'error', // never follow a redirect to an untrusted host
      signal: controller.signal,
    });
  } catch (err) {
    return fail(
      err?.name === 'AbortError'
        ? CAPTCHA_ERROR_CODES.VERIFICATION_TIMEOUT
        : CAPTCHA_ERROR_CODES.VERIFICATION_UNAVAILABLE
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response || !response.ok) {
    return fail(CAPTCHA_ERROR_CODES.VERIFICATION_UNAVAILABLE);
  }

  const data = await readBoundedJson(response);
  if (!isPlainObject(data)) {
    return fail(CAPTCHA_ERROR_CODES.RESPONSE_INVALID);
  }

  if (data.success !== true) {
    return fail(CAPTCHA_ERROR_CODES.VERIFICATION_REJECTED);
  }

  if (
    options.expectedHostname &&
    typeof data.hostname === 'string' &&
    data.hostname !== options.expectedHostname
  ) {
    return fail(CAPTCHA_ERROR_CODES.VERIFICATION_REJECTED);
  }

  if (
    options.expectedAction &&
    typeof data.action === 'string' &&
    data.action !== options.expectedAction
  ) {
    return fail(CAPTCHA_ERROR_CODES.VERIFICATION_REJECTED);
  }

  if (
    typeof options.minScore === 'number' &&
    typeof data.score === 'number' &&
    data.score < options.minScore
  ) {
    return fail(CAPTCHA_ERROR_CODES.VERIFICATION_REJECTED);
  }

  return ok();
}

/**
 * Boolean convenience wrapper over verifyCaptchaTokenDetailed(). Fails closed
 * on any error, malformed response, timeout, or network failure.
 *
 * @param {string} provider
 * @param {unknown} token
 * @param {{ expectedHostname?: string, expectedAction?: string, minScore?: number, remoteIp?: string }} [options]
 * @returns {Promise<boolean>}
 */
export async function verifyCaptchaToken(provider, token, options = {}) {
  const result = await verifyCaptchaTokenDetailed(provider, token, options);
  return result.ok;
}

/**
 * @param {object} form
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ blocked: boolean; silent?: boolean; reason?: string; score: number }>}
 */
export async function checkFormSpam(form, body) {
  const spam = form.spamSettings || {};
  let score = 0;

  if (spam.honeypot !== false) {
    const hpField = spam.honeypotField || 'website';
    const hpVal = body[hpField];
    if (hpVal && String(hpVal).trim()) {
      return { blocked: true, silent: true, reason: 'honeypot', score: 100 };
    }
  }

  const captchaProvider = spam.captchaProvider || 'none';
  if (captchaProvider !== 'none') {
    const token =
      body.captchaToken ||
      body['g-recaptcha-response'] ||
      body.cfTurnstileResponse;
    const verified = await verifyCaptchaToken(captchaProvider, token);
    if (!verified) {
      score += 50;
      return { blocked: true, reason: 'captcha_failed', score };
    }
  }

  return { blocked: false, score };
}
