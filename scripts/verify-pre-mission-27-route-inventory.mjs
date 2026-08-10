import fs from 'node:fs';
import path from 'node:path';
import { buildRouteInventory, repoRoot } from './lib/preMission27RouteInventory.mjs';

const inventory = buildRouteInventory();
const realmTotals = Object.fromEntries(['PUBLIC', 'STUDENT', 'EMPLOYER', 'AGENT', 'INSTITUTION', 'ADMIN'].map((realm) => [realm, inventory.records.filter((record) => record.realm === realm).length]));
const output = path.join(repoRoot, '.tmp', 'pre-mission27-route-inventory.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ ...inventory, realmTotals }, null, 2));

console.log(JSON.stringify({
  routes: inventory.records.length,
  realmTotals,
  missingPages: inventory.findings.missingPages.length,
  duplicatePatterns: inventory.findings.duplicatePatterns,
  staleNavigation: inventory.findings.staleNavigation,
  matrix: path.relative(repoRoot, output).replaceAll('\\', '/'),
}, null, 2));

if (inventory.findings.missingPages.length || inventory.findings.duplicatePatterns.length || inventory.findings.staleNavigation.length) process.exitCode = 1;
