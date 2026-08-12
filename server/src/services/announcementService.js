import { Announcement, ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_STATUSES } from '../models/Announcement.js';
import { AnnouncementUserState } from '../models/AnnouncementUserState.js';
import { queueNotification } from './automationService.js';
import { sanitizeString } from '../utils/sanitize.js';

const STAFF_ROLES = new Set(['Admin', 'SuperAdmin', 'Editor', 'Moderator']);

export function resolveAudienceFromRequest(req) {
  if (req.employer?.employerId || req.employer?._id) return 'employer';
  if (req.agentProfile?.agentProfileId || req.agentProfile?._id) return 'agent';
  if (req.institutionMembership?.organizationId) return 'institution';
  if (req.user?.role && STAFF_ROLES.has(req.user.role)) return 'staff';
  if (req.user?.userId || req.user?._id) return 'student';
  return null;
}

export function resolveUserKeyFromRequest(req) {
  if (req.employer?.employerId) return `employer:${req.employer.employerId}`;
  if (req.employer?._id) return `employer:${req.employer._id}`;
  if (req.agentProfile?.agentProfileId) return `agent:${req.agentProfile.agentProfileId}`;
  if (req.agentProfile?._id) return `agent:${req.agentProfile._id}`;
  if (req.institutionMembership?.organizationId) return `institution:${req.institutionMembership.organizationId}`;
  if (req.user?.userId) return `user:${req.user.userId}`;
  if (req.user?._id) return `user:${req.user._id}`;
  return null;
}

export function audienceMatches(audiences = [], targetAudience) {
  if (!targetAudience) return false;
  if (audiences.includes('all')) return true;
  return audiences.includes(targetAudience);
}

function publishedFeedFilter(audience, now = new Date()) {
  return {
    status: 'published',
    audiences: { $in: [audience, 'all'] },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
    publishedAt: { $lte: now },
  };
}

export async function listPublishedForAudience(audience, { limit = 20, now = new Date() } = {}) {
  return Announcement.find(publishedFeedFilter(audience, now))
    .sort({ priority: -1, publishedAt: -1 })
    .limit(limit)
    .lean();
}

export async function listFeedForUser(req, { limit = 20 } = {}) {
  const audience = resolveAudienceFromRequest(req);
  const userKey = resolveUserKeyFromRequest(req);
  if (!audience || !userKey) {
    return { audience: null, items: [] };
  }

  const announcements = await listPublishedForAudience(audience, { limit });
  if (!announcements.length) {
    return { audience, items: [] };
  }

  const ids = announcements.map((a) => a._id);
  const states = await AnnouncementUserState.find({
    announcementId: { $in: ids },
    userKey,
  }).lean();
  const stateById = new Map(states.map((s) => [String(s.announcementId), s]));

  const items = announcements.map((a) => {
    const state = stateById.get(String(a._id));
    return {
      id: a._id,
      title: a.title,
      body: a.body,
      type: a.type,
      priority: a.priority,
      link: a.link || null,
      publishedAt: a.publishedAt,
      expiresAt: a.expiresAt || null,
      surveyOptions: a.type === 'survey' ? (a.surveyOptions || []) : [],
      read: Boolean(state?.readAt),
      acknowledged: Boolean(state?.acknowledgedAt),
      surveyVote: state?.surveyVote || null,
    };
  });

  return { audience, items };
}

async function upsertState(announcementId, userKey, realm, patch) {
  return AnnouncementUserState.findOneAndUpdate(
    { announcementId, userKey },
    {
      $set: { realm, ...patch },
      $setOnInsert: { announcementId, userKey },
    },
    { upsert: true, new: true }
  ).lean();
}

export async function markRead(req, announcementId) {
  const userKey = resolveUserKeyFromRequest(req);
  const realm = resolveAudienceFromRequest(req);
  if (!userKey) return null;
  return upsertState(announcementId, userKey, realm, { readAt: new Date() });
}

export async function acknowledge(req, announcementId) {
  const userKey = resolveUserKeyFromRequest(req);
  const realm = resolveAudienceFromRequest(req);
  if (!userKey) return null;
  const now = new Date();
  return upsertState(announcementId, userKey, realm, { readAt: now, acknowledgedAt: now });
}

