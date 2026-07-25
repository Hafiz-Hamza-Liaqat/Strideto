/**
 * Ensure an admin user exists. Safe to run anytime (updates existing or creates).
 * Run from server dir: node src/scripts/ensureAdminUser.js
 *
 * Development default: admin@strideto.com / Admin1234
 * Production: ADMIN_EMAIL and ADMIN_PASSWORD are required (NODE_ENV=production).
 *
 * Example:
 *   ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD=YourSecurePass node src/scripts/ensureAdminUser.js
 *
 * On Render: set ADMIN_EMAIL + ADMIN_PASSWORD; the API will ensure admin on boot.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { ensureAdminOnBoot } from '../seed/ensureAdmin.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/edurozgaar';
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.ADMIN_PASSWORD) {
  console.error('❌ ADMIN_PASSWORD is required when NODE_ENV=production.');
  console.error('   Example: ADMIN_EMAIL=admin@yourdomain.com ADMIN_PASSWORD=YourSecurePass node src/scripts/ensureAdminUser.js');
  process.exit(1);
}

if (!isProduction && !process.env.ADMIN_EMAIL) {
  process.env.ADMIN_EMAIL = 'admin@strideto.com';
}
if (!isProduction && !process.env.ADMIN_PASSWORD) {
  process.env.ADMIN_PASSWORD = 'Admin1234';
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const result = await ensureAdminOnBoot();
  if (result.skipped) {
    console.error('Skipped:', result.reason);
    process.exit(1);
  }
  console.log(result.action === 'created' ? 'Created admin user:' : 'Updated existing user to Admin:', result.email);
  console.log('Login at /auth/login then open /admin');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
