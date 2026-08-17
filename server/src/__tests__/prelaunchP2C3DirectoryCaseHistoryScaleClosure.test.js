import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('public directory performs verification and active-service eligibility inside Mongo', () => {
  const service = read('server/src/services/agentProfileService.js');
  const block = service.split('export async function getPublicDirectory')[1].split('function domainError')[0];
  assert.match(block, /AgentProfile\.aggregate\(pipeline\)/);
  assert.match(block, /OrganizationVerification\.collection\.name/);
  assert.match(block, /AgentService\.collection\.name/);
  assert.match(block, /AGENT_SERVICE_STATUSES\.ACTIVE/);
  assert.match(block, /\$facet/);
  assert.doesNotMatch(block, /approvedOrgIds|svcOrgs|\.distinct\('organizationId'/);
});

test('ProfessionalCase detail returns bounded independent child windows', () => {
  const service = read('server/src/services/caseManagementService.js');
  const block = service.split('export async function getCase')[1].split('function optionalDate')[0];
  for (const key of ['applications', 'tasks', 'documentRequests', 'timeline', 'notes', 'approvals']) assert.match(block, new RegExp(key));
  assert.match(block, /boundedChildren/);
  assert.match(block, /childPagination/);
  assert.match(block, /taskStatus === 'open'/);
  assert.doesNotMatch(block, /CaseEvent\.find\([^)]*\)\.sort\([^)]*\)\.lean\(\)/);
});

test('Provider and Student Case details expose accessible child paging without all-page prefetch', () => {
  const provider = read('client/src/pages/Agent/AgentCaseDetail.jsx');
  const student = read('client/src/pages/Cases/CaseDetail.jsx');
  const component = read('client/src/components/cases/CaseSectionPagination.jsx');
  for (const source of [provider, student]) {
    assert.match(source, /childPagination/);
    assert.match(source, /taskStatus/);
    assert.doesNotMatch(source, /while\s*\([^)]*totalPages|Promise\.all\([^)]*Page/);
  }
  assert.match(component, /<Pagination/);
  assert.match(component, /aria-label/);
});
