/**
 * Single-flight refresh helper. Refresh cookies rotate on every successful
 * POST; concurrent callers MUST share one in-flight request or the second
 * POST consumes a stale cookie and the frontend treats that as logout.
 */
export function createRefreshFlight() {
  let current = null;

  return {
    run(factory) {
      if (!current) {
        current = Promise.resolve()
          .then(factory)
          .finally(() => {
            current = null;
          });
      }
      return current;
    },
    reset() {
      current = null;
    },
  };
}
