/**
 * Production-safe beta content seed (insert-only).
 * Run: npm run seed:beta -- --dry-run
 * Production insert: npm run seed:beta -- --expected-fingerprint <sha256> --confirm-production-target
 * Disable: BETA_SEED_DISABLE=1
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { Internship } from '../models/Internship.js';
import { IntlScholarship } from '../models/IntlScholarship.js';
import { Blog } from '../models/Blog.js';
import { CareerArticle } from '../models/CareerArticle.js';
import { Institution } from '../models/Institution.js';
import { University } from '../models/University.js';
import { ForeignStudy } from '../models/ForeignStudy.js';
import { Webinar } from '../models/Webinar.js';
import { Company } from '../models/Company.js';
import { runBetaSeed, assertNoDestructiveOps } from '../data/betaContent/betaSeedRunner.js';
import {
  assertProductionMutationTarget,
  publicMongoTargetSummary,
  resolveMongoTarget,
} from '../utils/mongoTargetGuard.js';
import { loadTargetSummary } from '../data/remediation/targetManifestStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getArgValue(argv, flag) {
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  return argv[i + 1] ?? null;
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    expectedFingerprint: getArgValue(argv, '--expected-fingerprint'),
    confirmProductionTarget: argv.includes('--confirm-production-target'),
  };
}

function logStats(stats) {
  for (const [key, val] of Object.entries(stats)) {
    if (!val) continue;
    console.log(`${key}: inserted=${val.inserted} skipped=${val.skipped} rejected=${val.rejected || 0}`);
  }
}

async function main() {
  if (process.env.BETA_SEED_DISABLE === '1') {
    console.log('BETA_SEED_DISABLE=1 — seed aborted (fail closed).');
    process.exit(0);
  }

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Refusing to connect.');
    process.exit(1);
  }

  const { dryRun, expectedFingerprint, confirmProductionTarget } = parseArgs(process.argv);
  const target = resolveMongoTarget();
  console.log(JSON.stringify({ mongoTarget: publicMongoTargetSummary(target) }));

  if (!dryRun) {
    if (!confirmProductionTarget) {
      console.error('Real seed requires --confirm-production-target');
      process.exit(1);
    }
    try {
      assertProductionMutationTarget({ expectedFingerprint, allowLocal: false });
      loadTargetSummary(expectedFingerprint);
    } catch (e) {
      console.error(JSON.stringify({ error: e.code || 'guard_failed', message: e.message }, null, 2));
      process.exit(1);
    }
  }

  const self = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  assertNoDestructiveOps(self);

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });

  const result = await runBetaSeed(
    {
      Job,
      Scholarship,
      Admission,
      Internship,
      IntlScholarship,
      Blog,
      CareerArticle,
      Institution,
      University,
      ForeignStudy,
      Webinar,
      Company,
    },
    { dryRun }
  );

  console.log(`beta seed complete dryRun=${result.dryRun}`);
  logStats(result.stats);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
