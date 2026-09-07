#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductionReadClient } from './lib/productionReadAuth.mjs';
import { compareReadback, findCanonicalMatches, validateCandidate } from './migrate-canonical-institutions-to-production.mjs';

const DEFAULT_INPUT = 'qa-artifacts/schools-colleges-pakistan-batch01a-ready.json';
const DEFAULT_REPORT = 'qa-artifacts/schools-colleges-pakistan-batch01a-final-verification.json';
const INSTITUTION_PATH = '/admin/education/institutions';

function parseArgs(argv = process.argv.slice(2)) {
  const args = { input: DEFAULT_INPUT, report: DEFAULT_REPORT, base: 'https://api.strideto.com/api' };
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'input') args.input = value;
    if (key === 'report') args.report = value;
    if (key === 'base') args.base = value.replace(/\/$/, '');
  }
  return args;
}

async function listAll(client) {
  const rows = [];
  let page = 1;
  let pages = 1;
  do {
    const body = await client.get(`${INSTITUTION_PATH}?page=${page}&limit=50`);
    rows.push(...(Array.isArray(body?.data) ? body.data : []));
    pages = Number(body?.pagination?.pages ?? body?.pages ?? 1) || 1;
    page += 1;
  } while (page <= pages);
  return rows;
}

function resultFor(candidate, matches) {
  if (matches.length === 0) {
    return {
      officialName: candidate.officialName,
      productionId: null,
      slug: candidate.slug,
      status: null,
      launchEligible: null,
      sourceCount: 0,
      matchCount: 0,
      verificationStatus: 'MISSING',
      fieldMismatches: [],
    };
  }
  if (matches.length > 1) {
    return {
      officialName: candidate.officialName,
      productionId: null,
      slug: candidate.slug,
      status: null,
      launchEligible: null,
      sourceCount: 0,
      matchCount: matches.length,
      verificationStatus: 'DUPLICATE_CANONICAL_MATCHES',
      duplicateBases: matches.map((match) => ({ basis: match.basis, productionId: String(match.existing?._id || '') })),
      fieldMismatches: [],
    };
  }
  const row = matches[0].existing;
  const comparison = compareReadback(candidate, row);
  const sourceCount = Array.isArray(row?.sources) ? row.sources.length : 0;
  const fieldMismatches = comparison.fields.filter((field) => field.classification === 'MISMATCH_REAL').map((field) => ({ field: field.field, expected: field.expected, actual: field.actual }));
  const verificationStatus = comparison.ok && row.countryCode === 'PK' && row.status === 'draft' && row.launchEligible === false && sourceCount > 0
    ? 'VERIFIED'
    : 'FIELD_MISMATCH';
  return {
    officialName: candidate.officialName,
    productionId: String(row?._id || ''),
    slug: row?.slug ?? null,
    status: row?.status ?? null,
    launchEligible: row?.launchEligible ?? null,
    sourceCount,
    matchCount: 1,
    verificationStatus,
    fieldMismatches: sourceCount > 0 ? fieldMismatches : [...fieldMismatches, { field: 'sources', expected: 'non-empty', actual: row?.sources ?? null }],
  };
}

export async function verifyBatch({ inputPath = DEFAULT_INPUT, reportPath = DEFAULT_REPORT, base = 'https://api.strideto.com/api' } = {}) {
  const input = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const candidates = Array.isArray(input) ? input : input.candidates;
  if (!Array.isArray(candidates) || candidates.length !== 9) throw new Error('Expected exactly 9 source candidates.');
  const validationErrors = candidates.flatMap((candidate, index) => validateCandidate(candidate, index));
  if (validationErrors.length) throw new Error(`Input validation failed: ${validationErrors.join('; ')}`);

  const client = await createProductionReadClient({ base, allowedPrefixes: [INSTITUTION_PATH] });
  const inventory = await listAll(client);
  const records = candidates.map((candidate) => resultFor(candidate, findCanonicalMatches(candidate, inventory)));
  const verified = records.filter((record) => record.verificationStatus === 'VERIFIED').length;
  const report = {
    generatedAt: new Date().toISOString(),
    sourceBatchFile: inputPath,
    candidateCount: candidates.length,
    foundExactlyOnce: records.filter((record) => record.matchCount === 1).length,
    verified,
    missing: records.filter((record) => record.verificationStatus === 'MISSING').length,
    duplicateCanonicalMatches: records.filter((record) => record.verificationStatus === 'DUPLICATE_CANONICAL_MATCHES').length,
    fieldMismatches: records.filter((record) => record.verificationStatus === 'FIELD_MISMATCH').length,
    draftCount: records.filter((record) => record.status === 'draft').length,
    launchEligibleFalseCount: records.filter((record) => record.launchEligible === false).length,
    sourceEvidencePresentCount: records.filter((record) => record.sourceCount > 0).length,
    failed: records.filter((record) => record.verificationStatus !== 'VERIFIED').length,
    records,
    requestSafety: {
      nonAuthWriteRequests: client.requestAudit.filter((event) => event.method !== 'GET' && event.path !== '/auth/login'),
      legacyEndpointRequests: client.requestAudit.filter((event) => event.path.includes('/admin/institutions') && !event.path.includes('/admin/education/institutions')),
      productionWrites: 0,
      updates: 0,
      deletes: 0,
      publishing: 0,
    },
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const args = parseArgs();
    const report = await verifyBatch(args);
    for (const record of report.records) {
      console.log(JSON.stringify({ officialName: record.officialName, productionId: record.productionId, slug: record.slug, status: record.status, launchEligible: record.launchEligible, sourceCount: record.sourceCount, verificationStatus: record.verificationStatus }));
    }
    console.log(JSON.stringify({
      candidateCount: report.candidateCount,
      foundExactlyOnce: report.foundExactlyOnce,
      verified: report.verified,
      missing: report.missing,
      duplicateCanonicalMatches: report.duplicateCanonicalMatches,
      fieldMismatches: report.fieldMismatches,
      draftCount: report.draftCount,
      launchEligibleFalseCount: report.launchEligibleFalseCount,
      sourceEvidencePresentCount: report.sourceEvidencePresentCount,
      failed: report.failed,
      report: args.report,
      'Production writes': 0,
      Updates: 0,
      Deletes: 0,
      Publishing: 0,
    }, null, 2));
    if (report.failed) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
