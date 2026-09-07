#!/usr/bin/env node
import fs from 'node:fs/promises';
import { discoverEmployerBoards } from '../lib/employer-board-discovery.mjs';

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

async function readRows(file) {
  const value = JSON.parse(await fs.readFile(file, 'utf8'));
  return Array.isArray(value) ? value : value.records ?? value.jobs ?? value.candidates ?? [];
}

async function main() {
  const boardsFile = arg('boards');
  const outputFile = arg('output');
  const reportFile = arg('report');
  if (!boardsFile || !outputFile || !reportFile) throw new Error('Usage: node scripts/tools/build-employer-board-discovery-cache.mjs --boards=boards.json --output=discovery.json --report=report.json [--history=a.json,b.json] [--concurrency=3] [--max-records=100] [--max-per-employer=3]');
  const boards = await readRows(boardsFile);
  const historyFiles = (arg('history', '') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const history = (await Promise.all(historyFiles.map(readRows))).flat();
  const result = await discoverEmployerBoards(boards, {
    history,
    concurrency: Number(arg('concurrency', 3)),
    timeoutMs: Number(arg('timeout', 12000)),
    userAgent: arg('user-agent', undefined),
    maxRecords: arg('max-records') == null ? undefined : Number(arg('max-records')),
    maxPerEmployer: arg('max-per-employer') == null ? undefined : Number(arg('max-per-employer')),
    sourceFamilyAllowlist: arg('source-families')?.split(',').map((value) => value.trim()).filter(Boolean),
  });
  const report = { ...result.report, boardsFile, historyFiles, generatedAt: new Date().toISOString() };
  await fs.writeFile(outputFile, `${JSON.stringify(result.records, null, 2)}\n`, 'utf8');
  await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

await main();
