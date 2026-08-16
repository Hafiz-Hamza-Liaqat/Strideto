/**
 * Dedicated HSI scan executor internals.
 * Does not import email, notification, or workflow delivery.
 */
import { loadHsiSecurityConfig } from '../../config/hsiSecurityConfig.js';
import { HSI_CLAMAV_VERDICTS, HSI_SCAN_ATTEMPT_TIMEOUT_MS, HSI_SCAN_JOB_STATUSES } from '../../../../shared/gbs/hsiSecurity.js';
import { clamdInstream, clamdVersion } from './clamavClamdAdapter.js';
import { decryptHsiVersionBytes } from './hsiObjectPipeline.js';
import {
  claimNextScanJob,
  completeScanJob,
  requeueOrFailScanJob,
  touchScanExecutorHeartbeat,
} from './gbsDocumentScanJobService.js';
import { finalizeHsiScanVerdict } from './hsiScanCompletionService.js';
import { VaultDocumentVersion } from '../../models/vault/VaultDocumentVersion.js';

export async function processClaimedScanJob(job, { env = process.env, now = new Date() } = {}) {
  const config = loadHsiSecurityConfig(env);
  const version = await VaultDocumentVersion.findById(job.vaultDocumentVersionId);
  if (!version) {
    await completeScanJob(job, { status: HSI_SCAN_JOB_STATUSES.DEAD, lastErrorCode: 'version_missing', now });
    return { status: HSI_SCAN_JOB_STATUSES.DEAD };
  }

  let plaintext;
  try {
    plaintext = await decryptHsiVersionBytes(version, { env });
  } catch {
    await requeueOrFailScanJob(job, { lastErrorCode: 'decrypt_failed', now });
    return { status: 'retry_or_dead' };
  }

  let engineVersion = null;
  try {
    engineVersion = await clamdVersion(config.clamav);
  } catch {
    engineVersion = null;
  }

  const result = await clamdInstream(plaintext, {
    ...config.clamav,
    timeoutMs: HSI_SCAN_ATTEMPT_TIMEOUT_MS,
  });
  plaintext.fill(0);

  if (result.verdict === HSI_CLAMAV_VERDICTS.TIMEOUT) {
    await requeueOrFailScanJob(job, { lastErrorCode: 'timeout', timeout: true, now });
    return { status: HSI_CLAMAV_VERDICTS.TIMEOUT };
  }
  if (result.verdict === HSI_CLAMAV_VERDICTS.FAILED) {
    await requeueOrFailScanJob(job, { lastErrorCode: result.code || 'failed', now });
    return { status: HSI_CLAMAV_VERDICTS.FAILED };
  }

  const finalized = await finalizeHsiScanVerdict({
    job,
    verdict: result.verdict,
    engineVersion,
    env,
    now,
  });
  const jobStatus = result.verdict === HSI_CLAMAV_VERDICTS.CLEAN
    ? HSI_SCAN_JOB_STATUSES.CLEAN
    : HSI_SCAN_JOB_STATUSES.REJECTED;
  await completeScanJob(job, {
    status: jobStatus,
    lastErrorCode: null,
    verdictEngine: 'clamav-clamd',
    verdictEngineVersion: engineVersion,
    now,
  });
  return { status: jobStatus, finalized };
}

export async function runScanExecutorTick({ leaseOwner, env = process.env, now = new Date() } = {}) {
  await touchScanExecutorHeartbeat(leaseOwner, now);
  const job = await claimNextScanJob({ leaseOwner, now });
  if (!job) return { claimed: false };
  const result = await processClaimedScanJob(job, { env, now });
  return { claimed: true, result };
}
