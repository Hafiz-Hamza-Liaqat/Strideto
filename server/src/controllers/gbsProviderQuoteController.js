import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import { assertAuthorizedProviderSubject } from '../services/gbs/providerSubjectContext.js';
import { assertProviderDomainAccess } from '../services/gbs/providerDomainService.js';
import { PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { setPrivateResponseHeaders } from '../middleware/privateResponse.js';
import {
  createProviderQuote,
  getProviderQuote,
  listProviderQuotes,
  sendProviderQuote,
  updateProviderQuoteDraft,
  withdrawProviderQuote,
} from '../services/gbs/gbsQuoteService.js';

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
  if (err.errors) payload.details = err.errors;
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

export async function listQuotes(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW);
    const data = await listProviderQuotes({ subject, query: req.query });
    return res.json(data);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getQuote(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW);
    const item = await getProviderQuote({
      subject,
      quoteRef: req.params.quoteRef,
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function createQuote(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE);
    const item = await createProviderQuote({
      subject,
      requestRef: req.params.requestRef,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    return res.status(201).json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function patchQuote(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE);
    const item = await updateProviderQuoteDraft({
      subject,
      quoteRef: req.params.quoteRef,
      body: req.body,
      expectedVersion: req.body?.expectedVersion,
      actor: actorFrom(req),
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function sendQuote(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE);
    const item = await sendProviderQuote({
      subject,
      quoteRef: req.params.quoteRef,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      expectedVersion: req.body?.expectedVersion,
      actor: actorFrom(req),
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function withdrawQuote(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE);
    const item = await withdrawProviderQuote({
      subject,
      quoteRef: req.params.quoteRef,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      expectedVersion: req.body?.expectedVersion,
      actor: actorFrom(req),
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}
