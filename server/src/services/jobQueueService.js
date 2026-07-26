import { BackgroundJob } from '../models/BackgroundJob.js';
import {
  sendEmail,
  sendTemplatedEmail,
} from './emailService.js';
import {
  notifyUser,
  notifyEmployer,
  createUserNotification,
} from './notificationService.js';
import { processScheduledWorkflowJob } from '../services/workflow/workflowSchedulerService.js';
import { scheduleAnalyticsEvent } from './analytics/AnalyticsEventService.js';
import { NewsletterLog } from '../models/NewsletterLog.js';
import { NewsletterSubscriber } from '../models/NewsletterSubscriber.js';
import { acquireQueueLock, releaseQueueLock } from './queueLock.js';

const BATCH_SIZE = 20;

export async function enqueueJob({ type, payload, dedupKey, scheduledAt, maxAttempts = 3 }) {
  if (dedupKey) {
    const existing = await BackgroundJob.findOne({
      dedupKey,
      status: { $in: ['pending', 'processing', 'completed'] },
    }).lean();
    if (existing) return { enqueued: false, duplicate: true, jobId: existing._id };
  }

  try {
    const job = await BackgroundJob.create({
      type,
      payload,
      dedupKey,
      scheduledAt: scheduledAt || new Date(),
      maxAttempts,
    });
    return { enqueued: true, jobId: job._id };
  } catch (err) {
    if (err.code === 11000 && dedupKey) return { enqueued: false, duplicate: true };
    throw err;
  }
}

function redactEmailPayload(payload) {
  if (!payload || typeof payload !== 'object') return;
  if (payload.vars && typeof payload.vars === 'object' && payload.vars.url) {
    payload.vars = { ...payload.vars, url: '[redacted]' };
  }
  if (typeof payload.text === 'string' && payload.text) payload.text = '[redacted]';
  if (typeof payload.body === 'string' && payload.body) payload.body = '[redacted]';
}

async function processEmailJob(payload) {
  if (payload.templateKey) {
    return sendTemplatedEmail(payload.to, payload.templateKey, payload.lang || 'en', payload.vars || {});
  }
  return sendEmail({
    to: payload.to,
    subject: payload.subject,
    body: payload.body,
    text: payload.text,
    template: payload.template,
  });
}

async function processNotificationJob(payload) {
  if (payload.recipientType === 'employer') {
    return notifyEmployer(payload.employerId, payload);
  }
  if (payload.userId) {
    return notifyUser(payload.userId, payload);
  }
  return createUserNotification(payload);
}

async function processScheduledNewsletter(payload) {
  const { subject, html, text, logId } = payload;
  const subscribers = await NewsletterSubscriber.find({ subscribed: true }).lean();
  let sentCount = 0;
  let failedCount = 0;
  const errors = [];

  for (const sub of subscribers) {
    try {
      const result = await sendEmail({ to: sub.email, subject, body: html, text, template: 'newsletter' });
      if (result.sent || result.placeholder) sentCount += 1;
    } catch (err) {
      failedCount += 1;
      errors.push(`${sub.email}: ${err.message}`);
    }
  }

  if (logId) {
    await NewsletterLog.findByIdAndUpdate(logId, {
      sentCount,
      subscriberCount: subscribers.length,
      status: failedCount ? (sentCount ? 'partial' : 'failed') : 'sent',
      summary: `Sent to ${sentCount}/${subscribers.length}`,
      errors: errors.slice(0, 20),
    });
  }

  return { sentCount, failedCount };
}

