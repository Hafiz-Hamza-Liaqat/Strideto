import { secureAccessAuthorization } from '../services/auth/secureAccessAuthorization.js';
import { setPrivateResponseHeaders } from './privateResponse.js';

/**
 * SEC-3E — maps a `secureAccessAuthorization` principal onto the exact
 * `req.user`/`req.employer` shapes every existing, unrelated handler
 * already reads (`userId`/`employerId`, `role`) — `requireUserAuth`,
 * `requireEmployerAuth`, `requireRole`, `requireAdmin`, `requireUser`, and
 * every non-auth route/controller need no change at all.
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
  } else if (principal.realm === 'agent') {
    req.agent = {
      agentAccountId: principal.subjectId,
      subjectId: principal.subjectId,
      role: 'agent',
      sid: principal.sid,
      jti: principal.jti,
      tokenVersion: principal.tokenVersion,
      exp: principal.exp,
    };
  } else if (principal.realm === 'institution') {
    req.institution = {
      institutionAccountId: principal.subjectId,
      subjectId: principal.subjectId,
      role: 'institution',
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
  setPrivateResponseHeaders(res);
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
  const result = await secureAccessAuthorization.authorizeRequest({
    authorizationHeader: authHeader,
  });
  if (result.code === 'ACCESS_AUTHORIZED') {
    setPrivateResponseHeaders(res);
    attachSecurePrincipal(req, result.principal);
  }
  next();
}

export function requireAuth(req, res, next) {
  return secureRequireAuth(req, res, next);
}

/** Requires a User token (not Employer). Use for candidate-facing routes. */
export function requireUserAuth(req, res, next) {
  if (req.employer) {
    return res
      .status(403)
      .json({ error: 'Employer account cannot access this resource' });
  }
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/** Optional auth — attaches user/employer when valid token present; never rejects. */
export function optionalAuth(req, res, next) {
  return secureOptionalAuth(req, res, next);
}

/** Requires an Employer token. Use for employer dashboard routes. */
export async function requireEmployerAuth(req, res, next) {
  if (!req.employer) {
    return res.status(401).json({ error: 'Employer authentication required' });
  }
  try {
    const { attachEmployerOrganizationContext } = await import(
      '../services/employer/employerOrganizationService.js'
    );
    await attachEmployerOrganizationContext(req);
    next();
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message, code: err.code });
  }
}

/** Requires an Agent token. Use for agent portal routes. */
export function requireAgentAuth(req, res, next) {
  if (!req.agent) {
    return res.status(401).json({ error: 'Agent authentication required' });
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

/** Requires an Institution token. Use for institution portal routes. */
export function requireInstitutionAuth(req, res, next) {
  if (!req.institution) {
    return res.status(401).json({ error: 'Institution authentication required' });
  }
  next();
}
