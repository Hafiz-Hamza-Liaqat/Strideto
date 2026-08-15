/**
 * Critical GBS/idempotency index readiness.
 *
 * Verification is the default. Apply requires STRIDETO_INDEX_PROVISION_CONFIRM=1.
 * Never drops, replaces, or syncs indexes.
 */
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import mongoose from 'mongoose';
import { GbsServiceRequest } from '../models/gbs/GbsServiceRequest.js';
import { IdempotencyRecord } from '../models/platform/IdempotencyRecord.js';
import {
  CriticalIndexProvisionError,
  GBS_SERVICE_REQUEST_CRITICAL_INDEXES,
  IDEMPOTENCY_RECORD_CRITICAL_INDEXES,
  compareCriticalIndexes,
  inspectIndexesSafely,
  provisionCriticalIdempotencyIndexes,
} from '../services/platform/criticalIndexProvision.js';

export class IndexReadinessError extends CriticalIndexProvisionError {}

export function parseCliMode(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--verify')) return 'verify';
  if (args.length === 1 && args[0] === '--apply') return 'apply';
  if (args.length === 1 && args[0] === '--help') return 'help';
  throw new IndexReadinessError('INVALID_ARGUMENTS');
}

export function assertApplyConfirmation(mode, environment = process.env) {
  if (mode === 'apply' && environment.STRIDETO_INDEX_PROVISION_CONFIRM !== '1') {
    throw new IndexReadinessError('APPLY_CONFIRMATION_REQUIRED');
  }
}

export function helpText() {
  return [
    'Critical GBS / idempotency index readiness',
    'Usage:',
    '  node src/scripts/provisionCriticalIdempotencyIndexes.js --verify',
    '  STRIDETO_INDEX_PROVISION_CONFIRM=1 node src/scripts/provisionCriticalIdempotencyIndexes.js --apply',
    'Default mode: --verify',
  ].join('\n');
}

function comparisonLines(label, comparison) {
  const lines = [`${label}`];
  for (const index of comparison.matched) lines.push(`MATCH ${index.name}`);
  for (const index of comparison.missing) lines.push(`MISSING ${index.name}`);
  for (const { expected } of comparison.mismatched) lines.push(`MISMATCH ${expected.name}`);
  lines.push(comparison.ok ? 'STATUS READY' : 'STATUS NOT_READY');
  return lines;
}

export async function executeCliReadiness({
  mode,
  inspectServiceRequest,
  inspectIdempotency,
  provision,
  output,
}) {
  const requestInspection = await inspectServiceRequest();
  const requestComparison = compareCriticalIndexes(
    GBS_SERVICE_REQUEST_CRITICAL_INDEXES,
    requestInspection.indexes
  );
  output(comparisonLines('GbsServiceRequest', requestComparison).join('\n'));

  const idemInspection = await inspectIdempotency();
  const idemComparison = compareCriticalIndexes(
    IDEMPOTENCY_RECORD_CRITICAL_INDEXES,
    idemInspection.indexes
  );
  output(comparisonLines('IdempotencyRecord', idemComparison).join('\n'));

  if (mode === 'verify') {
    return { exitCode: requestComparison.ok && idemComparison.ok ? 0 : 1 };
  }

  const result = await provision();
  output(comparisonLines('GbsServiceRequest', result.serviceRequest.comparison).join('\n'));
  output(comparisonLines('IdempotencyRecord', result.idempotency.comparison).join('\n'));
  return { exitCode: 0 };
}

export async function runCli({
  args = process.argv.slice(2),
  environment = process.env,
  output = console.log,
  errorOutput = console.error,
} = {}) {
  let connected = false;
  try {
    const mode = parseCliMode(args);
    if (mode === 'help') {
      output(helpText());
      return 0;
    }
    assertApplyConfirmation(mode, environment);
    if (!environment.MONGO_URI) throw new IndexReadinessError('MONGO_URI_REQUIRED');

    await mongoose.connect(environment.MONGO_URI, { autoIndex: false });
    connected = true;
    const result = await executeCliReadiness({
      mode,
      inspectServiceRequest: () => inspectIndexesSafely(() => GbsServiceRequest.collection.indexes()),
      inspectIdempotency: () => inspectIndexesSafely(() => IdempotencyRecord.collection.indexes()),
      provision: () => provisionCriticalIdempotencyIndexes(),
      output,
    });
    return result.exitCode;
  } catch (error) {
    const code = error instanceof CriticalIndexProvisionError
      ? error.code
      : 'INDEX_READINESS_OPERATION_FAILED';
    errorOutput(`ERROR ${code}`);
    return 1;
  } finally {
    if (connected) await mongoose.disconnect().catch(() => undefined);
  }
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  const exitCode = await runCli();
  process.exitCode = exitCode;
}
