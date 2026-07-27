import crypto from 'crypto';

const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
]);

function isPrivateLanHostname(hostname) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  if (h.endsWith('.local')) return true;
  if (h.startsWith('192.168.')) return true;
  if (h.startsWith('10.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

/**
 * Parse Mongo target from MONGO_URI without exposing credentials.
 * @param {string} [uri]
 */
export function resolveMongoTarget(uri = process.env.MONGO_URI) {
  if (!uri || typeof uri !== 'string') {
    return {
      ok: false,
      error: 'MONGO_URI missing',
      hostname: null,
      effectiveDatabaseName: null,
      hasExplicitDbPath: false,
      fingerprintSha256: null,
      isLocalDevelopmentTarget: false,
      nodeEnv: process.env.NODE_ENV || 'development',
    };
  }

  let hostname = null;
  let databaseName = null;
  let hasExplicitDbPath = false;

  try {
    const normalized = uri.replace(/^mongodb\+srv:/, 'https:').replace(/^mongodb:/, 'http:');
    const u = new URL(normalized);
    hostname = (u.hostname || '').toLowerCase();
    const path = (u.pathname || '').replace(/^\//, '').split('?')[0];
    if (path) {
      databaseName = decodeURIComponent(path);
      hasExplicitDbPath = true;
    }
  } catch {
    return {
      ok: false,
      error: 'MONGO_URI parse failed',
      hostname: null,
      effectiveDatabaseName: null,
      hasExplicitDbPath: false,
      fingerprintSha256: null,
      isLocalDevelopmentTarget: false,
      nodeEnv: process.env.NODE_ENV || 'development',
    };
  }

  const dbOverride = process.env.MONGO_DB_NAME || process.env.DB_NAME || null;
  const effectiveDatabaseName = dbOverride || databaseName || null;

  if (!effectiveDatabaseName) {
    return {
      ok: false,
      error: 'effective database name missing',
      hostname,
      effectiveDatabaseName: null,
      hasExplicitDbPath,
      fingerprintSha256: null,
      isLocalDevelopmentTarget: isLocalHostname(hostname) || isPrivateLanHostname(hostname),
      nodeEnv: process.env.NODE_ENV || 'development',
    };
  }

  const fingerprintSha256 = crypto
    .createHash('sha256')
    .update(`${hostname}|${effectiveDatabaseName}`)
    .digest('hex');

  const isLocalDevelopmentTarget =
    isLocalHostname(hostname) || isPrivateLanHostname(hostname);

  return {
    ok: true,
    error: null,
    hostname,
    effectiveDatabaseName,
    hasExplicitDbPath,
    fingerprintSha256,
    isLocalDevelopmentTarget,
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

export function isLocalHostname(hostname) {
  if (!hostname) return true;
  return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
}

/** Safe object for logs (no URI). */
export function publicMongoTargetSummary(target = resolveMongoTarget()) {
  return {
    hostname: target.hostname,
    effectiveDatabaseName: target.effectiveDatabaseName,
    fingerprintSha256: target.fingerprintSha256,
    isLocalDevelopmentTarget: target.isLocalDevelopmentTarget,
    nodeEnv: target.nodeEnv,
    hasExplicitDbPath: target.hasExplicitDbPath,
  };
}

/**
 * Fail closed for production mutations (apply, non-dry-run seed).
 * @param {{ expectedFingerprint?: string | null, allowLocal?: boolean }} options
 */
export function assertProductionMutationTarget(options = {}) {
  const { expectedFingerprint = null, allowLocal = false } = options;
  const target = resolveMongoTarget();

  if (!target.ok) {
    const err = new Error(`mongo_target_guard: ${target.error}`);
    err.code = 'MONGO_TARGET_INVALID';
    throw err;
  }

  if (!allowLocal && target.isLocalDevelopmentTarget) {
    const err = new Error('mongo_target_guard: local development Mongo target is not allowed for production mutations');
    err.code = 'MONGO_TARGET_LOCAL_FORBIDDEN';
    throw err;
  }

  if (!expectedFingerprint) {
    const err = new Error('mongo_target_guard: --expected-fingerprint is required');
    err.code = 'MONGO_TARGET_FINGERPRINT_REQUIRED';
    throw err;
  }

  if (expectedFingerprint !== target.fingerprintSha256) {
    const err = new Error('mongo_target_guard: fingerprint mismatch');
    err.code = 'MONGO_TARGET_FINGERPRINT_MISMATCH';
    throw err;
  }

  return target;
}
