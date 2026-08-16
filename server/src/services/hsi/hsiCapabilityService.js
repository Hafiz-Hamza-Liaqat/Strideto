/**
 * Server-authoritative HSI capability gate.
 * Flag ON never bypasses dependency readiness. Secrets are never returned.
 */
import {
  isGbsHsiDocumentsEnabled,
} from '../../../../shared/gbs/hsiSecurity.js';
import { loadHsiSecurityConfig, hsiPublicCapabilitySnapshot } from '../../config/hsiSecurityConfig.js';
import { probeClamdHealth } from './clamavClamdAdapter.js';
import { createHsiMinioClient, probeMinioHealth } from './minioOpaqueStorageAdapter.js';
import { probeVaultTransitHealth } from './vaultTransitClient.js';
import { isScanExecutorHealthy } from './gbsDocumentScanJobService.js';
import { probeAuditReady } from './hsiAudit.js';

export async function isHsiDocumentCapabilityReady({
  env = process.env,
  now = new Date(),
  probes: injected = {},
} = {}) {
  const config = loadHsiSecurityConfig(env);
  const enabled = isGbsHsiDocumentsEnabled(env);

  if (!enabled) {
    const snapshot = hsiPublicCapabilitySnapshot(config, {
      scannerHealthy: false,
      scanExecutorHealthy: false,
      storageHealthy: false,
      kmsHealthy: false,
      auditReady: false,
      overallReady: false,
    });
    return {
      ...snapshot,
      state: 'disabled',
      enabled: false,
      ready: false,
      overallReady: false,
    };
  }

  if (config.productionForbidden || config.skipEncryption) {
    const snapshot = hsiPublicCapabilitySnapshot(config, {
      scannerHealthy: false,
      scanExecutorHealthy: false,
      storageHealthy: false,
      kmsHealthy: false,
      auditReady: false,
      overallReady: false,
    });
    return { ...snapshot, state: 'not_ready', enabled: true, ready: false, overallReady: false };
  }

  const scannerHealthy = injected.scannerHealthy != null
    ? injected.scannerHealthy
    : config.scannerConfigured
      ? (await probeClamdHealth(config.clamav)).healthy === true
      : false;
  const storageHealthy = injected.storageHealthy != null
    ? injected.storageHealthy
    : config.storageConfigured
      ? (await probeMinioHealth(createHsiMinioClient(config.minio), config.minio)).healthy === true
      : false;
  const kmsHealthy = injected.kmsHealthy != null
    ? injected.kmsHealthy
    : config.kmsConfigured
      ? (await probeVaultTransitHealth(config.vault, { nodeEnv: env.NODE_ENV })).healthy === true
      : false;
  const scanExecutorHealthy = injected.scanExecutorHealthy != null
    ? injected.scanExecutorHealthy
    : await isScanExecutorHealthy(now);
  const auditReady = injected.auditReady != null
    ? injected.auditReady
    : await probeAuditReady();

  const overallReady = enabled
    && config.scannerConfigured
    && scannerHealthy
    && scanExecutorHealthy
    && config.storageConfigured
    && storageHealthy
    && config.kmsConfigured
    && kmsHealthy
    && config.encryptionPolicyReady
    && config.retentionPolicyReady
    && auditReady;

  const snapshot = hsiPublicCapabilitySnapshot(config, {
    scannerHealthy,
    scanExecutorHealthy,
    storageHealthy,
    kmsHealthy,
    auditReady,
    overallReady,
  });
  return {
    ...snapshot,
    enabled: true,
    ready: overallReady,
    overallReady,
    state: overallReady ? 'ready' : 'not_ready',
  };
}
