import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..');
function read(rel) {
  return readFileSync(path.join(src, rel), 'utf8');
}

const nav = read('config/agentNavConfig.js');
const layout = read('pages/Agent/business-services/GbsWorkspaceLayout.jsx');
const inbox = read('pages/Agent/business-services/GbsRequests.jsx');
const detail = read('pages/Agent/business-services/GbsRequestDetail.jsx');
const eduDash = read('pages/Agent/AgentDashboard.jsx');

check(nav.includes("label: 'Requests'"), 'Business nav Requests');
check(nav.includes("label: 'Business Verification'"), 'Business Verification placement preserved');
check(!eduDash.includes('Service Requests'), 'Education dashboard does not add GBS requests');
check(layout.includes("label: 'Requests'") && layout.includes("label: 'My Services'"), 'workspace subnav');

check(inbox.includes('customerDisplayName') && inbox.includes('htmlFor="gbs-request-status"'), 'inbox customer + status filter');
check(inbox.includes('Pagination') && inbox.includes('View request'), 'pagination and view');
check(!/revenue|Quote value|payment state/i.test(inbox), 'no revenue/quote/payment columns');
check(inbox.includes('break-words-safe') || inbox.includes('wrap'), 'long names wrap');

check(detail.includes('Mark Reviewing') && detail.includes('Ready for Quote') && detail.includes('Decline'), 'lifecycle actions');
check(detail.includes('Create Quote'), 'ready-for-quote request can create a quote');
check(detail.includes('AdminConfirmDialog') && detail.includes('decline-reason'), 'decline dialog');
check(detail.includes('customerSummary') && detail.includes('whitespace-pre-wrap'), 'requirements as text');
check(!detail.includes('Quote composer') && !/document upload|payment control|case control/i.test(detail), 'no later-product controls');
check(detail.includes("status === 403") || detail.includes('permission'), 'permission denied state');

console.log(`phase17d6ProviderRequestUi.test.js: ${count} assertions passed`);
