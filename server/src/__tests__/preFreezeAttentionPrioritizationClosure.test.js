import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const controller = fs.readFileSync('server/src/controllers/agentController.js', 'utf8');
const business = fs.readFileSync('server/src/services/gbs/providerWorkspaceSummaryService.js', 'utf8');

test('Education attention uses bounded actionable child queries instead of newest-case truncation', () => {
  assert.match(controller, /export async function getProviderAttention/);
  assert.doesNotMatch(controller, /attentionCases[\s\S]*?limit\(50\)[\s\S]*?attentionCaseIds/);
  assert.match(controller, /CaseTask\.aggregate\(\[/);
  assert.match(controller, /ProfessionalCaseApplication\.aggregate\(\[/);
  assert.match(controller, /CaseDocumentRequest\.aggregate\(\[/);
  assert.match(controller, /responsibleActor: 'agent'/);
  assert.match(controller, /status: \{ \$in: \['preparing', 'ready_for_review', 'needs_changes'\] \}/);
  assert.match(controller, /status: \{ \$in: \['requested', 'available'\] \}/);
  assert.match(controller, /\{ \$limit: 5 \}/);
  assert.match(controller, /'case\.authorizedMembershipIds': membershipId/);
});

test('Business attention filters actionable states before bounded limits', () => {
  assert.match(business, /GbsServiceRequest\.find\(\{ \...provider, status: \{ \$in:/);
  assert.match(business, /GbsQuote\.find\(\{ \...provider, status: 'sent' \}/);
  assert.match(business, /GbsCase\.find\(\{ \...provider, status: \{ \$in:/);
  assert.match(business, /\}\)\.sort\([\s\S]*?\)\.limit\(5\)/);
  assert.doesNotMatch(business, /find\(provider\)[\s\S]*?limit\(50\)/);
});
