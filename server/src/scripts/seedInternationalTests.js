import 'dotenv/config';
import { connectDB, disconnectDB } from '../config/db.js';
import { seedInternationalTests } from '../seed/internationalTests.js';

try {
  await connectDB();
  const result = await seedInternationalTests();
  console.log(`International Tests seed complete: ${JSON.stringify(result)}`);
  if (result.tests?.some((test) => ['existing-ineligible', 'conflict'].includes(test.status))) {
    process.exitCode = 2;
  }
} finally {
  await disconnectDB();
}
