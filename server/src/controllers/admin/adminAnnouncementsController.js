import mongoose from 'mongoose';
import { Announcement } from '../../models/Announcement.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listResponse, paginate } from '../../utils/apiResponse.js';
import { logAudit, auditFromRequest } from '../../services/auditService.js';
import {
  applyAnnouncementBody,
  publishAnnouncement,
  validateAnnouncementPayload,
} from '../../services/announcementService.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function buildQuery(q) {
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.type) filter.type = q.type;
  if (q.audience) filter.audiences = q.audience;
  if (q.search?.trim()) {
    const re = new RegExp(q.search.trim(), 'i');
    filter.$or = [{ title: re }, { body: re }];
  }
  return filter;
}

export const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const query = buildQuery(req.query);
  const [data, total] = await Promise.all([
    Announcement.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Announcement.countDocuments(query),
  ]);
  res.json(listResponse(data, paginate(page, limit, total), req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Announcement.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Announcement not found' });
  res.json(doc);
});

export const create = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const details = validateAnnouncementPayload(body);
  if (details) return res.status(400).json({ error: 'Validation failed', details });

  const doc = new Announcement({
    title: body.title.trim(),
    body: body.body.trim(),
    createdBy: req.user?.userId,
    status: 'draft',
  });
  applyAnnouncementBody(doc, body);
  await doc.save();
  await logAudit({
    ...auditFromRequest(req),
    action: 'announcement.create',
    targetType: 'announcement',
    targetId: doc._id,
    targetLabel: doc.title,
  });
  res.status(201).json(doc);
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Announcement.findById(id);
  if (!doc) return res.status(404).json({ error: 'Announcement not found' });

  const details = validateAnnouncementPayload(req.body || {}, { requireContent: false });
  if (details) return res.status(400).json({ error: 'Validation failed', details });

  const before = { status: doc.status, title: doc.title };
  applyAnnouncementBody(doc, req.body || {});
  if (doc.status !== 'published' && doc.status !== 'expired') {
    doc.status = 'draft';
  }
  await doc.save();
  await logAudit({
    ...auditFromRequest(req),
    action: 'announcement.update',
    targetType: 'announcement',
    targetId: id,
    targetLabel: doc.title,
    before,
    after: { status: doc.status, title: doc.title },
  });
  res.json(doc);
});

export const publish = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Announcement.findById(id);
  if (!doc) return res.status(404).json({ error: 'Announcement not found' });
  if (doc.status === 'published') return res.status(400).json({ error: 'Already published' });

  await publishAnnouncement(doc, req.user?.userId);
  await logAudit({
    ...auditFromRequest(req),
    action: 'announcement.publish',
    targetType: 'announcement',
    targetId: id,
    targetLabel: doc.title,
  });
  res.json(doc);
});

export const expire = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Announcement.findById(id);
  if (!doc) return res.status(404).json({ error: 'Announcement not found' });
  doc.status = 'expired';
  doc.expiresAt = doc.expiresAt || new Date();
  await doc.save();
  await logAudit({
    ...auditFromRequest(req),
    action: 'announcement.expire',
    targetType: 'announcement',
    targetId: id,
    targetLabel: doc.title,
  });
  res.json(doc);
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const doc = await Announcement.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ error: 'Announcement not found' });
  await logAudit({
    ...auditFromRequest(req),
    action: 'announcement.delete',
    targetType: 'announcement',
    targetId: id,
    targetLabel: doc.title,
  });
  res.status(204).send();
});
