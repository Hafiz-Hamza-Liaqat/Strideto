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
const list = read('pages/Agent/business-services/GbsQuotes.jsx');
const detail = read('pages/Agent/business-services/GbsQuoteDetail.jsx');
const request = read('pages/Agent/business-services/GbsRequestDetail.jsx');
const routes = read('routes/index.jsx');

check(nav.includes("label: 'Quotes'"), 'Business nav Quotes');
check(layout.includes('Quotes') && layout.includes('Service Requests'), 'workspace subnav includes Quotes after Requests');
check(!/Payout|Mailroom|Formation Case|PDF/.test(nav + layout), 'no payment/payout/case/PDF nav');

check(list.includes('No quotes for this subject'), 'empty state');
check(list.includes('htmlFor="gbs-quote-status"'), 'status filter labelled');
check(list.includes('View Quote') && list.includes('Pagination'), 'list + pagination');
check(list.includes('quotes.manage') || list.includes('do not have access'), 'view-only permission error');

check(request.includes('Create Quote'), 'ready request can create a quote');
check(request.includes('gbsProviderApi.createQuote'), 'create uses provider quote API');
check(request.includes('quotes.manage'), 'create surfaces quotes.manage denial');

check(detail.includes('Professional Service Fees') && detail.includes('Official / Government Fees'), 'draft editor fee sections');
check(detail.includes('htmlFor={`fee-label-${index}`}') || detail.includes('htmlFor={`fee-amount-${index}`}'), 'money inputs labelled');
check(detail.includes('htmlFor={`fee-currency-${index}`}'), 'currency associated with amounts');
check(detail.includes('fromDecimal'), 'amounts converted with canonical helper');
check(detail.includes('availableOfficialFees'), 'catalog official fee selection');
check(detail.includes('htmlFor="quote-terms"') && detail.includes('htmlFor="quote-days"'), 'terms and expiry labelled');
check(detail.includes('Fixed listing price must match'), 'fixed price validation copy');
check(detail.includes('Starting-at listing'), 'starting_at validation copy');
check(detail.includes('Range listing'), 'range validation copy');
check(detail.includes('Quote required'), 'quote_required hint');
check(detail.includes('Send quote') && detail.includes('Withdraw'), 'send and withdraw');
check(detail.includes('quotes.manage duty'), 'write denial for requests.manage-only members');
check(!/innerHTML|dangerouslySetInnerHTML/.test(detail), 'no raw HTML');
check(!/Payout|PDF|Mailroom|Formation Case|Proceed to Payment/.test(detail), 'no later-product provider controls');
check(detail.includes('role="alert"') || detail.includes('errorBox'), 'errors announced');

check(routes.includes('GbsQuotes') && routes.includes("path: 'quotes'"), 'nested provider quote routes');
check(routes.includes('GbsQuoteDetail'), 'provider quote detail route');

console.log(`phase17d7ProviderQuoteUi.test.js: ${count} assertions passed`);
