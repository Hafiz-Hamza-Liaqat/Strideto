import { AuditLog } from '../models/AuditLog.js';

export async function logAudit({
  actor,
  action,
  targetType = '',
  targetId = '',
  targetLabel = '',
  ip = '',
  status = 'success',
  metadata = {},
  before = undefined,
  after = undefined,
  reason = '',
}) {
  try {
    await AuditLog.create({
      actorId: actor?.userId || actor?.employerId || actor?.agentAccountId || actor?._id,
      actorEmail: actor?.email || '',
      actorRole: actor?.role || '',
      action,
      targetType,
      targetId: targetId ? String(targetId) : '',
      targetLabel,
      ip,
      status,
      metadata,
      ...(before !== undefined ? { before } : {}),
      ...(after !== undefined ? { after } : {}),
      ...(reason ? { reason } : {}),
    });
  } catch (err) {
    console.error('[audit] failed to write log:', err.message);
  }
}

export function auditFromRequest(req, overrides = {}) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
  return {
    actor: {
      userId: req.user?.userId,
      role: req.user?.role,
      email: req.user?.email,
    },
    ip,
    ...overrides,
  };
}