export async function castSurveyVote(req, announcementId, vote) {
  const userKey = resolveUserKeyFromRequest(req);
  const realm = resolveAudienceFromRequest(req);
  if (!userKey) return null;

  const doc = await Announcement.findById(announcementId).lean();
  if (!doc || doc.type !== 'survey') {
    const err = new Error('Survey announcement not found');
    err.status = 404;
    throw err;
  }
  const allowed = (doc.surveyOptions || []).map((o) => o.value);
  if (!allowed.includes(vote)) {
    const err = new Error('Invalid survey option');
    err.status = 400;
    throw err;
  }

  const existing = await AnnouncementUserState.findOne({ announcementId, userKey }).lean();
  if (existing?.surveyVote) {
    const err = new Error('Survey vote already recorded');
    err.status = 409;
    throw err;
  }

  const now = new Date();
  return upsertState(announcementId, userKey, realm, {
    readAt: now,
    acknowledgedAt: now,
    surveyVote: vote,
  });
}

export function applyAnnouncementBody(doc, body = {}) {
  if (body.title !== undefined) doc.title = sanitizeString(body.title);
  if (body.body !== undefined) doc.body = sanitizeString(body.body);
  if (body.type !== undefined) doc.type = body.type;
  if (body.audiences !== undefined) {
    const cleaned = Array.isArray(body.audiences)
      ? body.audiences.filter((a) => ANNOUNCEMENT_AUDIENCES.includes(a))
      : [];
    doc.audiences = cleaned.length ? cleaned : ['all'];
  }
  if (body.status !== undefined && ANNOUNCEMENT_STATUSES.includes(body.status)) doc.status = body.status;
  if (body.priority !== undefined) doc.priority = body.priority === 'high' ? 'high' : 'normal';
  if (body.link !== undefined) doc.link = body.link ? sanitizeString(body.link) : undefined;
  // Scheduling not available while background worker is stopped — ignore scheduledAt.
  if (body.expiresAt !== undefined) doc.expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
  if (body.surveyOptions !== undefined) {
    doc.surveyOptions = Array.isArray(body.surveyOptions)
      ? body.surveyOptions
          .filter((o) => o?.label && o?.value)
          .slice(0, 12)
          .map((o) => ({ label: sanitizeString(o.label), value: sanitizeString(o.value) }))
      : undefined;
  }
}

export async function publishAnnouncement(doc, publisherUserId) {
  const now = new Date();
  doc.status = 'published';
  doc.publishedAt = now;
  doc.publishedBy = publisherUserId;
  if (doc.scheduledAt && doc.scheduledAt > now) {
    doc.scheduledAt = now;
  }
  await doc.save();

  if (doc.priority === 'high') {
    await queueHighPriorityInAppPing(doc);
  }

  return doc;
}

async function queueHighPriorityInAppPing(doc) {
  const audiences = doc.audiences?.includes('all')
    ? ANNOUNCEMENT_AUDIENCES.filter((a) => a !== 'all')
    : doc.audiences;

  for (const audience of audiences) {
    await queueNotification({
      dedupKey: `announcement:${doc._id}:${audience}`,
      recipientType: audience === 'staff' ? 'staff' : audience,
      category: 'system',
      type: 'announcement.high_priority',
      title: doc.title,
      body: doc.body,
      link: doc.link || '/announcements',
      metadata: { announcementId: String(doc._id), audience },
    });
  }
}

export function validateAnnouncementPayload(body, { requireContent = true } = {}) {
  const details = {};
  if (requireContent && !body.title?.trim()) details.title = 'Title is required';
  if (requireContent && !body.body?.trim()) details.body = 'Body is required';
  if (body.type && !['info', 'policy', 'maintenance', 'action_required', 'survey'].includes(body.type)) {
    details.type = 'Invalid announcement type';
  }
  if (body.type === 'survey' && body.surveyOptions !== undefined) {
    if (!Array.isArray(body.surveyOptions) || body.surveyOptions.length < 2) {
      details.surveyOptions = 'Survey requires at least two options';
    }
  }
  return Object.keys(details).length ? details : null;
}
