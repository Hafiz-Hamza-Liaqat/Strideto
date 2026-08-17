import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('Education list pages request one bounded page and expose accessible navigation', () => {
  const pages = [
    'client/src/pages/Agent/AgentServices.jsx',
    'client/src/pages/Agent/AgentLeads.jsx',
    'client/src/pages/Agent/AgentConsultations.jsx',
    'client/src/pages/Agent/AgentCases.jsx',
    'client/src/pages/Agent/AgentClients.jsx',
    'client/src/pages/Cases/Cases.jsx',
  ];
  for (const path of pages) {
    const source = read(path);
    assert.match(source, /limit(?::|\s*=)\s*20/, `${path} requests a bounded page`);
    assert.match(source, /<Pagination/, `${path} renders pagination`);
    assert.doesNotMatch(source, /while\s*\([^)]*hasNext|fetchAll|loadAllPages/i, `${path} does not prefetch all pages`);
    assert.match(source, /<h1/, `${path} preserves route identity`);
  }
});

test('server list contracts clamp limits, return totals, and use deterministic ordering', () => {
  const profile = read('server/src/services/agentProfileService.js');
  const consultations = read('server/src/services/consultationService.js');
  const cases = read('server/src/services/caseManagementService.js');
  assert.match(profile.split('export async function getServices')[1].split('// ---------------------------------------------------------------------------')[0], /Math\.min\(50,/);
  assert.match(profile, /sort\(\{ createdAt: -1, _id: -1 \}\)/);
  assert.match(profile, /totalPages: Math\.max\(1, Math\.ceil\(total \/ limitNum\)\)/);
  assert.match(consultations, /sort\(\{ createdAt: -1, _id: -1 \}\)/);
  assert.match(cases, /sort\(\{ updatedAt: -1, _id: -1 \}\)/);
  assert.match(cases, /boundedPage\(query\)/);
});

test('Client query is database-side, deduplicated, bounded, and subject scoped', () => {
  const source = read('server/src/services/agentProfileService.js');
  const block = source.split('export async function listClientsForAgent')[1].split('export const agentProfileServiceInternals')[0];
  assert.match(block, /\$unionWith/);
  assert.match(block, /\$group/);
  assert.match(block, /\$facet/);
  assert.match(block, /\$skip/);
  assert.match(block, /\$limit/);
  assert.match(block, /assignedMembershipId: membership\._id/);
  assert.match(block, /authorizedMembershipIds: membership\._id/);
  assert.doesNotMatch(block, /Consultation\.find\(|ProfessionalCase\.find\(|clients\.slice\(/);
});
