/**
 * @deprecated Use: node src/scripts/remediateProductionOpportunityTrust.js --audit-target
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { Internship } from '../models/Internship.js';
import { IntlScholarship } from '../models/IntlScholarship.js';
import { buildTargetManifestsFromDatasets } from '../data/remediation/productionTrustManifestBuilder.js';
import { writeTargetManifests } from '../data/remediation/targetManifestStore.js';
import { publicMongoTargetSummary, resolveMongoTarget } from '../utils/mongoTargetGuard.js';

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }
  const target = resolveMongoTarget();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const [jobs, scholarships, admissions, internships, intlScholarships] = await Promise.all([
    Job.find({}).lean(),
    Scholarship.find({}).lean(),
    Admission.find({}).lean(),
    Internship.find({}).lean(),
    IntlScholarship.find({}).lean(),
  ]);
  const built = buildTargetManifestsFromDatasets({ jobs, scholarships, admissions, internships, intlScholarships });
  const { summary } = writeTargetManifests(target.fingerprintSha256, built);
  console.log(JSON.stringify({ mongoTarget: publicMongoTargetSummary(target), summary }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
