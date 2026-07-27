/**
 * Beta content seed tests (no production DB required for most cases).
 * Run: node src/__tests__/betaContentSeed.test.js
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  validatePublicOpportunity,
  validateDemoRecord,
} from '../data/betaContent/validatePublicOpportunity.js';
import { buildDemoOpportunities } from '../data/betaContent/demoOpportunities.js';
import { buildEditorialContent } from '../data/betaContent/editorial.js';
import {
  runBetaSeed,
  insertIfMissing,
  assertNoDestructiveOps,
  DESTRUCTIVE_PATTERNS,
} from '../data/betaContent/betaSeedRunner.js';
import {
  JOB_TYPES,
  SCHOLARSHIP_LEVELS,
  FUNDING_TYPES,
  INSTITUTION_TYPES,
} from '../data/betaContent/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const future = new Date(Date.now() + 86400000 * 30);

// --- validation ---
const goodJob = {
  status: 'active',
  title: 'Verified role',
  company: 'Official Org',
  sourceUrl: 'https://example.gov.pk/jobs/1',
  deadline: future,
};
assert.strictEqual(validatePublicOpportunity(goodJob, 'job', new Date()).ok, true);

const badJob = { ...goodJob, sourceUrl: '', deadline: new Date('2020-01-01') };
assert.strictEqual(validatePublicOpportunity(badJob, 'job', new Date()).ok, false);

const demo = buildDemoOpportunities();
for (const job of demo.jobs) {
  assert.strictEqual(validateDemoRecord(job).ok, true);
  assert.strictEqual(job.status, 'draft');
  assert.ok(job.externalId.startsWith('beta-v1-'));
}

// --- enums ---
assert.ok(JOB_TYPES.includes('Government'));
assert.ok(SCHOLARSHIP_LEVELS.includes('PhD'));
assert.ok(FUNDING_TYPES.includes('Partial'));
assert.ok(INSTITUTION_TYPES.includes('college'));

// --- no destructive ops in seed sources ---
const seedScript = fs.readFileSync(path.join(__dirname, '../scripts/seedBetaContent.js'), 'utf8');
const runner = fs.readFileSync(path.join(__dirname, '../data/betaContent/betaSeedRunner.js'), 'utf8');
assertNoDestructiveOps(seedScript);
for (const p of DESTRUCTIVE_PATTERNS) {
  assert.ok(!seedScript.includes(p), `seed script must not contain ${p}`);
  assert.ok(!runner.includes(`Model.${p}`) && !runner.includes(`await ${p}`), `runner must not invoke ${p}`);
}

// --- dry-run makes no writes ---
let createCalls = 0;
const stubModel = () => ({
  findOne: async () => null,
  create: async () => {
    createCalls += 1;
  },
});

const dryResult = await runBetaSeed(
  {
    Job: stubModel(),
    Scholarship: stubModel(),
    Admission: stubModel(),
    Internship: stubModel(),
    IntlScholarship: stubModel(),
    Blog: stubModel(),
    CareerArticle: stubModel(),
    Institution: stubModel(),
    University: stubModel(),
    ForeignStudy: stubModel(),
    Webinar: stubModel(),
    Company: stubModel(),
  },
  { dryRun: true }
);
assert.strictEqual(createCalls, 0);
assert.strictEqual(dryResult.dryRun, true);
assert.ok(dryResult.stats.blogs.inserted > 0);

// --- second run skips duplicates ---
let findCount = 0;
const existingId = { _id: 'abc' };
const stubWithExisting = () => ({
  findOne: async () => {
    findCount += 1;
    return existingId;
  },
  create: async () => {
    throw new Error('should not create');
  },
});

const skipResult = await runBetaSeed(
  {
    Job: stubWithExisting(),
    Scholarship: stubWithExisting(),
    Admission: stubWithExisting(),
    Internship: stubWithExisting(),
    IntlScholarship: stubWithExisting(),
    Blog: stubWithExisting(),
    CareerArticle: stubWithExisting(),
    Institution: stubWithExisting(),
    University: stubWithExisting(),
    ForeignStudy: stubWithExisting(),
    Webinar: stubWithExisting(),
    Company: stubWithExisting(),
  },
  { dryRun: false }
);
assert.ok(findCount > 0);
for (const val of Object.values(skipResult.stats)) {
  assert.strictEqual(val.inserted, 0);
  assert.ok(val.skipped > 0);
}

// --- admin-edited / existing not overwritten ---
let created = 0;
const jobModel = {
  findOne: async () => ({ _id: 'existing' }),
  create: async () => {
    created += 1;
  },
};
const r = await insertIfMissing(jobModel, { externalId: 'beta-v1-demo' }, { title: 'x' }, false);
assert.strictEqual(r.action, 'skipped');
assert.strictEqual(created, 0);

// --- editorial published ---
const editorial = buildEditorialContent();
assert.strictEqual(editorial.blogs.length, 8);
assert.strictEqual(editorial.careerArticles.length, 8);
for (const b of editorial.blogs) {
  assert.strictEqual(b.status, 'published');
  assert.ok(b.slug.startsWith('beta-v1-'));
}

// --- logs must not echo MONGO_URI (static check) ---
assert.ok(!seedScript.includes('console.log(process.env.MONGO_URI'));
assert.ok(!seedScript.includes('console.log(MONGO_URI'));

// --- BETA_SEED_DISABLE gate (script check) ---
assert.ok(seedScript.includes("BETA_SEED_DISABLE === '1'"));

console.log('betaContentSeed tests passed.');
