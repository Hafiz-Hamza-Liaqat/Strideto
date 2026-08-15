/**
 * Narrow User-realm staff denial (Phase 17D-6).
 *
 * Staff shares the User JWT realm, so requireUserAuth is not enough to
 * distinguish ordinary customers from staff. Do not silently strip staff.
 */
import { isStaffRole } from '../config/rbac.js';
import { loadUserRecordForAuth } from '../services/security/authorizeAction.js';

export async function requireNonStaffUser(req, res, next) {
  try {
    if (req.employer || req.agent || req.institution) {
      return res.status(403).json({ error: 'unavailable' });
    }
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const record = await loadUserRecordForAuth(req);
    const role = record?.role || req.user.role;
    if (isStaffRole(role)) {
      return res.status(403).json({ error: 'unavailable' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}
