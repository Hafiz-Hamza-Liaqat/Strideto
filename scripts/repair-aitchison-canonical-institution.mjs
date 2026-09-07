#!/usr/bin/env node

import readline from 'node:readline/promises';
import { buildReadHeaders, authenticateProductionAdmin } from './lib/productionReadAuth.mjs';

const BASE = 'https://api.strideto.com/api';
const PATH = '/admin/education/institutions/6a9f05e36b553a17cabc1f91';
const EXPECTED_ID = '6a9f05e36b553a17cabc1f91';
const EXPECTED_SLUG = 'aitchison-college-lahore';
const SOURCES = [
  {
    sourceType: 'institution_homepage',
    sourceUrl: 'https://aitchison.edu.pk/',
    publisher: 'Aitchison College',
    retrievedAt: '2026-09-07T23:07:09+05:00',
    verifiedAt: '2026-09-07T23:07:09+05:00',
  },
  {
    sourceType: 'institution_contact',
    sourceUrl: 'https://aitchison.edu.pk/contact-info',
    publisher: 'Aitchison College',
    retrievedAt: '2026-09-07T23:07:09+05:00',
    verifiedAt: '2026-09-07T23:07:09+05:00',
  },
];

const safe = (value) => value ?? null;

function readback(body) {
  return body?.data || body;
}

function safeSnapshot(row) {
  return {
    _id: String(safe(row?._id)),
    officialName: safe(row?.officialName),
    slug: safe(row?.slug),
    institutionType: safe(row?.institutionType),
    countryCode: safe(row?.countryCode),
    region: safe(row?.region),
    city: safe(row?.city),
    district: safe(row?.district),
    address: safe(row?.address),
    officialWebsite: safe(row?.officialWebsite),
    officialDomain: safe(row?.officialDomain),
    isPublic: safe(row?.isPublic),
    description: safe(row?.description),
    logoUrl: safe(row?.logoUrl),
    phone: safe(row?.phone),
    email: safe(row?.email),
    accreditations: safe(row?.accreditations),
    establishedYear: safe(row?.establishedYear),
    status: safe(row?.status),
  };
}

function assertPreconditions(row) {
  if (String(row?._id) !== EXPECTED_ID) throw new Error('Precondition failed: _id mismatch.');
  if (row?.slug !== EXPECTED_SLUG) throw new Error('Precondition failed: slug mismatch.');
  if (row?.status !== 'draft') throw new Error('Precondition failed: status is not draft.');
  if (!Array.isArray(row?.sources) || row.sources.length !== 0) throw new Error('Precondition failed: sources is not empty.');
  if (!(row?.launchEligible === null || row?.launchEligible === undefined || row?.launchEligible === false)) {
    throw new Error('Precondition failed: launchEligible is not null/undefined/false.');
  }
}

async function confirmRepair() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question('Type REPAIR to update exactly these two fields: ')).trim() === 'REPAIR'; }
  finally { rl.close(); }
}

const requestAudit = [];
const auth = await authenticateProductionAdmin(BASE, process.env.STRIDETO_ADMIN_TOKEN || '', requestAudit, { probePath: '/admin/education/institutions?page=1&limit=1' });
const headers = buildReadHeaders({ token: auth.token, cookie: auth.cookie });

async function request(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  requestAudit.push({ method, path, status: response.status });
  if (!response.ok) throw new Error(`${method} ${path} returned HTTP ${response.status}`);
  return response.json();
}

const before = readback(await request('GET', PATH));
assertPreconditions(before);
const mutation = { launchEligible: false, sources: SOURCES };
console.log(JSON.stringify({
  plannedDiff: { launchEligible: { from: safe(before.launchEligible), to: false }, sources: { from: [], to: SOURCES } },
  mutationFields: Object.keys(mutation),
  record: { _id: before._id, slug: before.slug, status: before.status },
}, null, 2));

if (!(await confirmRepair())) {
  console.log(JSON.stringify({ action: 'ABORTED_NO_CONFIRMATION', writes: 0 }, null, 2));
  process.exit(0);
}

await request('PATCH', PATH, mutation);
const after = readback(await request('GET', PATH));
if (String(after?._id) !== EXPECTED_ID || after.slug !== EXPECTED_SLUG || after.status !== 'draft' || after.launchEligible !== false || !Array.isArray(after.sources) || after.sources.length !== 2) {
  throw new Error('Post-repair verification failed; no further action taken.');
}
if (JSON.stringify(safeSnapshot(before)) !== JSON.stringify(safeSnapshot(after))) {
  throw new Error('Post-repair verification detected an unrelated profile mutation.');
}
console.log(JSON.stringify({ action: 'REPAIR_VERIFIED', writes: 1, creates: 0, deletes: 0, publishing: 0, record: { _id: after._id, slug: after.slug, status: after.status, launchEligible: after.launchEligible, sources: after.sources } }, null, 2));
