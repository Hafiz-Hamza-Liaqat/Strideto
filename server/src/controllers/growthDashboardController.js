import { User } from '../models/User.js';
import { AnalyticsEvent } from '../models/AnalyticsEvent.js';
import { ScraperRun, resolveScraperErrorDetails } from '../models/ScraperRun.js';
import { NewsletterLog, resolveNewsletterErrorDetails } from '../models/NewsletterLog.js';
import { Job } from '../models/Job.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { cacheGet, cacheSet } from '../config/redis.js';

const CACHE_KEY = 'admin:growth-dashboard';
const CACHE_TTL = 120;

export const getGrowthDashboard = asyncHandler(async (req, res) => {
  let data = await cacheGet(CACHE_KEY);
  if (data) return res.json(data);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const [
    totalUsers,
    newUsersToday,
    dailyActiveUsers,
    trendingSearches,
    recommendedClicksToday,
    scraperRuns,
    scraperStats,
    newsletterLogs,
    scrapedJobsCount,
    referralStats,
    topReferrers,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: startOfDay } }),
    AnalyticsEvent.distinct('userId', { createdAt: { $gte: startOfDay }, userId: { $ne: null } }).then((arr) => arr.length),
    AnalyticsEvent.aggregate([
      { $match: { eventType: 'search', createdAt: { $gte: startOfWeek } } },
      { $group: { _id: '$metadata.query', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    AnalyticsEvent.countDocuments({ eventType: 'click', createdAt: { $gte: startOfDay }, listingType: { $in: ['job', 'scholarship', 'admission'] } }),
    ScraperRun.find().sort({ runAt: -1 }).limit(10).lean(),
    ScraperRun.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, totalJobs: { $sum: '$jobsAdded' }, totalAdmissions: { $sum: '$admissionsAdded' }, runs: { $sum: 1 } } },
    ]).then((r) => r[0] || { totalJobs: 0, totalAdmissions: 0, runs: 0 }),
    NewsletterLog.find().sort({ sentAt: -1 }).limit(10).lean(),
    Job.countDocuments({ source: 'scraper' }),
    User.countDocuments({ referredBy: { $exists: true, $ne: null } }),
    User.find({ role: 'User', referralCount: { $gt: 0 } }).sort({ referralCount: -1 }).limit(5).select('name email referralCount').lean(),
  ]);

  data = {
    totalUsers: totalUsers ?? 0,
    newUsersToday: newUsersToday ?? 0,
    dailyActiveUsers: dailyActiveUsers ?? 0,
    trendingSearches: (trendingSearches || []).map((s) => ({ query: s._id || '(unknown)', count: s.count })),
    recommendedClicksToday: recommendedClicksToday ?? 0,
    scraper: {
      lastRuns: (scraperRuns || []).map((run) => {
        const errorDetails = resolveScraperErrorDetails(run);
        const { errors: _legacy, ...rest } = run;
        return { ...rest, errorDetails, errors: errorDetails };
      }),
      totalJobsAdded: scraperStats?.totalJobs ?? 0,
      totalAdmissionsAdded: scraperStats?.totalAdmissions ?? 0,
      totalRuns: scraperStats?.runs ?? 0,
      scrapedListingsCount: scrapedJobsCount ?? 0,
    },
    newsletter: {
      lastLogs: (newsletterLogs || []).map((log) => {
        const errorDetails = resolveNewsletterErrorDetails(log);
        const { errors: _legacy, ...rest } = log;
        return { ...rest, errorDetails, errors: errorDetails };
      }),
      totalSent: (newsletterLogs || []).reduce((acc, l) => acc + (l.sentCount || 0), 0),
    },
    referrals: {
      totalReferrals: referralStats ?? 0,
      topReferrers: (topReferrers || []).map((u) => ({ name: u.name, email: u.email, referralCount: u.referralCount || 0 })),
    },
  };

  await cacheSet(CACHE_KEY, data, CACHE_TTL);
  res.json(data);
});
