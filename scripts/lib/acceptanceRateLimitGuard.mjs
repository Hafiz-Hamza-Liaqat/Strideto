/** QA-only pacing around the production API limiter. Does not change product limits. */

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_BUDGET = 450; // stay under production apiLimiter max of 500/15min

export function retryAfterMs(response) {
  const header = response.headers?.()['retry-after'] || response.headers?.()['Retry-After'];
  if (!header) return 1000;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1000, seconds * 1000);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(1000, date - Date.now());
  return 1000;
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createRateLimitGuard({
  windowMs = Number(process.env.STRIDETO_QA_API_WINDOW_MS || DEFAULT_WINDOW_MS),
  budget = Number(process.env.STRIDETO_QA_API_WINDOW_BUDGET || DEFAULT_BUDGET),
  cellGapMs = Number(process.env.STRIDETO_QA_CELL_GAP_MS || 1500),
} = {}) {
  const hits = [];
  const stats = { apiRequests: 0, status429: 0, retries: 0, logins: 0 };

  function prune(now = Date.now()) {
    while (hits.length && hits[0] < now - windowMs) hits.shift();
  }

  function noteApi() {
    stats.apiRequests += 1;
    hits.push(Date.now());
    prune();
  }

  function note429() {
    stats.status429 += 1;
  }

  function noteRetry() {
    stats.retries += 1;
  }

  function noteLogin() {
    stats.logins += 1;
  }

  function hitsInWindow() {
    prune();
    return hits.length;
  }

  async function beforeCell(estimated = 25) {
    prune();
    while (hits.length + estimated >= budget) {
      const waitMs = Math.max(500, hits[0] + windowMs - Date.now() + 250);
      await delay(Math.min(waitMs, 5000));
      prune();
    }
    if (cellGapMs > 0) await delay(cellGapMs);
  }

  return { stats, noteApi, note429, noteRetry, noteLogin, beforeCell, hitsInWindow, windowMs, budget, cellGapMs };
}
