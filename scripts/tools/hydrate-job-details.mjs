#!/usr/bin/env node
import fs from 'node:fs/promises';
import { hydrateJobDetails, summarizeHydration } from '../lib/job-detail-hydrator.mjs';

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const inputFile = arg('input');
  const outputFile = arg('output');
  const reportFile = arg('report');
  if (!inputFile || !outputFile || !reportFile) throw new Error('Usage: node scripts/tools/hydrate-job-details.mjs --input=... --output=... --report=... [--concurrency=3] [--timeout=12000] [--max-records=N] [--diagnostic-only]');
  const input = JSON.parse(await fs.readFile(inputFile, 'utf8'));
  const records = Array.isArray(input) ? input : input.records;
  if (!Array.isArray(records)) throw new Error('Input must be an array or an object with a records array');
  const hydrated = await hydrateJobDetails(records, {
    concurrency: Number(arg('concurrency', 3)),
    timeoutMs: Number(arg('timeout', 12000)),
    userAgent: arg('user-agent', undefined),
    maxRecords: arg('max-records') == null ? undefined : Number(arg('max-records')),
    diagnosticOnly: flag('diagnostic-only'),
    sourceFamilyAllowlist: arg('source-families')?.split(',').map((value) => value.trim()).filter(Boolean),
  });
  const report = {
    input: inputFile,
    output: outputFile,
    records: hydrated.length,
    counts: summarizeHydration(hydrated),
    generatedAt: new Date().toISOString(),
    diagnosticOnly: flag('diagnostic-only'),
  };
  await fs.writeFile(outputFile, `${JSON.stringify(hydrated, null, 2)}\n`, 'utf8');
  await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

await main();
