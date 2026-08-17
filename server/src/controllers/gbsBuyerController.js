import { setPrivateResponseHeaders } from '../middleware/privateResponse.js';
import {
  activateBusinessClient,
  getBusinessClientEnabled,
} from '../services/gbs/gbsBuyerActivationService.js';
import {
  cancelCustomerServiceRequest,
  createCustomerServiceRequest,
  getCustomerOverview,
  getCustomerServiceRequest,
  getPrivateBetaServiceEntry,
  listCustomerServiceRequests,
} from '../services/gbs/gbsServiceRequestService.js';
import {
  acceptCustomerQuote,
  declineCustomerQuote,
  getCustomerQuote,
  listCustomerQuotes,
} from '../services/gbs/gbsQuoteService.js';
import {
  cancelCustomerCase,
  completeCustomerTask,
  countCustomerCases,
  ensureCustomerCaseForQuote,
  getCustomerCase,
  listCustomerCases,
} from '../services/gbs/gbsCaseService.js';

function actorFrom(req) {
  return {
    id: req.user?.userId,
    userId: req.user?.userId,
    role: req.user?.role,
    isStaff: false,
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

export async function getEnabled(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const data = await getBusinessClientEnabled(req.user.userId);
    return res.json(data);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function activate(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const data = await activateBusinessClient({
      userId: req.user.userId,
      actor: actorFrom(req),
      body: req.body,
    });
    return res.status(200).json(data);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function overview(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const [data, caseCounts, pendingQuotes, customerCases] = await Promise.all([
      getCustomerOverview({ userId: req.user.userId }),
      countCustomerCases({ userId: req.user.userId }),
      listCustomerQuotes({ userId: req.user.userId, query: { page: 1, limit: 5, status: 'sent' } }),
      listCustomerCases({ userId: req.user.userId, query: { page: 1, limit: 5, status: 'awaiting_client' } }),
    ]);
    return res.json({
      ...data,
      caseCounts,
      attention: {
        limit: 5,
        pendingQuotes: pendingQuotes.items || [],
        customerCases: customerCases.items || [],
        documentExchange: 'unavailable_private_beta',
        filingAuthorization: 'unavailable',
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function createRequest(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const item = await createCustomerServiceRequest({
      userId: req.user.userId,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    return res.status(201).json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getPrivateBetaService(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const item = await getPrivateBetaServiceEntry({
      userId: req.user.userId,
      listingSlug: req.params.listingSlug,
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function createPrivateBetaRequest(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const item = await createCustomerServiceRequest({
      userId: req.user.userId,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
      intakeChannel: 'private_beta',
    });
    return res.status(201).json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function listRequests(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const data = await listCustomerServiceRequests({
      userId: req.user.userId,
      query: req.query,
    });
    return res.json(data);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getRequest(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const item = await getCustomerServiceRequest({
      userId: req.user.userId,
      requestRef: req.params.requestRef,
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function cancelRequest(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const item = await cancelCustomerServiceRequest({
      userId: req.user.userId,
      requestRef: req.params.requestRef,
      expectedVersion: req.body?.expectedVersion,
      actor: actorFrom(req),
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function listQuotes(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const data = await listCustomerQuotes({
      userId: req.user.userId,
      query: req.query,
    });
    return res.json(data);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getQuote(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const item = await getCustomerQuote({
      userId: req.user.userId,
      quoteRef: req.params.quoteRef,
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function acceptQuote(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const item = await acceptCustomerQuote({
      userId: req.user.userId,
      quoteRef: req.params.quoteRef,
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

export async function declineQuote(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const item = await declineCustomerQuote({
      userId: req.user.userId,
      quoteRef: req.params.quoteRef,
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

export async function listCases(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const data = await listCustomerCases({
      userId: req.user.userId,
      query: req.query,
    });
    return res.json(data);
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getCase(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const item = await getCustomerCase({
      userId: req.user.userId,
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
    const item = await ensureCustomerCaseForQuote({
      userId: req.user.userId,
      quoteRef: req.params.quoteRef,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    return res.status(200).json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function completeCaseTask(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const item = await completeCustomerTask({
      userId: req.user.userId,
      caseRef: req.params.caseRef,
      taskRef: req.params.taskRef,
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

export async function cancelCase(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const item = await cancelCustomerCase({
      userId: req.user.userId,
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
    const { updateCustomerRequirementFact } = await import('../services/gbs/gbsRequirementPackService.js');
    await updateCustomerRequirementFact({
      userId: req.user.userId,
      caseRef: req.params.caseRef,
      expectedVersion: req.body?.expectedVersion,
      body: req.body,
      headerCommandId: req.get('Idempotency-Key'),
      actor: actorFrom(req),
    });
    const item = await getCustomerCase({
      userId: req.user.userId,
      caseRef: req.params.caseRef,
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function getFilingAuthorization(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const { getCustomerFilingAuthorization } = await import('../services/gbs/gbsFilingAuthorizationService.js');
    const item = await getCustomerFilingAuthorization({
      userId: req.user.userId,
      caseRef: req.params.caseRef,
    });
    return res.json({ item });
  } catch (err) {
    return sendError(res, err);
  }
}

export async function grantFilingAuthorization(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const { grantCustomerFilingAuthorization } = await import('../services/gbs/gbsFilingAuthorizationService.js');
    const item = await grantCustomerFilingAuthorization({
      userId: req.user.userId,
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

export async function revokeFilingAuthorization(req, res) {
  try {
    setPrivateResponseHeaders(res);
    const { revokeCustomerFilingAuthorization } = await import('../services/gbs/gbsFilingAuthorizationService.js');
    const item = await revokeCustomerFilingAuthorization({
      userId: req.user.userId,
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
