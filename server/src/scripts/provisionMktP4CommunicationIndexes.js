/**
 * MKT-P4 application communication index readiness.
 *
 *   node src/scripts/provisionMktP4CommunicationIndexes.js --verify
 *   STRIDETO_INDEX_PROVISION_CONFIRM=1 node src/scripts/provisionMktP4CommunicationIndexes.js --apply
 */
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import mongoose from 'mongoose';
import { CriticalIndexProvisionError } from '../services/platform/criticalIndexProvision.js';
import {
  provisionMktP4CommunicationIndexes,
  verifyMktP4CommunicationIndexes,
  APPLICATION_MESSAGE_CRITICAL_INDEXES,
  APPLICATION_INTERVIEW_INVITATION_CRITICAL_INDEXES,
} from '../services/platform/mktP4CommunicationIndexProvision.js';

export class MktP4IndexReadinessError extends CriticalIndexProvisionError {}

export function parseCliMode(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--verify')) return 'verify';
  if (args.length === 1 && args[0] === '--apply') return 'apply';
  if (args.length === 1 && args[0] === '--help') return 'help';
  throw new MktP4IndexReadinessError('INVALID_ARGUMENTS');
}

export function assertApplyConfirmation(mode, environment = process.env) {
  if (mode === 'apply' && environment.STRIDETO_INDEX_PROVISION_CONFIRM !== '1') {
    throw new MktP4IndexReadinessError('APPLY_CONFIRMATION_REQUIRED');
  }
}

export function helpText() {
  return [
    'MKT-P4 application communication index readiness',
    'Usage:',
    '  node src/scripts/provisionMktP4CommunicationIndexes.js --verify',
    '  STRIDETO_INDEX_PROVISION_CONFIRM=1 node src/scripts/provisionMktP4CommunicationIndexes.js --apply',
    'Default mode: --verify',
    '',
    'Indexes:',
    ...APPLICATION_MESSAGE_CRITICAL_INDEXES.map((i) => `  ApplicationMessage.${i.name}`),
    ...APPLICATION_INTERVIEW_INVITATION_CRITICAL_INDEXES.map((i) => `  ApplicationInterviewInvitation.${i.name}`),
  ].join('\n');
}

function comparisonLines(label, comparison) {
  const lines = [label];
  for (const index of comparison.matched) lines.push(`MATCH ${index.name}`);
  for (const index of comparison.missing) lines.push(`MISSING ${index.name}`);
  for (const { expected } of comparison.mismatched) lines.push(`MISMATCH ${expected.name}`);
  lines.push(comparison.ok ? 'STATUS READY' : 'STATUS NOT_READY');
  return lines;
}

export async function executeCliReadiness({ mode, verify, provision, output }) {
  const report = await verify();
  output(comparisonLines('ApplicationMessage', report.messages).join('\n'));
  output(comparisonLines('ApplicationInterviewInvitation', report.invitations).join('\n'));

  if (mode === 'verify') {
    return { exitCode: report.ok ? 0 : 1 };
  }

  await provision();
  const after = await verify();
  output(after.ok ? 'STATUS READY' : 'STATUS NOT_READY');
  return { exitCode: after.ok ? 0 : 1 };
}

async function main() {
  const args = process.argv.slice(2);
  const mode = parseCliMode(args);
  if (mode === 'help') {
    console.log(helpText());
    return;
  }

  assertApplyConfirmation(mode);
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri, { autoIndex: false });
  try {
    const { exitCode } = await executeCliReadiness({
      mode,
      verify: () => verifyMktP4CommunicationIndexes(),
      provision: () => provisionMktP4CommunicationIndexes(),
      output: (line) => console.log(line),
    });
    process.exit(exitCode);
  } finally {
    await mongoose.disconnect();
  }
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err?.code || err?.message || err);
    process.exit(1);
  });
}
