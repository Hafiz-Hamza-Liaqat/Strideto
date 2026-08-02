const INSECURE_JWT_SECRETS = new Set([
  'change-me-in-production',
  'your-super-secret-jwt-key-change-in-production',
  'dev-only-jwt-secret-min-32-characters-long',
]);

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
}

export function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const secret = process.env.JWT_SECRET;
  if (!secret || INSECURE_JWT_SECRETS.has(secret) || secret.length < 32) {
    console.error(
      '\n❌ FATAL: Set JWT_SECRET to a random string of at least 32 characters in production.'
    );
    console.error('   Generate one: openssl rand -hex 32\n');
    process.exit(1);
  }

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
  if (
    !refreshSecret ||
    INSECURE_JWT_SECRETS.has(refreshSecret) ||
    refreshSecret.length < 32
  ) {
    console.error(
      '\n❌ FATAL: Set REFRESH_SECRET to a random string of at least 32 characters in production.'
    );
    console.error('   Generate one: openssl rand -hex 32\n');
    process.exit(1);
  }
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
