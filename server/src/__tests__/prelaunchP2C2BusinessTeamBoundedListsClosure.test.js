import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('Business Messages exposes one bounded thread window with server-side context filtering', () => {
  const page = read('client/src/pages/Agent/business-services/GbsMessages.jsx');
  const service = read('server/src/services/gbs/gbsContextMessagingService.js');
  assert.match(page, /limit:\s*20/); assert.match(page, /<Pagination/); assert.match(page, /contextType/);
  assert.doesNotMatch(page, /page:\s*1,\s*limit:\s*50/);
  assert.match(service, /filter\.contextType = query\.contextType/);
  assert.match(service, /sort\(\{ lastMessageAt: -1, _id: -1 \}\)/);
  assert.doesNotMatch(service.split('listProviderGbsMessageThreads')[1], /GbsContextMessage\.find/);
});

test('Business listing UI consumes bounded metadata and canonical status filters', () => {
  const page = read('client/src/pages/Agent/business-services/GbsListings.jsx');
  const service = read('server/src/services/gbs/serviceListingService.js');
  assert.match(page, /limit:\s*20/); assert.match(page, /<Pagination/); assert.match(page, /GBS_LISTING_MODERATION_STATUSES/);
  assert.match(service, /LIST_PAGE_MAX/); assert.match(service, /totalPages/);
  assert.match(service, /sort\(\{ updatedAt: -1, _id: -1 \}\)/);
});

test('shared Team retrieval is domain-filtered, database-side, bounded, and batch enriched', () => {
  const page = read('client/src/pages/Agent/AgentTeam.jsx');
  const service = read('server/src/services/agentProfileService.js');
  const block = service.split('export async function getOrgMembers')[1].split('export async function updateMemberRole')[0];
  assert.match(page, /focusDomainId/); assert.match(page, /limit:\s*20/); assert.match(page, /<Pagination/);
  assert.match(block, /\$elemMatch/); assert.match(block, /\$lookup/); assert.match(block, /\$facet/); assert.match(block, /\$limit/);
  assert.doesNotMatch(block, /AgentMembership\.find\(\{ organizationId:[\s\S]*\.lean\(\)/);
  assert.doesNotMatch(block, /members\.map[\s\S]*AgentAccount\.find/);
});

