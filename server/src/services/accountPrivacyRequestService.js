import { AccountPrivacyRequest } from '../models/AccountPrivacyRequest.js';
import { DocumentAccessGrant } from '../models/vault/DocumentAccessGrant.js';
import { User } from '../models/User.js';
import { logAudit } from './auditService.js';
import {
  ACCOUNT_REQUEST_TYPES,
  ACCOUNT_REQUEST_STATUSES,
  validateAccountPrivacyRequest,
} from '../../../shared/platform/accountSecurityContract.js';
import { validateNotificationPreferences } from '../../../shared/international/notificationPreferences.js';
import { CONSENT_PURPOSES } from '../../../shared/platform/consentContract.js';

const OPEN_STATUSES = [
  ACCOUNT_REQUEST_STATUSES.REQUESTED,
  ACCOUNT_REQUEST_STATUSES.IN_PROGRESS,
];

function fail(message, status = 400, code) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  throw err;
}

function toClient(doc) {
  const plain = doc?.toObject ? doc.toObject() : { ...doc };
  return {
    id: String(plain._id),
    type: plain.type,
    status: plain.status,
    requestedAt: plain.requestedAt,
    completedAt: plain.completedAt,
    cancelledAt: plain.cancelledAt,
    artifactAvailable: Boolean(plain.artifactAvailable),
  };
}

function toAdmin(doc, subject) {
  const base = toClient(doc);
  return {
    ...base,
    subjectId: String(doc.subjectId),
    subjectEmail: subject?.email || '',
    subjectName: subject?.name || '',
  };
}

export async function listForSubject(subjectId) {
  const rows = await AccountPrivacyRequest.find({ subjectId }).sort({ createdAt: -1 }).lean();
  return rows.map(toClient);
}

export async function createRequest(subjectId, type, { actor, ip } = {}) {
  const validated = validateAccountPrivacyRequest({
    subjectId: String(subjectId),
    type,
    status: ACCOUNT_REQUEST_STATUSES.REQUESTED,
    auditIdentity: actor?.userId ? `user:${actor.userId}` : `user:${subjectId}`,
  });
  if (!validated.ok) fail(validated.errors.join('; '), 422);

  const existing = await AccountPrivacyRequest.findOne({
    subjectId,
    type,
    status: { $in: OPEN_STATUSES },
  });
  if (existing) {
    const err = new Error('An open request of this type already exists');
    err.status = 409;
    err.code = 'PRIVACY_REQUEST_EXISTS';
    err.existing = toClient(existing);
    throw err;
  }

  const created = await AccountPrivacyRequest.create({
    subjectId,
    type: validated.value.type,
    status: ACCOUNT_REQUEST_STATUSES.REQUESTED,
    requestedAt: new Date(),
    auditIdentity: validated.value.auditIdentity,
  });

  await logAudit({
    actor: actor || {},
    ip: ip || '',
    action: `privacy.request.${type}`,
    targetType: 'AccountPrivacyRequest',
    targetId: String(created._id),
    metadata: { type, status: created.status },
  });

  return toClient(created);
}

export async function cancelRequest(subjectId, requestId, { actor, ip } = {}) {
  const row = await AccountPrivacyRequest.findOne({ _id: requestId, subjectId });
  if (!row) fail('Request not found', 404);
  if (row.type !== ACCOUNT_REQUEST_TYPES.DELETION) {
    fail('Only deletion requests can be cancelled by the account holder', 409);
  }
  if (row.status !== ACCOUNT_REQUEST_STATUSES.REQUESTED) {
    fail('This request can no longer be cancelled', 409);
  }
  row.status = ACCOUNT_REQUEST_STATUSES.CANCELLED;
  row.cancelledAt = new Date();
  await row.save();

  await logAudit({
    actor: actor || {},
    ip: ip || '',
    action: 'privacy.request.cancelled',
    targetType: 'AccountPrivacyRequest',
    targetId: String(row._id),
    metadata: { type: row.type },
  });

  return toClient(row);
}

export async function listForAdmin({ type, status, limit = 50 } = {}) {
  const filter = {};
  if (type && Object.values(ACCOUNT_REQUEST_TYPES).includes(type)) filter.type = type;
  if (status && Object.values(ACCOUNT_REQUEST_STATUSES).includes(status)) filter.status = status;
  const rows = await AccountPrivacyRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit) || 50)))
    .lean();
  const subjectIds = [...new Set(rows.map((r) => String(r.subjectId)))];
  const users = await User.find({ _id: { $in: subjectIds } })
    .select('email name')
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return rows.map((row) => toAdmin(row, byId.get(String(row.subjectId))));
}

export async function staffUpdateStatus(requestId, nextStatus, { actor, ip } = {}) {
  const allowed = [
    ACCOUNT_REQUEST_STATUSES.IN_PROGRESS,
    ACCOUNT_REQUEST_STATUSES.COMPLETED,
    ACCOUNT_REQUEST_STATUSES.REJECTED,
  ];
  if (!allowed.includes(nextStatus)) fail('Invalid staff status transition', 422);

  const row = await AccountPrivacyRequest.findById(requestId);
  if (!row) fail('Request not found', 404);
  if (row.status === ACCOUNT_REQUEST_STATUSES.CANCELLED) {
    fail('Cancelled requests cannot be advanced', 409);
  }

  row.status = nextStatus;
  if (nextStatus === ACCOUNT_REQUEST_STATUSES.COMPLETED) {
    row.completedAt = new Date();
    // Never fabricate a downloadable archive.
    row.artifactAvailable = false;
  }
  await row.save();

  await logAudit({
    actor: actor || {},
    ip: ip || '',
    action: 'privacy.request.staff_status',
    targetType: 'AccountPrivacyRequest',
    targetId: String(row._id),
    metadata: { type: row.type, status: nextStatus },
  });

  return toClient(row);
}

export async function privacyOverview(subjectId) {
  const [requests, grants, user] = await Promise.all([
    listForSubject(subjectId),
    DocumentAccessGrant.find({ ownerUserId: subjectId, status: 'active' })
      .select('documentId granteeType granteeId purpose expiresAt permissions status createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    User.findById(subjectId).select('notificationPreferences').lean(),
  ]);

  const consents = grants.map((g) => ({
    id: String(g._id),
    purpose: CONSENT_PURPOSES.VAULT_GRANT,
    documentId: String(g.documentId),
    counterpartyType: g.granteeType,
    counterpartyId: g.granteeId,
    grantedAt: g.createdAt,
    expiresAt: g.expiresAt || null,
    permissions: g.permissions || [],
    resourceScope: `vault_document:${g.documentId}`,
  }));

  return {
    requests,
    consents,
    consentScopes: Object.values(CONSENT_PURPOSES),
    notificationPreferences: user?.notificationPreferences || {},
    channelsConfigured: {
      in_app: true,
      email: false,
      sms: false,
      push: false,
      whatsapp: false,
    },
  };
}

export function normalizePreferenceWrite(input) {
  const result = validateNotificationPreferences(input || {});
  if (!result.ok) {
    const err = new Error(result.errors.join('; '));
    err.status = 422;
    throw err;
  }
  return result;
}
