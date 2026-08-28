/**
 * SEO-P5 — IndexNow submission service (best-effort, bounded, no live calls in tests).
 */
import { logger } from '../../utils/logger.js';
import { readIndexNowConfig } from './indexNowConfig.js';
import {
  buildIndexNowPayload,
  normalizeIndexNowUrlList,
  INDEXNOW_PROTOCOL_MAX_URLS,
} from '../../../../shared/seo/indexNowUrlPolicy.js';
import { PRODUCTION_PUBLIC_ORIGIN } from '../../../../shared/seo/publicSiteOrigin.js';

export const INDEXNOW_TIMEOUT_MS = 8000;
export const INDEXNOW_INTERNAL_BATCH_LIMIT = 1000;

let fetchImpl = globalThis.fetch;

export function setIndexNowFetchForTests(fn) {
  fetchImpl = fn;
}

export function resetIndexNowFetchForTests() {
  fetchImpl = globalThis.fetch;
}

function classifyIndexNowResponse(status) {
  if (status === 200 || status === 202) return 'accepted';
  if (status === 429) return 'rate_limited';
  if (status === 400 || status === 403 || status === 422) return 'permanent_failure';
  if (status >= 500) return 'transient_failure';
  return 'unknown';
}

/**
 * @param {string[]} pathsOrUrls — canonical paths or absolute URLs
 * @param {{ fetchFn?: typeof fetch, env?: object }} [options]
 */
export async function submitIndexNowUrls(pathsOrUrls, options = {}) {
  const config = readIndexNowConfig(options.env);
  if (!config.enabled) {
    logger.debug('seo.indexnow.skipped', { reason: config.reason, count: pathsOrUrls?.length || 0 });
    return { ok: false, skipped: true, reason: config.reason };
  }

  const absoluteUrls = normalizeIndexNowUrlList(
    (pathsOrUrls || []).map((u) =>
      String(u).startsWith('http') ? u : `${PRODUCTION_PUBLIC_ORIGIN}${u.startsWith('/') ? u : `/${u}`}`
    )
  );

  if (!absoluteUrls.length) {
    return { ok: false, skipped: true, reason: 'no_valid_urls' };
  }

  if (absoluteUrls.length > INDEXNOW_PROTOCOL_MAX_URLS) {
    absoluteUrls.length = INDEXNOW_PROTOCOL_MAX_URLS;
  }

  const payload = buildIndexNowPayload({
    key: config.key,
    keyLocation: config.keyLocation,
    urls: absoluteUrls,
    host: config.host,
  });

  const fetchFn = options.fetchFn || fetchImpl;
  if (typeof fetchFn !== 'function') {
    return { ok: false, skipped: true, reason: 'fetch_unavailable' };
  }

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INDEXNOW_TIMEOUT_MS);

  try {
    logger.info('seo.indexnow.submitted', { urlCount: payload.urlList.length });

    const response = await fetchFn(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const category = classifyIndexNowResponse(response.status);
    const durationMs = Date.now() - started;

    if (category === 'accepted') {
      logger.info('seo.indexnow.accepted', { status: response.status, durationMs, urlCount: payload.urlList.length });
      return { ok: true, status: response.status, category, durationMs, urlCount: payload.urlList.length };
    }

    logger.warn('seo.indexnow.failed', {
      status: response.status,
      category,
      durationMs,
      urlCount: payload.urlList.length,
    });
    return { ok: false, status: response.status, category, durationMs, urlCount: payload.urlList.length };
  } catch (err) {
    const durationMs = Date.now() - started;
    const isTimeout = err?.name === 'AbortError';
    logger.warn('seo.indexnow.failed', {
      category: isTimeout ? 'timeout' : 'network_error',
      durationMs,
      urlCount: payload.urlList.length,
      error: isTimeout ? 'timeout' : 'network',
    });
    return { ok: false, category: isTimeout ? 'timeout' : 'network_error', durationMs };
  } finally {
    clearTimeout(timer);
  }
}

export function getIndexNowBatchLimit() {
  return Math.min(INDEXNOW_INTERNAL_BATCH_LIMIT, INDEXNOW_PROTOCOL_MAX_URLS);
}
