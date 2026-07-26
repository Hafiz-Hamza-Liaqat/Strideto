import { FailedEmail } from '../../models/FailedEmail.js';
import { NewsletterLog, resolveNewsletterErrorDetails } from '../../models/NewsletterLog.js';
import { AuditLog } from '../../models/AuditLog.js';
import { SupportTicket } from '../../models/SupportTicket.js';
import { ContactMessage } from '../../models/ContactMessage.js';
import { getRedisClient } from '../../config/redis.js';
import { getQueueStats } from '../../services/jobQueueService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getMonitoringDashboard = asyncHandler(async (_req, res) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const queueStats = await getQueueStats();

  const [
    failedEmails,
    failedEmailCount,
    recentErrors,
    openTickets,
    newContacts,
    newsletterLogs,
    auditSummary,
  ] = await Promise.all([
    FailedEmail.find().sort({ createdAt: -1 }).limit(20).lean(),
    FailedEmail.countDocuments({ createdAt: { $gte: since24h } }),
    AuditLog.find({ action: { $regex: /fail|error/i } }).sort({ createdAt: -1 }).limit(15).lean().catch(() => []),
    SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress', 'waiting'] } }),
    ContactMessage.countDocuments({ status: 'new' }),
    NewsletterLog.find().sort({ sentAt: -1 }).limit(10).lean(),
    AuditLog.aggregate([
      { $match: { createdAt: { $gte: since24h } } },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]).catch(() => []),
  ]);

  let cacheStats = { status: 'disabled' };
  try {
    const client = await getRedisClient();
    if (client) {
      const info = await client.info('stats');
      const hits = info.match(/keyspace_hits:(\d+)/)?.[1];
      const misses = info.match(/keyspace_misses:(\d+)/)?.[1];
      cacheStats = {
        status: 'up',
        keyspaceHits: hits ? Number(hits) : null,
        keyspaceMisses: misses ? Number(misses) : null,
      };
    }
  } catch {
    cacheStats = { status: 'down' };
  }

  res.json({
    generatedAt: new Date().toISOString(),
    queues: {
      openSupportTickets: openTickets,
      newContactMessages: newContacts,
      backgroundJobs: queueStats,
    },
    failedJobs: [],
    failedEmails: {
      last24h: failedEmailCount,
      recent: failedEmails,
    },
    cache: cacheStats,
    recentErrors,
    newsletter: (newsletterLogs || []).map((log) => {
      const errorDetails = resolveNewsletterErrorDetails(log);
      const { errors: _legacy, ...rest } = log;
      return { ...rest, errorDetails, errors: errorDetails };
    }),
    auditSummary,
    backgroundTasks: {
      scraperCron: process.env.DISABLE_SCRAPER_CRON !== 'true' ? 'running' : 'disabled',
      nodeUptimeSeconds: Math.floor(process.uptime()),
    },
  });
});
