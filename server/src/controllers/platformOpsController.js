import fs from 'fs';
import os from 'os';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getRedisClient } from '../config/redis.js';
import { verifySmtpConnection, isSmtpConfigured } from '../services/emailService.js';

async function checkMongo() {
  const state = mongoose.connection.readyState;
  return { status: state === 1 ? 'up' : 'down', readyState: state };
}

async function checkRedis() {
  try {
    const client = await getRedisClient();
    if (!client) return { status: 'disabled' };
    await client.ping();
    return { status: 'up' };
  } catch (err) {
    return { status: 'down', error: err.message };
  }
}

function checkCloudinary() {
  const configured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);
  return { status: configured ? 'configured' : 'not_configured', configured };
}

function checkStripe() {
  const configured = !!process.env.STRIPE_SECRET_KEY;
  return { status: configured ? 'configured' : 'not_configured', configured };
}

function checkEnv() {
  const required = ['MONGO_URI', 'JWT_SECRET'];
  const recommended = ['SITE_URL', 'MAIL_HOST', 'MAIL_USER', 'MAIL_PASS', 'CLOUDINARY_CLOUD_NAME', 'STRIPE_SECRET_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  const warnings = recommended.filter((k) => !process.env[k]);
  return {
    valid: missing.length === 0,
    missing,
    warnings,
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

function getDiskUsage() {
  try {
    const uploadsPath = process.env.UPLOADS_PATH || 'uploads';
    if (fs.existsSync(uploadsPath)) {
      const files = fs.readdirSync(uploadsPath);
      return { uploadsFileCount: files.length, path: uploadsPath };
    }
  } catch {
    /* ignore */
  }
  return {
    freeMemoryMb: Math.round(os.freemem() / 1024 / 1024),
    totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
    loadAvg: os.loadavg(),
    platform: os.platform(),
  };
}

export const getPlatformHealth = asyncHandler(async (_req, res) => {
  const [mongo, redis, smtp] = await Promise.all([
    checkMongo(),
    checkRedis(),
    verifySmtpConnection(),
  ]);

  const services = {
    mongo,
    redis,
    smtp: { ...smtp, configured: isSmtpConfigured() },
    cloudinary: checkCloudinary(),
    stripe: checkStripe(),
    api: { status: 'up', uptimeSeconds: Math.floor(process.uptime()) },
  };

  const env = checkEnv();
  const disk = getDiskUsage();

  const degraded = mongo.status !== 'up' || (smtp.configured && smtp.status === 'down');

  res.json({
    status: degraded ? 'degraded' : 'ok',
    service: 'Strideto Platform',
    timestamp: new Date().toISOString(),
    services,
    environment: env,
    disk,
    backgroundServices: {
      scraperCron: process.env.DISABLE_SCRAPER_CRON !== 'true' ? 'enabled' : 'disabled',
      redisCache: redis.status === 'up' ? 'enabled' : redis.status,
    },
  });
});

export const getEnvValidation = asyncHandler(async (_req, res) => {
  res.json(checkEnv());
});

/** Extended health for public endpoint */
export const getExtendedHealth = asyncHandler(async (_req, res) => {
  const mongo = await checkMongo();
  const redis = await checkRedis();
  let backgroundJobs = null;
  try {
    const { getQueueStats } = await import('../services/jobQueueService.js');
    backgroundJobs = await getQueueStats();
  } catch {
    backgroundJobs = { status: 'unavailable' };
  }
  const smtpConfigured = isSmtpConfigured();
  const pending = Number(backgroundJobs?.pending) || 0;
  const { resolveEmailDeliveryState } = await import('../services/emailDeliveryState.js');
  const email = await resolveEmailDeliveryState({ pending });
  res.json({
    status: mongo.status === 'up' ? 'ok' : 'degraded',
    service: 'Strideto API',
    mongo: mongo.status,
    redis: redis.status,
    smtp: smtpConfigured ? 'configured' : 'not_configured',
    email: {
      configured: email.providerConfigured,
      providerConfigured: email.providerConfigured,
      workerRunning: email.workerRunning,
      deliveryEnabled: email.deliveryEnabled,
      queuePending: email.queuePending,
      effectiveState: email.effectiveState,
      mode: email.effectiveState,
      note: email.note,
    },
    backgroundJobs,
    uptime: process.uptime(),
  });
});
