#!/usr/bin/env node

/*
 * Controlled publication preparation for the eight approved Batch 01A
 * CanonicalInstitution records. Dry-run is the default. Live mode requires
 * --live and one exact `PUBLISH 8` confirmation after every preflight passes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReadHeaders, authenticateProductionAdmin } from './lib/productionReadAuth.mjs';

export const DEFAULT_INPUT = 'qa-artifacts/schools-colleges-pakistan-batch01a-ready.json';
export const DEFAULT_BASE = 'https://api.strideto.com/api';
export const INSTITUTION_PATH = '/admin/education/institutions';
export const CONFIRMATION = 'PUBLISH 8';

export const APPROVED_TARGETS = Object.freeze([
  { id: '6a9f05e36b553a17cabc1f91', slug: 'aitchison-college-lahore', officialName: 'Aitchison College' },
  { id: '6a9f0e29eb06d34cd036b5ee', slug: 'karachi-grammar-school', officialName: 'Karachi Grammar School' },
  { id: '6a9f0e44eb06d34cd036b631', slug: 'lahore-grammar-school-55-main', officialName: 'Lahore Grammar School 55 Main' },
  { id: '6a9f0e4deb06d34cd036b652', slug: 'nixor-college-karachi', officialName: 'Nixor College' },
  { id: '6a9f0e54eb06d34cd036b667', slug: 'the-city-school-pakistan', officialName: 'The City School Pakistan' },
  { id: '6a9f0e5aeb06d34cd036b67c', slug: 'government-college-peshawar', officialName: 'Government College Peshawar' },
  { id: '6a9f107deb06d34cd036ba5e', slug: 'islamabad-college-for-girls-f-6-2', officialName: 'Islamabad College for Girls F-6/2' },
  { id: '6a9f107deb06d34cd036ba6d', slug: 'quetta-institute-information-technology-english-language', officialName: 'Quetta Institute of Information Technology and English Language' },
]);

export const EXCLUDED_TARGET = Object.freeze({
  id: '6a9f107eeb06d34cd036ba7c',
  slug: 'girls-cadet-college-quetta',
  officialName: 'Girls Cadet College Quetta',
});

const TARGET_BY_ID = new Map(APPROVED_TARGETS.map((target) => [target.id, target]));
const text = (value) => typeof value === 'string' ? value.trim() : '';

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { input: DEFAULT_INPUT, base: DEFAULT_BASE, report: '', live: false };
  for (const arg of argv) {
    if (arg === '--live') { args.live = true; continue; }
    if (arg === '--dry-run' || arg === '--preview') { args.live = false; continue; }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'input') args.input = value;
    if (key === 'base') args.base = value.replace(/\/$/, '');
    if (key === 'report') args.report = value;
  }
  if (!args.report) args.report = args.input.replace(/\.json$/i, '.publication-report.json');
  return args;
}

function getCandidates(input) {
  const candidates = Array.isArray(input) ? input : input?.candidates;
  if (!Array.isArray(candidates)) throw new Error('Input must contain a candidates array.');
  return candidates;
}

export function selectApprovedCandidates(input) {
  const candidates = getCandidates(input);
  const byId = new Map();
  for (const candidate of candidates) {
    const id = String(candidate?.productionId || candidate?._id || candidate?.id || '').trim();
    if (id) byId.set(id, (byId.get(id) || []).concat(candidate));
  }
  const selected = APPROVED_TARGETS.map((target) => {
    const rows = byId.get(target.id) || candidates.filter((candidate) => candidate?.slug === target.slug);
    if (rows.length !== 1) throw new Error(`Expected exactly one input record for ${target.officialName}; found ${rows.length}.`);
    const candidate = rows[0];
    if (candidate.officialName !== target.officialName || candidate.slug !== target.slug) {
      throw new Error(`Input identity mismatch for ${target.officialName}.`);
    }
    return { ...candidate, productionId: target.id };
  });
  // The approved source batch intentionally contains the ninth, excluded
  // record. It is ignored here and can never enter the mutation plan.
  return selected;
}

export function buildPublicationPayload() {
  // The controller derives launchEligible from this status transition. No
  // profile field, source field, or client-controlled launch flag is sent.
  return { status: 'published' };
}

function sourceCount(row) { return Array.isArray(row?.sources) ? row.sources.length : 0; }

export function validatePreflightRecord(candidate, row, inventory = []) {
  const target = TARGET_BY_ID.get(String(candidate.productionId));
  const errors = [];
  if (!target) errors.push('record is outside the approved allowlist');
  if (String(row?._id || row?.id || '') !== String(candidate.productionId)) errors.push('production ID mismatch');
  if (row?.slug !== candidate.slug || row?.officialName !== candidate.officialName) errors.push('slug/name mismatch');
  if (row?.countryCode !== 'PK') errors.push('countryCode must be PK');
  if (sourceCount(row) < 1) errors.push('source evidence is missing');
  const identityMatches = inventory.filter((item) => String(item?._id || item?.id || '') === String(candidate.productionId));
  if (identityMatches.length !== 1) errors.push(`canonical match count is ${identityMatches.length}, expected 1`);
  const alreadyPublished = row?.status === 'published' && row?.launchEligible === true;
  if (!alreadyPublished && row?.status !== 'draft') errors.push(`status must be draft, received ${String(row?.status)}`);
  if (!alreadyPublished && row?.launchEligible !== false) errors.push(`launchEligible must be false, received ${String(row?.launchEligible)}`);
  return { ok: errors.length === 0, errors, alreadyPublished };
}

export function isPublishConfirmation(value) { return String(value ?? '').trim() === CONFIRMATION; }

export async function confirmPublication({ input = process.stdin, output = process.stdout } = {}) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input, output });
  try { return isPublishConfirmation(await rl.question(`Type ${CONFIRMATION} to publish the eight approved records: `)); }
  finally { rl.close(); }
}

async function sha256(filePath) {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
}

async function loadInput(inputPath) {
  return JSON.parse(await fs.readFile(inputPath, 'utf8'));
}

function resultFor(candidate, target, preflight) {
  return {
    productionId: target.id,
    officialName: target.officialName,
    slug: target.slug,
    preflight: preflight.ok ? (preflight.alreadyPublished ? 'ALREADY_PUBLISHED_SKIP' : 'PASS') : 'FAIL',
    errors: preflight.errors,
    plannedAction: preflight.alreadyPublished ? 'SKIP_ALREADY_PUBLISHED' : (preflight.ok ? 'PUBLISH' : 'ABORT'),
  };
}

async function defaultClient(base, requestAudit) {
  const auth = await authenticateProductionAdmin(base, process.env.STRIDETO_ADMIN_TOKEN || '', requestAudit, { probePath: `${INSTITUTION_PATH}?page=1&limit=1` });
  const request = async (method, relativePath, body) => {
    if (!relativePath.startsWith(INSTITUTION_PATH)) throw new Error(`Endpoint allowlist rejected: ${relativePath}`);
    const response = await fetch(`${base}${relativePath}`, {
      method,
      headers: { ...buildReadHeaders({ token: auth.token, cookie: auth.cookie }), ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    requestAudit.push({ method, path: relativePath, purpose: method === 'GET' ? 'publication preflight/readback' : 'canonical publication mutation', status: response.status });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${method} ${relativePath} returned HTTP ${response.status}`);
    return payload?.data || payload;
  };
  return { get: (p) => request('GET', p), patch: (p, body) => request('PATCH', p, body) };
}

export function extractInventoryPage(body) {
  if (Array.isArray(body)) return { rows: body, pages: 1 };
  if (Array.isArray(body?.data)) {
    return { rows: body.data, pages: Number(body?.pagination?.pages ?? body?.pages ?? 1) || 1 };
  }
  if (Array.isArray(body?.institutions)) {
    return { rows: body.institutions, pages: Number(body?.pagination?.pages ?? body?.pages ?? 1) || 1 };
  }
  if (Array.isArray(body?.items)) {
    return { rows: body.items, pages: Number(body?.pagination?.pages ?? body?.pages ?? 1) || 1 };
  }
  if (Array.isArray(body?.results)) {
    return { rows: body.results, pages: Number(body?.pagination?.pages ?? body?.pages ?? 1) || 1 };
  }
  return { rows: [], pages: 1 };
}

async function listInventory(client) {
  const all = [];
  let page = 1;
  let pages = 1;
  do {
    const body = await client.get(`${INSTITUTION_PATH}?page=${page}&limit=100`);
    const extracted = extractInventoryPage(body);
    all.push(...extracted.rows);
    pages = extracted.pages;
    page += 1;
  } while (page <= pages);
  return all;
}

export async function runPublication({ inputPath = DEFAULT_INPUT, reportPath, base = DEFAULT_BASE, live = false, client, confirm = confirmPublication } = {}) {
  const startedAt = new Date().toISOString();
  const absoluteInput = path.resolve(inputPath);
  const input = await loadInput(absoluteInput);
  const candidates = selectApprovedCandidates(input);
  const report = {
    sourceBatchFile: inputPath,
    batchHash: await sha256(absoluteInput),
    startedAt,
    completedAt: null,
    mode: live ? 'live-intent' : 'dry-run',
    targetCount: APPROVED_TARGETS.length,
    excluded: EXCLUDED_TARGET,
    authenticatedProductionPreflight: false,
    preflightPassed: false,
    confirmationRequired: live,
    confirmationReceived: false,
    published: 0,
    alreadyPublished: 0,
    failed: 0,
    stopped: false,
    results: [],
    requestSafety: { productionWrites: 0, updates: 0, deletes: 0, publishing: 0 },
  };
  const requestAudit = [];
  const api = client || await defaultClient(base, requestAudit);
  const inventory = await listInventory(api);
  report.authenticatedProductionPreflight = true;
  const rows = new Map();
  for (const candidate of candidates) {
    rows.set(candidate.productionId, await api.get(`${INSTITUTION_PATH}/${encodeURIComponent(candidate.productionId)}`));
  }
  const plans = candidates.map((candidate) => {
    const target = TARGET_BY_ID.get(candidate.productionId);
    const preflight = validatePreflightRecord(candidate, rows.get(candidate.productionId), inventory);
    return { candidate, target, preflight, result: resultFor(candidate, target, preflight) };
  });
  report.results = plans.map(({ result }) => result);
  report.preflightPassed = plans.every(({ preflight }) => preflight.ok);
  report.alreadyPublished = plans.filter(({ preflight }) => preflight.alreadyPublished).length;
  if (!report.preflightPassed) {
    report.failed = plans.filter(({ preflight }) => !preflight.ok).length;
    report.stopped = true;
  } else if (live && plans.some(({ preflight }) => !preflight.alreadyPublished)) {
    report.confirmationReceived = await confirm();
    if (!report.confirmationReceived) {
      report.stopped = true;
      report.results = report.results.map((result) => result.plannedAction === 'PUBLISH' ? { ...result, plannedAction: 'STOPPED_NO_CONFIRMATION' } : result);
    }
  }
  if (live && report.preflightPassed && report.confirmationReceived && !report.stopped) {
    for (const plan of plans) {
      if (plan.preflight.alreadyPublished) continue;
      try {
        const row = await api.patch(`${INSTITUTION_PATH}/${encodeURIComponent(plan.target.id)}`, buildPublicationPayload());
        report.requestSafety.productionWrites += 1;
        report.requestSafety.updates += 1;
        report.requestSafety.publishing += 1;
        const verified = String(row?._id || row?.id || '') === plan.target.id
          && row?.slug === plan.target.slug
          && row?.officialName === plan.target.officialName
          && row?.status === 'published'
          && row?.launchEligible === true
          && sourceCount(row) > 0;
        if (!verified) {
          report.failed += 1;
          report.stopped = true;
          report.results = report.results.map((result) => result.productionId === plan.target.id
            ? { ...result, plannedAction: 'PUBLISH_SUCCEEDED_READBACK_MISMATCH', readback: { status: row?.status, launchEligible: row?.launchEligible, sourceCount: sourceCount(row) } }
            : result);
          break;
        }
        report.published += 1;
        report.results = report.results.map((result) => result.productionId === plan.target.id ? { ...result, plannedAction: 'PUBLISHED_AND_READBACK_VERIFIED', finalStatus: row.status, finalLaunchEligible: row.launchEligible } : result);
      } catch (error) {
        report.failed += 1;
        report.stopped = true;
        report.results = report.results.map((result) => result.productionId === plan.target.id ? { ...result, plannedAction: 'PUBLISH_FAILED', error: error.message } : result);
        break;
      }
    }
  }
  report.requestAudit = requestAudit;
  report.completedAt = new Date().toISOString();
  if (reportPath) await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = parseArgs();
  try {
    const report = await runPublication({ inputPath: args.input, reportPath: args.report, live: args.live });
    console.log(JSON.stringify({ mode: report.mode, targetCount: report.targetCount, preflightPassed: report.preflightPassed, alreadyPublished: report.alreadyPublished, published: report.published, failed: report.failed, stopped: report.stopped, report: args.report }, null, 2));
    if (report.failed || report.stopped) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
