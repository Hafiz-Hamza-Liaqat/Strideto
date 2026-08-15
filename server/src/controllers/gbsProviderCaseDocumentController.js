import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import { assertAuthorizedProviderSubject } from '../services/gbs/providerSubjectContext.js';
import { assertProviderDomainAccess } from '../services/gbs/providerDomainService.js';
import { PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { setPrivateResponseHeaders } from '../middleware/privateResponse.js';
import {
  assertProviderCaseDocumentDuty,
  downloadProviderCaseDocument,
  listProviderCaseDocumentRequirements,
  rejectProviderDocument,
  reviewProviderDocument,
  waiveProviderDocument,
} from '../services/gbs/gbsCaseDocumentService.js';

function actorFrom(req) {
  return {
    id: req.agent?.agentAccountId,
    agentAccountId: req.agent?.agentAccountId,
    role: 'agent',
    isStaff: false,
    subjectType: 'agent',
    subjectId: req.agent?.agentAccountId,
  };
}

function sendError(res, err) {
  const status = err.status || 500;
  const payload = { error: err.code || err.message || 'server_error' };
  if (err.currentVersion != null) payload.currentVersion = err.currentVersion;
  if (err.expectedVersion != null) payload.expectedVersion = err.expectedVersion;
  return res.status(status).json(payload);
}

async function requireView(req) {
  const subjectType = req.query.subjectType || req.body?.subjectType;
  const subjectId = req.query.subjectId || req.body?.subjectId;
  const subject = await assertAuthorizedProviderSubject({
    agentAccountId: req.agent.agentAccountId,
    subjectType,
    subjectId,
    actor: actorFrom(req),
  });
  await assertProviderDomainAccess({
    agentAccountId: req.agent.agentAccountId,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    permissionId: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW,
    actor: actorFrom(req),
  });
  return subject;
}

async function requireDocumentDuty(req) {
  const subject = await requireView(req);
  await assertProviderCaseDocumentDuty({
    agentAccountId: req.agent.agentAccountId,
    subject,
    actor: actorFrom(req),
  });
  return subject;
}

export async function listCaseDocumentRequirements(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireView(req);
    let canManageDocuments = false;
    try {
      await assertProviderCaseDocumentDuty({
        agentAccountId: req.agent.agentAccountId,
        subject,
        actor: actorFrom(req),
      });
      canManageDocuments = true;
    } catch {
      canManageDocuments = false;
    }
    const data = await listProviderCaseDocumentRequirements({
      subject,
      caseRef: req.params.caseRef,
      canManageDocuments,
    });
    return res.json(data);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function reviewDocument(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireDocumentDuty(req);
    const data = await reviewProviderDocument({
      subject,
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

export async function rejectDocument(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireDocumentDuty(req);
    const data = await rejectProviderDocument({
      subject,
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

export async function waiveDocument(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireDocumentDuty(req);
    const data = await waiveProviderDocument({
      subject,
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

export async function downloadDocument(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireDocumentDuty(req);
    return await downloadProviderCaseDocument({
      subject,
      caseRef: req.params.caseRef,
      requirementRef: req.params.requirementRef,
      res,
      actor: actorFrom(req),
    });
  } catch (err) {
    return sendError(res, err);
  }
}
