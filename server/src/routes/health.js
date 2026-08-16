import { Router } from 'express';
import { getRedisClient } from '../config/redis.js';
import { getMongoHealth } from '../config/db.js';
import { isShuttingDown } from '../config/shutdown.js';
import { collectMetrics, metricsPrometheusText } from '../config/metrics.js';
import { getExtendedHealth } from '../controllers/platformOpsController.js';
import { getQueueStats } from '../services/jobQueueService.js';
import { isHsiDocumentCapabilityReady } from '../services/hsi/hsiCapabilityService.js';

export const healthRouter = Router();

healthRouter.get('/health', getExtendedHealth);

healthRouter.get('/health/live', async (_req, res) => {
  res.json({ status: 'ok', live: true, timestamp: new Date().toISOString() });
});

healthRouter.get('/health/ready', async (_req, res) => {
  const mongo = getMongoHealth();
  let redis = { status: 'disabled' };
  try {
    const client = await getRedisClient();
    if (client) {
      await client.ping();
      redis = { status: 'up' };
    }
  } catch (err) {
    redis = { status: 'down', error: err.message };
  }

  let queue = { status: 'ok' };
  try {
    const stats = await getQueueStats();
    if (stats.dead24h > 50) queue = { status: 'degraded', dead24h: stats.dead24h };
  } catch (err) {
    queue = { status: 'unavailable', error: err.message };
  }

  const requireRedis = process.env.REQUIRE_REDIS === '1';
  const redisOk = !requireRedis || redis.status === 'up';
  const shuttingDown = isShuttingDown();
  const ready = mongo.status === 'up' && redisOk && !shuttingDown;
  const status = ready ? 200 : 503;
  res.status(status).json({
    status: ready ? 'ready' : 'not_ready',
    appEnv: process.env.APP_ENV || process.env.NODE_ENV || 'unknown',
    mongo,
    redis,
    queue,
    requireRedis,
    shuttingDown,
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/health/hsi', async (_req, res) => {
  const cap = await isHsiDocumentCapabilityReady();
  const body = {
    enabled: cap.enabled === true,
    ready: cap.ready === true,
    state: cap.state,
    scannerConfigured: cap.scannerConfigured === true,
    scannerHealthy: cap.scannerHealthy === true,
    scanExecutorHealthy: cap.scanExecutorHealthy === true,
    storageConfigured: cap.storageConfigured === true,
    storageHealthy: cap.storageHealthy === true,
    kmsConfigured: cap.kmsConfigured === true,
    kmsHealthy: cap.kmsHealthy === true,
    encryptionPolicyReady: cap.encryptionPolicyReady === true,
    retentionPolicyReady: cap.retentionPolicyReady === true,
    auditReady: cap.auditReady === true,
  };
  if (!cap.enabled) {
    return res.status(200).json(body);
  }
  return res.status(cap.ready ? 200 : 503).json(body);
});

healthRouter.get('/metrics', async (req, res) => {
  if (req.query.format === 'prometheus') {
    const text = await metricsPrometheusText();
    res.type('text/plain').send(text);
    return;
  }
  res.json(await collectMetrics());
});
