/**
 * Session-expired callback registry (Phase 1 auth convergence).
 *
 * HTTP clients invoke registered realm handlers when refresh fails terminally
 * so UI cache (localStorage profile) clears with the in-memory access token.
 */

const handlers = new Set();

export function onSessionExpired(handler) {
  if (typeof handler !== 'function') return () => {};
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function notifySessionExpired(realm = 'user') {
  for (const handler of handlers) {
    try {
      handler(realm);
    } catch {
      /* best-effort */
    }
  }
}
