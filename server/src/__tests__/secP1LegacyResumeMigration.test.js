/**
 * SEC-P1 legacy application resume migration tests.
 * Run: node server/src/__tests__/secP1LegacyResumeMigration.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRIVATE_LOCAL_PREFIX,
  PRIVATE_CLOUDINARY_PREFIX,
  RESUME_STORAGE_KIND,
} from '../../../shared/application/resumeStorageDescriptor.js';
import {
  descriptorFingerprint,
  legacySourceFingerprint,
  createMigrationRunId,
  validateReportEnvironmentBinding,
} from '../../../shared/application/legacyResumeMigrationReport.js';
import {
  validateTrustedLegacyCloudinaryResumeUrl,
} from '../../../shared/application/legacyResumeMigrationUrl.js';
import { resolveLegacyPublicUploadFile } from '../../../shared/application/legacyResumePathSafety.js';
import {
  classifyResumeForMigration,
  migrateApplicationRecord,
  cleanupMigratedLegacyArtifact,
  runLegacyResumeMigration,
  runCleanupFromReport,
  assertMigrationExecutionAllowed,
  parseMigrationLimitArg,
  buildMigrationReportEnvelope,
  MIGRATION_RECORD_STATUS,
} from '../services/legacyApplicationResumeMigration.js';
import {
  resolveEmployerApplicationResumeAccess,
  resolvePrivateApplicationFile,
} from '../services/applicationResumeStorage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const testUploadsRoot = path.resolve(here, '../../uploads');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

function makeMockApplicationModel(store) {
  return {
    async updateOne(filter, update) {
      const id = String(filter._id);
      const row = store.get(id);
      if (!row) return { modifiedCount: 0 };
      if (filter.resumeURL != null && row.resumeURL !== filter.resumeURL) {
        return { modifiedCount: 0 };
      }
      if (update?.$set?.resumeURL != null) row.resumeURL = update.$set.resumeURL;
      return { modifiedCount: 1 };
    },
    find() {
      const docs = [...store.values()];
      let idx = 0;
      return {
        select() { return this; },
        cursor() {
          return {
            [Symbol.asyncIterator]() {
              return {
                async next() {
                  if (idx >= docs.length) return { done: true };
                  const value = docs[idx];
                  idx += 1;
                  return { done: false, value };
                },
              };
            },
          };
        },
      };
    },
    findById(id) {
      const row = store.get(String(id));
      const doc = row ? { _id: row._id, resumeURL: row.resumeURL } : null;
      return {
        select() { return this; },
        lean: async () => doc,
      };
    },
  };
}

function buildMigratedJournalEntry(appId, privateDescriptor, legacyKey) {
  const cleanupMeta = { type: 'legacy_local', key: legacyKey };
  return {
    applicationId: String(appId),
    opaqueId: `app_${String(appId).slice(-8)}`,
    status: MIGRATION_RECORD_STATUS.MIGRATED,
    legacyKind: RESUME_STORAGE_KIND.LEGACY_LOCAL_PUBLIC,
    cleanupEligible: true,
    cleanupMeta,
    legacySourceFingerprint: legacySourceFingerprint(cleanupMeta),
    destinationFingerprint: descriptorFingerprint(privateDescriptor),
  };
}

function buildReportFromJournal(journal) {
  return buildMigrationReportEnvelope({
    migrationRunId: createMigrationRunId(),
    mode: 'execute',
    dryRun: false,
    summary: { migrated: journal.length },
    ageBands: {},
    journal,
  });
}

// Classification
check(
  classifyResumeForMigration('http://localhost:5000/uploads/legacy.pdf') === RESUME_STORAGE_KIND.LEGACY_LOCAL_PUBLIC,
  'SEC-P1-01'
);
check(
  classifyResumeForMigration('https://res.cloudinary.com/demo/image/upload/v1/x.pdf')
    === RESUME_STORAGE_KIND.LEGACY_CLOUDINARY_PUBLIC,
  'SEC-P1-02'
);
check(classifyResumeForMigration(`${PRIVATE_LOCAL_PREFIX}x`) === RESUME_STORAGE_KIND.PRIVATE_LOCAL, 'SEC-P1-03');
check(
  classifyResumeForMigration(`${PRIVATE_CLOUDINARY_PREFIX}x`) === RESUME_STORAGE_KIND.PRIVATE_CLOUDINARY,
  'SEC-P1-04'
);
check(classifyResumeForMigration(null) === RESUME_STORAGE_KIND.MISSING, 'SEC-P1-05');
check(classifyResumeForMigration('weird') === RESUME_STORAGE_KIND.UNKNOWN, 'SEC-P1-06');

// Guards
const savedEnv = { ...process.env };
function restoreEnv() {
  process.env = { ...savedEnv };
}
process.env.NODE_ENV = 'production';
delete process.env.ALLOW_LEGACY_RESUME_MIGRATION;
check(
  assertMigrationExecutionAllowed({ execute: false }).ok,
  'SEC-P1-GUARD-01: production dry-run allowed'
);
check(
  !assertMigrationExecutionAllowed({ execute: true, allowProduction: false }).ok,
  'SEC-P1-GUARD-02: production execute without env guard fails'
);
process.env.ALLOW_LEGACY_RESUME_MIGRATION = '1';
check(
  !assertMigrationExecutionAllowed({ execute: true, allowProduction: false }).ok,
  'SEC-P1-GUARD-03: production execute without --allow-production fails'
);
check(
  !assertMigrationExecutionAllowed({ execute: true, allowProduction: true }).ok,
  'SEC-P1-GUARD-04: production cleanup apply without Cloudinary fails closed'
);
delete process.env.CLOUDINARY_CLOUD_NAME;
delete process.env.CLOUDINARY_API_KEY;
delete process.env.CLOUDINARY_API_SECRET;
check(
  !assertMigrationExecutionAllowed({ execute: true, allowProduction: true }).ok,
  'SEC-P1-GUARD-05: production apply blocked without cloudinary'
);
restoreEnv();
check(assertMigrationExecutionAllowed({ execute: false }).dryRun, 'SEC-P1-GUARD-07: default dry-run');

const badLimit = parseMigrationLimitArg('0');
check(!badLimit.ok, 'limit zero rejected');
const negLimit = parseMigrationLimitArg('-5');
check(!negLimit.ok, 'negative limit rejected');

// SSRF / traversal
check(!validateTrustedLegacyCloudinaryResumeUrl('https://evil.example/x').ok, 'SEC-P1-21');
check(!resolveLegacyPublicUploadFile('http://x/uploads/../etc/passwd', testUploadsRoot).ok, 'SEC-P1-17');

// Local E2E fixture
const safeKey = `sec-p1-${Date.now()}.pdf`;
const safeRel = `applications/${safeKey}`;
const safeAbs = path.join(testUploadsRoot, safeRel);
await fs.mkdir(path.dirname(safeAbs), { recursive: true });
await fs.writeFile(safeAbs, Buffer.from('%PDF-1.4 sec-p1-e2e'));

const unrelatedLogo = path.join(testUploadsRoot, 'logo-sec-p1.png');
await fs.writeFile(unrelatedLogo, Buffer.from('not-a-resume'));

const appId = '507f1f77bcf86cd799439011';
const legacyLocalUrl = `http://localhost:5000/uploads/${safeRel}`;
const store = new Map([[appId, { _id: appId, resumeURL: legacyLocalUrl }]]);
const mockModel = makeMockApplicationModel(store);

const dryBatch = await runLegacyResumeMigration({
  execute: false,
  deps: { ApplicationModel: mockModel },
  journal: [],
});
check(dryBatch.summary.writesPerformed === 0, 'SEC-P1-07 dry-run zero writes');
check(dryBatch.summary.deletionsPerformed === 0, 'SEC-P1-09 dry-run zero deletes');

const migrated = await migrateApplicationRecord(store.get(appId), {
  execute: true,
  deps: { uploadsRoot: testUploadsRoot, ApplicationModel: mockModel },
  journal: [],
});
check(migrated.status === MIGRATION_RECORD_STATUS.MIGRATED, 'SEC-P1-12 local migrated');
check(store.get(appId).resumeURL.startsWith(PRIVATE_LOCAL_PREFIX), 'SEC-P1-13 private descriptor');

let legacyExists = true;
try { await fs.access(safeAbs); } catch { legacyExists = false; }
check(legacyExists, 'SEC-P1-14 legacy remains after migrate');

const rerun = await migrateApplicationRecord(store.get(appId), {
  execute: true,
  deps: { uploadsRoot: testUploadsRoot, ApplicationModel: mockModel },
  journal: [],
});
check(rerun.status === MIGRATION_RECORD_STATUS.SKIPPED_ALREADY_PRIVATE, 'SEC-P1-15 rerun skips');

const privateDescriptor = store.get(appId).resumeURL;
const journalEntry = buildMigratedJournalEntry(appId, privateDescriptor, safeRel);
const report = buildReportFromJournal([journalEntry]);

// DB conflict before cleanup
const conflictId = '507f1f77bcf86cd799439030';
const conflictRel = `applications/conflict-${Date.now()}.pdf`;
const conflictAbs = path.join(testUploadsRoot, conflictRel);
await fs.writeFile(conflictAbs, Buffer.from('%PDF-1.4 conflict'));
const conflictUrl = `http://localhost:5000/uploads/${conflictRel}`;
const conflictStore = new Map([[conflictId, { _id: conflictId, resumeURL: conflictUrl }]]);
const conflictModel = makeMockApplicationModel(conflictStore);
conflictStore.get(conflictId).resumeURL = `${PRIVATE_LOCAL_PREFIX}changed`;
const conflict = await migrateApplicationRecord(
  { _id: conflictId, resumeURL: conflictUrl },
  { execute: true, deps: { uploadsRoot: testUploadsRoot, ApplicationModel: conflictModel }, journal: [] }
);
check(conflict.status === MIGRATION_RECORD_STATUS.DB_CONFLICT, 'SEC-P1-24 db conflict');
await fs.unlink(conflictAbs).catch(() => {});

// SEC-P1-CLEAN-01 valid entry + matching DB
const cleanDry = await cleanupMigratedLegacyArtifact(journalEntry, {
  apply: false,
  application: store.get(appId),
  deps: { uploadsRoot: testUploadsRoot },
});
check(cleanDry.status === MIGRATION_RECORD_STATUS.CLEANUP_ELIGIBLE, 'SEC-P1-CLEAN-01 dry eligible');

const cleanApply = await cleanupMigratedLegacyArtifact(journalEntry, {
  apply: true,
  application: store.get(appId),
  deps: { uploadsRoot: testUploadsRoot },
});
check(cleanApply.status === MIGRATION_RECORD_STATUS.CLEANUP_COMPLETED, 'SEC-P1-CLEAN-01 cleanup ok');

let legacyGone = true;
try { await fs.access(safeAbs); legacyGone = false; } catch { /* absent */ }
check(legacyGone, 'local E2E cleanup removed legacy');