async function executeJob(job) {
  switch (job.type) {
    case 'email':
    case 'retry_email':
      return processEmailJob(job.payload);
    case 'notification':
      return processNotificationJob(job.payload);
    case 'scheduled_newsletter':
      return processScheduledNewsletter(job.payload);
    case 'scheduled_publish':
      return processScheduledWorkflowJob(job.payload);
    case 'scholarship_reminder':
    case 'admission_reminder':
    case 'subscription_expiry':
      return processNotificationJob(job.payload);
    case 'application_reminder':
      return processApplicationReminderJob(job.payload);
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

async function processApplicationReminderJob(payload = {}) {
  const { userId, applicationId, reminderId, title } = payload;
  if (!userId) throw new Error('application_reminder requires userId');

  await notifyUser(userId, {
    category: 'application',
    type: 'career.application_reminder',
    title: title || 'Application reminder',
    body: 'You have a reminder on your application tracker.',
    link: applicationId ? `/applications/${applicationId}` : '/applications',
    metadata: { applicationId, reminderId },
  });

  if (applicationId && reminderId) {
    const { OpportunityApplicationRepository } = await import(
      '../repositories/career/OpportunityApplicationRepository.js'
    );
    await OpportunityApplicationRepository.updateReminderStatus(applicationId, reminderId, 'sent');
  }
}

async function recordNotificationSent(payload) {
  scheduleAnalyticsEvent({
    eventType: 'notification_sent',
    userId: payload.userId || undefined,
    metadata: { type: payload.type, category: payload.category, automated: true },
  });
}

export async function processQueue(limit = BATCH_SIZE) {
  const locked = await acquireQueueLock();
  if (!locked) return { processed: 0, completed: 0, failed: 0, retried: 0, skipped: true };

  try {
  const now = new Date();
  const jobs = await BackgroundJob.find({
    status: 'pending',
    scheduledAt: { $lte: now },
  })
    .sort({ scheduledAt: 1 })
    .limit(limit);

  const results = { processed: 0, completed: 0, failed: 0, retried: 0 };

  for (const job of jobs) {
    job.status = 'processing';
    job.attempts += 1;
    await job.save();
    results.processed += 1;

    try {
      await executeJob(job);
      job.status = 'completed';
      job.processedAt = new Date();
      job.lastError = undefined;
      if (job.type === 'email' || job.type === 'retry_email') {
        redactEmailPayload(job.payload);
      }
      await job.save();
      results.completed += 1;

      if (job.type === 'notification' || job.type.startsWith('scholarship_') || job.type.startsWith('admission_') || job.type === 'subscription_expiry' || job.type === 'application_reminder') {
        await recordNotificationSent(job.payload);
      }
      if (job.type === 'email' || job.type === 'retry_email') {
        scheduleAnalyticsEvent({
          eventType: 'email_sent',
          metadata: { template: job.payload?.templateKey || job.payload?.template, automated: true },
        });
      }
    } catch (err) {
      job.lastError = err.message;
      if (job.attempts >= job.maxAttempts) {
        job.status = 'dead';
        results.failed += 1;
        if (job.type === 'email' || job.type === 'retry_email') {
          await enqueueJob({
            type: 'retry_email',
            payload: job.payload,
            dedupKey: job.dedupKey ? `${job.dedupKey}:retry:${job.attempts}` : undefined,
            maxAttempts: 1,
          }).catch(() => {});
          redactEmailPayload(job.payload);
        }
      } else {
        job.status = 'pending';
        job.scheduledAt = new Date(Date.now() + job.attempts * 60 * 1000);
        results.retried += 1;
      }
      await job.save();
    }
  }

  return results;
  } finally {
    await releaseQueueLock();
  }
}

export async function getQueueStats() {
  const [pending, processing, completed, failed, dead] = await Promise.all([
    BackgroundJob.countDocuments({ status: 'pending' }),
    BackgroundJob.countDocuments({ status: 'processing' }),
    BackgroundJob.countDocuments({ status: 'completed', createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    BackgroundJob.countDocuments({ status: 'failed' }),
    BackgroundJob.countDocuments({ status: 'dead', createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
  ]);

  const byType = await BackgroundJob.aggregate([
    { $match: { status: { $in: ['pending', 'dead'] } } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
  ]);

  return { pending, processing, completed24h: completed, failed, dead24h: dead, byType };
}

export async function retryDeadJobs(limit = 10) {
  const jobs = await BackgroundJob.find({ status: 'dead' }).sort({ updatedAt: -1 }).limit(limit);
  for (const job of jobs) {
    job.status = 'pending';
    job.attempts = 0;
    job.scheduledAt = new Date();
    await job.save();
  }
  return jobs.length;
}
