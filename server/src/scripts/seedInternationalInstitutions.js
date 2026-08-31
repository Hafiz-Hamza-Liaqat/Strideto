import 'dotenv/config';
import { connectDB, disconnectDB } from '../config/db.js';
import { seedInternationalInstitutions } from '../seed/internationalInstitutions.js';

try {
  await connectDB();
  const result = await seedInternationalInstitutions();
  console.log(`International institution/program seed complete: ${JSON.stringify(result)}`);
  if (!result.ok) process.exitCode = 2;
} finally {
  await disconnectDB();
}