const access = await resolveEmployerApplicationResumeAccess({ resumeURL: privateDescriptor });
check(access.ok, 'secure retrieval after cleanup');

// SEC-P1-CLEAN-02 failed entry
const failedEntry = { ...journalEntry, status: MIGRATION_RECORD_STATUS.FAILED_SOURCE_READ };
const failedClean = await cleanupMigratedLegacyArtifact(failedEntry, {
  apply: true,
  application: store.get(appId),
});
check(failedClean.reason === 'entry_not_migrated', 'SEC-P1-CLEAN-02 failed cannot delete');

// SEC-P1-CLEAN-03 scanned only
const scannedEntry = { ...journalEntry, status: MIGRATION_RECORD_STATUS.SCANNED };
const scannedClean = await cleanupMigratedLegacyArtifact(scannedEntry, {
  apply: true,
  application: store.get(appId),
});
check(scannedClean.reason === 'entry_not_migrated', 'SEC-P1-CLEAN-03 scanned cannot delete');

// SEC-P1-CLEAN-04 app not found
const missingAppClean = await cleanupMigratedLegacyArtifact(journalEntry, {
  apply: true,
  application: null,
});
check(missingAppClean.reason === 'application_not_found', 'SEC-P1-CLEAN-04');

// SEC-P1-CLEAN-05 DB still legacy
const legacyStore = new Map([[appId, { _id: appId, resumeURL: legacyLocalUrl }]]);
const legacyClean = await cleanupMigratedLegacyArtifact(journalEntry, {
  apply: true,
  application: legacyStore.get(appId),
});
check(legacyClean.reason === 'db_still_legacy', 'SEC-P1-CLEAN-05');

