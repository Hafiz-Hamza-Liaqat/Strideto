/**
 * Dedicated GBS HSI document scan executor.
 * Run: node src/gbsDocumentScanWorker.js
 *
 * Must not import or start email / notification / workflow delivery.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import { runScanExecutorTick } from './services/hsi/hsiScanExecutor.js';

const INTERVAL_MS = Number(process.env.HSI_SCAN_POLL_INTERVAL_MS) || 2_000;
const LEASE_OWNER = process.env.HSI_SCAN_LEASE_OWNER || `hsi-scan-${crypto.randomBytes(6).toString('hex')}`;
let running = true;

async function main() {
  await connectDB();
  logger.info('hsi_scan_worker_started', { intervalMs: INTERVAL_MS, leaseOwner: LEASE_OWNER });

  const loop = async () => {
    while (running) {
      try {
        await runScanExecutorTick({ leaseOwner: LEASE_OWNER });
      } catch (err) {
        logger.error('hsi_scan_worker_tick_error', { error: err.message });
      }
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  };

  loop();

  async function shutdown(signal) {
    logger.info('hsi_scan_worker_shutdown', { signal });
    running = false;
    setTimeout(async () => {
      await disconnectDB().catch(() => {});
      process.exit(0);
    }, 500);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('hsi_scan_worker_fatal', { error: err.message });
  process.exit(1);
});
