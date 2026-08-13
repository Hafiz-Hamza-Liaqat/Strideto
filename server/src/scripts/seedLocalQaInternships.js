/**
 * Local/QA disposable internship samples for USER manual testing.
 * Explicitly classified as fixtures so public launch projection never includes them.
 *
 * Refuses production, staging, and PUBLIC_LAUNCH_PROJECTION.
 * Run locally only: node src/scripts/seedLocalQaInternships.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Internship } from '../models/Internship.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/edurozgaar';

function refuseIfLaunchSurface() {
  if (process.env.PUBLIC_LAUNCH_PROJECTION === '1') {
    throw new Error('Refusing QA internship seed: PUBLIC_LAUNCH_PROJECTION=1');
  }
  if (process.env.APP_ENV === 'staging' || process.env.APP_ENV === 'production') {
    throw new Error(`Refusing QA internship seed: APP_ENV=${process.env.APP_ENV}`);
  }
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LOCAL_QA_SEED !== '1') {
    throw new Error('Refusing QA internship seed in NODE_ENV=production');
  }
}

const FIXTURE = {
  isFixture: true,
  dataClass: 'qa',
  environment: 'local',
  launchEligible: false,
  demoOnly: true,
  status: 'active',
};

const SAMPLES = [
  {
    title: '[QA] USA internal software internship',
    slug: 'qa-usa-internal-software-internship',
    organization: 'QA North America Labs',
    countryCode: 'US',
    region: 'California',
    city: 'San Francisco',
    workMode: 'hybrid',
    field: 'computing',
    specialization: 'software',
    applyMethod: 'internal',
    isPaid: true,
    duration: '12 weeks',
    description: 'Disposable local QA sample. USA internal internship.',
  },
  {
    title: '[QA] Germany external traineeship',
    slug: 'qa-germany-external-traineeship',
    organization: 'QA Berlin Training GmbH',
    countryCode: 'DE',
    region: 'Berlin',
    city: 'Berlin',
    workMode: 'on_site',
    field: 'engineering',
    specialization: 'mechanical',
    applyMethod: 'external',
    applicationLink: 'https://example.test/qa-de-traineeship',
    isPaid: true,
    duration: '6 months',
    description: 'Disposable local QA sample. Germany external traineeship.',
  },
  {
    title: '[QA] UK apprenticeship',
    slug: 'qa-uk-apprenticeship',
    organization: 'QA London Apprentice Co',
    countryCode: 'GB',
    region: 'England',
    city: 'London',
    workMode: 'hybrid',
    field: 'business',
    specialization: 'operations',
    applyMethod: 'external',
    internshipType: 'apprenticeship',
    isPaid: true,
    duration: '12 months',
    description: 'Disposable local QA sample. UK apprenticeship.',
  },
  {
    title: '[QA] Pakistan graduate program',
    slug: 'qa-pakistan-graduate-program',
    organization: 'QA Karachi Graduate Track',
    countryCode: 'PK',
    region: 'Sindh',
    city: 'Karachi',
    workMode: 'on_site',
    field: 'business',
    specialization: 'graduate',
    applyMethod: 'internal',
    isPaid: true,
    duration: '18 months',
    description: 'Disposable local QA sample. Pakistan graduate program.',
  },
  {
    title: '[QA] Remote internship',
    slug: 'qa-remote-internship',
    organization: 'QA Remote Studio',
    countryCode: 'CA',
    region: 'Ontario',
    city: 'Toronto',
    workMode: 'remote',
    field: 'design',
    specialization: 'product',
    applyMethod: 'internal',
    isPaid: true,
    duration: '10 weeks',
    description: 'Disposable local QA sample. Remote internship.',
  },
  {
    title: '[QA] Paid internship',
    slug: 'qa-paid-internship',
    organization: 'QA Paid Cohort',
    countryCode: 'AU',
    region: 'New South Wales',
    city: 'Sydney',
    workMode: 'hybrid',
    field: 'computing',
    applyMethod: 'internal',
    isPaid: true,
    duration: '8 weeks',
    description: 'Disposable local QA sample. Paid internship.',
  },
  {
    title: '[QA] Compensation unknown internship',
    slug: 'qa-compensation-unknown-internship',
    organization: 'QA Unknown Pay Org',
    countryCode: 'US',
    region: 'New York',
    city: 'New York',
    workMode: 'on_site',
    field: 'research',
    applyMethod: 'external',
    isPaid: false,
    compensationUnknown: true,
    duration: '3 months',
    description: 'Disposable local QA sample. Compensation unknown.',
  },
];

async function run() {
  refuseIfLaunchSurface();
  await mongoose.connect(MONGO_URI);
  let upserted = 0;
  for (const sample of SAMPLES) {
    await Internship.findOneAndUpdate(
      { slug: sample.slug },
      { $set: { ...sample, ...FIXTURE } },
      { upsert: true, new: true }
    );
    upserted += 1;
  }
  console.log(`seedLocalQaInternships: upserted ${upserted} disposable QA internships (isFixture=true, launchEligible=false)`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