// SEC-P1-CLEAN-06 descriptor mismatch
const wrongPrivate = `${PRIVATE_LOCAL_PREFIX}other-file.pdf`;
const wrongStore = new Map([[appId, { _id: appId, resumeURL: wrongPrivate }]]);
const mismatchClean = await cleanupMigratedLegacyArtifact(journalEntry, {
  apply: true,
  application: wrongStore.get(appId),
});
check(mismatchClean.reason === 'destination_fingerprint_mismatch', 'SEC-P1-CLEAN-06');

// SEC-P1-CLEAN-07 tampered path
const tampered = {
  ...journalEntry,
  cleanupMeta: { type: 'legacy_local', key: '../logo-sec-p1.png' },
};
const tamperedClean = await cleanupMigratedLegacyArtifact(tampered, {
  apply: true,
  application: store.get(appId),
  deps: { uploadsRoot: testUploadsRoot },
});
check(
  tamperedClean.status === MIGRATION_RECORD_STATUS.CLEANUP_REFUSED,
  'SEC-P1-CLEAN-07 tampered path refused'
);

let logoStillThere = false;
try { await fs.access(unrelatedLogo); logoStillThere = true; } catch { /* */ }
check(logoStillThere, 'SEC-P1-CLEAN-08 unrelated upload preserved');

