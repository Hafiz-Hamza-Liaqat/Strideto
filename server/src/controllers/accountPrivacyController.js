import { asyncHandler } from '../utils/asyncHandler.js';
import { auditFromRequest } from '../services/auditService.js';
import * as privacy from '../services/accountPrivacyRequestService.js';
import { ACCOUNT_REQUEST_TYPES } from '../../../shared/platform/accountSecurityContract.js';

function actorMeta(req) {
  return {
    actor: {
      userId: req.user?.userId,
      role: req.user?.role,
      email: req.user?.email,
    },
    ip: auditFromRequest(req).ip,
  };
}

export const getPrivacyOverview = asyncHandler(async (req, res) => {
  const data = await privacy.privacyOverview(req.user.userId);
  res.json(data);
});

export const listMyPrivacyRequests = asyncHandler(async (req, res) => {
  const data = await privacy.listForSubject(req.user.userId);
  res.json({ data });
});

export const createExportRequest = asyncHandler(async (req, res) => {
  try {
    const created = await privacy.createRequest(
      req.user.userId,
      ACCOUNT_REQUEST_TYPES.EXPORT,
      actorMeta(req)
    );
    res.status(201).json(created);
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: err.message, existing: err.existing });
    }
    throw err;
  }
});

export const createDeletionRequest = asyncHandler(async (req, res) => {
  if (req.body?.confirm !== true) {
    return res.status(422).json({
      error: 'Deletion requires explicit confirmation',
      code: 'DELETION_CONFIRMATION_REQUIRED',
    });
  }
  try {
    const created = await privacy.createRequest(
      req.user.userId,
      ACCOUNT_REQUEST_TYPES.DELETION,
      actorMeta(req)
    );
    res.status(201).json(created);
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: err.message, existing: err.existing });
    }
    throw err;
  }
});

export const cancelPrivacyRequest = asyncHandler(async (req, res) => {
  const updated = await privacy.cancelRequest(req.user.userId, req.params.id, actorMeta(req));
  res.json(updated);
});

export const adminListPrivacyRequests = asyncHandler(async (req, res) => {
  const data = await privacy.listForAdmin({
    type: req.query.type,
    status: req.query.status,
    limit: req.query.limit,
  });
  res.json({ data });
});

export const adminUpdatePrivacyRequest = asyncHandler(async (req, res) => {
  const updated = await privacy.staffUpdateStatus(req.params.id, req.body?.status, actorMeta(req));
  res.json(updated);
});
