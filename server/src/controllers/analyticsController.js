import { asyncHandler } from '../utils/asyncHandler.js';
import { recordAnalyticsEvent } from '../services/analytics/AnalyticsEventService.js';
import { AnalyticsEvent } from '../models/AnalyticsEvent.js';
import { cacheGet, cacheSet } from '../config/redis.js';

const CACHE_TTL = 120;

/**
 * Public event ingest — delegates to AnalyticsEventService (C.7.0.5).
 * Keeps legacy response shape for backward compatibility.
 */
export const recordEvent = asyncHandler(async (req, res) => {
  try {
    const doc = await recordAnalyticsEvent(req.body || {}, {
      userId: req.user?.userId,
      userAgent: req.headers['user-agent'] || '',
      entityType: req.employer?.employerId ? 'employer' : undefined,
      entityId: req.employer?.employerId || undefined,
    });
    res.status(201).json({ id: doc._id });
  } catch (e) {
    if (e.status === 400) {
      return res.status(400).json({ error: e.message, details: e.details });
    }
    throw e;
  }
});

/** Legacy v1 dashboard — unchanged contract */
export const getDashboard = asyncHandler(async (req, res) => {
  const cacheKey = 'analytics:dashboard';
  let data = await cacheGet(cacheKey);
  if (data) return res.json(data);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [dailyActiveUsers, trendingSearches, recommendedClicks, notificationsSent, notificationsOpened] = await Promise.all([
    AnalyticsEvent.distinct('userId', { createdAt: { $gte: startOfDay }, userId: { $ne: null } }),
    AnalyticsEvent.aggregate([
      { $match: { eventType: 'search', createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } } },
      { $group: { _id: '$metadata.query', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    AnalyticsEvent.countDocuments({ eventType: 'click', listingType: { $in: ['job', 'scholarship', 'admission'] }, createdAt: { $gte: startOfDay } }),
    AnalyticsEvent.countDocuments({ eventType: 'notification_sent', createdAt: { $gte: startOfDay } }),
    AnalyticsEvent.countDocuments({ eventType: 'notification_opened', createdAt: { $gte: startOfDay } }),
  ]);

  data = {
    dailyActiveUsers: dailyActiveUsers?.length ?? 0,
    trendingSearches: (trendingSearches || []).map((s) => ({ query: s._id || '(unknown)', count: s.count })),
    recommendedClicksToday: recommendedClicks ?? 0,
    notificationsSentToday: notificationsSent ?? 0,
    notificationsOpenedToday: notificationsOpened ?? 0,
  };
  await cacheSet(cacheKey, data, CACHE_TTL);
  res.json(data);
});