// SEC-P1-CLEAN-09 stale report version
const staleReport = { ...report, reportVersion: 999 };
const staleCleanup = await runCleanupFromReport({
  report: staleReport,
  apply: false,
  deps: { ApplicationModel: mockModel },
});
check(!staleCleanup.ok && staleCleanup.error === 'report_version_unsupported', 'SEC-P1-CLEAN-09');

// SEC-P1-CLEAN-10 already absent idempotent
const absentEntry = buildMigratedJournalEntry('507f1f77bcf86cd799439099', privateDescriptor, 'applications/missing.pdf');
const absentClean = await cleanupMigratedLegacyArtifact(absentEntry, {
  apply: true,
  application: { _id: '507f1f77bcf86cd799439099', resumeURL: privateDescriptor },
  deps: { uploadsRoot: testUploadsRoot },
});
check(absentClean.status === MIGRATION_RECORD_STATUS.CLEANUP_ALREADY_ABSENT, 'SEC-P1-CLEAN-10');

// SEC-P1-CLEAN-11 cloudinary manual
const cloudMeta = { type: 'legacy_cloudinary', cloudName: 'demo', publicId: 'applications/x' };
const cloudEntry = {
  applicationId: '507f1f77bcf86cd799439020',
  status: MIGRATION_RECORD_STATUS.MIGRATED,
  legacyKind: RESUME_STORAGE_KIND.LEGACY_CLOUDINARY_PUBLIC,
  cleanupEligible: true,
  cleanupMeta: cloudMeta,
  legacySourceFingerprint: legacySourceFingerprint(cloudMeta),
  destinationFingerprint: descriptorFingerprint(`${PRIVATE_CLOUDINARY_PREFIX}applications/x`),
};
const cloudClean = await cleanupMigratedLegacyArtifact(cloudEntry, {
  apply: true,
  application: {
    _id: cloudEntry.applicationId,
    resumeURL: `${PRIVATE_CLOUDINARY_PREFIX}applications/x`,
  },
});
check(cloudClean.status === MIGRATION_RECORD_STATUS.CLEANUP_MANUAL_REQUIRED, 'SEC-P1-CLEAN-11/12');

// Environment binding
const boundReport = buildReportFromJournal([journalEntry]);
const envMismatch = validateReportEnvironmentBinding(
  {
    ...boundReport,
    environment: {
      ...boundReport.environment,
      mongoFingerprintSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
  },
  {
    nodeEnv: boundReport.environment.nodeEnv,
    mongoFingerprintSha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  }
);
check(!envMismatch.ok && envMismatch.error === 'report_database_mismatch', 'environment binding');

// Report privacy
const reportJson = JSON.stringify(boundReport);
check(!reportJson.includes(legacyLocalUrl), 'report privacy: no legacy URL');
check(!reportJson.includes(privateDescriptor), 'report privacy: no raw descriptor');

// cleanup private artifacts
for (const row of store.values()) {
  if (row.resumeURL?.startsWith(PRIVATE_LOCAL_PREFIX)) {
    const p = resolvePrivateApplicationFile(row.resumeURL.slice(PRIVATE_LOCAL_PREFIX.length));
    if (p) await fs.unlink(p).catch(() => {});
  }
}
await fs.unlink(unrelatedLogo).catch(() => {});

console.log(`secP1LegacyResumeMigration.test.js: ${count} checks passed`);
