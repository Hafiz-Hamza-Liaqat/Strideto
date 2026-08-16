/**
 * Fail-closed HSI audit. Mandatory inserts throw; they never fail-soft.
 * Do not log bytes, DEK/KEK, tokens, filenames, or object secrets.
 */
import { AuditLog } from '../../models/AuditLog.js';
import { redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';
import { HSI_SECURITY_CODES } from '../../../../shared/gbs/hsiSecurity.js';

export async function logRequiredHsiAudit({
  actor = {},
  action,
  targetType = '',
  targetId = '',
  status = 'success',
  metadata = {},
} = {}) {
  try {
    await AuditLog.create({
      actorId: actor?.userId || actor?.employerId || actor?.agentAccountId || actor?._id,
      actorEmail: actor?.email || '',
      actorRole: actor?.role || '',
      action,
      targetType,
      targetId: targetId ? String(targetId) : '',
      status,
      metadata: redactAuditMetadata(metadata),
    });
  } catch (err) {
    const wrapped = Object.assign(new Error(HSI_SECURITY_CODES.AUDIT_UNAVAILABLE), {
      status: 503,
      code: HSI_SECURITY_CODES.AUDIT_UNAVAILABLE,
      causeCode: err?.code,
    });
    throw wrapped;
  }
}

export async function probeAuditReady() {
  try {
    if (!AuditLog?.db?.readyState || AuditLog.db.readyState !== 1) return false;
    await AuditLog.findOne().select('_id').lean();
    return true;
  } catch {
    return false;
  }
}
