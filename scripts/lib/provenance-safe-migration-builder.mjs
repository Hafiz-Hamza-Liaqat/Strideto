import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_CHUNK_SIZE = 10;
const JOB_TYPES = new Set(['Government', 'Private', 'Internship']);
const REQUIRED_FIELDS = ['externalId', 'sourceUrl', 'title', 'company'];

function jsonRecords(value) {
  if (Array.isArray(value)) return value;
  return value?.records ?? value?.jobs ?? value?.candidates ?? value?.acceptedCandidates ?? [];
}

function identityValues(record) {
  return {
    externalId: record?.externalId == null ? '' : String(record.externalId),
    sourceUrl: String(record?.sourceUrl ?? ''),
    applicationLink: String(record?.applicationLink ?? ''),
    slug: String(record?.slug ?? record?.seoSlug ?? ''),
  };
}

function recordIdentity(record) {
  const values = identityValues(record);
  return values.externalId || values.sourceUrl || values.applicationLink || values.slug || JSON.stringify(record);
}

function identityKeys(record) {
  const values = identityValues(record);
  return Object.entries(values).filter(([, value]) => value).map(([key, value]) => `${key}:${value}`);
}

function sameIdentity(a, b) {
  const left = identityValues(a);
  const right = identityValues(b);
  return (left.externalId && left.externalId === right.externalId)
    || (left.sourceUrl && left.sourceUrl === right.sourceUrl)
    || (left.applicationLink && left.applicationLink === right.applicationLink)
    || (left.slug && left.slug === right.slug)
    || JSON.stringify(a) === JSON.stringify(b);
}

async function hashBytes(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
async function hashFile(sourcePool, readFile = fs.readFile) { return hashBytes(await readFile(sourcePool)); }
function lineageName(source, index) { return String(source.lineageName ?? path.basename(source.sourcePool ?? `lineage-${index + 1}`, path.extname(source.sourcePool ?? ''))).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || `lineage-${index + 1}`; }
function chunkArray(records, size) { const chunks = []; for (let i = 0; i < records.length; i += size) chunks.push(records.slice(i, i + size)); return chunks; }

export function validateChunkSize(value = MAX_CHUNK_SIZE) {
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1 || size > MAX_CHUNK_SIZE) throw new TypeError(`chunkSize must be an integer between 1 and ${MAX_CHUNK_SIZE}`);
  return size;
}

export function validateCandidate(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['record must be an object'];
  for (const field of REQUIRED_FIELDS) if (!record[field]) errors.push(`missing ${field}`);
  if (record.productionDuplicateStatus !== 'UNVERIFIED') errors.push('productionDuplicateStatus must be UNVERIFIED');
  if (record.status !== 'draft') errors.push('status must be draft');
  if (record.approvalStatus !== 'pending') errors.push('approvalStatus must be pending');
  if (record.launchEligible !== false) errors.push('launchEligible must be false');
  if (record.jobType != null && record.jobType !== '' && !JOB_TYPES.has(record.jobType)) errors.push(`unsupported jobType: ${record.jobType}`);
  return errors;
}

export function candidateBelongsToSource(candidate, sourceRecords) {
  return sourceRecords.some((sourceRecord) => sameIdentity(candidate, sourceRecord));
}

