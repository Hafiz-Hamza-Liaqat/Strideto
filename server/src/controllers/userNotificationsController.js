import mongoose from 'mongoose';
import { UserNotification } from '../models/UserNotification.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import { STAFF_ROLES } from '../config/rbac.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function recipientContext(req) {
  if (req.employer) {
    return { recipientType: 'employer', employerId: req.employer.employerId || req.employer._id };
  }
  if (req.agent?.agentAccountId) {
    return { recipientType: 'agent', agentAccountId: req.agent.agentAccountId };
  }
  if (req.institution?.institutionAccountId) {
    return { recipientType: 'institution', institutionAccountId: req.institution.institutionAccountId };
  }
  // Unsupported realms are denied rather than falling through
  // and dereferencing a missing req.user.
  if (!req.user?.userId) return null;
  const isStaff = req.user?.role && STAFF_ROLES.includes(req.user.role);
  return {
    recipientType: isStaff ? 'staff' : 'user',
    userId: req.user.userId,
  };
}

function applyRecipientOwner(filter, ctx) {
  if (ctx.recipientType === 'employer') filter.employerId = ctx.employerId;
  else if (ctx.recipientType === 'agent') filter.agentAccountId = ctx.agentAccountId;
  else if (ctx.recipientType === 'institution') filter.institutionAccountId = ctx.institutionAccountId;
  else filter.userId = ctx.userId;
}

function denyUnsupportedInboxRealm(res) {
  return res.status(403).json({ error: 'Notification inbox is not available for this account type' });
}

function buildFilter(ctx, query) {
  const filter = { recipientType: ctx.recipientType };
  applyRecipientOwner(filter, ctx);

  if (query.read === 'true') filter.read = true;
  if (query.read === 'false') filter.read = false;
  if (query.category) filter.category = query.category;
  return filter;
}

export const listUserNotifications = asyncHandler(async (req, res) => {
  const ctx = recipientContext(req);
  if (!ctx) return denyUnsupportedInboxRealm(res);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const filter = buildFilter(ctx, req.query);

  const [data, total, unreadCount] = await Promise.all([
    UserNotification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    UserNotification.countDocuments(filter),
    UserNotification.countDocuments({ ...filter, read: false }),
  ]);

  res.json({ ...listResponse(data, paginate(page, limit, total), req.query), unreadCount });
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const ctx = recipientContext(req);
  if (!ctx) return denyUnsupportedInboxRealm(res);
  const filter = buildFilter(ctx, { read: 'false' });
  const unreadCount = await UserNotification.countDocuments(filter);
  res.json({ unreadCount });
});

export const markRead = asyncHandler(async (req, res) => {
  const ctx = recipientContext(req);
  if (!ctx) return denyUnsupportedInboxRealm(res);
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

  const filter = { _id: id, recipientType: ctx.recipientType };
  applyRecipientOwner(filter, ctx);

  const doc = await UserNotification.findOneAndUpdate(filter, { read: true, readAt: new Date() }, { new: true });
  if (!doc) return res.status(404).json({ error: 'Notification not found' });
  res.json(doc);
});

export const markAllRead = asyncHandler(async (req, res) => {
  const ctx = recipientContext(req);
  if (!ctx) return denyUnsupportedInboxRealm(res);
  const filter = buildFilter(ctx, { read: 'false' });
  const result = await UserNotification.updateMany(filter, { read: true, readAt: new Date() });
  res.json({ updated: result.modifiedCount });
});

export const removeNotification = asyncHandler(async (req, res) => {
  const ctx = recipientContext(req);
  if (!ctx) return denyUnsupportedInboxRealm(res);
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

  const filter = { _id: id, recipientType: ctx.recipientType };
  applyRecipientOwner(filter, ctx);

  const doc = await UserNotification.findOneAndDelete(filter);
  if (!doc) return res.status(404).json({ error: 'Notification not found' });
  res.status(204).send();
});

/** Legacy broadcast notifications + user inbox (v1 compat). */
export const getNotificationsForUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select('province interests role').lean();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const isStaff = STAFF_ROLES.includes(user.role);
  const recipientType = isStaff ? 'staff' : 'user';

  const [inbox, broadcasts] = await Promise.all([
    UserNotification.find({ recipientType, userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(DEFAULT_LIMIT)
      .lean(),
    Notification.find({
      $and: [
        { $or: [{ target_province: { $exists: false } }, { target_province: { $in: [null, ''] } }, { target_province: user.province }] },
        { $or: [{ target_interest: { $exists: false } }, { target_interest: { $in: [null, ''] } }, { target_interest: { $in: user.interests || [] } }] },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const unreadCount = await UserNotification.countDocuments({ recipientType, userId: req.user.userId, read: false });

  res.json({ data: inbox, broadcasts, unreadCount });
});
