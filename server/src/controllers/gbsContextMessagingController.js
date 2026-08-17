import { setPrivateResponseHeaders } from '../middleware/privateResponse.js';
import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import { PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { GBS_MESSAGE_ACTOR_TYPES, GBS_MESSAGE_CONTEXT_TYPES } from '../../../shared/gbs/contextMessaging.js';
import { assertAuthorizedProviderSubject } from '../services/gbs/providerSubjectContext.js';
import { assertProviderDomainAccess } from '../services/gbs/providerDomainService.js';
import {
  createGbsContextMessage,
  listGbsContextMessages,
  listProviderGbsMessageThreads,
} from '../services/gbs/gbsContextMessagingService.js';

function sendError(res, err) {
  return res.status(err.status || 500).json({ error: err.code || err.message || 'server_error' });
}

function providerAuditActor(req) {
  return { id: req.agent?.agentAccountId, agentAccountId: req.agent?.agentAccountId, role: 'agent', isStaff: false };
}

async function providerActor(req, permissionId) {
  const subjectType = req.query.subjectType || req.body?.subjectType;
  const subjectId = req.query.subjectId || req.body?.subjectId;
  const subject = await assertAuthorizedProviderSubject({
    agentAccountId: req.agent.agentAccountId, subjectType, subjectId, actor: providerAuditActor(req),
  });
  await assertProviderDomainAccess({
    agentAccountId: req.agent.agentAccountId,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
    permissionId,
    actor: providerAuditActor(req),
  });
  return {
    type: GBS_MESSAGE_ACTOR_TYPES.PROVIDER,
    id: req.agent.agentAccountId,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
  };
}

function buyerActor(req) {
  return { type: GBS_MESSAGE_ACTOR_TYPES.BUSINESS_CLIENT, id: req.user.userId };
}

const providerPermission = Object.freeze({
  request: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_REQUESTS_MANAGE,
  quote: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE,
  case: PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE,
});

export function buyerList(contextType) {
  return async (req, res) => {
    try {
      setPrivateResponseHeaders(res);
      return res.json(await listGbsContextMessages({
        contextType, contextRef: req.params.contextRef, actor: buyerActor(req), query: req.query,
      }));
    } catch (err) { return sendError(res, err); }
  };
}

export function buyerSend(contextType) {
  return async (req, res) => {
    try {
      setPrivateResponseHeaders(res);
      const item = await createGbsContextMessage({
        contextType, contextRef: req.params.contextRef, actor: buyerActor(req), body: req.body,
        auditActor: { id: req.user.userId, userId: req.user.userId, role: req.user.role, isStaff: false },
      });
      return res.status(201).json({ item });
    } catch (err) { return sendError(res, err); }
  };
}

export function providerList(contextType) {
  return async (req, res) => {
    try {
      const actor = await providerActor(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW);
      return res.json(await listGbsContextMessages({
        contextType, contextRef: req.params.contextRef, actor, query: req.query,
      }));
    } catch (err) { return sendError(res, err); }
  };
}

export function providerSend(contextType) {
  return async (req, res) => {
    try {
      const actor = await providerActor(req, providerPermission[contextType]);
      const item = await createGbsContextMessage({
        contextType, contextRef: req.params.contextRef, actor, body: req.body, auditActor: providerAuditActor(req),
      });
      return res.status(201).json({ item });
    } catch (err) { return sendError(res, err); }
  };
}

export async function providerThreads(req, res) {
  try {
    const actor = await providerActor(req, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW);
    return res.json(await listProviderGbsMessageThreads({
      subject: { subjectType: actor.subjectType, subjectId: actor.subjectId }, query: req.query,
    }));
  } catch (err) { return sendError(res, err); }
}

export const TYPES = GBS_MESSAGE_CONTEXT_TYPES;
