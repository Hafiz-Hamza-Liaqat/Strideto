#!/usr/bin/env node

import { createProductionReadClient } from './lib/productionReadAuth.mjs';

const BASE = 'https://api.strideto.com/api';
const SAFE_FIELDS = [
  '_id', 'officialName', 'slug', 'institutionType', 'countryCode', 'region', 'city',
  'district', 'address', 'officialWebsite', 'officialDomain', 'isPublic', 'description',
  'logoUrl', 'phone', 'email', 'accreditations', 'establishedYear', 'status',
  'launchEligible', 'sources',
];

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || '';
}

const id = argument('id');
const slug = argument('slug');
if (!id && !slug) {
  console.error('Usage: node scripts/inspect-canonical-institution-readback.mjs --id=...');
  process.exitCode = 1;
} else {
  const client = await createProductionReadClient({
    base: BASE,
    allowedPrefixes: ['/admin/education/institutions'],
  });
  const path = id
    ? `/admin/education/institutions/${encodeURIComponent(id)}`
    : `/admin/education/institutions?search=${encodeURIComponent(slug)}&page=1&limit=20`;
  const body = await client.get(path);
  const rows = id ? [body?.data || body] : (Array.isArray(body?.data) ? body.data : []);
  const selected = id ? rows : rows.filter((row) => row?.slug === slug);
  console.log(JSON.stringify(selected.map((row) => Object.fromEntries(SAFE_FIELDS.map((field) => [field, row?.[field] ?? null]))), null, 2));
}
