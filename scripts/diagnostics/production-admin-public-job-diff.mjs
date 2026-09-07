#!/usr/bin/env node
/* Read-only production diagnostic. Authentication and headers come from productionReadAuth. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductionReadClient } from '../lib/productionReadAuth.mjs';

const key = (job) => String(job?._id || job?.id || job?.externalId || job?.sourceUrl || job?.slug || '');
const norm = (value) => String(value ?? '').trim().toLowerCase();

export const pageItems = (body) => Array.isArray(body?.data) ? body.data : Array.isArray(body?.jobs) ? body.jobs : Array.isArray(body?.items) ? body.items : [];
export const pageTotal = (body) => Number(body?.pagination?.total ?? body?.total ?? 0);

export async function fetchAll(client, endpoint, limit) {
  const all = [];
  for (let page = 1; page <= 1000; page += 1) {
    const body = await client.get(`${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&limit=${limit}`);
    const rows = pageItems(body);
    all.push(...rows);
    const total = pageTotal(body);
    if (!rows.length || all.length >= total || rows.length < limit) return { rows: all, first: body, reportedTotal: total };
  }
  throw new Error('Pagination safety limit reached');
}

export function publicFilterReasons(job, now = Date.now()) {
  const out = [];
  if (job.status !== 'active') out.push(`status=${job.status ?? '(missing)'}`);
  if (job.approvalStatus && job.approvalStatus !== 'approved') out.push(`approvalStatus=${job.approvalStatus}`);
  if (job.publicationState && ['draft', 'pending_review', 'rejected', 'closed', 'expired'].includes(job.publicationState)) out.push(`publicationState=${job.publicationState}`);
  if (job.launchEligible !== true) out.push(`launchEligible=${String(job.launchEligible)}`);
  if (job.isFixture === true || job.demoOnly === true) out.push('fixture/demo record');
  if (['fixture', 'qa', 'test', 'disposable', 'acceptance'].includes(norm(job.dataClass))) out.push(`dataClass=${job.dataClass}`);
  if (['local', 'qa', 'test'].includes(norm(job.environment))) out.push(`environment=${job.environment}`);
  for (const field of ['visibleUntil', 'applicationsCloseAt', 'deadline']) {
    if (job[field] && !Number.isNaN(new Date(job[field]).getTime()) && new Date(job[field]).getTime() < now) out.push(`${field}<now`);
  }
  return out.length ? out : ['not explained by known public filter; inspect locale/projection/data response'];
}

function safeJob(job, now) {
  return {
    id: job._id || job.id || null,
    externalId: job.externalId || null,
    title: job.title || null,
    company: job.company || job.organization || null,
    status: job.status ?? null,
    approvalStatus: job.approvalStatus ?? null,
    launchEligible: job.launchEligible ?? null,
    visibility: job.visibility ?? job.publicationState ?? null,
    suspended: job.suspended ?? job.isSuspended ?? null,
    archived: job.archived ?? null,
    deleted: job.deleted ?? job.isDeleted ?? null,
    deadline: job.deadline ?? null,
    type: job.type ?? null,
    jobType: job.jobType ?? null,
    category: job.category ?? null,
    country: job.country ?? null,
    location: job.location ?? null,
    createdAt: job.createdAt ?? null,
    updatedAt: job.updatedAt ?? null,
    publicFilterReasons: publicFilterReasons(job, now),
  };
}

export function isReadOnlyAudit(audit) {
  return audit.every((request) => request.method === 'GET' || (request.method === 'POST' && request.path === '/auth/login'));
}

export async function runDiagnostic({ client, now = Date.now() } = {}) {
  const readClient = client ?? await createProductionReadClient({ allowedPrefixes: ['/admin/jobs', '/jobs'] });
  const admin = await fetchAll(readClient, '/admin/jobs', 100);
  const publicList = await fetchAll(readClient, '/jobs', 50);
  const publicKeys = new Set(publicList.rows.map(key));
  const publicExternal = new Set(publicList.rows.map((job) => String(job.externalId || '')).filter(Boolean));
  const missing = admin.rows.filter((job) => !publicKeys.has(key(job)) && !(job.externalId && publicExternal.has(String(job.externalId))));
  const requestAudit = readClient.requestAudit ?? [];
  return {
    adminReportedTotal: admin.reportedTotal,
    adminFetched: admin.rows.length,
    publicReportedTotal: publicList.reportedTotal,
    publicFetched: publicList.rows.length,
    adminPagination: admin.first?.pagination || null,
    publicPagination: publicList.first?.pagination || null,
    publicInitialFilters: {},
    adminOnlyCount: missing.length,
    adminOnly: missing.map((job) => safeJob(job, now)),
    authenticationMode: readClient.authenticationMode ?? 'injected-client',
    requestAudit: requestAudit.map(({ method, path: requestPath, purpose, status }) => ({ method, path: requestPath, purpose, status })),
    writeEndpointsUsed: requestAudit.filter((request) => request.method !== 'GET' && !(request.method === 'POST' && request.path === '/auth/login')).map((request) => request.path),
    readOnlyAudit: isReadOnlyAudit(requestAudit),
    note: 'Read-only comparison; no writes, deletes, updates, or credentials printed.',
  };
}

export async function main() {
  const report = await runDiagnostic({ client: await createProductionReadClient({ base: process.env.STRIDETO_API_BASE || undefined, allowedPrefixes: ['/admin/jobs', '/jobs'] }) });
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
