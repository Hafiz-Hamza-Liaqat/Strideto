/**
 * Phase 17D-7 — GBS Quotes source contract.
 * Run: node src/__tests__/phase17d7SourceContract.test.js
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  isBusinessServicesPublicMarketplaceEnabled,
  GBS_COMMAND_IDS,
  GBS_SERVICE_REQUEST_STATUSES,
  GBS_PRICING_MODES,
} from '../../../shared/gbs/constants.js';
import { PROVIDER_DOMAIN_PERMISSIONS, defaultPermissionsForInvite } from '../../../shared/provider/providerDomainPermissions.js';
import { PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { AGENT_MEMBER_ROLES } from '../../../shared/agent/constants.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../shared/security/gbsAuditEvents.js';
import {
  QUOTE_STATUSES,
  QUOTE_STATUSES_EMITTED,
  assertListingPriceHonesty,
  computeQuoteTotals,
  isOpaqueQuoteRef,
  snapshotOfficialFee,
  validateQuoteContract,
} from '../../../shared/gbs/quoteContract.js';
import { allowlistedCreateInput, allowlistedDraftUpdate } from '../../../shared/gbs/quote.js';
import { fromDecimal } from '../../../shared/international/money.js';
import { FEE_AMOUNT_MODELS } from '../../../shared/gbs/catalogConstants.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

check(existsSync(path.join(root, 'server/src/models/gbs/GbsQuote.js')), 'GbsQuote model exists');
check(!existsSync(path.join(root, 'server/src/models/gbs/FormationCase.js')), 'no FormationCase model');
check(!existsSync(path.join(root, 'server/src/models/gbs/Quote.js')), 'no sequential Quote alias model');

const model = read('server/src/models/gbs/GbsQuote.js');
check(model.includes('publicQuoteRef'), 'opaque publicQuoteRef field');
check(!/quoteNumber|Q-000001/.test(model), 'no sequential quote number authority');
check(!/paidAt|paymentIntent|caseId|commission|payout|refund/.test(model), 'no payment/case fields');
check(model.includes("name: 'gbs_quote_public_ref_unique'"), 'named public ref unique index');
check(model.includes("name: 'gbs_quote_creation_command_unique'"), 'named creation command unique index');
check(model.includes("name: 'gbs_quote_active_slot_unique'"), 'named active-slot unique index');
check(model.includes("status: { $in: ['draft', 'sent'] }"), 'active slot is draft or sent only');
check(QUOTE_STATUSES_EMITTED.includes('expired') && QUOTE_STATUSES_EMITTED.includes('declined'), 'expired and declined are emitted');
check(!QUOTE_STATUSES_EMITTED.includes(QUOTE_STATUSES.SUPERSEDED), 'superseded is not emitted');

const statuses = Object.values(GBS_SERVICE_REQUEST_STATUSES);
check(!statuses.includes('quote_sent') && !statuses.includes('quote_accepted') && !statuses.includes('quote_declined'), 'no quote_* ServiceRequest statuses');

check(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE === 'business_services.quotes.manage', 'quotes.manage duty');
check(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_REQUESTS_MANAGE !== PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE, 'requests.manage does not imply quotes.manage');
const memberDefaults = defaultPermissionsForInvite({
  domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  role: AGENT_MEMBER_ROLES.MEMBER,
});
check(memberDefaults.includes(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW), 'ordinary member gets view');
check(!memberDefaults.includes(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE), 'ordinary member is not auto-granted quotes.manage');
const ownerDefaults = defaultPermissionsForInvite({
  domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  role: AGENT_MEMBER_ROLES.OWNER,
});
check(ownerDefaults.includes(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_QUOTES_MANAGE), 'owner receives quotes.manage with domain catalog');

check(GBS_COMMAND_IDS.QUOTE_CREATE === 'gbs.quote.create', 'create command id');
check(GBS_COMMAND_IDS.QUOTE_SEND === 'gbs.quote.send', 'send command id');
check(GBS_COMMAND_IDS.QUOTE_ACCEPT === 'gbs.quote.accept', 'accept command id');
check(GBS_COMMAND_IDS.QUOTE_DECLINE === 'gbs.quote.decline', 'decline command id');
check(GBS_COMMAND_IDS.QUOTE_WITHDRAW === 'gbs.quote.withdraw', 'withdraw command id');

check(GBS_AUDIT_EVENTS.GBS_QUOTE_CREATED === 'gbs_quote_created', 'created audit');
check(GBS_AUDIT_EVENTS.GBS_QUOTE_EXPIRED === 'gbs_quote_expired', 'expired audit');
const redacted = redactAuditMetadata({ providerTerms: 'secret terms', declineNote: 'private', publicQuoteRef: 'abc' });
check(!redacted.providerTerms && !redacted.declineNote && redacted.publicQuoteRef === 'abc', 'audit redacts terms/notes');

check(isOpaqueQuoteRef('opaqueQuoteRef_17d7_abc123XYZ'), 'opaque ref accepted');
check(!isOpaqueQuoteRef('Q-000001') && !isOpaqueQuoteRef('QT-0001'), 'sequential quote numbers rejected');
check(!isOpaqueQuoteRef('64b1f0c2a1b2c3d4e5f60789'), 'raw ObjectId rejected');

const contract = read('shared/gbs/quoteContract.js');
check(contract.includes("from '../international/money.js'"), 'quote contract uses canonical money helpers');
check(!/\*\s*100/.test(contract), 'no amount * 100 commercial math');
check(!/Number\.isFinite/.test(contract), 'no Number.isFinite commercial totals');
const svc = read('server/src/services/gbs/gbsQuoteService.js');
check(svc.includes('fromDecimal') || contract.includes('fromDecimal'), 'catalog conversion uses fromDecimal');
check(svc.includes('normalizeExpiredQuoteForMutation'), 'lazy persisted expiration helper');
check(svc.includes('assertNoAcceptedQuote') || svc.includes("status: Q.ACCEPTED"), 'accepted quote blocks replacement');
check(svc.includes('READY_FOR_QUOTE'), 'create requires ready_for_quote');
check(!svc.includes('startWorker') && !svc.includes('edurozgaar-staging-worker'), 'quote service does not start worker');
check(!/paidAt|paymentIntent|FormationCase/.test(svc), 'service has no payment/case writes');

const totals = computeQuoteTotals({
  currency: 'USD',
  professionalFeeLines: [{ amountMinor: 50000, currency: 'USD' }],
  officialFeeLines: [{
    listed: true,
    amountMinor: 10000,
    currency: 'GBP',
    amountModel: FEE_AMOUNT_MODELS.FIXED,
  }],
});
check(totals.subtotalProfessionalMinor === 50000, 'professional subtotal is integer minor units');
check(totals.totalCustomerAmountMinor == null, 'mixed currencies omit grand total');
check(totals.officialFeeGroups.some((g) => g.currency === 'GBP'), 'official fees grouped by catalog currency');

const fixedOk = assertListingPriceHonesty(
  { pricingMode: GBS_PRICING_MODES.FIXED, providerFeeLines: [{ amountMinor: 50000, currency: 'USD' }] },
  50000,
  'USD'
);
check(fixedOk.ok, 'fixed listing exact match');
const fixedBad = assertListingPriceHonesty(
  { pricingMode: GBS_PRICING_MODES.FIXED, providerFeeLines: [{ amountMinor: 50000, currency: 'USD' }] },
  60000,
  'USD'
);
check(fixedBad.ok === false && fixedBad.error === 'fixed_price_mismatch', 'fixed mismatch denied');
const startBad = assertListingPriceHonesty(
  { pricingMode: GBS_PRICING_MODES.STARTING_AT, providerFeeLines: [{ amountMinor: 40000, currency: 'USD' }] },
  30000,
  'USD'
);
check(startBad.error === 'starting_at_undercut', 'starting_at cannot undercut');
const rangeBad = assertListingPriceHonesty(
  {
    pricingMode: GBS_PRICING_MODES.RANGE,
    providerFeeLines: [
      { amountMinor: 20000, currency: 'USD' },
      { amountMinor: 80000, currency: 'USD' },
    ],
  },
  90000,
  'USD'
);
check(rangeBad.error === 'range_price_outside', 'range outside denied');
check(assertListingPriceHonesty({ pricingMode: GBS_PRICING_MODES.QUOTE_REQUIRED }, 12345, 'USD').ok, 'quote_required accepted');

const wySnap = snapshotOfficialFee({
  feeId: 'fee:US-WY-llc-articles',
  label: 'Wyoming LLC Articles',
  currency: 'USD',
  amountModel: FEE_AMOUNT_MODELS.FIXED,
  amount: 100,
  eligibleCurrent: true,
  cadence: 'one_time',
  sourceId: 'src:US-WY-fees',
  sourceVersion: 1,
});
check(wySnap.amountMinor === fromDecimal(100, 'USD').amountMinor, 'catalog major units convert via fromDecimal');
check(wySnap.ownership === 'government', 'official snapshot ownership is government');

const mixedCreate = allowlistedCreateInput({ listingId: 'x', status: 'sent' });
check(mixedCreate.ok === false, 'create body rejects authority/status fields');
const thirdParty = allowlistedDraftUpdate({
  expectedVersion: 0,
  professionalFeeLines: [{ label: 'Work', amountMinor: 1000, currency: 'USD' }],
  thirdPartyFeeLines: [{ label: 'Courier', amountMinor: 1, currency: 'USD' }],
});
check(thirdParty.ok === false, 'third-party fee input rejected');
const valid = validateQuoteContract({
  publicQuoteRef: 'opaqueQuoteRef_17d7_abc123XYZ',
  revision: 1,
  status: 'draft',
  currency: 'USD',
  professionalFeeLines: [{ label: 'Work', amountMinor: 1000, currency: 'USD' }],
  thirdPartyFeeLines: [{ label: 'nope' }],
  recordVersion: 0,
});
check(valid.ok === false, 'contract rejects non-empty thirdPartyFeeLines');

const buyerRoutes = read('server/src/routes/gbsBuyer.js');
check(buyerRoutes.includes("'/business/quotes/:quoteRef/accept'"), 'customer accept route');
check(buyerRoutes.includes("'/business/quotes/:quoteRef/decline'"), 'customer decline route');
check(buyerRoutes.includes('secureTrustedOrigin') && buyerRoutes.includes('gbsBuyerWriteLimiter'), 'buyer mutations origin + limiter');
check(!buyerRoutes.includes('/pay') && !buyerRoutes.includes('/cases'), 'no payment/case buyer routes');
check(buyerRoutes.includes('businessClientProductAuth'), 'buyer quotes use business client product auth');

const agentRoutes = read('server/src/routes/agent.js');
check(agentRoutes.includes("'/agent/business-services/requests/:requestRef/quote'"), 'provider create from request');
check(agentRoutes.includes("'/agent/business-services/quotes/:quoteRef/send'"), 'provider send');
check(agentRoutes.includes("'/agent/business-services/quotes/:quoteRef/withdraw'"), 'provider withdraw');
check(agentRoutes.includes('gbsQuoteWriteLimiter') && agentRoutes.includes('secureTrustedOrigin'), 'provider quote writes origin + limiter');
check(!agentRoutes.includes('/quotes/:quoteRef/accept'), 'provider cannot accept');
check(!agentRoutes.includes('/formation') && !agentRoutes.includes('/payout'), 'no formation/payout provider routes');

const auth = read('server/src/middleware/auth.js');
check(!auth.includes("realm === 'business_client'"), 'no fifth auth realm');

const capMw = read('server/src/middleware/requireUserCapability.js');
check(capMw.includes('requireNonStaffUser') && capMw.includes('businessClientProductAuth'), 'staff cannot act as Business Client');

const rate = read('server/src/middleware/rateLimit.js');
check(rate.includes('gbsQuoteWriteLimiter'), 'quote write limiter exists');

const envExample = read('.env.example');
check(/BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0/.test(envExample), 'committed marketplace default OFF');
check(isBusinessServicesPublicMarketplaceEnabled({}) === false, 'runtime marketplace default OFF');
check(!/MONGO_AUTO_INDEX=1/.test(envExample), 'committed env does not enable autoIndex');

const dbCfg = read('server/src/config/db.js');
check(dbCfg.includes("autoIndex: process.env.MONGO_AUTO_INDEX === '1'"), 'autoIndex stays opt-in');
check(!/autoIndex:\s*true/.test(dbCfg), 'db.js does not force autoIndex true');

const provision = read('server/src/services/platform/criticalIndexProvision.js');
check(provision.includes('GBS_QUOTE_CRITICAL_INDEXES'), 'quote critical indexes declared');
check(provision.includes('gbs_quote_active_slot_unique'), 'active-slot index provisioned');
check(!/\.syncIndexes\s*\(/.test(provision), 'provisioner never syncIndexes');
check(!provision.includes('dropIndex') && !provision.includes('dropIndexes'), 'provisioner never drops indexes');
check(provision.includes('quoteCollection') || provision.includes('GbsQuote.collection'), 'quote collection is provisioned');

const boot = read('server/src/index.js');
check(boot.includes('provisionCriticalIdempotencyIndexes'), 'startup provisions critical indexes');
check(!/\.syncIndexes\s*\(/.test(boot), 'startup does not syncIndexes');

const clientRoutes = read('client/src/routes/index.jsx');
check(clientRoutes.includes("path: 'quotes'"), 'nested quotes routes');
check(!clientRoutes.includes('business/quotes'), 'no literal business/quotes path string');
check(!/FormationCase|Mailroom|QuotePdf|quote PDF/i.test(clientRoutes), 'no case/mailroom/PDF routes');

const buyerDetail = read('client/src/pages/BusinessClient/BusinessClientQuoteDetail.jsx');
check(buyerDetail.includes('Professional Service Fees') && buyerDetail.includes('Official / Government Fees'), 'fee sections separated');
check(buyerDetail.includes('does not take payment'), 'accept copy denies payment');
check(buyerDetail.includes('does not create a formation case'), 'accept copy denies case creation');
check(!/Pay now|Proceed to Payment|Upload Documents|Start Formation|innerHTML/i.test(buyerDetail), 'no pay/docs/case/html');
check(buyerDetail.includes('whitespace-pre-wrap'), 'provider terms rendered as text');

const providerEditor = read('client/src/pages/Agent/business-services/GbsQuoteDetail.jsx');
check(providerEditor.includes('fromDecimal'), 'draft editor converts via fromDecimal');
check(providerEditor.includes('Official / Government Fees'), 'catalog official fee selection');
check(!/innerHTML|dangerouslySetInnerHTML/.test(providerEditor), 'no raw HTML');
check(!/Payout|PDF|Mailroom|Formation Case/.test(providerEditor), 'no later-product provider UI');

console.log(`phase17d7SourceContract.test.js: ${count} assertions passed`);
