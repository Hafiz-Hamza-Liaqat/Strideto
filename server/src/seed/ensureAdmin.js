import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

/**
 * Create or promote an Admin user when ADMIN_EMAIL + ADMIN_PASSWORD are set.
 * Safe to call on every boot (idempotent). Does nothing if password env is missing.
 */
export async function ensureAdminOnBoot({ logIdentity = true } = {}) {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    return { skipped: true, reason: 'ADMIN_EMAIL or ADMIN_PASSWORD not set' };
  }

  const name = (process.env.ADMIN_NAME || 'Admin User').trim() || 'Admin User';
  let user = await User.findOne({ email }).select('+password');
  if (user) {
    user.role = 'Admin';
    user.password = password;
    user.emailVerified = true;
    await user.save();
    logger.info('admin_ensured', {
      ...(logIdentity ? { email } : {}),
      action: 'updated',
    });
    return { skipped: false, action: 'updated', email };
  }

  await User.create({
    name,
    email,
    password,
    role: 'Admin',
    emailVerified: true,
  });
  logger.info('admin_ensured', {
    ...(logIdentity ? { email } : {}),
    action: 'created',
  });
  return { skipped: false, action: 'created', email };
}
