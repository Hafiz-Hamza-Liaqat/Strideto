/**
 * Source checker boundary (Mission 5).
 *
 * Defines the contract for a source availability check and provides:
 *   - a NO-OP implementation (default — safe for Mission 5)
 *   - an injectable factory for injecting mock responses in tests
 *
 * IMPORTANT: No live internet checks are performed in Mission 5.
 * This boundary exists so future scheduled checking (Mission X) and any
 * admin-triggered re-check can plug in a real HTTP adapter without touching
 * the provenance or freshness models.
 *
 * The checker contract:
 *   checkSource(url, opts?) → Promise<SourceCheckResult>
 *
 * SourceCheckResult shape:
 *   {
 *     ok: boolean,
 *     status: 'reachable' | 'unreachable' | 'redirected' | 'error',
 *     httpStatus?: number,      // HTTP response code if checked
 *     canonicalUrl?: string,    // final URL after redirects
 *     checkedAt: string,        // ISO 8601
 *     errorMessage?: string,
 *   }
 */

/** @typedef {'reachable'|'unreachable'|'redirected'|'error'} CheckStatus */

/**
 * @typedef {object} SourceCheckResult
 * @property {boolean} ok
 * @property {CheckStatus} status
 * @property {number} [httpStatus]
 * @property {string} [canonicalUrl]
 * @property {string} checkedAt ISO 8601
 * @property {string} [errorMessage]
 */

/**
 * No-op checker — returns a safe "not checked" result without any network call.
 * This is the correct default for Mission 5.
 *
 * @param {string} _url
 * @returns {Promise<SourceCheckResult>}
 */
export async function noOpSourceChecker(_url) {
  return {
    ok: false,
    status: 'error',
    checkedAt: new Date().toISOString(),
    errorMessage: 'Live source checking is not enabled in this context.',
  };
}

/**
 * Create an injectable mock checker for testing.
 *
 * @param {Record<string, SourceCheckResult>} responseMap
 *   Map of normalized URL → result. If URL not found, returns 'unreachable'.
 * @returns {(url: string) => Promise<SourceCheckResult>}
 */
export function createMockSourceChecker(responseMap = {}) {
  return async function mockChecker(url) {
    const checkedAt = new Date().toISOString();
    const key = url ? url.toLowerCase() : '';
    if (Object.prototype.hasOwnProperty.call(responseMap, key)) {
      return { checkedAt, ...responseMap[key] };
    }
    return {
      ok: false,
      status: 'unreachable',
      checkedAt,
      errorMessage: 'No mock response registered for this URL.',
    };
  };
}

/**
 * Source checker registry — holds the active checker implementation.
 * Default is the no-op checker. Call setSourceChecker() to inject a
 * real HTTP adapter (future mission) or a mock (tests).
 *
 * Do NOT set a live HTTP checker from within Mission 5 code.
 */
let _activeChecker = noOpSourceChecker;

export function setSourceChecker(checkerFn) {
  if (typeof checkerFn !== 'function') throw new TypeError('checkerFn must be a function');
  _activeChecker = checkerFn;
}

export function resetSourceChecker() {
  _activeChecker = noOpSourceChecker;
}

/**
 * Check a source URL using the currently-registered checker.
 *
 * @param {string} url
 * @param {object} [opts]
 * @returns {Promise<SourceCheckResult>}
 */
export async function checkSource(url, opts = {}) {
  return _activeChecker(url, opts);
}
