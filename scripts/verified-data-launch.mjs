#!/usr/bin/env node
/**
 * Verified Data Launch operational CLI (Mission 25).
 *
 *   node scripts/verified-data-launch.mjs --manifest initial-launch-pack.v1.json
 *   node scripts/verified-data-launch.mjs --manifest <file> --canonical-state <file.json>
 *   node scripts/verified-data-launch.mjs --list
 *
 * DRY RUN IS THE DEFAULT AND THE ONLY MODE IMPLEMENTED.
 *
 * A dry run:
 *   - reads the manifest from data/verified-launch/
 *   - validates provenance, authority, freshness, money, dates, bounds
 *   - plans create / no_change / update / supersede / conflict / skip_* states
 *   - emits the rollback plan and the launch quality report
 *
 * and performs ZERO persistence: no database connection is opened, no file in
 * the repository is modified, and no network request is made.
 *
 * `--apply` is deliberately NOT implemented here. The gate a future apply must
 * pass lives in server/src/services/data/verifiedLaunchGate.js and fails closed;
 * invoking --apply prints that gate's requirements and exits non-zero.
 *
 * No new npm dependency is required.
 */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = path.resolve(__dirname, '../server/src');
const loadServer = (rel) => import(pathToFileURL(path.join(serverSrc, rel)).href);

const { loadLaunchPack, listLaunchPacks, LAUNCH_PACK_ROOT, LaunchPackError } =
  await loadServer('services/data/verifiedLaunchPack.js');
const { ManifestStructureError } =
  await loadServer('services/data/verifiedLaunchManifest.js');
const { planLaunchBatch, buildRollbackPlan, buildLaunchReport, createCanonicalStateSnapshot } =
  await loadServer('services/data/verifiedLaunchPlanner.js');
const { resolveLaunchEnvironment, describeApplyAtomicity } =
  await loadServer('services/data/verifiedLaunchGate.js');

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1] ?? null;
}

function usage() {
  console.log(`
Strideto verified data launch (Mission 25)

  --manifest <file>          manifest filename inside data/verified-launch/
  --canonical-state <file>   optional canonical-state snapshot JSON (defaults to empty)
  --list                     list available launch packs
  --json                     emit the machine-readable result only
  --dry-run                  explicit dry run (this is already the default)
  --apply                    NOT AVAILABLE in Mission 25 — prints the gate and exits 1

Dry run performs zero persistence and makes no network or database call.
`.trim());
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--help') || argv.includes('-h')) {
    usage();
    return 0;
  }

  if (argv.includes('--list')) {
    const packs = listLaunchPacks();
    console.log(`launch pack root: ${LAUNCH_PACK_ROOT}`);
    if (!packs.length) console.log('(no launch packs)');
    for (const name of packs) console.log(`  ${name}`);
    return 0;
  }

  if (argv.includes('--apply')) {
    const env = resolveLaunchEnvironment();
    console.error('REFUSED: apply mode is not available in Mission 25.');
    console.error('');
    console.error('A future apply run must satisfy every one of:');
    console.error('  1. explicit --apply intent');
    console.error('  2. STRIDETO_LAUNCH_ENV declaring an approved non-production environment');
    console.error('     (NODE_ENV never authorizes an apply)');
    console.error('  3. manifest environmentIntent matching that environment');
    console.error('  4. batch review state approved_for_nonproduction');
    console.error('  5. --expected-fingerprint matching the computed manifest fingerprint');
    console.error('  6. a typed operator acknowledgement');
    console.error('  7. a server-derived Admin/SuperAdmin actor');
    console.error('');
    console.error(`  current environment gate: ${env.ok ? env.environment : env.reason}`);
    console.error(`  atomicity: ${describeApplyAtomicity().mode}`);
    return 1;
  }

  const manifestArg = argValue(argv, '--manifest');
  if (!manifestArg) {
    usage();
    console.error('\nERROR: --manifest is required.');
    return 1;
  }

  const asJson = argv.includes('--json');
  const mode = 'dry-run'; // default and only mode

  let loaded;
  try {
    loaded = loadLaunchPack(manifestArg);
  } catch (err) {
    if (err instanceof LaunchPackError || err instanceof ManifestStructureError) {
      console.error(`REFUSED [${err.code}]: ${err.message}`);
      return 1;
    }
    throw err;
  }

  const { filePath, validation } = loaded;

  let snapshot = {};
  const statePath = argValue(argv, '--canonical-state');
  if (statePath) {
    const fs = await import('fs');
    snapshot = JSON.parse(fs.readFileSync(path.resolve(statePath), 'utf8'));
  }

  const plan = planLaunchBatch(validation, createCanonicalStateSnapshot(snapshot));
  const rollback = buildRollbackPlan(plan);
  const report = buildLaunchReport(validation, plan);

  const result = {
    mode,
    persistence: 'none',
    databaseConnection: 'none',
    networkCalls: 'none',
    manifestFile: path.basename(filePath),
    batchId: plan.batchId,
    manifestVersion: plan.manifestVersion,
    manifestFingerprint: plan.manifestFingerprint,
    environmentIntent: plan.environmentIntent,
    canonicalStateSource: statePath ? 'snapshot_file' : 'empty_assumed',
    counts: plan.counts,
    validation: validation.summary,
    invalidRecords: validation.invalidRecords,
    invalidSources: validation.invalidSources,
    rollbackOperations: rollback.operations.length,
    report,
  };

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  console.log('Strideto verified data launch — DRY RUN (not applied)');
  console.log('─'.repeat(60));
  console.log(`manifest            ${path.basename(filePath)}`);
  console.log(`schema version      ${plan.manifestVersion}`);
  console.log(`batch id            ${plan.batchId}`);
  console.log(`fingerprint         ${plan.manifestFingerprint}`);
  console.log(`environment intent  ${plan.environmentIntent}`);
  console.log(`canonical state     ${result.canonicalStateSource}`);
  console.log('');
  console.log(`records             ${validation.summary.totalRecords} (valid ${validation.summary.validRecords}, invalid ${validation.summary.invalidRecords})`);
  console.log(`sources             ${validation.summary.totalSources} (valid ${validation.summary.validSources}, invalid ${validation.summary.invalidSources})`);
  console.log('');
  console.log('plan');
  for (const [state, count] of Object.entries(plan.counts)) {
    if (count > 0 || ['create', 'no_change', 'update', 'supersede', 'conflict'].includes(state)) {
      console.log(`  ${state.padEnd(24)} ${count}`);
    }
  }
  console.log('');
  console.log('distribution');
  console.log(`  source authority  ${JSON.stringify(report.bySourceAuthority)}`);
  console.log(`  freshness         ${JSON.stringify(report.byFreshness)}`);
  console.log(`  country           ${JSON.stringify(report.byCountry)}`);
  console.log('');
  console.log(`rollback operations ${rollback.operations.length} (hard deletes ${rollback.hardDeletes})`);
  console.log(`absent from manifest ${plan.absentFromManifest.length} (retained, never deleted)`);

  if (validation.invalidRecords.length) {
    console.log('');
    console.log('invalid records');
    for (const bad of validation.invalidRecords) {
      const reasons = bad.errors.map((e) => `${e.field}=${e.reason}`).join(', ');
      console.log(`  ${bad.recordKey ?? `#${bad.index}`} [${bad.entityType ?? 'unknown'}]: ${reasons}`);
    }
  }

  console.log('');
  console.log('Dry run only. Nothing was applied. No production or staging data was touched.');
  return 0;
}

const code = await main();
process.exit(code);
