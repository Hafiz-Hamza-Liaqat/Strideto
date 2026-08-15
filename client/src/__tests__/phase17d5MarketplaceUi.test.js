import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Phase 17D-5 public marketplace UI contract (no jsdom).
 */

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

const hub = read('pages/Public/BusinessServicesMarketplace.jsx');
const detail = read('pages/Public/BusinessServicesListingDetail.jsx');
const card = read('pages/Public/GbsMarketplaceCard.jsx');
const format = read('pages/Public/gbsMarketplaceFormat.js');
const hook = read('hooks/useBusinessServicesMarketplaceEnabled.js');
const api = read('services/gbsMarketplaceApi.js');
const routes = read('routes/index.jsx');
const notFound = read('pages/Static/NotFound.jsx');
const agentPublic = read('pages/Public/AgentPublicProfile.jsx');

check(routes.includes('BusinessServicesMarketplace'), 'hub route registered');
check(routes.includes('BusinessServicesListingDetail'), 'detail route registered');
check(routes.includes('ROUTES.BUSINESS_SERVICES'), 'hub uses ROUTES constant');
check(routes.includes('MainLayoutWrapper') && routes.includes('BusinessServicesMarketplace'), 'marketplace sits under public MainLayout');
check(!routes.includes("path: '/business-services'"), 'literal public path string not used');
check(!routes.includes("pages/Business/"), 'no Business Client pages');
check(!/business\/requests|business\/quotes|business\/cases/.test(routes), 'no request/quote/case routes');

check(hub.includes('<NotFound />'), 'flag-off hub renders NotFound');
check(detail.includes('<NotFound />'), 'flag-off/missing detail renders NotFound');
check(notFound.includes('noindex'), 'NotFound is noindex');
check(hub.includes("enabled !== true || error === 'not_found'") || hub.includes('enabled !== true'), 'unavailable marketplace is NotFound not a teaser');
check(hub.includes("title=\"Business Services | Strideto\""), 'hub SeoHead title');
check(hub.includes('canonical={ROUTES.BUSINESS_SERVICES}'), 'hub canonical');
check(hub.includes('<h1'), 'hub has h1');
check(hub.includes('htmlFor="gbs-search"'), 'search labelled');
check(hub.includes('htmlFor="gbs-capability"') && hub.includes('htmlFor="gbs-jurisdiction"'), 'filters labelled');
check(hub.includes('htmlFor="gbs-sort"'), 'sort labelled');
check(hub.includes("aria-busy=\"true\""), 'loading uses aria-busy');
check(hub.includes('role="alert"'), 'API error is announced');
check(hub.includes('No Business Services listings are publicly available yet.'), 'empty marketplace state');
check(hub.includes('No listings match these filters.'), 'no-results state');
check(hub.includes("value=\"newest\"") && hub.includes("value=\"title\""), 'sort newest/title only');
check(!/Recommended|Best|Top Provider|Most Trusted|Featured|Sponsored/.test(hub + detail + card), 'no paid ranking copy');

check(card.includes('View Details'), 'cards CTA is View Details');
check(card.includes('<Link to={to}'), 'cards use links');
check(card.includes('providerKindLabel'), 'Independent/Agency is text, not color-only');
check(card.includes('verificationBadge'), 'capability verification badge on cards');
check(card.includes('formatProfessionalFee'), 'card shows professional fee summary');
check(card.includes('break-words-safe'), 'long titles wrap');

check(detail.includes('Professional service fee'), 'detail labels professional fee');
check(detail.includes('Official/government fee'), 'detail labels government fee separately');
check(detail.includes('Official fee not listed here'), 'absent official fee is truthful');
check(detail.includes('Provider estimate'), 'turnaround is a provider estimate');
check(detail.includes('consultationAvailable'), 'consultation is factual only');
check(!/Request Service|Get Quote|Contact Provider|Hire\b|Start Formation|Sign in to continue/.test(hub + detail + card), 'no transactional CTAs');
check(!/disabled.*Request|disabled.*Quote|disabled.*Contact/.test(hub + detail + card), 'no fake disabled transactional buttons');
check(!/ProfessionalReview|averageRating|reviewCount|success rate|completed jobs/.test(hub + detail + card + format), 'no GBS ratings or education review reuse');
check(!/tel:|mailto:|whatsapp|WhatsApp/.test(hub + detail + card), 'no GBS contact leakage');
check(!detail.includes('Request consultation') && !detail.includes('Sign in to request consultation'), 'education consultation CTA not reused');
check(detail.includes('AggregateRating') === false && !detail.includes('aggregateRating'), 'no fake AggregateRating');
check(detail.includes("'@type': 'Service'") && detail.includes("'@type': 'Offer'"), 'JSON-LD Service/Offer only when price exists');
check(detail.includes("summary.kind === 'quote_required'"), 'quote_required does not invent JSON-LD price');
check(detail.includes('canonical={canonical}'), 'detail canonical');
check(detail.includes('<h1'), 'detail has h1');
check(detail.includes('<h2'), 'detail has h2 hierarchy');

check(format.includes("summary.kind === 'quote_required'") && format.includes("return 'Quote required'"), 'quote_required is not formatted as 0');
check(format.includes("'Agency' : 'Independent'"), 'provider kind labels');

check(api.includes('/business-services/enabled'), 'anonymous enabled client');
check(api.includes('/business-services/listings'), 'anonymous list client');
check(!/\.post\(|\.patch\(|\.put\(/.test(api), 'marketplace API client is read-only');
check(hook.includes('gbsMarketplaceApi'), 'enabled hook uses public probe');

check(agentPublic.includes('Request consultation') || agentPublic.includes('Sign in to request consultation'), 'education public profile still has its own CTA');
check(agentPublic.includes('Verified interaction reviews'), 'education reviews remain on /agents, not GBS');

console.log(`phase17d5MarketplaceUi.test.js: ${count} assertions passed`);
