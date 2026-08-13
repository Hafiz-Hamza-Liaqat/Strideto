/**
 * Background worker process (C.7.0.9).
 * Run: node src/worker.js  or  WORKER_ONLY=1 via Docker worker service.
 */
import 'dotenv/config';
import { connectDB } from './config/db.js';
import { disconnectDB } from './config/db.js';
import { getRedisClient } from './config/redis.js';
import { logger } from './utils/logger.js';
import { processQueue, getQueueStats } from './services/jobQueueService.js';
import { touchWorkerHeartbeat } from './services/workerHeartbeat.js';
import { processDueScheduledWorkflows } from './services/workflow/workflowSchedulerService.js';
import {
  runScholarshipDeadlineReminders,
  runAdmissionDeadlineReminders,
  runSubscriptionExpiryReminders,
} from './scheduler/reminderJobs.js';

const INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS) || 15_000;
let running = true;

async function tick() {
  await touchWorkerHeartbeat();
  const result = await processQueue();
  if (result.processed > 0) {
    logger.info('worker_queue_processed', result);
  }
  const wf = await processDueScheduledWorkflows();
  if (wf.processed > 0) {
    logger.info('worker_workflow_scheduled', wf);
  }
}

async function runRemindersIfDue() {
  const hour = new Date().getHours();
  if (hour === 8 && process.env.DISABLE_REMINDER_CRON !== '1') {
    const [sch, adm, sub] = await Promise.all([
      runScholarshipDeadlineReminders(),
      runAdmissionDeadlineReminders(),
      runSubscriptionExpiryReminders(),
    ]);
    logger.info('worker_reminders', { sch, adm, sub });
  }
}

async function main() {
  process.env.WORKER_ONLY = '1';
  await connectDB();
  logger.info('worker_started', { intervalMs: INTERVAL_MS });

  const loop = async () => {
    while (running) {
      try {
        await tick();
        await runRemindersIfDue();
      } catch (err) {
        logger.error('worker_tick_error', { error: err.message });
      }
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  };

  loop();

  const statsInterval = setInterval(async () => {
    try {
      const stats = await getQueueStats();
      if (stats.pending > 0 || stats.dead24h > 0) {
        logger.info('worker_queue_stats', stats);
      }
    } catch {
      /* ignore */
    }
  }, 60_000);
  statsInterval.unref();

  async function shutdown(signal) {
    logger.info('worker_shutdown', { signal });
    running = false;
    const redis = await getRedisClient();
    if (redis) await redis.quit().catch(() => {});
    await disconnectDB();
    clearInterval(statsInterval);
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('worker_fatal', { error: err.message });
  process.exit(1);
});
