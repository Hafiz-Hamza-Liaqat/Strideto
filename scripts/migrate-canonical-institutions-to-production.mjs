#!/usr/bin/env node

/*
 * Draft-only-by-default canonical institution migration.
 *
 * This tool is intentionally separate from the legacy Institution workflow.
 * It uses HTTPS API calls only, never publishes, and only permits the canonical
 * admin institution endpoint when live mode is explicitly confirmed.
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReadHeaders, authenticateProductionAdmin } from './lib/productionReadAuth.mjs';
import { isValidSourceType } from '../shared/international/evidence.js';

const DEFAULT_INPUT = 'qa-artifacts/schools-colleges-pakistan-batch01a-ready.json';
const DEFAULT_BASE = 'https://api.strideto.com/api';
const INSTITUTION_PATH = '/admin/education/institutions';
const MAX_BATCH = 10;
const ALLOWED_TYPES = new Set(['school', 'college', 'institute']);
const ALLOWED_STATUS = 'draft';
const ALLOWED_FIELDS = [
  'officialName', 'slug', 'countryCode', 'city', 'region', 'description',
  'address', 'district', 'officialWebsite', 'officialDomain', 'logoUrl',
  'phone', 'email', 'accreditations', 'establishedYear', 'institutionType',
  'isPublic', 'sources', 'status', 'launchEligible',
];

const text = (value) => typeof value === 'string' ? value.trim() : '';

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { input: DEFAULT_INPUT, base: DEFAULT_BASE, dryRun: true, live: false, report: '' };
  for (const arg of argv) {
    if (arg === '--live') { args.live = true; args.dryRun = false; continue; }
    if (arg === '--dry-run') { args.dryRun = true; args.live = false; continue; }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'input') args.input = value;
    if (key === 'base') args.base = value.replace(/\/$/, '');
    if (key === 'report') args.report = value;
  }
  if (!args.report) args.report = args.input.replace(/\.json$/i, '.migration-report.json');
  return args;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

function normalizeUrl(value) {
  if (!text(value)) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch { return text(value).toLowerCase(); }
}

function normalizeDomain(value) {
  if (!text(value)) return '';
  const candidate = text(value).replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
  return candidate.replace(/^www\./i, '').toLowerCase();
}

function normalizeIdentity(value) {
  return text(value).toLocaleLowerCase().replace(/[‐‑‒–—―]/g, '-').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function validateSource(source, index) {
  const errors = [];
  if (!source || typeof source !== 'object') return [`sources[${index}] must be an object`];
  for (const field of ['sourceType', 'sourceUrl', 'publisher', 'retrievedAt', 'verifiedAt']) {
    if (!text(source[field])) errors.push(`sources[${index}].${field} is required`);
  }
  if (source.sourceType && !isValidSourceType(source.sourceType)) errors.push(`sources[${index}].sourceType is unsupported`);
  if (source.sourceUrl && !isHttpUrl(source.sourceUrl)) errors.push(`sources[${index}].sourceUrl must be http(s)`);
  for (const field of ['retrievedAt', 'verifiedAt']) {
    if (source[field] && Number.isNaN(new Date(source[field]).getTime())) errors.push(`sources[${index}].${field} is invalid`);
  }
  return errors;
}

export function validateCandidate(candidate, index = 0) {
  const errors = [];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [`candidate[${index}] must be an object`];
  for (const field of ['officialName', 'slug', 'institutionType', 'countryCode', 'sources']) {
    if (candidate[field] === undefined || candidate[field] === null || (typeof candidate[field] === 'string' && !text(candidate[field]))) {
      errors.push(`candidate[${index}].${field} is required`);
    }
  }
  if (!ALLOWED_TYPES.has(text(candidate.institutionType))) errors.push(`candidate[${index}].institutionType is unsupported`);
  if (text(candidate.countryCode).toUpperCase() !== 'PK') errors.push(`candidate[${index}].countryCode must be PK`);
  if (!text(candidate.slug).match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)) errors.push(`candidate[${index}].slug is not normalized`);
  if (candidate.officialWebsite != null && candidate.officialWebsite !== '' && !isHttpUrl(candidate.officialWebsite)) errors.push(`candidate[${index}].officialWebsite must be http(s)`);
  if (candidate.officialDomain != null && candidate.officialDomain !== '' && normalizeDomain(candidate.officialDomain).includes(' ')) errors.push(`candidate[${index}].officialDomain is invalid`);
  if (candidate.email != null && candidate.email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.email)) errors.push(`candidate[${index}].email is invalid`);
  if (!Array.isArray(candidate.sources) || candidate.sources.length === 0) errors.push(`candidate[${index}] requires source evidence`);
  else candidate.sources.forEach((source, sourceIndex) => errors.push(...validateSource(source, sourceIndex)));
  if (candidate.status !== ALLOWED_STATUS) errors.push(`candidate[${index}].status must be draft`);
  if (candidate.launchEligible !== false) errors.push(`candidate[${index}].launchEligible must be false`);
  return errors;
}

export function buildPayload(candidate) {
  const payload = {};
  for (const field of ALLOWED_FIELDS) {
    if (candidate[field] !== undefined) payload[field] = candidate[field];
  }
  payload.status = 'draft';
  payload.launchEligible = false;
  return payload;
}

function normalizedReadbackValue(field, value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (field === 'slug' || field === 'institutionType' || field === 'status') return trimmed.toLowerCase();
  if (field === 'countryCode') return trimmed.toUpperCase();
  if (field === 'officialDomain') return normalizeDomain(trimmed);
  if (field === 'officialWebsite') return normalizeUrl(trimmed);
  if (field === 'city' || field === 'region') return normalizeIdentity(trimmed);
  return trimmed;
}

function normalizedDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).trim() : date.toISOString();
}

function normalizedSources(sources) {
  return (Array.isArray(sources) ? sources : []).map((source) => ({
    sourceType: text(source?.sourceType).toLowerCase(),
    sourceUrl: normalizeUrl(source?.sourceUrl),
    publisher: normalizeIdentity(source?.publisher),
    retrievedAt: normalizedDate(source?.retrievedAt),
    verifiedAt: normalizedDate(source?.verifiedAt),
    evidenceRef: text(source?.evidenceRef),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export function compareReadback(candidate, row) {
  const fields = [
    ['officialName', candidate.officialName, row?.officialName],
    ['slug', candidate.slug, row?.slug],
    ['institutionType', candidate.institutionType, row?.institutionType],
    ['countryCode', 'PK', row?.countryCode],
    ['region', candidate.region, row?.region],
    ['city', candidate.city, row?.city],
    ['officialWebsite', candidate.officialWebsite, row?.officialWebsite],
    ['officialDomain', candidate.officialDomain, row?.officialDomain],
    ['sources', normalizedSources(candidate.sources), normalizedSources(row?.sources)],
    ['status', 'draft', row?.status],
    ['launchEligible', false, row?.launchEligible],
  ].map(([field, expected, actual]) => {
    const normalizedExpected = field === 'sources' ? expected : normalizedReadbackValue(field, expected);
    const normalizedActual = field === 'sources' ? actual : normalizedReadbackValue(field, actual);
    const equal = field === 'sources'
      ? JSON.stringify(normalizedExpected) === JSON.stringify(normalizedActual)
      : normalizedExpected === normalizedActual;
    return {
      field,
      expected,
      actual,
      normalization: normalizedExpected !== expected || normalizedActual !== actual ? 'canonical-semantic' : 'none',
      classification: equal
        ? (normalizedExpected === expected && normalizedActual === actual ? 'MATCH' : 'NORMALIZED_EQUIVALENT')
        : 'MISMATCH_REAL',
    };
  });
  return { ok: fields.every((field) => field.classification !== 'MISMATCH_REAL'), fields };
}

function identityMatches(candidate, existing) {
  const candidateDomain = normalizeDomain(candidate.officialDomain || candidate.officialWebsite);
  const existingDomain = normalizeDomain(existing.officialDomain || existing.officialWebsite);
  const candidateWebsite = normalizeUrl(candidate.officialWebsite);
  const existingWebsite = normalizeUrl(existing.officialWebsite);
  const candidateNameCity = `${normalizeIdentity(candidate.officialName)}|${normalizeIdentity(candidate.city)}`;
  const existingNameCity = `${normalizeIdentity(existing.officialName)}|${normalizeIdentity(existing.city)}`;
  const candidateNameAddress = `${normalizeIdentity(candidate.officialName)}|${normalizeIdentity(candidate.address)}`;
  const existingNameAddress = `${normalizeIdentity(existing.officialName)}|${normalizeIdentity(existing.address)}`;
  return { candidateDomain, existingDomain, candidateWebsite, existingWebsite, candidateNameCity, existingNameCity, candidateNameAddress, existingNameAddress };
}

export function classifyDuplicate(candidate, existingRecords = []) {
  for (const existing of existingRecords) {
    const m = identityMatches(candidate, existing);
    if (m.candidateDomain && m.candidateDomain === m.existingDomain) return { status: 'DUPLICATE_SKIP', basis: 'officialDomain', existing };
    if (m.candidateWebsite && m.candidateWebsite === m.existingWebsite) return { status: 'DUPLICATE_SKIP', basis: 'officialWebsite', existing };
    if (normalizeIdentity(candidate.slug) && normalizeIdentity(candidate.slug) === normalizeIdentity(existing.slug)) return { status: 'DUPLICATE_SKIP', basis: 'slug', existing };
    if (m.candidateNameCity !== '|' && m.candidateNameCity === m.existingNameCity) return { status: 'REVIEW_REQUIRED', basis: 'officialName+city', existing };
    if (m.candidateNameAddress !== '|' && m.candidateNameAddress === m.existingNameAddress) return { status: 'REVIEW_REQUIRED', basis: 'officialName+address', existing };
  }
  return { status: 'SAFE_TO_CREATE', basis: null, existing: null };
}

export function validateBatchSize(count) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) {
    throw new Error(`Batch must contain between 1 and ${MAX_BATCH} candidates.`);
  }
}

async function sha256(filePath) {
  return crypto.createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
}

async function loadBatch(filePath) {
  const input = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const candidates = Array.isArray(input) ? input : input.candidates;
  if (!Array.isArray(candidates)) throw new Error('Input must contain a candidates array.');
  validateBatchSize(candidates.length);
  const errors = candidates.flatMap((candidate, index) => validateCandidate(candidate, index));
  if (errors.length) throw new Error(`Input validation failed: ${errors.join('; ')}`);
  const ids = new Set();
  for (const candidate of candidates) {
    const identity = `${normalizeIdentity(candidate.officialName)}|${normalizeIdentity(candidate.city)}|${normalizeIdentity(candidate.slug)}`;
    if (ids.has(identity)) throw new Error(`Duplicate candidate identity in input: ${identity}`);
    ids.add(identity);
  }
  return { input, candidates };
}

async function listAllInstitutions(client) {
  const result = [];
  let page = 1;
  let pages = 1;
  do {
    const body = await client.get(`${INSTITUTION_PATH}?page=${page}&limit=100`);
    const rows = Array.isArray(body?.data) ? body.data : [];
    result.push(...rows);
    pages = Number(body?.pagination?.pages ?? body?.pages ?? 1) || 1;
    page += 1;
  } while (page <= pages);
  return result;
}

async function createAdminReadClient(base) {
  const requestAudit = [];
  const authentication = await authenticateProductionAdmin(base, process.env.STRIDETO_ADMIN_TOKEN || '', requestAudit, {
    probePath: `${INSTITUTION_PATH}?page=1&limit=1`,
  });
  const get = async (relativePath) => {
    if (!relativePath.startsWith(INSTITUTION_PATH)) throw new Error(`Read allowlist rejected: ${relativePath}`);
    const response = await fetch(`${base}${relativePath}`, { headers: buildReadHeaders({ token: authentication.token, cookie: authentication.cookie }) });
    requestAudit.push({ method: 'GET', path: relativePath, purpose: 'migration preflight/readback', status: response.status });
    if (!response.ok) throw new Error(`${relativePath} returned HTTP ${response.status}`);
    return response.json();
  };
  return { get, token: authentication.token, cookie: authentication.cookie, requestAudit };
}

export function isMigrationConfirmation(value) {
  return String(value ?? '').trim() === 'MIGRATE';
}

export async function confirmMigration({ input = process.stdin, output = process.stdout } = {}) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input, output });
  try { return isMigrationConfirmation(await rl.question('Type MIGRATE to create draft records: ')); }
  finally { rl.close(); }
}

export async function runMigration({ inputPath = DEFAULT_INPUT, reportPath, base = DEFAULT_BASE, live = false } = {}) {
  const startedAt = new Date().toISOString();
  const absoluteInput = path.resolve(inputPath);
  const sourceHash = await sha256(absoluteInput);
  const { candidates } = await loadBatch(absoluteInput);
  const report = {
    sourceBatchFile: inputPath,
    batchHash: sourceHash,
    startedAt,
    completedAt: null,
    mode: live ? 'live' : 'dry-run',
    authenticatedProductionPreflight: false,
    candidateCount: candidates.length,
    safeCount: 0,
    duplicateSkips: 0,
    reviewRequired: 0,
    postSucceeded: 0,
    readbackVerified: 0,
    readbackMismatch: 0,
    createdVerified: 0,
    created: 0,
    failed: 0,
    stopped: false,
    results: [],
  };
  const client = await createAdminReadClient(base);
  report.authenticatedProductionPreflight = true;
  let inventory = await listAllInstitutions(client);
  for (const candidate of candidates) {
    const duplicate = classifyDuplicate(candidate, inventory);
    const result = { candidate: candidate.officialName, slug: candidate.slug, duplicateStatus: duplicate.status, duplicateBasis: duplicate.basis, validationStatus: 'PASS', plannedAction: duplicate.status === 'SAFE_TO_CREATE' ? (live ? 'CREATE_DRAFT' : 'WOULD_CREATE_DRAFT') : 'SKIP' };
    if (duplicate.status === 'DUPLICATE_SKIP') { report.duplicateSkips += 1; report.results.push(result); continue; }
    if (duplicate.status === 'REVIEW_REQUIRED') { report.reviewRequired += 1; report.results.push(result); continue; }
    report.safeCount += 1;
    if (!live) { report.results.push(result); continue; }
    if (!await confirmMigration()) { report.stopped = true; report.results.push({ ...result, plannedAction: 'STOPPED_NO_CONFIRMATION' }); break; }
    const response = await fetch(`${base}${INSTITUTION_PATH}`, { method: 'POST', headers: { ...buildReadHeaders({ token: client.token, cookie: client.cookie }), 'content-type': 'application/json' }, body: JSON.stringify(buildPayload(candidate)) });
    if (!response.ok) { report.failed += 1; report.stopped = true; report.results.push({ ...result, plannedAction: 'POST_FAILED', error: `HTTP ${response.status}`, postSucceeded: false }); break; }
    report.postSucceeded += 1;
    const created = await response.json();
    const createdId = created?._id || created?.data?._id;
    if (!createdId) { report.failed += 1; report.stopped = true; report.results.push({ ...result, plannedAction: 'POST_SUCCEEDED_NO_ID', error: 'Create response had no _id', postSucceeded: true }); break; }
    const readback = await client.get(`${INSTITUTION_PATH}/${createdId}`);
    const row = readback?.data || readback;
    const comparison = compareReadback(candidate, row);
    if (!comparison.ok) {
      report.readbackMismatch += 1;
      report.failed += 1;
      report.stopped = true;
      report.results.push({ ...result, plannedAction: 'POST_SUCCEEDED_READBACK_MISMATCH', productionId: createdId, postSucceeded: true, readbackVerified: false, readbackFields: comparison.fields });
      break;
    }
    report.readbackVerified += 1;
    report.createdVerified += 1;
    report.created += 1;
    report.results.push({ ...result, plannedAction: 'CREATED_AND_READBACK_VERIFIED', productionId: createdId, postSucceeded: true, readbackVerified: true, readbackFields: comparison.fields });
    inventory = await listAllInstitutions(client);
  }
  report.completedAt = new Date().toISOString();
  if (reportPath) await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = parseArgs();
  try {
    const report = await runMigration({ inputPath: args.input, reportPath: args.report, base: args.base, live: args.live });
    console.log(JSON.stringify({ mode: report.mode, candidateCount: report.candidateCount, safeCount: report.safeCount, duplicateSkips: report.duplicateSkips, reviewRequired: report.reviewRequired, created: report.created, failed: report.failed, report: args.report }, null, 2));
    if (report.failed || report.stopped) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
