/**
 * Canonical production-invalid signing-secret set.
 * Includes every committed JWT_SECRET / REFRESH_SECRET placeholder literal
 * found in env examples, Docker templates, and deployment docs.
 * JwtSessionProvider must reuse this helper — do not fork a second list.
 */
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
}
