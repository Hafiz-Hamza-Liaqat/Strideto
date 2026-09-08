import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createProductionReadClient } from './lib/productionReadAuth.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidatePath = path.join(root, 'qa-artifacts', 'scholarships-batch01-canonical-ready.json');
const inventoryPath = path.join(root, 'qa-artifacts', 'scholarships-production-canonical-inventory.json');
const preflightPath = path.join(root, 'qa-artifacts', 'scholarships-batch01-production-preflight.json');
const reportPath = path.join(root, 'qa-artifacts', 'scholarships-batch01-production-preflight.md');

const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();
const host = (value) => { try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
const array = (value) => Array.isArray(value) ? value : [];
const recordsFrom = (body) => array(body?.data ?? body?.institutions ?? body?.items ?? body?.results ?? body);

function sourceUrls(record) {
  return array(record.sources).map((source) => source?.sourceUrl).filter(Boolean);
}

function matchCandidate(candidate, existing) {
  const c = candidate.scholarship;
  const cTitle = normalize(c.title);
  const cProvider = normalize(c.provider?.name);
  const cSourceHosts = new Set(sourceUrls(c).map(host).filter(Boolean));
  const cApplyHost = host(c.applicationUrl);
  const cYear = normalize(candidate.cycle?.academicYear || c.cycleLabel);
  const scored = existing.map((item) => {
    const eTitle = normalize(item.title);
    const eProvider = normalize(item.provider?.name || item.provider);
    const eSources = sourceUrls(item);
    const eHosts = new Set(eSources.map(host).filter(Boolean));
    const signals = [];
    if (cTitle && eTitle === cTitle) signals.push('title');
    if (cProvider && eProvider === cProvider) signals.push('provider');
    if ([...cSourceHosts].some((h) => eHosts.has(h))) signals.push('official-source-domain');
    if (cApplyHost && (eHosts.has(cApplyHost) || host(item.applicationUrl) === cApplyHost)) signals.push('application-domain');
    if (cYear && normalize(item.cycleLabel || item.academicYear).includes(cYear)) signals.push('cycle/year');
    const strong = signals.includes('title') && signals.some((s) => ['provider', 'official-source-domain', 'application-domain'].includes(s));
    return { item, signals, strong };
  }).filter((entry) => entry.strong);
  return scored;
}

async function main() {
  const candidateArtifact = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
  const client = await createProductionReadClient({
    allowedPrefixes: ['/admin/jobs', '/jobs', '/admin/education/scholarships'],
    probePath: '/admin/education/scholarships?page=1&limit=1',
  });
  const first = await client.get('/admin/education/scholarships?page=1&limit=100');
  const firstRecords = recordsFrom(first);
  const pagination = first?.pagination || {};
  const totalPages = Number(pagination.totalPages ?? pagination.pages ?? first?.totalPages ?? first?.pages ?? 1) || 1;
  const all = [...firstRecords];
  for (let page = 2; page <= totalPages; page += 1) {
    const body = await client.get(`/admin/education/scholarships?page=${page}&limit=100`);
    all.push(...recordsFrom(body));
  }
  const cycles = [];
  for (const scholarship of all) {
    const id = scholarship._id || scholarship.id;
    if (!id) continue;
    const body = await client.get(`/admin/education/scholarships/${encodeURIComponent(id)}/cycles`);
    for (const cycle of recordsFrom(body)) cycles.push({ scholarshipId: id, ...cycle });
  }
  const inventory = {
    generatedAt: new Date().toISOString(),
    productionRead: true,
    scholarshipCount: all.length,
    cycleCount: cycles.length,
    scholarships: all.map((s) => ({
      productionId: String(s._id || s.id || ''), title: s.title || '', provider: s.provider || null,
      institutionId: s.institutionId || null, country: s.destinationCountries || [], scholarshipType: s.scholarshipType || '',
      applicationUrl: s.applicationUrl || '', officialSourceUrls: sourceUrls(s), status: s.status || '',
      verificationStatus: s.verificationStatus || '', freshnessState: s.freshnessState || '', cycleLabel: s.cycleLabel || '', deadlineDate: s.deadlineDate || '',
    })),
    cycles: cycles.map((c) => ({ scholarshipId: String(c.scholarshipId), cycleLabel: c.cycleLabel || '', academicYear: c.academicYear || '', deadlineAt: c.deadlineAt || null, cycleStatus: c.cycleStatus || '', status: c.status || '' })),
    requestAudit: client.requestAudit,
  };
  fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');

  const results = candidateArtifact.records.map((candidate) => {
    const matches = matchCandidate(candidate, all);
    const cycleMatch = matches.find(({ item }) => normalize(item.cycleLabel || item.academicYear).includes(normalize(candidate.cycle.academicYear))) || null;
    let classification = 'SAFE_TO_CREATE';
    let relationship = 'NEW_SCHOLARSHIP_NEW_CYCLE';
    if (matches.length > 1) classification = 'REVIEW_REQUIRED';
    else if (matches.length === 1) {
      classification = cycleMatch ? 'DUPLICATE_SKIP' : 'EXISTING_SCHOLARSHIP_NEW_CYCLE';
      relationship = cycleMatch ? 'EXISTING_SCHOLARSHIP_EXISTING_CYCLE' : 'EXISTING_SCHOLARSHIP_NEW_CYCLE';
    }
    const sourceValid = sourceUrls(candidate.scholarship).length > 0 && Boolean(candidate.scholarship.applicationUrl);
    if (!sourceValid) classification = 'REVIEW_REQUIRED';
    return { candidate: candidate.scholarship.title, classification, relationship, matchBasis: matches.flatMap((m) => m.signals), productionMatches: matches.map(({ item }) => ({ productionId: String(item._id || item.id || ''), title: item.title || '', provider: item.provider || null, status: item.status || '' })), sourceValid };
  });
  const output = {
    generatedAt: new Date().toISOString(), productionRead: true, candidateCount: results.length,
    productionScholarshipCount: all.length, productionCycleCount: cycles.length, results,
    summary: {
      safeToCreate: results.filter((r) => r.classification === 'SAFE_TO_CREATE').length,
      existingScholarshipNewCycle: results.filter((r) => r.classification === 'EXISTING_SCHOLARSHIP_NEW_CYCLE').length,
      duplicateSkip: results.filter((r) => r.classification === 'DUPLICATE_SKIP').length,
      reviewRequired: results.filter((r) => r.classification === 'REVIEW_REQUIRED').length,
    },
    requestAudit: client.requestAudit,
  };
  fs.writeFileSync(preflightPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  const lines = ['# Scholarships Batch 01 production duplicate preflight', '', `Generated: ${output.generatedAt}`, '', '- READ ONLY: authenticated GET requests only.', '- No scholarship or cycle writes were performed.', '', `- Production scholarships: ${all.length}`, `- Production cycles: ${cycles.length}`, `- Candidates: ${results.length}`, '', '| Candidate | Classification | Relationship | Production match IDs | Basis |', '|---|---|---|---|---|', ...results.map((r) => `| ${r.candidate} | ${r.classification} | ${r.relationship} | ${r.productionMatches.map((m) => m.productionId).join(', ') || 'none'} | ${[...new Set(r.matchBasis)].join(', ') || 'none'} |`), '', '## Import decision', '', results.some((r) => r.classification === 'REVIEW_REQUIRED') ? 'Import is **blocked** pending review.' : 'Import may proceed only after reviewing this report and running the separate authenticated write preflight.', ''];
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(JSON.stringify({ productionScholarshipCount: all.length, productionCycleCount: cycles.length, candidateCount: results.length, summary: output.summary, writes: 0 }, null, 2));
}

main().catch((error) => { console.error(`Preflight failed: ${error.message}`); process.exitCode = 1; });
