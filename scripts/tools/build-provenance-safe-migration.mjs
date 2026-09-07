#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildProvenanceSafeMigration, writeProvenanceSafeMigration } from '../lib/provenance-safe-migration-builder.mjs';

function values(name) {
  const prefix = `--${name}=`;
  return process.argv.filter((entry) => entry.startsWith(prefix)).map((entry) => entry.slice(prefix.length));
}
function arg(name, fallback = null) { return values(name)[0] ?? fallback; }
function records(value) { return Array.isArray(value) ? value : value?.records ?? value?.jobs ?? value?.candidates ?? value?.acceptedCandidates ?? []; }

async function main() {
  const sourceFiles = values('source-pool');
  const outputDir = arg('output-dir');
  const prefix = arg('prefix', 'production-migration');
  const campaignWaveText = arg('campaign-wave') ?? prefix.match(/(?:^|-)wave-(\d{3})(?:-|$)/i)?.[1];
  if (!sourceFiles.length || !outputDir || campaignWaveText == null) throw new Error('Usage: node scripts/tools/build-provenance-safe-migration.mjs --source-pool=source-a.json [--source-pool=source-b.json] --output-dir=dir --prefix=production-wave-011 [--campaign-wave=11] [--chunk-size=10]');
  const sourcePools = [];
  for (const sourcePool of sourceFiles) {
    const value = JSON.parse(await fs.readFile(sourcePool, 'utf8'));
    sourcePools.push({ sourcePool, records: records(value), lineageName: path.basename(sourcePool, path.extname(sourcePool)) });
  }
  const plan = await buildProvenanceSafeMigration(sourcePools, { prefix, campaignWave: Number(campaignWaveText), chunkSize: Number(arg('chunk-size', 10)), preparedAt: arg('prepared-at', undefined) });
  const written = await writeProvenanceSafeMigration(plan, outputDir);
  console.log(JSON.stringify({ ...plan.manifest, outputDir, manifestPath: written.manifestPath }, null, 2));
}

await main();
