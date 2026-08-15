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

const layout = read('pages/BusinessClient/BusinessClientLayout.jsx');
const home = read('pages/BusinessClient/BusinessClientOverview.jsx');
const list = read('pages/BusinessClient/BusinessClientRequests.jsx');
const form = read('pages/BusinessClient/BusinessClientRequestForm.jsx');
const detail = read('pages/BusinessClient/BusinessClientRequestDetail.jsx');
const routes = read('routes/index.jsx');
const cta = read('pages/Public/GbsListingRequestCta.jsx');
const card = read('pages/Public/GbsMarketplaceCard.jsx');

check(layout.includes('Activate Business Services'), 'activation copy');
check(layout.includes('does not verify your identity'), 'activation does not claim identity verification');
check(layout.includes("error: 'unavailable'") || layout.includes('Business Services unavailable'), 'staff unavailable state');
check(layout.includes('Overview') && layout.includes('Service Requests') && layout.includes('Quotes'), 'IA: overview + requests + quotes');
check(!/Payments|Formation Cases|Messages|Documents|My Businesses/.test(layout + home), 'no later-product nav');

check(home.includes('Active / pre-quote'), 'overview active count');
check(home.includes('No service requests yet') || home.includes('empty'), 'empty state');
check(home.includes('BUSINESS_SERVICES'), 'marketplace discovery link');

check(form.includes('<fieldset>') && form.includes('<legend'), 'actingFor fieldset');
check(form.includes('htmlFor="customer-summary"'), 'summary labelled');
check(form.includes('htmlFor="existing-business-name"'), 'business name labelled');
check(form.includes('role="alert"'), 'form errors announced');
check(form.includes('creationCommandId'), 'idempotent command id');
check(!/passport|national ID|bank details|card number/i.test(form), 'no ID/payment collection');

check(list.includes('View request') && list.includes('Pagination'), 'list + pagination');
check(detail.includes('Service Request') && detail.includes('publicRequestRef'), 'detail reference');
check(detail.includes('Cancel request') && detail.includes('AdminConfirmDialog'), 'cancel confirmation');
check(detail.includes('submitted') && detail.includes('provider_reviewing') && detail.includes('ready_for_quote'), 'status cancel allowlist');
check(detail.includes('whitespace-pre-wrap'), 'summary rendered as text');
check(!detail.includes('Quote composer') && !/Formation Case|WebSocket/i.test(detail), 'no quote/case/chat');

check(cta.includes('Request Service') && cta.includes('ROUTES.LOGIN'), 'anonymous Request Service → login');
check(card.includes('View Details') && !card.includes('Request Service'), 'cards stay View Details');
check(routes.includes('BusinessClientLayout') && routes.includes("path: 'requests'"), 'buyer request routes nested');
check(!routes.includes("pages/Business/"), 'BusinessClient folder, not pages/Business/');

console.log(`phase17d6BuyerUi.test.js: ${count} assertions passed`);
