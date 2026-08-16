/**
 * Durable GBS HSI scan job queue. Not BackgroundJob. Not the email Worker.
 */
import crypto from 'node:crypto';
import { GbsDocumentScanJob } from '../../models/gbs/GbsDocumentScanJob.js';
import { HsiScanExecutorHeartbeat } from '../../models/gbs/HsiScanExecutorHeartbeat.js';
import {
  HSI_SCAN_ATTEMPT_TIMEOUT_MS,
  HSI_SCAN_JOB_STATUSES,
  HSI_SCAN_LEASE_MS,
  HSI_SCAN_MAX_ATTEMPTS,
  HSI_SCAN_EXECUTOR_HEARTBEAT_STALE_MS,
  hsiScanBackoffMs,
} from '../../../../shared/gbs/hsiSecurity.js';

function opaqueRef() {
  return crypto.randomBytes(18).toString('base64url');
}

export async function enqueueGbsDocumentScanJob({
  vaultDocumentVersionId,
  opaqueStorageRef,
  checksumSha256,
  mimeType,
  sizeBytes,
  classification,
  now = new Date(),
} = {}) {
  try {
    return await GbsDocumentScanJob.create({
      publicJobRef: opaqueRef(),
      vaultDocumentVersionId,
      opaqueStorageRef,
      checksumSha256,
      mimeType,
      sizeBytes,
      classification,
      status: HSI_SCAN_JOB_STATUSES.QUEUED,
      attempt: 0,
      maxAttempts: HSI_SCAN_MAX_ATTEMPTS,
      availableAt: now,
      schemaVersion: '17d-8b2a.0',
    });
  } catch (err) {
    if (err?.code === 11000) {
      return GbsDocumentScanJob.findOne({ vaultDocumentVersionId, checksumSha256 });
    }
    throw err;
  }
}

export async function claimNextScanJob({
  leaseOwner,
  now = new Date(),
  leaseMs = HSI_SCAN_LEASE_MS,
} = {}) {
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);
  return GbsDocumentScanJob.findOneAndUpdate(
    {
      $or: [
        { status: HSI_SCAN_JOB_STATUSES.QUEUED, availableAt: { $lte: now } },
        { status: HSI_SCAN_JOB_STATUSES.LEASED, leaseExpiresAt: { $lte: now } },
      ],
      attempt: { $lt: HSI_SCAN_MAX_ATTEMPTS },
    },
    {
      $set: {
        status: HSI_SCAN_JOB_STATUSES.LEASED,
        leasedAt: now,
        leaseOwner,
        leaseExpiresAt,
      },
      $inc: { attempt: 1, recordVersion: 1 },
    },
    { new: true, sort: { availableAt: 1, createdAt: 1 } }
  );
}

export async function completeScanJob(job, {
  status,
  lastErrorCode = null,
  verdictEngine = null,
  verdictEngineVersion = null,
} = {}) {
  return GbsDocumentScanJob.findOneAndUpdate(
    {
      _id: job._id,
      status: HSI_SCAN_JOB_STATUSES.LEASED,
      leaseOwner: job.leaseOwner,
      recordVersion: job.recordVersion,
    },
    {
      $set: {
        status,
        lastErrorCode,
        verdictEngine,
        verdictEngineVersion,
        leasedAt: null,
        leaseExpiresAt: null,
      },
      $inc: { recordVersion: 1 },
    },
    { new: true }
  );
}

export async function requeueOrFailScanJob(job, {
  lastErrorCode,
  timeout = false,
  now = new Date(),
} = {}) {
  const terminal = job.attempt >= (job.maxAttempts || HSI_SCAN_MAX_ATTEMPTS);
  if (terminal) {
    return completeScanJob(job, {
      status: timeout ? HSI_SCAN_JOB_STATUSES.TIMEOUT : HSI_SCAN_JOB_STATUSES.DEAD,
      lastErrorCode,
      now,
    });
  }
  return GbsDocumentScanJob.findOneAndUpdate(
    {
      _id: job._id,
      status: HSI_SCAN_JOB_STATUSES.LEASED,
      leaseOwner: job.leaseOwner,
      recordVersion: job.recordVersion,
    },
    {
      $set: {
        status: HSI_SCAN_JOB_STATUSES.QUEUED,
        lastErrorCode,
        availableAt: new Date(now.getTime() + hsiScanBackoffMs(job.attempt)),
        leasedAt: null,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
      $inc: { recordVersion: 1 },
    },
    { new: true }
  );
}

export async function touchScanExecutorHeartbeat(leaseOwner, now = new Date()) {
  await HsiScanExecutorHeartbeat.findByIdAndUpdate(
    'default',
    { $set: { leaseOwner, lastBeatAt: now } },
    { upsert: true }
  );
}

export async function isScanExecutorHealthy(now = new Date(), staleMs = HSI_SCAN_EXECUTOR_HEARTBEAT_STALE_MS) {
  const row = await HsiScanExecutorHeartbeat.findById('default').lean();
  if (!row?.lastBeatAt) return false;
  return (now.getTime() - new Date(row.lastBeatAt).getTime()) <= staleMs;
}

export { HSI_SCAN_ATTEMPT_TIMEOUT_MS };
