import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import { assertAuthorizedProviderSubject } from '../services/gbs/providerSubjectContext.js';
import { assertProviderDomainAccess } from '../services/gbs/providerDomainService.js';
import { PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { setPrivateResponseHeaders } from '../middleware/privateResponse.js';
import {
  completeGenericService,
  ensureProviderCaseForQuote,
  getProviderCase,
  listProviderCases,
  markReadyForSubmission,
  markUnableToProceed,
  requestCustomerAction,
  startPreparation,
} from '../services/gbs/gbsCaseService.js';

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

export async function listCases(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW);
    const data = await listProviderCases({ subject, query: req.query });
    return res.json(data);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getCase(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW);
    const item = await getProviderCase({
      subject,
      caseRef: req.params.caseRef,
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function ensureCase(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE);
    const item = await ensureProviderCaseForQuote({
      subject,
      quoteRef: req.params.quoteRef,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function startPrep(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE);
    const item = await startPreparation({
      subject,
      caseRef: req.params.caseRef,
      expectedVersion: req.body?.expectedVersion,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function requestAction(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE);
    const item = await requestCustomerAction({
      subject,
      caseRef: req.params.caseRef,
      expectedVersion: req.body?.expectedVersion,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function readyForSubmission(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE);
    const item = await markReadyForSubmission({
      subject,
      caseRef: req.params.caseRef,
      expectedVersion: req.body?.expectedVersion,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function unableToProceed(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE);
    const item = await markUnableToProceed({
      subject,
      caseRef: req.params.caseRef,
      expectedVersion: req.body?.expectedVersion,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function completeService(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE);
    const item = await completeGenericService({
      subject,
      caseRef: req.params.caseRef,
      expectedVersion: req.body?.expectedVersion,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function updateRequirementFact(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE);
    const { updateProviderRequirementFact } = await import('../services/gbs/gbsRequirementPackService.js');
    await updateProviderRequirementFact({
      subject,
      caseRef: req.params.caseRef,
      expectedVersion: req.body?.expectedVersion,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    const item = await getProviderCase({ subject, caseRef: req.params.caseRef });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function updateRequirementCheck(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE);
    const { updateProviderRequirementCheck } = await import('../services/gbs/gbsRequirementPackService.js');
    await updateProviderRequirementCheck({
      subject,
      caseRef: req.params.caseRef,
      expectedVersion: req.body?.expectedVersion,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    const item = await getProviderCase({ subject, caseRef: req.params.caseRef });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function attestRaConsent(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE);
    const { attestProviderRaConsent } = await import('../services/gbs/gbsRequirementPackService.js');
    await attestProviderRaConsent({
      subject,
      caseRef: req.params.caseRef,
      expectedVersion: req.body?.expectedVersion,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    const item = await getProviderCase({ subject, caseRef: req.params.caseRef });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getFilingAuthorization(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW);
    const { getProviderFilingAuthorization } = await import('../services/gbs/gbsFilingAuthorizationService.js');
    const item = await getProviderFilingAuthorization({
      subject,
      caseRef: req.params.caseRef,
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function attestExternalFiling(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const subject = await requireSubject(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE);
    const { attestProviderExternalFiling } = await import('../services/gbs/gbsExternalFilingService.js');
    const item = await attestProviderExternalFiling({
      subject,
      caseRef: req.params.caseRef,
      expectedVersion: req.body?.expectedVersion,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}
