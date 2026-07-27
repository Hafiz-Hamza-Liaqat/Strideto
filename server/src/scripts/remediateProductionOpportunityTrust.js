/**
 * Production opportunity trust remediation (target-safe).
 *
 * Target manifests: server/.remediation-targets/<fingerprint>/
 *
 * --audit-target
 * --dry-run-target-safe --expected-fingerprint <sha256>
 * --apply-target-safe --expected-fingerprint <sha256> --confirm-production-target
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { Internship } from '../models/Internship.js';
import { IntlScholarship } from '../models/IntlScholarship.js';
import {
  buildTrustAuditReport,
  evaluateTrustedContentGate,
  formatRemediationSummary,
  reviewBetaSeedPayload,
} from '../data/opportunityTrustRemediation.js';
import {
  applyManifestEntries,
  buildRollbackManifest,
  buildRollbackOperations,
  manifestSummary,
  assertManifestDisjoint,
} from '../data/remediation/productionTrustRemediationStaged.js';
import { buildTargetManifestsFromDatasets } from '../data/remediation/productionTrustManifestBuilder.js';
import {
  writeTargetManifests,
  loadSafeNowManifest,
  assertManifestNotStale,
  markDryRunCompleted,
  assertFreshDryRun,
} from '../data/remediation/targetManifestStore.js';
import { verifySafeNowManifestEntries, verifySafeNowPostApply } from '../data/remediation/targetManifestVerify.js';
import {
  assertProductionMutationTarget,
  publicMongoTargetSummary,
  resolveMongoTarget,
} from '../utils/mongoTargetGuard.js';
import { verifiedPublicOpportunities } from '../data/betaContent/verifiedPublic.opportunities.js';
import { buildDemoOpportunities } from '../data/betaContent/demoOpportunities.js';
import { buildEditorialContent } from '../data/betaContent/editorial.js';
import { buildReferenceContent } from '../data/betaContent/referenceContent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROLLBACK_DIR = path.join(__dirname, '../../.remediation-rollbacks');

function getArgValue(argv, flag) {
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  return argv[i + 1] ?? null;
}

function parseArgs(argv) {
  return {
    auditTarget: argv.includes('--audit-target'),
    dryRunTargetSafe: argv.includes('--dry-run-target-safe'),
    applyTargetSafe: argv.includes('--apply-target-safe'),
    expectedFingerprint: getArgValue(argv, '--expected-fingerprint'),
    confirmProductionTarget: argv.includes('--confirm-production-target'),
    dryRunSafe: argv.includes('--dry-run-safe'),
    applySafe: argv.includes('--apply-safe'),
    dryRunDeferred: argv.includes('--dry-run-deferred'),
    applyDeferred: argv.includes('--apply-deferred'),
    confirmDeferred: argv.includes('--confirm-deferred-production-remediation'),
    legacyDryRun: argv.includes('--dry-run'),
    legacyApply: argv.includes('--apply'),
  };
}

function requireMongoUri() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Refusing to connect.');
    process.exit(1);
  }
}

function resolveMode(args) {
  const modes = [
    args.auditTarget && 'audit-target',
    args.dryRunTargetSafe && 'dry-run-target-safe',
    args.applyTargetSafe && 'apply-target-safe',
    args.dryRunSafe && 'dry-run-safe',
    args.applySafe && 'apply-safe',
    args.dryRunDeferred && 'dry-run-deferred',
    args.applyDeferred && 'apply-deferred',
    args.legacyDryRun && 'dry-run-legacy',
    args.legacyApply && 'apply-legacy',
  ].filter(Boolean);
  if (modes.length > 1) {
    console.error('Only one remediation mode flag may be used at a time.');
    process.exit(1);
  }
  return modes[0] || 'report';
}

function rejectLegacyCommittedManifestModes(mode) {
  if (mode === 'dry-run-safe' || mode === 'apply-safe' || mode === 'dry-run-deferred' || mode === 'apply-deferred') {
    console.error(JSON.stringify({
      error: 'legacy_manifest_modes_disabled',
      message: 'Committed ObjectId manifests were removed in E.1D. Use --audit-target and --dry-run-target-safe with --expected-fingerprint.',
      mode,
    }, null, 2));
    process.exit(1);
  }
}

async function loadDatasets() {
  const fields = {
    jobs: '_id externalId slug status title company organization location province city category type jobType applyType applicationLink applyEmail description requirements sourceUrl sourceWebsite deadline expiresAt approvalStatus updatedAt',
    scholarships: '_id slug status title provider country university description eligibility link deadline sourceUrl updatedAt',
    admissions: '_id slug status program institution university province city session deadline lastDate applyLink link source sourceUrl eligibility description updatedAt',
    internships: '_id slug status title organization location province city applicationLink description eligibility internshipType deadline updatedAt',
    intlScholarships: '_id slug status title country university provider link deadline applicationDeadline description eligibility degreeLevel fundingType updatedAt',
  };
  const [jobs, scholarships, admissions, internships, intlScholarships] = await Promise.all([
    Job.find({}, fields.jobs).lean(),
    Scholarship.find({}, fields.scholarships).lean(),
    Admission.find({}, fields.admissions).lean(),
    Internship.find({}, fields.internships).lean(),
    IntlScholarship.find({}, fields.intlScholarships).lean(),
  ]);
  return { jobs, scholarships, admissions, internships, intlScholarships };
}

function verifiedPublicDeficits() {
  const minimums = {
    jobs: 10,
    scholarships: 8,
    admissions: 6,
    internships: 4,
    intlScholarships: 4,
  };
  const current = {
    jobs: verifiedPublicOpportunities.jobs.length,
    scholarships: verifiedPublicOpportunities.scholarships.length,
    admissions: verifiedPublicOpportunities.admissions.length,
    internships: verifiedPublicOpportunities.internships.length,
    intlScholarships: verifiedPublicOpportunities.intlScholarships.length,
  };
  const deficits = {};
  for (const [key, min] of Object.entries(minimums)) {
    if (current[key] < min) {
      deficits[key] = { required: min, inVerifiedPublicFile: current[key], shortfall: min - current[key] };
    }
  }
  return { current, minimums, deficits, readyForDeferredGateViaSeedFile: Object.keys(deficits).length === 0 };
}

function writeRollbackArtifact(prefix, rollbackManifest, fingerprintSha256) {
  fs.mkdirSync(ROLLBACK_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(ROLLBACK_DIR, `${prefix}-${fingerprintSha256.slice(0, 12)}-${ts}.json`);
  const payload = {
    fingerprintSha256,
    rollbackManifest,
    rollbackOperations: buildRollbackOperations(rollbackManifest),
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

function safeConsolePayload(payload) {
  const text = JSON.stringify(payload, null, 2);
  if (/mongodb(\+srv)?:\/\//i.test(text)) {
    throw new Error('refusing to log content that may contain Mongo URI');
  }
  return text;
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = resolveMode(args);
  rejectLegacyCommittedManifestModes(mode);

  if (args.applyTargetSafe && !args.confirmProductionTarget) {
    console.error('--apply-target-safe requires --confirm-production-target');
    process.exit(1);
  }

  requireMongoUri();
  const targetPreview = resolveMongoTarget();
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });

  const models = { Job, Scholarship, Admission, Internship, IntlScholarship };
  const datasets = await loadDatasets();
  const audit = buildTrustAuditReport(datasets);
  const trustedGate = evaluateTrustedContentGate(audit.classified);
  const verifiedPublicReadiness = verifiedPublicDeficits();

  const payload = {
    mode,
    mongoTarget: publicMongoTargetSummary(targetPreview),
  };

  if (mode === 'report') {
    payload.summary = formatRemediationSummary(audit);
    payload.trustedContentGate = trustedGate;
    payload.verifiedPublicSeedFile = verifiedPublicReadiness;
    payload.betaSeedReview = reviewBetaSeedPayload({
      demo: buildDemoOpportunities(),
      editorial: buildEditorialContent(),
      reference: buildReferenceContent(),
    }).safeToRun;
    payload.note = 'Run --audit-target on the intended MongoDB target (e.g. Render Shell) to generate fingerprint-scoped manifests.';
  }

  if (mode === 'audit-target') {
    if (!targetPreview.ok) {
      console.error(JSON.stringify({ error: targetPreview.error }, null, 2));
      process.exit(1);
    }
    const built = buildTargetManifestsFromDatasets(datasets);
    assertManifestDisjoint(built.safeNow, built.deferred, built.manualReview);
    const { dir, summary } = writeTargetManifests(targetPreview.fingerprintSha256, built);
    payload.targetManifestDir = dir;
    payload.targetSummary = summary;
    payload.safeNowPreview = built.safeNow.map((r) => ({
      collection: r.collection,
      title: r.title,
      slug: r.slug,
      externalId: r.externalId,
      originalStatus: r.originalStatus,
      proposedStatus: r.proposedStatus,
      reason: r.reason,
    }));
  }

  if (mode === 'dry-run-target-safe') {
    try {
      assertProductionMutationTarget({ expectedFingerprint: args.expectedFingerprint, allowLocal: false });
    } catch (e) {
      console.error(JSON.stringify({ error: e.code || 'guard_failed', message: e.message }, null, 2));
      process.exit(1);
    }
    const { summary, entries } = loadSafeNowManifest(args.expectedFingerprint);
    assertManifestNotStale(summary);
    const verification = await verifySafeNowManifestEntries(models, entries);
    if (!verification.ok) {
      console.error(JSON.stringify({ error: 'target_verification_failed', issues: verification.issues }, null, 2));
      process.exit(1);
    }
    markDryRunCompleted(args.expectedFingerprint);
    payload.wouldApply = manifestSummary(entries);
    payload.verification = { ok: true, targetCount: entries.length };
    payload.note = 'Zero writes. Dry-run stamp recorded for apply window.';
  }

  if (mode === 'apply-target-safe') {
    try {
      assertProductionMutationTarget({ expectedFingerprint: args.expectedFingerprint, allowLocal: false });
    } catch (e) {
      console.error(JSON.stringify({ error: e.code || 'guard_failed', message: e.message }, null, 2));
      process.exit(1);
    }
    const { summary, entries } = loadSafeNowManifest(args.expectedFingerprint);
    assertManifestNotStale(summary);
    assertFreshDryRun(summary);
    const preVerify = await verifySafeNowManifestEntries(models, entries);
    if (!preVerify.ok) {
      console.error(JSON.stringify({ error: 'target_verification_failed', issues: preVerify.issues }, null, 2));
      process.exit(1);
    }
    const executedAt = new Date().toISOString();
    const rollbackManifest = buildRollbackManifest(entries, executedAt);
    const rollbackPath = writeRollbackArtifact('target-safe', rollbackManifest, args.expectedFingerprint);
    const applied = await applyManifestEntries(models, entries, { strict: true });
    const postVerify = await verifySafeNowPostApply(models, entries);
    payload.rollbackArtifact = rollbackPath;
    payload.applied = {
      drafted: applied.drafted,
      closed: applied.closed,
      unchanged: applied.unchanged,
      details: applied.details,
      failures: applied.failures,
    };
    payload.postApplyStatusCheck = postVerify;
    if (applied.failures.length > 0) {
      console.error(safeConsolePayload(payload));
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  if (mode === 'dry-run-legacy' || mode === 'apply-legacy') {
    payload.legacyWarning = 'Use --audit-target and target-safe modes.';
    payload.summary = formatRemediationSummary(audit);
  }

  console.log(safeConsolePayload(payload));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