export async function buildProvenanceSafeMigration(sourcePools, options = {}) {
  const pools = Array.isArray(sourcePools) ? sourcePools : [];
  const chunkSize = validateChunkSize(options.chunkSize ?? MAX_CHUNK_SIZE);
  const prefix = String(options.prefix ?? 'production-migration').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const campaignWave = Number(options.campaignWave);
  if (!Number.isInteger(campaignWave) || campaignWave < 0) throw new TypeError('campaignWave must be an explicit non-negative integer');
  const preparedAt = options.preparedAt ?? new Date().toISOString();
  const readFile = options.readFile ?? fs.readFile;
  const prepared = [];
  const allInputRecords = [];
  const seen = new Map();
  const lineageManifests = [];
  for (let index = 0; index < pools.length; index += 1) {
    const source = pools[index];
    if (!source?.sourcePool) throw new Error(`source pool ${index + 1} is missing sourcePool`);
    const sourceRecords = Array.isArray(source.records) ? source.records : jsonRecords(source.records);
    const membershipRecords = Array.isArray(source.sourceRecords) ? source.sourceRecords : sourceRecords;
    if (!Array.isArray(sourceRecords) || !Array.isArray(membershipRecords)) throw new Error(`source pool ${source.sourcePool} does not contain records`);
    const sourcePoolHash = await hashFile(source.sourcePool, readFile);
    const name = lineageName(source, index);
    const lineageRecords = [];
    for (const record of sourceRecords) {
      const errors = validateCandidate(record);
      if (errors.length) throw new Error(`Invalid candidate ${record?.externalId ?? '<unknown>'} in ${source.sourcePool}: ${errors.join('; ')}`);
      const identity = recordIdentity(record);
      const duplicateKey = identityKeys(record).find((key) => seen.has(key));
      if (duplicateKey) throw new Error(`Duplicate candidate identity across prepared sources: ${duplicateKey}`);
      for (const key of identityKeys(record)) seen.set(key, source.sourcePool);
      if (!candidateBelongsToSource(record, membershipRecords)) throw new Error(`Candidate ${identity} is outside declared source pool ${source.sourcePool}`);
      lineageRecords.push(record);
      allInputRecords.push({ record, sourcePool: source.sourcePool, lineage: name });
    }
    const chunks = chunkArray(lineageRecords, chunkSize);
    const batchPlans = chunks.map((records, chunkIndex) => ({
      records,
      lineage: name,
      batchNumber: prepared.length + chunkIndex + 1,
      chunkIndex: chunkIndex + 1,
      batchName: `${prefix}-${name}-chunk-${String(chunkIndex + 1).padStart(2, '0')}`,
      sourcePool: source.sourcePool,
      sourcePoolHash,
      report: {
        campaignWave,
        sourcePool: source.sourcePool,
        sourcePoolHash,
        preparedAt,
        batchNumber: prepared.length + chunkIndex + 1,
        batchCount: records.length,
        candidateIds: records.map((record) => String(record.externalId)),
        provenanceContract: 'single declared sourcePool per runner batch',
        recordsOutsideProvenance: 0,
        provenance: 'PASS',
      },
    }));
    prepared.push(...batchPlans);
    lineageManifests.push({ lineage: name, sourcePool: source.sourcePool, sourcePoolHash, inputCount: lineageRecords.length, chunkCounts: chunks.map((chunk) => chunk.length) });
  }
  const flattened = prepared.flatMap((batch) => batch.records);
  const inputIdentities = allInputRecords.map(({ record }) => recordIdentity(record));
  const outputIdentities = flattened.map(recordIdentity);
  const duplicateSet = outputIdentities.filter((identity, index) => outputIdentities.indexOf(identity) !== index);
  const missing = inputIdentities.filter((identity) => !outputIdentities.includes(identity));
  const contentUnchanged = flattened.length === allInputRecords.length && flattened.every((record, index) => JSON.stringify(record) === JSON.stringify(allInputRecords[index].record));
  const orderPreserved = lineageManifests.every((lineage) => {
    const expected = allInputRecords.filter((entry) => entry.lineage === lineage.lineage).map((entry) => recordIdentity(entry.record));
    const actual = prepared.filter((batch) => batch.lineage === lineage.lineage).flatMap((batch) => batch.records.map(recordIdentity));
    return JSON.stringify(expected) === JSON.stringify(actual);
  });
  const provenanceViolations = prepared.flatMap((batch) => batch.records.filter((record) => { const source = pools.find((candidate) => candidate.sourcePool === batch.sourcePool); return !candidateBelongsToSource(record, source?.sourceRecords ?? source?.records ?? []); })).length;
  const manifest = {
    prefix, campaignWave, chunkSize, inputSourcePools: lineageManifests.map(({ lineage, sourcePool, sourcePoolHash, inputCount }) => ({ lineage, sourcePool, sourcePoolHash, inputCount })),
    totalCandidateCount: allInputRecords.length, lineageCount: lineageManifests.length, chunkCount: prepared.length,
    lineage: lineageManifests, chunks: prepared.map((batch) => ({ batchName: batch.batchName, batchNumber: batch.batchNumber, lineage: batch.lineage, count: batch.records.length, sourcePool: batch.sourcePool, sourcePoolHash: batch.sourcePoolHash })),
    missingCandidates: missing, duplicateCandidatesAcrossChunks: duplicateSet, provenanceViolations,
    orderPreservation: orderPreserved, contentIntegrity: contentUnchanged,
    accountingInvariant: allInputRecords.length === flattened.length && missing.length === 0 && duplicateSet.length === 0 && provenanceViolations === 0,
  };
  return { batches: prepared, manifest };
}

export async function writeProvenanceSafeMigration(plan, outputDir, writeFile = fs.writeFile, mkdir = fs.mkdir) {
  await mkdir(outputDir, { recursive: true });
  const written = [];
  for (const batch of plan.batches) {
    const batchPath = path.join(outputDir, `${batch.batchName}.json`);
    const reportPath = path.join(outputDir, `${batch.batchName}-report.json`);
    await writeFile(batchPath, `${JSON.stringify(batch.records, null, 2)}\n`, 'utf8');
    await writeFile(reportPath, `${JSON.stringify(batch.report, null, 2)}\n`, 'utf8');
    written.push({ ...batch, batchPath, reportPath });
  }
  const manifestPath = path.join(outputDir, `${plan.manifest.prefix}-manifest.json`);
  await writeFile(manifestPath, `${JSON.stringify({ ...plan.manifest, batches: written.map(({ batchPath, reportPath, batchName, batchNumber, lineage, records }) => ({ batchPath, reportPath, batchName, batchNumber, lineage, count: records.length })) }, null, 2)}\n`, 'utf8');
  return { batches: written, manifestPath };
}

export { JOB_TYPES, MAX_CHUNK_SIZE, recordIdentity, sameIdentity };
