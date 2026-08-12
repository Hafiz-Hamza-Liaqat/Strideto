import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Announcement } from '../models/Announcement.js';
import {
  acknowledge,
  audienceMatches,
  castSurveyVote,
  listFeedForUser,
  markRead,
  resolveAudienceFromRequest,
  resolveUserKeyFromRequest,
} from '../services/announcementService.js';

export const getFeed = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const feed = await listFeedForUser(req, { limit });
  res.json(feed);
});

export const getOne = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

  const audience = resolveAudienceFromRequest(req);
  const userKey = resolveUserKeyFromRequest(req);
  if (!audience || !userKey) return res.status(401).json({ error: 'Authentication required' });

  const doc = await Announcement.findById(id).lean();
  if (!doc || doc.status !== 'published') return res.status(404).json({ error: 'Announcement not found' });
  if (doc.expiresAt && new Date(doc.expiresAt) <= new Date()) {
    return res.status(404).json({ error: 'Announcement not found' });
  }
  if (!audienceMatches(doc.audiences, audience)) {
    return res.status(404).json({ error: 'Announcement not found' });
  }

  res.json({
    id: doc._id,
    title: doc.title,
    body: doc.body,
    type: doc.type,
    priority: doc.priority,
    link: doc.link || null,
    publishedAt: doc.publishedAt,
    expiresAt: doc.expiresAt || null,
    surveyOptions: doc.type === 'survey' ? (doc.surveyOptions || []) : [],
  });
});

export const read = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const state = await markRead(req, id);
  if (!state) return res.status(401).json({ error: 'Authentication required' });
  res.json({ ok: true, readAt: state.readAt });
});

export const ack = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
  const state = await acknowledge(req, id);
  if (!state) return res.status(401).json({ error: 'Authentication required' });
  res.json({ ok: true, acknowledgedAt: state.acknowledgedAt });
});

export const vote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const voteValue = req.body?.vote;
  if (!voteValue) return res.status(400).json({ error: 'vote is required' });
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const state = await castSurveyVote(req, id, String(voteValue));
    res.json({ ok: true, surveyVote: state.surveyVote });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Vote failed' });
  }
});
