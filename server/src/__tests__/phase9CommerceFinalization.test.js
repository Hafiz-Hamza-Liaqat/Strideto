/**
 * Phase 9 — Commerce / usage / payments finalization.
 * Run: node src/__tests__/phase9CommerceFinalization.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeMoney, addMoney } from '../../../shared/international/money.js';
import {
  UNKNOWN_MONEY,
  moneyOrUnknown,
  isUnknownMoney,
  isZeroMoney,
  getCommissionPolicy,
  calculateFee,
  mapReconciliationOperationalState,
  truncateProviderReference,
  projectReceipt,
  deriveOrderPurpose,
  clientPaymentAuthorityFields,
  isLocalMarketplaceHost,
} from '../../../shared/commerce/contracts.js';
import { SimulatedMarketplaceProvider } from '../services/payments/SimulatedMarketplaceProvider.js';
import { marketplaceStripeConfiguration } from '../services/payments/StripeConnectProvider.js';
import { FREE_BETA_PUBLISHING_POLICY } from '../config/freeBetaPublishingPolicy.js';
import { INSTITUTION_LAUNCH_BILLING } from '../../../shared/institution/institutionPortal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const source = (rel) => readFileSync(path.join(root, rel), 'utf8');

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const commerceSvc = source('server/src/services/commerceService.js');
const marketSvc = source('server/src/services/marketplacePaymentService.js');
const simSvc = source('server/src/services/marketplaceSimulationService.js');
const notif = source('server/src/services/commerceNotificationBridge.js');
const commerceCtrl = source('server/src/controllers/commerceController.js');
const marketCtrl = source('server/src/controllers/marketplacePaymentController.js');
const commerceRoutes = source('server/src/routes/commerce.js');
const marketRoutes = source('server/src/routes/marketplacePayments.js');
const employerUsage = source('server/src/controllers/employerUsageController.js');
const agentCtrl = source('server/src/controllers/agentController.js');
const disputes = source('server/src/services/professionalTrustService.js');
const simProviderSrc = source('server/src/services/payments/SimulatedMarketplaceProvider.js');
const stripeAdapter = source('server/src/services/payments/StripeConnectProvider.js');
const ledger = source('server/src/models/commerce/CommerceLedgerEntry.js');
const orderModel = source('server/src/models/commerce/CommerceOrder.js');
const reconModel = source('server/src/models/commerce/CommerceOperations.js');
const checkout = source('client/src/pages/Commerce/MarketplaceCheckout.jsx');
const historyUi = source('client/src/pages/Commerce/CommerceHistory.jsx');
const billingUi = source('client/src/pages/Employer/EmployerBilling.jsx');
const instBilling = source('client/src/pages/Institution/InstitutionBilling.jsx');

// MONEY
{
  check(Number.isInteger(makeMoney(1050, 'PKR').amountMinor), 'minor units are integers');
  check(makeMoney(1, 'usd').currency === 'USD', 'currency normalized');
  check(isZeroMoney(makeMoney(0, 'USD')) && !isUnknownMoney(makeMoney(0, 'USD')), 'zero is not unknown');
  check(isUnknownMoney(UNKNOWN_MONEY) && UNKNOWN_MONEY.amountMinor === null, 'unknown is explicit');
  check(isUnknownMoney(moneyOrUnknown(null)), 'missing money is unknown');
  check((() => { try { addMoney(makeMoney(1, 'USD'), makeMoney(1, 'PKR')); return false; } catch { return true; } })(), 'no implicit FX');
}

// ORDER / PURPOSE / OWNERSHIP
{
  check(deriveOrderPurpose({ consultationId: 'c1' }) === 'agent_consultation', 'consultation purpose');
  check(deriveOrderPurpose({ serviceId: 's1' }) === 'agent_professional_service', 'service purpose');
  check(commerceSvc.includes("status:'pending_payment'") && commerceSvc.includes("paymentAvailability:'not_configured'"), 'new orders pending + not_configured');
  check(commerceCtrl.includes('purchaserType:scope.ownerType') && commerceCtrl.includes('purchaserId:scope.ownerId'), 'owner derived from principal');
  check(!commerceCtrl.includes('sellerOrganizationId:req.body'), 'client cannot set merchant id');
}

// PAYMENT AUTHORITY
{
  check(clientPaymentAuthorityFields({ paid: true, refunded: true }).length === 2, 'mass-assignment detector');
  check(commerceCtrl.includes('mass_assignment_rejected') && marketCtrl.includes('mass_assignment_rejected'), 'order/intent refuse client authority');
  check(marketSvc.includes("paid:false"), 'intent creation is not paid');
  check(marketSvc.includes("if(order.status==='paid')"), 'success maps paid once');
  check(marketSvc.includes("return{duplicate:true,handled:true}"), 'provider replay idempotent');
  check(marketSvc.includes('runFinanceWrite') && marketSvc.includes('TransactionNumbersAreOnlyAllowedOnAReplicaSet'), 'paid write degrades on standalone Mongo instead of 500');
}

// EMPLOYER QUOTA
{
  check(FREE_BETA_PUBLISHING_POLICY.drafts.consumesQuota === false, 'drafts consume no quota');
  check(FREE_BETA_PUBLISHING_POLICY.drafts.requiresPayment === false, 'drafts require no payment');
  check(FREE_BETA_PUBLISHING_POLICY.chargedSubmissions.rolling24Hours.limit === 1, '1 free / 24h');
  check(FREE_BETA_PUBLISHING_POLICY.chargedSubmissions.rolling30Days.limit === 10, '10 / 30d');
  check(FREE_BETA_PUBLISHING_POLICY.maximumActiveFreeJobs === 5, 'max 5 active free jobs');
  check(employerUsage.includes("paidProducts") && employerUsage.includes("not_configured"), 'employer paid products inventory');
  check(employerUsage.includes('privateDraft: false'), 'drafts flagged as non-consuming');
  check(source('server/src/controllers/paymentsController.js').includes("code: 'not_configured'") && source('server/src/controllers/paymentsController.js').includes('paidPublishingEnabled'), 'employer checkout is not_configured when unpaid publishing is the launch policy');
}

// AGENT / COMMISSION / KYC
{
  check(getCommissionPolicy().configured === false && getCommissionPolicy().note === 'Commission not configured', 'commission not invented');
  check(calculateFee(makeMoney(1000, 'PKR'), { type: 'none' }).amountMinor === 0, 'unconfigured fee is zero');
  check(agentCtrl.includes('getCommissionPolicy') && agentCtrl.includes('Commission not configured'), 'usage billing uses policy helper');
  check(marketSvc.includes('chargesCapability') && marketSvc.includes('transfersCapability') && marketSvc.includes('payoutsEnabled'), 'KYC capabilities separated');
  check(simSvc.includes("provider: 'simulation'") && simSvc.includes('isLocalMarketplaceSimulationAllowed'), 'simulated connect is local-only');
}

// SIMULATED PROVIDER
{
  const provider = new SimulatedMarketplaceProvider();
  check(provider.configurationState() === 'simulation_ready', 'simulation state');
  check(!simProviderSrc.includes("from 'stripe'") && !simProviderSrc.includes('new Stripe'), 'simulation never imports Stripe');
  const event = provider.constructWebhookEvent(Buffer.from('{"id":"evt_sim"}'), 'sim_local');
  check(event.id === 'evt_sim', 'simulation webhook parses signed local payload');
  check((() => { try { provider.constructWebhookEvent(Buffer.from('{}'), 'bad'); return false; } catch { return true; } })(), 'bad simulation signature rejected');
  check(marketplaceStripeConfiguration({}) === 'not_configured', 'live Stripe remains not_configured by default');
  check(isLocalMarketplaceHost({ hostname: 'localhost' }) && !isLocalMarketplaceHost({ hostname: 'strideto.com' }), 'simulation host allowlist');
}

// REFUND / DISPUTES
{
  check(commerceSvc.includes('money.currency!==transaction.currency'), 'cross-currency refund denied');
  check(marketSvc.includes('Refund exceeds remaining refundable amount'), 'over-refund denied');
  check(marketSvc.includes("refund.status==='refunded'"), 'refund replay already_refunded');
  check(!disputes.includes('CommerceRefund') && !disputes.includes('requestRefund'), 'professional dispute does not auto-refund');
  check(marketSvc.includes('ProviderFinancialDispute') && marketSvc.includes('charge.dispute'), 'financial disputes separate');
}

// RECONCILIATION
{
  check(mapReconciliationOperationalState('matched') === 'reconciled', 'matched → reconciled');
  check(mapReconciliationOperationalState('mismatch') === 'attention_required', 'mismatch → attention_required');
  check(mapReconciliationOperationalState('manual_review') === 'manual_review_required', 'manual_review mapped');
  check(reconModel.includes("'pending_provider','matched','mismatch','manual_review','resolved'"), 'accepted recon enum preserved');
  check(commerceCtrl.includes('operationalState:mapReconciliationOperationalState'), 'admin list projects operational state');
  check(source('server/src/controllers/admin/adminSuperControlController.js').includes('mapReconciliationOperationalState'), 'Phase-2 Admin Commerce consumes operationalState');
  check(source('client/src/pages/Admin/AdminCommerceCenter.jsx').includes('operationalState'), 'Admin Commerce surface displays operationalState without redesign');
  check(marketSvc.includes('amount_mismatch') && marketSvc.includes('currency_mismatch'), 'amount/currency mismatch recorded');
  check(!marketSvc.slice(marketSvc.indexOf('async function mismatch'), marketSvc.indexOf('async function paymentSucceeded')).includes("order.status"), 'mismatch does not mutate order paid state');
}

// LEDGER / RECEIPTS
{
  check(ledger.includes('append-only'), 'ledger immutable');
  check(projectReceipt({ status: 'pending_payment' }) === null, 'no receipt before paid');
  check(projectReceipt({ status: 'paid', orderNumber: 'ST-1', amountMinor: 100, currency: 'PKR' }).downloadablePdf === undefined, 'no fabricated PDF field on helper');
  check(truncateProviderReference('pi_1234567890abcdef').includes('…'), 'provider ref truncated');
  check(commerceCtrl.includes('downloadablePdf:false'), 'receipt endpoint does not fabricate PDF');
  check(commerceRoutes.includes('/commerce/orders/:orderId/receipt'), 'receipt route exists');
}

// INSTITUTION
{
  check(INSTITUTION_LAUNCH_BILLING.providerState === 'not_configured', 'institution provider not_configured');
  check(instBilling.includes('Launch pricing is free') && instBilling.includes('No live Stripe'), 'institution billing copy');
}

// NOTIFICATIONS
{
  check(notif.includes('createUserNotificationOnce') && notif.includes("category: 'payment'"), 'in-app payment notifications');
  check(notif.includes('commerce:paid:') && notif.includes('commerce:failed:') && notif.includes('commerce:refunded:'), 'payment/refund dedupe keys');
  check(notif.includes('commerce:recon:') && notif.includes('COMMERCE_ADMIN_READ'), 'reconciliation notifies commerce-capable staff');
  check(notif.includes('/commerce-history') && !notif.includes('clientSecret') && !notif.includes('STRIPE_'), 'safe deep links, no secrets');
  check(marketSvc.includes('emitFinanceQuietly') && marketSvc.includes('payment_paid'), 'provider success fans out notifications');
}

// SECURITY / HTTP
{
  check(marketRoutes.includes('requireUserAuth,c.simulatePayment') && marketRoutes.includes('requireAgentAuth,c.simulateConnect'), 'simulation is authenticated');
  check(simSvc.includes("marketplaceStripeConfiguration(env) !== 'not_configured'") && simSvc.includes("MARKETPLACE_STRIPE_MODE") && simSvc.includes("'live'"), 'simulation denied when live/configured');
  check(stripeAdapter.includes('STRIPE_CONNECT_WEBHOOK_SECRET') && stripeAdapter.includes('constructEvent'), 'live webhook still signature-verified');
  check(!checkout.includes('cardNumber') && !checkout.includes('cvv'), 'no PAN/CVV fields');
  check(orderModel.includes("select:false") || source('server/src/models/commerce/CommerceTransaction.js').includes("select:false"), 'provider references hidden by default');
}

// UI TRUTH
{
  check(checkout.includes("not_configured") && checkout.includes('Marketplace payments are not configured'), 'checkout fails closed when not configured');
  check(historyUi.includes('An order is not a payment') && historyUi.includes('Receipt available'), 'student history truthful');
  check(billingUi.includes('paidProducts') && billingUi.includes('not_configured'), 'employer billing shows paid-product state');
}

console.log(`phase9CommerceFinalization.test.js: ${count} assertions passed`);

