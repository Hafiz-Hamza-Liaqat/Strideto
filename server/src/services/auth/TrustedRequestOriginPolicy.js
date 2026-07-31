/**
 * SEC-3C — dormant trusted-request-origin policy. Pure, dependency-free
 * logic; not wired into Express, CORS, or any route. Authority:
 * docs/STRIDETO_AUTHENTICATION_SESSION_SECURITY_ARCHITECTURE_AUDIT.md §19.
 *
 * Mirrors `config/cors.js`'s own exact-match-against-a-Set approach
 * (never substring/suffix/regex matching) rather than diverging from the
 * established, already-correct convention.
 *
 * SEC-3C.1 correction: §19 point 4 introduces a forced-preflight header
 * only as a hedged illustrative example ("e.g. `X-Strideto-Client: web`"),
 * not as a finalized, adopted, exact contract — confirmed by re-reading
 * the checkpointed architecture report directly (no other passage
 * declares it authoritative). This module therefore implements no marker
 * evaluator. Strict Origin/Referer validation below is the sole
 * authoritative dormant primitive this module provides; exact
 * forced-preflight marker selection, if any, is deferred to SEC-3E.
 */

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Parses a configured trusted-origin entry into its normalized origin
 * string, or `null` if it is not an acceptable configuration entry.
 * Rejects: any path other than `/`, query, fragment, embedded credentials,
 * wildcard host, opaque/`null` origins, and malformed URLs.
 */
function normalizeConfiguredOrigin(raw) {
  if (!isNonEmptyString(raw)) return null;
  if (raw === 'null' || raw === '*') return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  if (url.search || url.hash) return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  if (url.hostname === '*' || url.hostname.includes('*')) return null;
  return url.origin;
}

/**
 * Parses an incoming `Origin` (or a derived `Referer` origin) header
 * value strictly. Rejects comma-separated/multiple values (a single
 * `Origin` header must never legitimately contain more than one value),
 * `null`, and anything that isn't a clean scheme+host[:port] origin with
 * no path/query/fragment/credentials.
 */
function parseIncomingOrigin(raw) {
  if (!isNonEmptyString(raw)) return { kind: 'missing' };
  if (raw === 'null') return { kind: 'null' };
  if (raw.includes(',')) return { kind: 'malformed' };
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { kind: 'malformed' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { kind: 'malformed' };
  }
  if (url.username || url.password) return { kind: 'malformed' };
  if (raw.replace(/\/$/, '') !== url.origin) {
    // The raw Origin header itself must already be exactly an origin (no
    // path/query/fragment) — Origin headers are never supposed to carry
    // those, so anything beyond `scheme://host[:port]` is malformed input,
    // not something to silently normalize away.
    return { kind: 'malformed' };
  }
  return { kind: 'ok', origin: url.origin };
}

/**
 * Parses a `Referer` header as a full absolute URL and derives its
 * origin. Unlike `Origin`, `Referer` legitimately carries a path/query,
 * so those are stripped, not treated as malformed.
 */
function parseRefererOrigin(raw) {
  if (!isNonEmptyString(raw)) return { kind: 'missing' };
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { kind: 'malformed' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { kind: 'malformed' };
  }
  if (url.username || url.password) return { kind: 'malformed' };
  return { kind: 'ok', origin: url.origin };
}

function assertValidTrustedOrigins(trustedOrigins) {
  if (!Array.isArray(trustedOrigins) || trustedOrigins.length === 0) {
    throw new TypeError('trustedOrigins must be a non-empty array');
  }
  const normalized = new Set();
  for (const raw of trustedOrigins) {
    const normalizedOrigin = normalizeConfiguredOrigin(raw);
    if (!normalizedOrigin) {
      throw new TypeError(
        `trustedOrigins entry is not an acceptable origin: ${JSON.stringify(raw)}`
      );
    }
    normalized.add(normalizedOrigin);
  }
  return normalized;
}

/**
 * @param {object} config
 * @param {string[]} config.trustedOrigins — exact origins to trust
 * @param {'production'|'development'} config.mode
 */
export function createTrustedRequestOriginPolicy(config) {
  const { trustedOrigins, mode } = config || {};
  if (mode !== 'production' && mode !== 'development') {
    throw new TypeError(
      'TrustedRequestOriginPolicy requires an unambiguous production or development mode'
    );
  }
  const trustedSet = assertValidTrustedOrigins(trustedOrigins);
  if (mode === 'production') {
    for (const origin of trustedSet) {
      if (!origin.startsWith('https:')) {
        throw new TypeError(
          `production trustedOrigins entries must be HTTPS: ${origin}`
        );
      }
    }
  }

  /**
   * Evaluate a request's Origin/Referer per the exact §19 precedence:
   * Origin present (valid or not) never falls back to Referer; Origin
   * genuinely absent falls back to Referer; both absent fails closed.
   */
  function evaluateRequestOrigin({ origin, referer }) {
    const parsedOrigin = parseIncomingOrigin(origin);

    if (parsedOrigin.kind === 'null') {
      return Object.freeze({ code: 'ORIGIN_NULL' });
    }
    if (parsedOrigin.kind === 'malformed') {
      return Object.freeze({ code: 'ORIGIN_MALFORMED' });
    }
    if (parsedOrigin.kind === 'ok') {
      return trustedSet.has(parsedOrigin.origin)
        ? Object.freeze({ code: 'ORIGIN_TRUSTED' })
        : Object.freeze({ code: 'ORIGIN_UNTRUSTED' });
    }

    // Origin genuinely absent (parsedOrigin.kind === 'missing') — fall
    // back to Referer, per §19 step 2.
    const parsedReferer = parseRefererOrigin(referer);
    if (parsedReferer.kind === 'missing') {
      return Object.freeze({ code: 'ORIGIN_MISSING' });
    }
    if (parsedReferer.kind === 'malformed') {
      return Object.freeze({ code: 'REFERER_MALFORMED' });
    }
    return trustedSet.has(parsedReferer.origin)
      ? Object.freeze({ code: 'REFERER_TRUSTED' })
      : Object.freeze({ code: 'REFERER_UNTRUSTED' });
  }

  return Object.freeze({
    mode,
    trustedOrigins: Object.freeze([...trustedSet]),
    evaluateRequestOrigin,
  });
}
