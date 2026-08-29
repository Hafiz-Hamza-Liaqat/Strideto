/**
 * SEC-P1 — Migrate legacy public application resumes to MKT-P3 private storage.
 *
 * SAFETY:
 *   - Dry-run by DEFAULT (no uploads, no DB writes, no deletions).
 *   - Migration writes require explicit --execute.
 *   - Cleanup is a separate --cleanup mode; cleanup writes require --apply.
 *   - --execute and --cleanup cannot be combined.
 *   - Production mutation requires ALLOW_LEGACY_RESUME_MIGRATION=1 AND --allow-production.
 *   - Cleanup requires --from-report=<path> (report is checkpoint input, not authority).
 *   - Production without authenticated Cloudinary fails closed (no local fallback).
 *
 * Usage:
 *   node server/src/scripts/migrateLegacyApplicationResumes.js
 *   node server/src/scripts/migrateLegacyApplicationResumes.js --execute
 *   node server/src/scripts/migrateLegacyApplicationResumes.js --cleanup --from-report=%TEMP%\sec-p1.json
 *   node server/src/scripts/migrateLegacyApplicationResumes.js --cleanup --apply --from-report=%TEMP%\sec-p1.json
 *   node server/src/scripts/migrateLegacyApplicationResumes.js --execute --allow-production
 */
import 'dotenv/config';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { connectDB } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { fileURLToPath } from 'url';
import { createMigrationRunId } from '../../../shared/application/legacyResumeMigrationReport.js';
import {
  LegacyApplicationResumeMigration,
  assertMigrationExecutionAllowed,
  parseMigrationLimitArg,
  buildMigrationReportEnvelope,
  formatMigrationSummaryOutput,
} from '../services/legacyApplicationResumeMigration.js';

function parseLimitFromArgv() {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  if (!arg) return { ok: true, limit: null };
  return parseMigrationLimitArg(arg.split('=')[1]);
}

function parseReportFileArg() {
  const arg = process.argv.find((a) => a.startsWith('--report-file='));
  return arg ? arg.slice('--report-file='.length) : null;
}

function parseFromReportArg() {
  const arg = process.argv.find((a) => a.startsWith('--from-report='));
  return arg ? arg.slice('--from-report='.length) : null;
}

function assertReportOutsideRepo(reportPath) {
  const resolved = path.resolve(reportPath);
  const repoRoot = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
  const tmpRoot = path.resolve(os.tmpdir());
  if (resolved.startsWith(repoRoot + path.sep) || resolved === repoRoot) {
    return { ok: false, error: 'report_inside_repo' };
  }
  if (!resolved.startsWith(tmpRoot + path.sep) && resolved !== tmpRoot) {
    return { ok: false, error: 'report_outside_temp' };
  }
  return { ok: true, resolved };
}

async function loadCleanupReport(reportPath) {
  const raw = await fs.readFile(path.resolve(reportPath), 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const migrateExecute = process.argv.includes('--execute');
  const cleanup = process.argv.includes('--cleanup');
  const cleanupApply = process.argv.includes('--apply');
  const allowProduction = process.argv.includes('--allow-production');
  const limitParsed = parseLimitFromArgv();
  const reportFile = parseReportFileArg();
  const fromReport = parseFromReportArg();
  const migrationRunId = createMigrationRunId();

  if (!limitParsed.ok) {
    console.error(`Invalid --limit: ${limitParsed.error}`);
    process.exit(2);
  }
  const { limit } = limitParsed;

  if (migrateExecute && cleanup) {
    console.error('Refusing to combine --execute and --cleanup. Run migration first, then cleanup separately.');
    process.exit(2);
  }
  if (cleanupApply && !cleanup) {
    console.error('Refusing --apply without --cleanup.');
    process.exit(2);
  }
  if (cleanup && !fromReport) {
    console.error('Cleanup requires --from-report=<path> to a verified migration report.');
    process.exit(2);
  }

  const mutating = migrateExecute || cleanupApply;
  const guard = assertMigrationExecutionAllowed({ execute: mutating, allowProduction });
  if (!guard.ok) {
    console.error(`Migration blocked: ${guard.error}`);
    process.exit(2);
  }

  await connectDB();
  const journal = [];

  if (cleanup) {
    const reportRaw = await loadCleanupReport(fromReport);
    const reportCheck = LegacyApplicationResumeMigration.loadAndValidateCleanupReport(reportRaw);
    if (!reportCheck.ok) {
      console.error(`Cleanup report rejected: ${reportCheck.error}`);
      process.exit(2);
    }

    logger.info('legacy_resume_cleanup_start', {
      cleanupApply,
      allowProduction,
      dryRun: !cleanupApply,
      limit,
      migrationRunId: reportRaw.migrationRunId,
    });

    const result = await LegacyApplicationResumeMigration.runCleanupFromReport({
      report: reportRaw,
      apply: cleanupApply,
      allowProduction,
      limit,
      journal,
    });

    if (!result.ok) {
      console.error(`Cleanup failed: ${result.error}`);
      process.exit(2);
    }

    console.log(formatMigrationSummaryOutput(result));
    logger.info('legacy_resume_cleanup_complete', {
      mode: result.mode,
      dryRun: result.dryRun,
      summary: result.summary,
      journalCount: result.journalCount,
      migrationRunId: result.migrationRunId,
    });
    process.exit(0);
  }

  logger.info('legacy_resume_migration_start', {
    execute: migrateExecute,
    allowProduction,
    dryRun: guard.dryRun,
    limit,
    migrationRunId,
  });

  const result = await LegacyApplicationResumeMigration.runLegacyResumeMigration({
    execute: migrateExecute,
    allowProduction,
    limit,
    journal,
  });

  if (!result.ok) {
    console.error(`Migration failed: ${result.error}`);
    process.exit(2);
  }

  console.log(formatMigrationSummaryOutput(result));
  logger.info('legacy_resume_migration_complete', {
    mode: result.mode,
    dryRun: result.dryRun,
    summary: result.summary,
    ageBands: result.ageBands,
    journalCount: result.journalCount,
    migrationRunId,
  });

  if (reportFile) {
    const outside = assertReportOutsideRepo(reportFile);
    if (!outside.ok) {
      console.error(`Report file rejected: ${outside.error}`);
      process.exit(2);
    }
    const safeReport = buildMigrationReportEnvelope({
      migrationRunId,
      mode: result.mode,
      dryRun: result.dryRun,
      summary: result.summary,
      ageBands: result.ageBands,
      journal,
    });
    await fs.writeFile(outside.resolved, JSON.stringify(safeReport, null, 2), 'utf8');
    console.log(`Report written: ${outside.resolved}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || 'legacy_resume_migration_error');
  process.exit(1);
});
