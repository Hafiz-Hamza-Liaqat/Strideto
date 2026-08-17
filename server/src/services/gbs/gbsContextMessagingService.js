import { GbsServiceRequest } from '../../models/gbs/GbsServiceRequest.js';
import { GbsQuote } from '../../models/gbs/GbsQuote.js';
import { GbsCase } from '../../models/gbs/GbsCase.js';
import { GbsContextThread } from '../../models/gbs/GbsContextThread.js';
import { GbsContextMessage } from '../../models/gbs/GbsContextMessage.js';
import {
  GBS_MESSAGE_ACTOR_TYPES,
  GBS_MESSAGE_CONTEXT_TYPES,
  GBS_MESSAGE_LIMITS,
  parseGbsMessageLimit,
  parseGbsMessagePage,
} from '../../../../shared/gbs/contextMessaging.js';
import { stripAllHtml } from '../../utils/htmlSanitize.js';
import { logAudit } from '../auditService.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../../shared/security/gbsAuditEvents.js';

function deny(code, status = 400) {
  return Object.assign(new Error(code), { code, status });
}

const CONTEXTS = Object.freeze({
  [GBS_MESSAGE_CONTEXT_TYPES.REQUEST]: {
    model: GbsServiceRequest, ref: 'publicRequestRef', title: 'titleSnapshot',
  },
  [GBS_MESSAGE_CONTEXT_TYPES.QUOTE]: {
    model: GbsQuote, ref: 'publicQuoteRef', title: 'titleSnapshot',
  },
  [GBS_MESSAGE_CONTEXT_TYPES.CASE]: {
    model: GbsCase, ref: 'publicCaseRef', title: 'titleSnapshot',
  },
});

function contextConfig(contextType) {
  const config = CONTEXTS[contextType];
  if (!config) throw deny('invalid_message_context');
  return config;
}

async function resolveContext({ contextType, contextRef, actor }) {
  const config = contextConfig(contextType);
  const filter = { [config.ref]: String(contextRef || '').trim() };
  if (actor.type === GBS_MESSAGE_ACTOR_TYPES.BUSINESS_CLIENT) {
    filter.requesterUserId = actor.id;
  } else {
    filter.providerSubjectType = actor.subjectType;
    filter.providerSubjectId = String(actor.subjectId);
  }
  const record = await config.model.findOne(filter).lean();
  if (!record) throw deny('not_found', 404);
  return {
    record,
    seed: {
      contextType,
      contextId: record._id,
      contextPublicRef: record[config.ref],
      requesterUserId: record.requesterUserId,
      providerSubjectType: record.providerSubjectType,
      providerSubjectId: String(record.providerSubjectId),
      titleSnapshot: record[config.title] || record.capabilityPublicNameSnapshot || contextType,
    },
  };
}

function projectMessage(message) {
  return {
    id: String(message._id),
    senderActorType: message.senderActorType,
    text: message.text,
    createdAt: message.createdAt,
  };
}

export async function listGbsContextMessages({ contextType, contextRef, actor, query = {} } = {}) {
  const { seed } = await resolveContext({ contextType, contextRef, actor });
  const thread = await GbsContextThread.findOne({ contextType, contextId: seed.contextId }).lean();
  const page = parseGbsMessagePage(query.page);
  const limit = parseGbsMessageLimit(query.limit);
  if (!thread) return { context: seed, items: [], page, limit, total: 0, totalPages: 0 };
  const [rows, total] = await Promise.all([
    GbsContextMessage.find({ threadId: thread._id }).sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    GbsContextMessage.countDocuments({ threadId: thread._id }),
  ]);
  return {
    context: seed,
    items: rows.reverse().map(projectMessage),
    page,
    limit,
    total,
    totalPages: total ? Math.ceil(total / limit) : 0,
  };
}

export async function createGbsContextMessage({ contextType, contextRef, actor, body, auditActor = {} } = {}) {
  const raw = body?.text;
  if (typeof raw !== 'string') throw deny('message_text_required');
  const text = stripAllHtml(raw).slice(0, GBS_MESSAGE_LIMITS.TEXT_MAX).trim();
  if (!text) throw deny('message_text_required');
  const { seed } = await resolveContext({ contextType, contextRef, actor });
  const now = new Date();
  let thread;
  try {
    thread = await GbsContextThread.findOneAndUpdate(
      { contextType, contextId: seed.contextId },
      { $set: { ...seed, lastMessageAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (Number(error?.code) !== 11000) throw error;
    thread = await GbsContextThread.findOneAndUpdate(
      { contextType, contextId: seed.contextId },
      { $set: { lastMessageAt: now } },
      { new: true }
    );
  }
  if (!thread) throw deny('message_thread_unavailable', 503);
  const message = await GbsContextMessage.create({
    threadId: thread._id,
    senderActorType: actor.type,
    senderActorId: String(actor.id),
    text,
  });
  await logAudit({
    actor: auditActor,
    action: GBS_AUDIT_EVENTS.GBS_CONTEXT_MESSAGE_CREATED,
    targetType: 'GbsContextThread',
    targetId: String(thread._id),
    metadata: redactAuditMetadata({ contextType, contextPublicRef: seed.contextPublicRef }),
  });
  return projectMessage(message);
}

export async function listProviderGbsMessageThreads({ subject, query = {} } = {}) {
  const page = parseGbsMessagePage(query.page);
  const limit = parseGbsMessageLimit(query.limit);
  const filter = { providerSubjectType: subject.subjectType, providerSubjectId: String(subject.subjectId) };
  if (query.contextType) {
    if (!Object.values(GBS_MESSAGE_CONTEXT_TYPES).includes(query.contextType)) throw deny('invalid_message_context');
    filter.contextType = query.contextType;
  }
  const [rows, total] = await Promise.all([
    GbsContextThread.find(filter).sort({ lastMessageAt: -1, _id: -1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    GbsContextThread.countDocuments(filter),
  ]);
  return {
    items: rows.map((row) => ({
      id: String(row._id), contextType: row.contextType, contextPublicRef: row.contextPublicRef,
      title: row.titleSnapshot, lastMessageAt: row.lastMessageAt,
    })),
    page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0,
  };
}
