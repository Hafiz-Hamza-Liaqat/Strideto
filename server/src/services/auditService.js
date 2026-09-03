import { AuditLog } from '../models/AuditLog.js';

export async function logAudit({
  auditId = undefined,
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
  throwOnError = false,
}) {
  try {
    await AuditLog.create({
      ...(auditId !== undefined ? { _id: auditId } : {}),
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
    if (throwOnError) {
      throw Object.assign(new Error('Audit persistence failed'), {
        code: 'AUDIT_PERSIST_FAILED',
      });
    }
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
