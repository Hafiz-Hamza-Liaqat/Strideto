/**
 * Production signing-secret placeholder rejection.
 * Run: node src/__tests__/validateProductionEnv.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  INSECURE_SIGNING_SECRETS,
  isInsecureSigningSecret,
  validateProductionEnv,
} from '../config/validateEnv.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

const STRONG_JWT = 't'.repeat(32);
const STRONG_REFRESH = 'u'.repeat(32);

const BASE_PRODUCTION = {
  NODE_ENV: 'production',
  JWT_SECRET: STRONG_JWT,
  REFRESH_SECRET: STRONG_REFRESH,
  SITE_URL: 'https://strideto.example',
  MONGO_URI: 'mongodb://localhost:27017/strideto-validate-env-test',
  REDIS_URL: 'redis://localhost:6379',
};

function captureValidation(overrides) {
  const saved = { ...process.env };
  const errors = [];
  const origError = console.error;
  const origWarn = console.warn;
  const origExit = process.exit;
  let exitCode;
  console.error = (...args) => {
    errors.push(args.map(String).join(' '));
  };
  console.warn = () => {};
  process.exit = (code) => {
    exitCode = code ?? 0;
    const err = new Error('__production_env_exit__');
    err.exitCode = exitCode;
    throw err;
  };
  const keys = [
    'NODE_ENV',
    'JWT_SECRET',
    'REFRESH_SECRET',
    'SITE_URL',
    'MONGO_URI',
    'REDIS_URL',
    'FRONTEND_URL',
    'APP_URL',
    'CLOUDINARY_CLOUD_NAME',
    'GBS_HSI_DOCUMENTS_ENABLED',
    'VAULT_DEV_MODE',
    'HSI_SKIP_ENCRYPTION',
  ];
  try {
    for (const key of keys) delete process.env[key];
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) process.env[key] = value;
    }
    try {
      validateProductionEnv();
    } catch (err) {
      if (err.message !== '__production_env_exit__') throw err;
    }
    return { passed: exitCode === undefined, exitCode, errors: errors.join('\n') };
  } finally {
    console.error = origError;
    console.warn = origWarn;
    process.exit = origExit;
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  }
}

function assertNoSecretEcho(errors, secret, label) {
  check(!errors.includes(secret), `${label}: fatal text must not echo the secret value`);
}

// --- Shared helper ---------------------------------------------------------
{
  check(
    isInsecureSigningSecret('replace-with-openssl-rand-hex-32'),
    'canonical helper rejects the root JWT placeholder'
  );
  check(
    isInsecureSigningSecret('replace-with-a-different-openssl-rand-hex-32'),
    'canonical helper rejects the root REFRESH placeholder'
  );
  check(
    !isInsecureSigningSecret(STRONG_JWT),
    'canonical helper accepts a distinct strong test secret'
  );
}

// --- 1. published JWT placeholder ------------------------------------------
{
  const result = captureValidation({
    ...BASE_PRODUCTION,
    JWT_SECRET: 'replace-with-openssl-rand-hex-32',
  });
  check(result.passed === false && result.exitCode === 1, 'published JWT placeholder → production validation FAILS');
  check(
    /JWT_SECRET uses an insecure placeholder value/.test(result.errors),
    'JWT placeholder fatal names JWT_SECRET without printing the value'
  );
  assertNoSecretEcho(result.errors, 'replace-with-openssl-rand-hex-32', 'JWT placeholder');
}

// --- 2. published REFRESH placeholder --------------------------------------
{
  const result = captureValidation({
    ...BASE_PRODUCTION,
    REFRESH_SECRET: 'replace-with-a-different-openssl-rand-hex-32',
  });
  check(result.passed === false && result.exitCode === 1, 'published REFRESH placeholder → production validation FAILS');
  check(
    /REFRESH_SECRET uses an insecure placeholder value/.test(result.errors),
    'REFRESH placeholder fatal names REFRESH_SECRET without printing the value'
  );
  assertNoSecretEcho(result.errors, 'replace-with-a-different-openssl-rand-hex-32', 'REFRESH placeholder');
}

// --- 3. every committed env-file assignment + documented variants ----------
{
  const envFiles = [
    '.env.example',
    '.env.template',
    '.env.production.example',
    path.join('docker', '.env.production.example'),
    path.join('docker', '.env.staging.example'),
  ];
  const assigned = new Set();
  const assignment = /^\s*#?\s*(?:JWT_SECRET|REFRESH_SECRET)=(\S+)/;
  for (const rel of envFiles) {
    const src = readFileSync(path.join(repoRoot, rel), 'utf8');
    for (const line of src.split(/\r?\n/)) {
      const m = assignment.exec(line);
      if (m?.[1]) assigned.add(m[1]);
    }
  }
  check(assigned.size >= 4, `expected several committed JWT/REFRESH placeholders, found ${assigned.size}`);
  for (const value of assigned) {
    check(
      INSECURE_SIGNING_SECRETS.has(value),
      'committed env-file JWT/REFRESH placeholder is denylisted'
    );
    const asJwt = captureValidation({ ...BASE_PRODUCTION, JWT_SECRET: value });
    check(asJwt.passed === false && asJwt.exitCode === 1, 'env-file placeholder FAILS as JWT_SECRET');
    assertNoSecretEcho(asJwt.errors, value, 'env-file JWT slot');
    const asRefresh = captureValidation({ ...BASE_PRODUCTION, REFRESH_SECRET: value });
    check(asRefresh.passed === false && asRefresh.exitCode === 1, 'env-file placeholder FAILS as REFRESH_SECRET');
    assertNoSecretEcho(asRefresh.errors, value, 'env-file REFRESH slot');
  }

  const documented = [
    'REPLACE_WITH_openssl_rand_hex_32',
    'REPLACE_WITH_A_DIFFERENT_openssl_rand_hex_32',
    'your-very-long-random-secret-at-least-32-characters',
    'a-different-random-secret-at-least-32-characters',
    'REPLACE_WITH_A_STRONG_SECRET_AT_LEAST_32_CHARS',
    'REPLACE_WITH_A_DIFFERENT_STRONG_SECRET_AT_LEAST_32_CHARS',
  ];
  for (const value of documented) {
    check(INSECURE_SIGNING_SECRETS.has(value), `documented placeholder is denylisted`);
  }
}

// --- 4. JWT == REFRESH -----------------------------------------------------
{
  const result = captureValidation({
    ...BASE_PRODUCTION,
    REFRESH_SECRET: STRONG_JWT,
  });
  check(result.passed === false && result.exitCode === 1, 'JWT == REFRESH → existing FAIL preserved');
  check(/must not be equal/.test(result.errors), 'equal-secret fatal is preserved');
}

// --- 5. short secret -------------------------------------------------------
{
  const jwtShort = captureValidation({ ...BASE_PRODUCTION, JWT_SECRET: 'short-jwt-secret' });
  check(jwtShort.passed === false && jwtShort.exitCode === 1, 'short JWT_SECRET → FAIL');
  check(/at least 32 characters/.test(jwtShort.errors), 'short JWT still uses the length fatal');

  const refreshShort = captureValidation({ ...BASE_PRODUCTION, REFRESH_SECRET: 'short-refresh-secret' });
  check(refreshShort.passed === false && refreshShort.exitCode === 1, 'short REFRESH_SECRET → FAIL');
  check(/at least 32 characters/.test(refreshShort.errors), 'short REFRESH still uses the length fatal');
}

// --- 6. missing secret -----------------------------------------------------
{
  const missingJwt = captureValidation({ ...BASE_PRODUCTION, JWT_SECRET: undefined });
  check(missingJwt.passed === false && missingJwt.exitCode === 1, 'missing JWT_SECRET → FAIL');

  const missingRefresh = captureValidation({ ...BASE_PRODUCTION, REFRESH_SECRET: undefined });
  check(missingRefresh.passed === false && missingRefresh.exitCode === 1, 'missing REFRESH_SECRET → FAIL');
}

// --- 7. two distinct strong test secrets -----------------------------------
{
  const result = captureValidation(BASE_PRODUCTION);
  check(result.passed === true, 'two distinct strong test secrets → validation PASSES');
  check(result.exitCode === undefined, 'passing validation does not process.exit');
}

// --- 8. HSI off does not require HSI secrets --------------------------------
{
  const result = captureValidation({ ...BASE_PRODUCTION, GBS_HSI_DOCUMENTS_ENABLED: '0' });
  check(result.passed === true, 'HSI disabled → production validation does not require MinIO/Vault/ClamAV');
}

// --- 9. HSI on without config / with test adapters fails closed -------------
{
  const missing = captureValidation({ ...BASE_PRODUCTION, GBS_HSI_DOCUMENTS_ENABLED: '1' });
  check(missing.passed === false && missing.exitCode === 1, 'HSI enabled without config → FAIL');
  check(/missing configuration/.test(missing.errors), 'HSI missing-config fatal names the gap');

  const devVault = captureValidation({
    ...BASE_PRODUCTION,
    GBS_HSI_DOCUMENTS_ENABLED: '1',
    VAULT_DEV_MODE: '1',
    CLAMAV_CLAMD_HOST: 'clamav',
    HSI_MINIO_ENDPOINT: 'http://minio:9000',
    HSI_MINIO_ACCESS_KEY: 'a'.repeat(20),
    HSI_MINIO_SECRET_KEY: 'b'.repeat(20),
    HSI_MINIO_QUARANTINE_BUCKET: 'hsi-q',
    HSI_MINIO_CLEAN_BUCKET: 'hsi-c',
    VAULT_ADDR: 'http://vault:8200',
    VAULT_TOKEN: 'c'.repeat(20),
    VAULT_TRANSIT_KEY_NAME: 'hsi-prod',
    GBS_HSI_RETENTION_POLICY_JSON: '{"unused_upload":1}',
  });
  check(devVault.passed === false, 'Vault dev mode refused in production HSI');
  check(/dev mode/.test(devVault.errors), 'dev-mode fatal is explicit');

  const skip = captureValidation({
    ...BASE_PRODUCTION,
    GBS_HSI_DOCUMENTS_ENABLED: '1',
    HSI_SKIP_ENCRYPTION: '1',
  });
  check(skip.passed === false, 'HSI_SKIP_ENCRYPTION refused in production');
}

console.log(`validateProductionEnv.test.js: ${count} assertions passed`);
