/**
 * SEO-P8 — minimal service-account JWT for GSC readonly API (server-only).
 */
import jwt from 'jsonwebtoken';
import { GSC_READONLY_SCOPE } from './gscConfig.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKEN_CACHE_MS = 50 * 60 * 1000;

/** @type {{ token?: string, expiresAt?: number }} */
const cache = {};

/**
 * @param {{ serviceEmail: string, privateKey: string, scope?: string }} config
 */
export function createServiceAccountAssertion(config) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: config.serviceEmail,
      scope: config.scope || GSC_READONLY_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    config.privateKey,
    { algorithm: 'RS256' },
  );
}

/**
 * @param {{ serviceEmail: string, privateKey: string, scope?: string }} config
 */
export async function getGscAccessToken(config) {
  if (cache.token && cache.expiresAt && cache.expiresAt > Date.now()) {
    return cache.token;
  }

  const assertion = createServiceAccountAssertion(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = new Error('gsc_token_exchange_failed');
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    cache.token = data.access_token;
    cache.expiresAt = Date.now() + TOKEN_CACHE_MS;
    return cache.token;
  } finally {
    clearTimeout(timeout);
  }
}

export function clearGscTokenCache() {
  cache.token = undefined;
  cache.expiresAt = undefined;
}
