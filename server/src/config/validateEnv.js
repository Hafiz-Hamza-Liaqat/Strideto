/**
 * Canonical production-invalid signing-secret set.
 * Includes every committed JWT_SECRET / REFRESH_SECRET placeholder literal
 * found in env examples, Docker templates, and deployment docs.
 * JwtSessionProvider must reuse this helper — do not fork a second list.
 */
import { isInsecureHsiCredential } from './hsiSecurityConfig.js';
import { buildGoogleOidcConfig } from '../services/auth/googleOidcConfig.js';

export const INSECURE_SIGNING_SECRETS = new Set([
  'change-me-in-production',
  'your-super-secret-jwt-key-change-in-production',
  'dev-only-jwt-secret-min-32-characters-long',
  'replace-with-openssl-rand-hex-32',
  'replace-with-a-different-openssl-rand-hex-32',
  'REPLACE_WITH_openssl_rand_hex_32',
  'REPLACE_WITH_A_DIFFERENT_openssl_rand_hex_32',
  'replace-with-openssl-rand-hex-32-staging-only',
  'replace-with-a-different-openssl-rand-hex-32-staging-only',
  'your-very-long-random-secret-at-least-32-characters',
  'a-different-random-secret-at-least-32-characters',
  'REPLACE_WITH_A_STRONG_SECRET_AT_LEAST_32_CHARS',
  'REPLACE_WITH_A_DIFFERENT_STRONG_SECRET_AT_LEAST_32_CHARS',
  'your-long-random-secret-32-chars',
  'a-different-long-random-secret',
]);

export function isInsecureSigningSecret(value) {
  return typeof value === 'string' && INSECURE_SIGNING_SECRETS.has(value);
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

function fatalMissingOrShort(name) {
  console.error(
    `\n❌ FATAL: Set ${name} to a random string of at least 32 characters in production.`
  );
  console.error('   Generate one: openssl rand -hex 32\n');
  process.exit(1);
}

function fatalPlaceholder(name) {
  console.error(`\n❌ FATAL: ${name} uses an insecure placeholder value\n`);
  process.exit(1);
}

function rejectSigningSecret(name, value) {
  if (!value) {
    fatalMissingOrShort(name);
    return;
  }
  if (isInsecureSigningSecret(value)) {
    fatalPlaceholder(name);
    return;
  }
  if (value.length < 32) {
    fatalMissingOrShort(name);
  }
}

export function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const secret = process.env.JWT_SECRET;
  rejectSigningSecret('JWT_SECRET', secret);

  if (!process.env.SITE_URL) {
    console.error(
      '\n❌ FATAL: Set SITE_URL in production (e.g. https://yourdomain.com).\n'
    );
    process.exit(1);
  }

  if (!process.env.MONGO_URI) {
    console.error('\n❌ FATAL: Set MONGO_URI in production.\n');
    process.exit(1);
  }

  if (!process.env.FRONTEND_URL && !process.env.APP_URL) {
    warn('FRONTEND_URL or APP_URL not set — CORS may block the SPA origin.');
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    warn(
      'Cloudinary not configured — uploads will use local disk (ensure /uploads is secured).'
    );
  }

  if (process.env.JWT_SECRET === process.env.REFRESH_SECRET) {
    warn(
      'Use separate secrets for JWT_SECRET and REFRESH_SECRET when refresh signing is enabled.'
    );
  }

  // Secure authentication is the only runtime path. Production keeps the
  // canonical secret-separation and shared-Redis hard-fail requirements.
  const refreshSecret = process.env.REFRESH_SECRET;
  rejectSigningSecret('REFRESH_SECRET', refreshSecret);
  if (refreshSecret === secret) {
    console.error(
      '\n❌ FATAL: JWT_SECRET and REFRESH_SECRET must not be equal in production.\n'
    );
    process.exit(1);
  }

  if (!process.env.REDIS_URL) {
    console.error(
      '\n❌ FATAL: Set REDIS_URL in production — the secure access-token denylist requires a shared store; no process-local fallback is permitted once secure auth is active.\n'
    );
    process.exit(1);
  }

  if (process.env.OAUTH_GOOGLE_ENABLED === '1') {
    // The runtime config degrades an enabled-but-invalid Google setup to
    // "disabled" so it can never take password authentication down with it.
    // In production that silent degradation is the wrong answer: an operator
    // who set the flag expects the flow to work, so a bad configuration is
    // fatal at startup instead of quietly missing.
    const googleRequired = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
    ];
    const missingGoogle = googleRequired.filter((key) => !process.env[key]);
    if (missingGoogle.length) {
      console.error(
        `\n❌ FATAL: Google sign-in is enabled but missing configuration: ${missingGoogle.join(', ')}\n`
      );
      process.exit(1);
    }
    try {
      buildGoogleOidcConfig(process.env);
    } catch (error) {
      console.error(`\n❌ FATAL: Google sign-in configuration is invalid: ${error.message}\n`);
      process.exit(1);
    }
  }

  if (process.env.GBS_HSI_DOCUMENTS_ENABLED === '1') {
    if (process.env.VAULT_DEV_MODE === '1' || process.env.HSI_VAULT_DEV_MODE === '1') {
      console.error('\n❌ FATAL: Vault Transit dev mode is not permitted when HSI is enabled in production.\n');
      process.exit(1);
    }
    if (
      process.env.HSI_SKIP_ENCRYPTION === '1'
      || process.env.HSI_FAKE_KMS === '1'
      || process.env.HSI_ALLOW_PLAINTEXT === '1'
    ) {
      console.error('\n❌ FATAL: HSI encryption-bypass flags are not permitted in production.\n');
      process.exit(1);
    }
    const hsiRequired = [
      'CLAMAV_CLAMD_HOST',
      'HSI_MINIO_ENDPOINT',
      'HSI_MINIO_ACCESS_KEY',
      'HSI_MINIO_SECRET_KEY',
      'HSI_MINIO_QUARANTINE_BUCKET',
      'HSI_MINIO_CLEAN_BUCKET',
      'VAULT_ADDR',
      'VAULT_TOKEN',
      'VAULT_TRANSIT_KEY_NAME',
      'GBS_HSI_RETENTION_POLICY_JSON',
    ];
    const missingHsi = hsiRequired.filter((key) => !process.env[key]);
    if (missingHsi.length) {
      console.error(`\n❌ FATAL: HSI is enabled but missing configuration: ${missingHsi.join(', ')}\n`);
      process.exit(1);
    }
    if (
      isInsecureHsiCredential(process.env.HSI_MINIO_ACCESS_KEY)
      || isInsecureHsiCredential(process.env.HSI_MINIO_SECRET_KEY)
      || isInsecureHsiCredential(process.env.VAULT_TOKEN)
    ) {
      console.error('\n❌ FATAL: HSI storage/KMS credentials are placeholders or insecure test values.\n');
      process.exit(1);
    }
    if (process.env.HSI_MINIO_QUARANTINE_BUCKET === process.env.HSI_MINIO_CLEAN_BUCKET) {
      console.error('\n❌ FATAL: HSI quarantine and clean buckets must be distinct.\n');
      process.exit(1);
    }
  }
}
