import { setPrivateResponseHeaders } from '../middleware/privateResponse.js';
import {
  completeCustomerDocumentUpload,
  downloadCustomerCaseDocument,
  initializeCustomerDocumentUpload,
  listCustomerCaseDocumentRequirements,
  supersedeCustomerDocumentUpload,
} from '../services/gbs/gbsCaseDocumentService.js';

function actorFrom(req) {
  return { id: req.user?.userId, userId: req.user?.userId, role: 'user', isStaff: false };
}

function sendError(res, err) {
  const status = err.status || 500;
  const payload = { error: err.code || err.message || 'server_error' };
  if (err.currentVersion != null) payload.currentVersion = err.currentVersion;
  if (err.expectedVersion != null) payload.expectedVersion = err.expectedVersion;
  return res.status(status).json(payload);
}

export async function listCaseDocumentRequirements(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const data = await listCustomerCaseDocumentRequirements({
      userId: req.user.userId,
      caseRef: req.params.caseRef,
    });
    return res.json(data);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function initializeUpload(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const data = await initializeCustomerDocumentUpload({
      userId: req.user.userId,
      caseRef: req.params.caseRef,
      requirementRef: req.params.requirementRef,
      expectedVersion: req.body?.expectedVersion,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    return res.json(data);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function completeUpload(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const data = await completeCustomerDocumentUpload({
      userId: req.user.userId,
      caseRef: req.params.caseRef,
      requirementRef: req.params.requirementRef,
      expectedVersion: req.body?.expectedVersion,
      file: req.gbsDocumentFile,
      body: req.body || {},
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    return res.json(data);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function replaceUpload(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const data = await supersedeCustomerDocumentUpload({
      userId: req.user.userId,
      caseRef: req.params.caseRef,
      requirementRef: req.params.requirementRef,
      expectedVersion: req.body?.expectedVersion,
      file: req.gbsDocumentFile,
      body: req.body || {},
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    return res.json(data);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function downloadDocument(req, res) {
  try {
    setPrivateResponseHeaders(res);
    return await downloadCustomerCaseDocument({
      userId: req.user.userId,
      caseRef: req.params.caseRef,
      requirementRef: req.params.requirementRef,
      res,
      actor: actorFrom(req),
    });
  } catch (err) {
    return sendError(res, err);
  }
}
