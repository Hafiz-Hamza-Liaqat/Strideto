import { verifyToken } from '../utils/jwt.js';
import { isAccessTokenRevoked } from '../utils/tokenStore.js';
import { secureAuthConfig } from '../services/auth/secureAuthConfig.js';
import { secureAccessAuthorization } from '../services/auth/secureAccessAuthorization.js';

/**
 * SEC-3E — maps a `secureAccessAuthorization` principal onto the exact
 * `req.user`/`req.employer` shapes every existing, unrelated handler
 * already reads (`userId`/`employerId`, `role`) — `requireUserAuth`,
 * `requireEmployerAuth`, `requireRole`, `requireAdmin`, `requireUser`, and
 * every non-auth route/controller need no change at all, in either mode.
 * `sid`/`jti`/`tokenVersion`/`exp` are attached too — only the auth
 * controllers (logout/logout-all/change-password) read them.
 */
function attachSecurePrincipal(req, principal) {
  if (principal.realm === 'employer') {
    req.employer = {
      employerId: principal.subjectId,
      role: 'employer',
      sid: principal.sid,
      jti: principal.jti,
      tokenVersion: principal.tokenVersion,
      exp: principal.exp,
    };
  } else {
    req.user = {
      userId: principal.subjectId,
      role: principal.role,
      sid: principal.sid,
      jti: principal.jti,
      tokenVersion: principal.tokenVersion,
      exp: principal.exp,
    };
  }
}

async function secureRequireAuth(req, res, next) {
  const result = await secureAccessAuthorization.authorizeRequest({
    authorizationHeader: req.headers.authorization,
  });
  if (result.code !== 'ACCESS_AUTHORIZED') {
    return res.status(result.httpStatus).json(result.body);
  }
  attachSecurePrincipal(req, result.principal);
  next();
}

async function secureOptionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  const result = await secureAccessAuthorization.authorizeRequest({ authorizationHeader: authHeader });
  if (result.code === 'ACCESS_AUTHORIZED') {
    attachSecurePrincipal(req, result.principal);
  }
  next();
}

function legacyRequireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  isAccessTokenRevoked(token)
    .then((revoked) => {
      if (revoked) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
      try {
        const decoded = verifyToken(token);
        if (decoded.type === 'refresh') {
          return res.status(401).json({ error: 'Use access token for this request' });
        }
        if (decoded.employerId && decoded.role === 'employer') {
          req.employer = { employerId: decoded.employerId, role: 'employer' };
        } else {
          req.user = { userId: decoded.userId, role: decoded.role };
        }
        next();
      } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    })
    .catch(() => res.status(401).json({ error: 'Authentication failed' }));
}

export function requireAuth(req, res, next) {
  if (secureAuthConfig.enabled) {
    return secureRequireAuth(req, res, next);
  }
  return legacyRequireAuth(req, res, next);
}

/** Requires a User token (not Employer). Use for candidate-facing routes. */
export function requireUserAuth(req, res, next) {
  if (req.employer) {
    return res.status(403).json({ error: 'Employer account cannot access this resource' });
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/** Optional auth — attaches user/employer when valid token present; never rejects. */
export function optionalAuth(req, res, next) {
  if (secureAuthConfig.enabled) {
    return secureOptionalAuth(req, res, next);
  }
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return next();
  isAccessTokenRevoked(token)
    .then((revoked) => {
      if (revoked) return next();
      try {
        const decoded = verifyToken(token);
        if (decoded.type === 'refresh') return next();
        if (decoded.employerId && decoded.role === 'employer') {
          req.employer = { employerId: decoded.employerId, role: 'employer' };
        } else {
          req.user = { userId: decoded.userId, role: decoded.role, email: decoded.email, name: decoded.name };
        }
      } catch {
        /* ignore invalid token */
      }
      next();
    })
    .catch(() => next());
}

/** Requires an Employer token. Use for employer dashboard routes. */
export function requireEmployerAuth(req, res, next) {
  if (!req.employer) {
    return res.status(401).json({ error: 'Employer authentication required' });
  }
  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export const requireAdmin = requireRole('Admin', 'SuperAdmin');
export const requireUser = requireRole('User', 'Admin');
