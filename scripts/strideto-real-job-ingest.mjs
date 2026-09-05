import fs from 'node:fs/promises';

const queuePath = process.env.STRIDETO_JOB_QUEUE || 'qa-artifacts/strideto-real-job-queue.json';
const auditPath = process.env.STRIDETO_JOB_AUDIT || 'docs/audits/STRIDETO_REAL_JOB_IMPORT_AUDIT_2026-09-05.json';
const baseUrl = (process.env.STRIDETO_API_BASE || 'http://localhost:5001/api').replace(/\/$/, '');
const token = process.env.STRIDETO_ADMIN_TOKEN;
const writeIntervalMs = Math.max(0, Number(process.env.STRIDETO_ADMIN_WRITE_INTERVAL_MS || 2500));

const required = ['title', 'company', 'countryCode', 'applicationLink', 'sourceUrl', 'slug', 'verifiedAt'];
const headers = { Authorization: `Bearer ${token || ''}`, Origin: process.env.STRIDETO_ORIGIN || 'https://localhost:8443' };

function fail(message) {
  throw new Error(message);
}

async function api(path, options = {}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (response.status === 429 && attempt < 3) {
      const retryAfter = response.headers.get('retry-after');
      const retrySeconds = Number(retryAfter);
      const retryDelay = Number.isFinite(retrySeconds)
        ? Math.max(1000, retrySeconds * 1000)
        : 60000;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      continue;
    }
    if (!response.ok) fail(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    return body;
  }
}

function validateRecord(record) {
  for (const field of required) if (!record[field]) fail(`queue record missing ${field}`);
  if (record.status !== 'draft' || record.approvalStatus !== 'pending' || record.launchEligible !== false) {
    fail(`queue record ${record.externalId} has unsafe publication state`);
  }
  if (record.urgent !== false || record.isFeatured !== false) fail(`queue record ${record.externalId} has unsafe flags`);
}

const queue = JSON.parse(await fs.readFile(queuePath, 'utf8'));
const audit = JSON.parse(await fs.readFile(auditPath, 'utf8'));
if (!Array.isArray(queue.records) || !Array.isArray(audit.records)) fail('queue/audit records must be arrays');
const existingIds = new Set(audit.records.map((record) => record.externalId).filter(Boolean));
const existingUrls = new Set(audit.records.map((record) => record.sourceUrl).filter(Boolean));
const report = { prepared: queue.records.length, inserted: 0, skippedDuplicates: 0, failed: 0, records: [] };

if (queue.records.length && !token) fail('STRIDETO_ADMIN_TOKEN is required for non-empty queue');
let existing = [];
if (queue.records.length) existing = (await api('/admin/jobs?limit=100&page=1')).data || [];

for (const record of queue.records) {
  validateRecord(record);
  const duplicate = existing.find((job) => job.externalId === record.externalId
    || job.sourceUrl === record.sourceUrl
    || job.applicationLink === record.applicationLink
    || job.slug === record.slug
    || (job.company === record.company && job.title === record.title && job.city === record.city));
  if (duplicate || (record.externalId && existingIds.has(record.externalId)) || existingUrls.has(record.sourceUrl)) {
    report.skippedDuplicates += 1;
    continue;
  }
  const created = await api('/admin/jobs', { method: 'POST', body: JSON.stringify(record) });
  const job = created?.job || created;
  const saved = await api(`/admin/jobs/${job._id}`);
  for (const field of ['countryCode', 'region', 'city', 'workMode', 'sourceUrl', 'applicationLink', 'externalId', 'slug', 'seoTitle', 'metaDescription', 'status', 'approvalStatus', 'launchEligible']) {
    if (String(saved[field] ?? '') !== String(record[field] ?? '')) fail(`round-trip mismatch ${record.externalId}: ${field}`);
  }
  audit.records.push({ ...record, jobId: String(saved._id), officialSourceUrl: record.sourceUrl, applicationUrl: record.applicationLink, duplicateCheck: 'no-match', writeResult: 'inserted-valid', verifiedAt: record.verifiedAt });
  existing.push(saved);
  if (record.externalId) existingIds.add(record.externalId);
  existingUrls.add(record.sourceUrl);
  report.inserted += 1;
  report.records.push({ externalId: record.externalId, jobId: String(saved._id) });
  if (writeIntervalMs > 0) await new Promise((resolve) => setTimeout(resolve, writeIntervalMs));
}

audit.campaignRetainedCount = audit.records.length;
if (queue.records.length) await fs.writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ...report, auditCount: audit.records.length }));
