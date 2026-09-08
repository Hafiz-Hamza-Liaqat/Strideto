import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { authenticateProductionAdmin, buildReadHeaders } from './lib/productionReadAuth.mjs';
import { BATCH_TITLES, classify, compareReadback, payloads, recordsFrom, sha256, validateBatch } from './lib/canonicalScholarshipImport.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map(process.argv.slice(2).filter((x) => x.startsWith('--')).map((x) => { const [k, ...v] = x.slice(2).split('='); return [k, v.join('=') || true]; }));
const inputPath = path.resolve(root, String(args.get('input') || 'qa-artifacts/scholarships-batch01-canonical-ready.json'));
const reportPath = path.resolve(root, String(args.get('report') || `qa-artifacts/scholarships-batch01-import-${args.has('live') ? 'live' : 'dryrun'}.json`));
const live = args.has('live');
const expectedHash = String(args.get('sha256') || args.get('expected-sha256') || '').toLowerCase();

async function confirm() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question('Type IMPORT 9 to authorize this batch: ')).trim() === 'IMPORT 9'; } finally { rl.close(); }
}

const idOf = (record) => String(record?._id || record?.id || '');
async function main() {
  const bytes = fs.readFileSync(inputPath);
  const artifact = JSON.parse(bytes.toString('utf8'));
  const records = validateBatch(artifact);
  const batchHash = sha256(bytes);
  if (expectedHash && expectedHash !== batchHash) throw new Error('Input artifact SHA-256 does not match the supplied expected hash.');
  if (live && !expectedHash) throw new Error('Live import requires --sha256=<expected artifact hash>.');
  const base = (process.env.STRIDETO_PRODUCTION_API || 'https://api.strideto.com/api').replace(/\/$/, '');
  const requestAudit = [];
  const authentication = await authenticateProductionAdmin(base, process.env.STRIDETO_ADMIN_TOKEN || '', requestAudit, { probePath: '/admin/education/scholarships?page=1&limit=1' });
  const get = async (requestPath) => {
    const response = await fetch(`${base}${requestPath}`, { headers: buildReadHeaders(authentication) });
    requestAudit.push({ method: 'GET', path: requestPath, purpose: 'migration preflight/readback', status: response.status });
    if (!response.ok) throw new Error(`${requestPath} returned HTTP ${response.status}`);
    return response.json();
  };
  const post = async (requestPath, body) => {
    const response = await fetch(`${base}${requestPath}`, { method: 'POST', headers: { ...buildReadHeaders(authentication), 'content-type': 'application/json' }, body: JSON.stringify(body) });
    requestAudit.push({ method: 'POST', path: requestPath, purpose: 'canonical draft import', status: response.status });
    if (!response.ok) throw new Error(`${requestPath} returned HTTP ${response.status}`);
    return response.json();
  };
  const first = await get('/admin/education/scholarships?page=1&limit=100');
  const all = [...recordsFrom(first)];
  const pagination = first?.pagination || {};
  const totalPages = Number(pagination.totalPages ?? pagination.pages ?? first?.totalPages ?? first?.pages ?? 1) || 1;
  for (let page = 2; page <= totalPages; page += 1) all.push(...recordsFrom(await get(`/admin/education/scholarships?page=${page}&limit=100`)));
  const cycles = [];
  for (const scholarship of all) {
    const id = idOf(scholarship);
    if (!id) continue;
    for (const cycle of recordsFrom(await get(`/admin/education/scholarships/${encodeURIComponent(id)}/cycles`))) cycles.push({ scholarshipId: id, ...cycle });
  }
  const plans = records.map((record) => {
    const decision = classify(record, all, cycles);
    return { title: record.scholarship.title, ...decision, productionScholarshipId: decision.matches?.[0] ? idOf(decision.matches[0].item) : null, productionCycleId: decision.cycleMatch ? idOf(decision.cycleMatch) : null, plannedScholarshipCreate: decision.classification === 'SAFE_TO_CREATE', plannedCycleCreate: decision.classification === 'SAFE_TO_CREATE' };
  });
  const reviewRequired = plans.filter((p) => p.classification === 'REVIEW_REQUIRED').length;
  const summary = { candidateCount: 9, safeScholarshipCreates: plans.filter((p) => p.classification === 'SAFE_TO_CREATE').length, safeCycleCreates: plans.filter((p) => p.classification === 'SAFE_TO_CREATE').length, duplicateScholarshipSkips: plans.filter((p) => p.classification === 'DUPLICATE_SKIP').length, duplicateCycleSkips: plans.filter((p) => p.classification === 'DUPLICATE_SKIP').length, reviewRequired, scholarshipPostSucceeded: 0, scholarshipReadbackVerified: 0, cyclePostSucceeded: 0, cycleReadbackVerified: 0, createdVerified: 0, failed: 0, stopped: false };
  const report = { mode: live ? 'live-intent' : 'dry-run', sourceBatch: inputPath, batchHash, productionScholarshipCount: all.length, productionCycleCount: cycles.length, preflight: plans, summary, requestAudit, writes: 0 };
  if (!live) { fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); console.log(JSON.stringify(report, null, 2)); return; }
  if (reviewRequired || plans.some((p) => p.classification !== 'SAFE_TO_CREATE')) throw new Error('Live import blocked: preflight contains duplicates or review-required records.');
  console.log(BATCH_TITLES.map((title) => `- ${title}`).join('\n'));
  console.log(`Planned scholarship creates: ${summary.safeScholarshipCreates}`);
  console.log(`Planned cycle creates: ${summary.safeCycleCreates}`);
  console.log('No publish, update, delete, legacy, or Mongo operation is part of this runner.');
  if (!(await confirm())) { report.summary.stopped = true; report.summary.failed = 1; report.error = 'Exact confirmation IMPORT 9 was not provided.'; fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); return; }
  for (const record of records) {
    const plan = plans.find((p) => p.title === record.scholarship.title);
    const payload = payloads(record);
    const created = await post('/admin/education/scholarships', payload.scholarship);
    report.summary.scholarshipPostSucceeded += 1;
    const scholarship = created?.data || created;
    plan.productionScholarshipId = idOf(scholarship);
    const readback = await get(`/admin/education/scholarships/${encodeURIComponent(plan.productionScholarshipId)}`);
    const comparison = compareReadback(payload.scholarship, readback?.data || readback);
    plan.scholarshipReadback = comparison;
    if (!comparison.ok) throw new Error(`Scholarship readback mismatch: ${record.scholarship.title}`);
    report.summary.scholarshipReadbackVerified += 1;
    const cycleResponse = await post(`/admin/education/scholarships/${encodeURIComponent(plan.productionScholarshipId)}/cycles`, payload.cycle);
    report.summary.cyclePostSucceeded += 1;
    const cycle = cycleResponse?.data || cycleResponse;
    plan.productionCycleId = idOf(cycle);
    const cycleList = recordsFrom(await get(`/admin/education/scholarships/${encodeURIComponent(plan.productionScholarshipId)}/cycles`));
    const storedCycle = cycleList.find((item) => idOf(item) === plan.productionCycleId) || cycleList.find((item) => item.cycleLabel === payload.cycle.cycleLabel);
    if (!storedCycle || String(storedCycle.scholarshipId) !== plan.productionScholarshipId || storedCycle.cycleLabel !== payload.cycle.cycleLabel || storedCycle.academicYear !== payload.cycle.academicYear || storedCycle.status !== 'draft' || storedCycle.cycleStatus !== payload.cycle.cycleStatus || (storedCycle.deadlineAt || null) !== (payload.cycle.deadlineAt || null) || JSON.stringify(storedCycle.sources || []) !== JSON.stringify(payload.cycle.sources || [])) throw new Error(`Cycle readback mismatch: ${record.scholarship.title}`);
    report.summary.cycleReadbackVerified += 1;
    report.summary.createdVerified += 1;
    plan.finalStatus = 'CREATED_AND_VERIFIED';
  }
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(`Import runner stopped: ${error.message}`); process.exitCode = 1; });
