#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routesRoot = path.join(root, 'server', 'src', 'routes');
const controllersRoot = path.join(root, 'server', 'src', 'controllers');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : entry.name.endsWith('.js') ? [target] : [];
  });
}

const guardPattern = /\b(?:protect|authenticate\w*|require(?:Admin|Staff|Role|Permission|SuperAdmin|Employer|Agent|Institution)\w*|authorize\w*|secureAccess\w*|verify\w*Token|auth)\b/i;
const routeFiles = walk(routesRoot);
const endpoints = [];
for (const file of routeFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const inheritedGuard = /\.use\s*\([^)]*(?:protect|authenticate|requireAdmin|requireStaff|requirePermission|requireRole|secureAccess)/is.test(source);
  for (const match of source.matchAll(/\b([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g)) {
    const line = source.slice(0, match.index).split('\n').length;
    const snippet = source.slice(match.index, Math.min(source.length, match.index + 1_200)).split(/\n\s*\);?/)[0];
    const method = match[2].toUpperCase();
    endpoints.push({
      file: path.relative(root, file).replaceAll('\\', '/'), line, router: match[1], method, path: match[3],
      operation: method === 'GET' ? 'read' : 'mutation',
      guard: guardPattern.test(snippet) ? 'direct' : inheritedGuard ? 'router-inherited' : 'public-or-controller-authorized',
    });
  }
}

const sensitiveBodyPattern = /(?:\.create\s*\(\s*req\.body|\.insertMany\s*\(\s*req\.body|find(?:One|ById)?AndUpdate\s*\([^,]+,\s*req\.body|\.update(?:One|Many)\s*\([^,]+,\s*req\.body|\{\s*\.\.\.req\.body\s*\})/g;
const directBodyMutationCandidates = [];
for (const file of walk(controllersRoot)) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(sensitiveBodyPattern)) {
    directBodyMutationCandidates.push({
      file: path.relative(root, file).replaceAll('\\', '/'),
      line: source.slice(0, match.index).split('\n').length,
      category: 'DIRECT_REQUEST_BODY_PERSISTENCE_REVIEW_REQUIRED',
    });
  }
}

const priorityPatterns = {
  profiles: /profile|user/i, jobs: /job/i, applications: /application/i, Vault: /vault/i,
  'Skill Trust': /skill/i, marketplace: /marketplace/i, consultations: /consultation/i,
  cases: /case/i, 'reviews/reports': /review|report|trust/i, Commerce: /commerce|payment/i,
  'Institution Programs': /institution|education/i, 'Admin actions': /admin/i, notifications: /notification|inbox/i,
};
const priorityCoverage = Object.fromEntries(Object.entries(priorityPatterns).map(([name, pattern]) => [name, endpoints.some((entry) => pattern.test(entry.file) || pattern.test(entry.path))]));
const methodTotals = Object.fromEntries(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => [method, endpoints.filter((entry) => entry.method === method).length]));
const guardTotals = Object.fromEntries(['direct', 'router-inherited', 'public-or-controller-authorized'].map((guard) => [guard, endpoints.filter((entry) => entry.guard === guard).length]));
const summary = {
  routeFiles: routeFiles.length,
  endpoints: endpoints.length,
  reads: endpoints.filter((entry) => entry.operation === 'read').length,
  mutations: endpoints.filter((entry) => entry.operation === 'mutation').length,
  methodTotals,
  guardTotals,
  priorityCoverage,
  directBodyMutationCandidates,
};

assert.ok(endpoints.length > 0, 'route endpoint inventory must not be empty');
assert.ok(Object.values(priorityCoverage).every(Boolean), 'every release-priority resource must be represented');
assert.equal(directBodyMutationCandidates.length, 0, `unsafe direct request-body persistence candidates: ${JSON.stringify(directBodyMutationCandidates)}`);
console.log(JSON.stringify(summary, null, 2));
