/**
 * Graceful shutdown + process signal handling (C.7.0.9).
 */
import { disconnectDB } from './db.js';
import { getRedisClient } from './redis.js';
import { stopScraperCron } from '../scheduler/cron.js';
import { logger } from '../utils/logger.js';

let shuttingDown = false;

export function isShuttingDown() {
  return shuttingDown;
}

/**
 * Registers SIGTERM/SIGINT handlers that close the given (already-listening)
 * HTTP server and release Mongo/Redis/cron resources before exiting.
 * @param {import('http').Server} server
 */
export function registerGracefulShutdown(server) {
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutdown_started', { signal });

    const forceTimer = setTimeout(() => {
      logger.error('shutdown_forced', { reason: 'timeout' });
      process.exit(1);
    }, Number(process.env.SHUTDOWN_TIMEOUT_MS) || 30_000);
    forceTimer.unref();

    server.close(async () => {
      try {
        stopScraperCron();
        const redis = await getRedisClient();
        if (redis) await redis.quit().catch(() => {});
        await disconnectDB();
        logger.info('shutdown_complete');
        clearTimeout(forceTimer);
        process.exit(0);
      } catch (err) {
        logger.error('shutdown_error', { error: err.message });
        clearTimeout(forceTimer);
        process.exit(1);
      }
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}
