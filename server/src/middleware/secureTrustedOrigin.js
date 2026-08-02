import { secureAuthConfig } from '../services/auth/secureAuthConfig.js';
import { SAFE_BODIES } from '../services/auth/secureAuthResultMapping.js';

/**
 * SEC-3E.1 — the single authoritative composition point for trusted-origin
 * enforcement on browser-authentication routes. Corrects the original
 * SEC-3E pass, which called `TrustedRequestOriginPolicy` by hand inside
 * individual controller functions, sometimes *after* the request had
 * already performed a database read/write (a real login timestamp write,
 * an Employer account creation, an audit-log entry) — this module makes
 * the check the first route-specific handler instead, so no secure-mode
 * side effect of any kind can occur before it runs.
 *
 * Delegates entirely to the already-checkpointed, unmodified
 * `TrustedRequestOriginPolicy` (SEC-3C) via `secureAuthConfig.originPolicy`
 * — no origin-matching algorithm is duplicated here.
 */
export function secureTrustedOrigin(req, res, next) {
  const result = secureAuthConfig.originPolicy.evaluateRequestOrigin({
    origin: req.headers.origin,
    referer: req.headers.referer,
  });
  const trusted =
    result.code === 'ORIGIN_TRUSTED' || result.code === 'REFERER_TRUSTED';

  if (!trusted) {
    // No raw Origin/Referer echoed, no configured trusted-origin list
    // leaked — matches the architecture's own §19 point 8 error shape.
    return res.status(403).json(SAFE_BODIES.ORIGIN_VALIDATION_FAILED);
  }

  next();
}
