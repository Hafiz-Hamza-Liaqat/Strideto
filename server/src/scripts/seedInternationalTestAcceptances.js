import 'dotenv/config';
import { connectDB, disconnectDB } from '../config/db.js';
import { seedInternationalTestAcceptances } from '../seed/internationalTestAcceptances.js';

try {
  await connectDB();
  const result = await seedInternationalTestAcceptances();
  console.log(`International TestAcceptance seed complete: ${JSON.stringify(result)}`);
  if (!result.ok) process.exitCode = 2;
} finally {
  await disconnectDB();
}
