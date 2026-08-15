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
const list = read('pages/BusinessClient/BusinessClientQuotes.jsx');
const detail = read('pages/BusinessClient/BusinessClientQuoteDetail.jsx');
const routes = read('routes/index.jsx');
const requestDetail = read('pages/BusinessClient/BusinessClientRequestDetail.jsx');

check(layout.includes('Quotes'), 'Quotes nav present');
check(layout.includes("to={`${ROUTES.BUSINESS}/quotes`}"), 'Quotes nav targets nested quotes');
check(!/Payments|Formation Cases|Messages|Documents/.test(layout), 'no later-product customer nav');

check(list.includes('No quotes yet'), 'empty state');
check(list.includes('View Quote') && list.includes('Pagination'), 'list + pagination');
check(list.includes('overflow-x-auto'), 'table scrolls on narrow viewports');
check(list.includes('quoteStatusLabel') && list.includes('subtotalProfessionalMinor'), 'status and professional subtotal');
check(list.includes('officialFeeGroups') || list.includes('Official fees'), 'official fee indicator');
check(!/Pay|Formation Case|Upload Documents|Messages/.test(list), 'list has no pay/case/docs/chat');

check(detail.includes('<h2') && detail.includes('Service / Provider'), 'semantic headings');
check(detail.includes('Professional Service Fees') && detail.includes('Official / Government Fees'), 'fee sections separated');
check(detail.includes('Currencies are shown separately'), 'mixed-currency grand total omitted');
check(detail.includes('Accept quote') && detail.includes('Decline quote'), 'accept/decline actions');
check(detail.includes('does not take payment') && detail.includes('service Case'), 'accept confirmation copy');
check(detail.includes('does not') && detail.includes('government approval'), 'no government-approval guarantee');
check(detail.includes('AdminConfirmDialog') && detail.includes('open={acceptOpen}'), 'accessible accept dialog');
check(detail.includes('open={declineOpen}') && detail.includes('htmlFor="quote-decline-reason"'), 'accessible decline dialog');
check(detail.includes("error: 'quote_expired'") || detail.includes('This quote has expired'), 'expired error');
check(detail.includes('Business Services access is not active') || detail.includes('business_client_required'), 'grant-loss error');
check(detail.includes("status === 404") && detail.includes('Quote not found'), 'ownership 404');
check(detail.includes('whitespace-pre-wrap') && !detail.includes('innerHTML') && !detail.includes('dangerouslySetInnerHTML'), 'terms as text');
check(detail.includes('role="alert"') && detail.includes('aria-busy'), 'errors and loading announced');
check(!/Pay now|Proceed to Payment|Upload Documents|Start Formation|Messages/.test(detail), 'no pay/docs/case/chat');

check(requestDetail.includes(`${'ROUTES.BUSINESS'}`) && requestDetail.includes('/quotes'), 'request detail links to quotes');
check(requestDetail.includes('quote_decision_required'), 'sent-quote cancel 409 surfaced');

check(routes.includes('BusinessClientQuotes') && routes.includes("path: 'quotes'"), 'nested customer quote routes');
check(!routes.includes("pages/Business/"), 'pages live under BusinessClient');

console.log(`phase17d7BuyerUi.test.js: ${count} assertions passed`);
