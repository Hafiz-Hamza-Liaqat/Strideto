/**
 * Server-only HSI security configuration.
 * Never expose secrets. Production refuses test/dev adapters.
 */
import { isGbsHsiDocumentsEnabled } from '../../../shared/gbs/hsiSecurity.js';
import { HSI_REQUIRED_RETENTION_CLASSES } from '../../../shared/gbs/hsiSecurity.js';

const PLACEHOLDER_VALUES = new Set([
  '',
  'replace-me',
  'changeme',
  'minioadmin',
  'minio-root-user',
  'minio-root-password',
  'vault-token',
  'root',
  'dev-only',
  'test',
  'REPLACE_WITH_MINIO_ACCESS_KEY',
  'REPLACE_WITH_MINIO_SECRET_KEY',
  'REPLACE_WITH_VAULT_TOKEN',
]);

export const INSECURE_HSI_CREDENTIALS = PLACEHOLDER_VALUES;

export function isInsecureHsiCredential(value) {
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (PLACEHOLDER_VALUES.has(trimmed)) return true;
  if (/minioadmin/i.test(trimmed)) return true;
  return false;
}

function read(env, key) {
  const value = env?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseBool(value) {
  return value === '1' || value === 'true';
}

export function parseHsiRetentionPolicy(env = process.env) {
  const raw = read(env, 'GBS_HSI_RETENTION_POLICY_JSON');
  if (!raw) {
    return { ready: false, reason: 'missing', durationsSeconds: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ready: false, reason: 'malformed', durationsSeconds: null };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ready: false, reason: 'malformed', durationsSeconds: null };
  }
  const durationsSeconds = {};
  for (const cls of HSI_REQUIRED_RETENTION_CLASSES) {
    const n = Number(parsed[cls]);
    if (!Number.isFinite(n) || n <= 0) {
      return { ready: false, reason: 'class_missing', durationsSeconds: null, missingClass: cls };
    }
    durationsSeconds[cls] = Math.floor(n);
  }
  return { ready: true, reason: null, durationsSeconds };
}

export function loadHsiSecurityConfig(env = process.env) {
  const enabled = isGbsHsiDocumentsEnabled(env);
  const nodeEnv = read(env, 'NODE_ENV') || 'development';
  const production = nodeEnv === 'production';
  const vaultDevMode = parseBool(read(env, 'VAULT_DEV_MODE'))
    || parseBool(read(env, 'HSI_VAULT_DEV_MODE'));
  const skipEncryption = parseBool(read(env, 'HSI_SKIP_ENCRYPTION'))
    || parseBool(read(env, 'HSI_FAKE_KMS'))
    || parseBool(read(env, 'HSI_ALLOW_PLAINTEXT'));
  const environmentName = read(env, 'APP_ENV') || read(env, 'HSI_ENVIRONMENT') || nodeEnv;

  const clamav = {
    host: read(env, 'CLAMAV_CLAMD_HOST') || read(env, 'HSI_CLAMD_HOST'),
    port: Number(read(env, 'CLAMAV_CLAMD_PORT') || read(env, 'HSI_CLAMD_PORT') || 3310),
    timeoutMs: Number(read(env, 'CLAMAV_CLAMD_TIMEOUT_MS') || 30_000),
    maxStreamBytes: Number(read(env, 'CLAMAV_CLAMD_MAX_STREAM_BYTES') || 40 * 1024 * 1024),
  };

  const minio = {
    endpoint: read(env, 'HSI_MINIO_ENDPOINT'),
    region: read(env, 'HSI_MINIO_REGION') || 'us-east-1',
    accessKey: read(env, 'HSI_MINIO_ACCESS_KEY'),
    secretKey: read(env, 'HSI_MINIO_SECRET_KEY'),
    quarantineBucket: read(env, 'HSI_MINIO_QUARANTINE_BUCKET'),
    cleanBucket: read(env, 'HSI_MINIO_CLEAN_BUCKET'),
    forcePathStyle: read(env, 'HSI_MINIO_FORCE_PATH_STYLE') !== '0',
    tls: parseBool(read(env, 'HSI_MINIO_TLS')),
  };

  const vault = {
    addr: read(env, 'VAULT_ADDR') || read(env, 'HSI_VAULT_ADDR'),
    token: read(env, 'VAULT_TOKEN') || read(env, 'HSI_VAULT_TOKEN'),
    transitKeyName: read(env, 'VAULT_TRANSIT_KEY_NAME') || read(env, 'HSI_VAULT_TRANSIT_KEY_NAME'),
    namespace: read(env, 'VAULT_NAMESPACE') || '',
    timeoutMs: Number(read(env, 'HSI_VAULT_TIMEOUT_MS') || 8000),
    devMode: vaultDevMode,
  };

  const retention = parseHsiRetentionPolicy(env);

  const scannerConfigured = Boolean(clamav.host && Number.isInteger(clamav.port) && clamav.port > 0);
  const storageConfigured = Boolean(
    minio.endpoint
    && minio.quarantineBucket
    && minio.cleanBucket
    && minio.quarantineBucket !== minio.cleanBucket
    && !isInsecureHsiCredential(minio.accessKey)
    && !isInsecureHsiCredential(minio.secretKey)
  );
  const kmsConfigured = Boolean(
    vault.addr
    && vault.transitKeyName
    && !isInsecureHsiCredential(vault.token)
  );

  const productionForbidden = production && (vaultDevMode || skipEncryption);
  const encryptionPolicyReady = !skipEncryption && kmsConfigured && !productionForbidden;

  return {
    enabled,
    production,
    environmentName,
    skipEncryption,
    vaultDevMode,
    productionForbidden,
    clamav,
    minio,
    vault,
    retention,
    scannerConfigured,
    storageConfigured,
    kmsConfigured,
    encryptionPolicyReady,
    retentionPolicyReady: retention.ready === true,
  };
}

export function hsiPublicCapabilitySnapshot(config, probes = {}) {
  return {
    enabled: config.enabled === true,
    scannerConfigured: config.scannerConfigured === true,
    scannerHealthy: probes.scannerHealthy === true,
    scanExecutorHealthy: probes.scanExecutorHealthy === true,
    storageConfigured: config.storageConfigured === true,
    storageHealthy: probes.storageHealthy === true,
    kmsConfigured: config.kmsConfigured === true,
    kmsHealthy: probes.kmsHealthy === true,
    encryptionPolicyReady: config.encryptionPolicyReady === true,
    retentionPolicyReady: config.retentionPolicyReady === true,
    auditReady: probes.auditReady === true,
    overallReady: probes.overallReady === true,
  };
}
