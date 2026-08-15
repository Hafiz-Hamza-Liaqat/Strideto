import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import { assertAuthorizedProviderSubject } from '../services/gbs/providerSubjectContext.js';
import { assertProviderDomainAccess } from '../services/gbs/providerDomainService.js';
import { PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import {
  declineProviderServiceRequest,
  getProviderServiceRequest,
  listProviderServiceRequests,
  readyForQuoteProviderServiceRequest,
  reviewProviderServiceRequest,
} from '../services/gbs/gbsServiceRequestService.js';

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

async function requireSubject(req, permissionId = PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW) {
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
    permissionId,
    actor: actorFrom(req),
  });
  return subject;
}

export async function listRequests(req, res) {
  try {
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW);
    const data = await listProviderServiceRequests({ subject, query: req.query });
    return res.json(data);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getRequest(req, res) {
  try {
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW);
    const item = await getProviderServiceRequest({
      subject,
      requestRef: req.params.requestRef,
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function reviewRequest(req, res) {
  try {
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_REQUESTS_MANAGE);
    const item = await reviewProviderServiceRequest({
      subject,
      requestRef: req.params.requestRef,
      expectedVersion: req.body?.expectedVersion,
      actor: actorFrom(req),
      body: req.body,
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function declineRequest(req, res) {
  try {
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_REQUESTS_MANAGE);
    const item = await declineProviderServiceRequest({
      subject,
      requestRef: req.params.requestRef,
      expectedVersion: req.body?.expectedVersion,
      actor: actorFrom(req),
      body: req.body,
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function readyForQuote(req, res) {
  try {
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_REQUESTS_MANAGE);
    const item = await readyForQuoteProviderServiceRequest({
      subject,
      requestRef: req.params.requestRef,
      expectedVersion: req.body?.expectedVersion,
      actor: actorFrom(req),
      body: req.body,
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}
