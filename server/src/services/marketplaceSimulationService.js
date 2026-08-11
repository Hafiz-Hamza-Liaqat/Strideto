/**
 * Localhost-only simulated provider events. Never calls Stripe. Never marks
 * paid unless processMarketplaceWebhook accepts a consistent synthetic event.
 */
import { marketplaceStripeConfiguration } from './payments/StripeConnectProvider.js';
import { isLocalMarketplaceHost } from '../../../shared/commerce/contracts.js';
import {
  agentPaymentScope,
  assertOrganizationApproved,
  processMarketplaceWebhook,
  providerReadiness,
} from './marketplacePaymentService.js';
import { emitCommerceNotifications } from './commerceNotificationBridge.js';
import { MarketplaceProviderAccount } from '../models/commerce/MarketplaceProviderAccount.js';
import { CommerceOrder } from '../models/commerce/CommerceOrder.js';
import { CommerceRefund } from '../models/commerce/CommerceRefund.js';
import { CommercePayoutReadiness } from '../models/commerce/CommerceOperations.js';

const fail = (status, message, code = 'simulation_error') => Object.assign(new Error(message), { status, code });

export function isLocalMarketplaceSimulationAllowed(req, env = process.env) {
  if (marketplaceStripeConfiguration(env) !== 'not_configured') return false;
  if (String(env.MARKETPLACE_STRIPE_MODE || '') === 'live') return false;
  return isLocalMarketplaceHost(req);
}

export async function simulateConnectReady(agentAccountId, req) {
  if (!isLocalMarketplaceSimulationAllowed(req)) {
    throw fail(403, 'Marketplace simulation is not available', 'simulation_denied');
  }
  const membership = await agentPaymentScope(agentAccountId);
  await assertOrganizationApproved(membership.organizationId);
  const connectedAccountId = `acct_sim_${String(membership.organizationId)}`;
  const account = await MarketplaceProviderAccount.findOneAndUpdate(
    { organizationId: membership.organizationId },
    {
      $set: {
        provider: 'simulation',
        connectedAccountId,
        onboardingStatus: 'complete',
        detailsSubmitted: true,
        chargesCapability: 'active',
        transfersCapability: 'active',
        payoutsEnabled: true,
        requirementsState: 'none',
        requirementsSummary: [],
        disabledReason: '',
        lastSynchronizedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).select('+connectedAccountId');
  await CommercePayoutReadiness.findOneAndUpdate(
    { organizationId: membership.organizationId },
    {
      $set: {
        providerAccountReference: connectedAccountId,
        kycState: 'provider_verified',
        payoutState: 'eligible_future',
      },
    },
    { upsert: true }
  );
  await emitCommerceNotifications('kyc_enabled', {
    organizationId: membership.organizationId,
    state: 'complete',
  });
  return providerReadiness(account, true);
}

function paymentEvent({ order, account, outcome }) {
  const succeeded = outcome === 'succeeded';
  const eventId = `evt_sim_${String(order._id)}_${outcome}`;
  const paymentIntentId = `pi_sim_${String(order._id)}`;
  return {
    id: eventId,
    type: succeeded ? 'payment_intent.succeeded' : (outcome === 'canceled' ? 'payment_intent.canceled' : 'payment_intent.payment_failed'),
    data: {
      object: {
        id: paymentIntentId,
        amount: order.amountMinor,
        amount_received: succeeded ? order.amountMinor : 0,
        currency: String(order.currency || '').toLowerCase(),
        application_fee_amount: order.pricingSnapshot?.fees?.amountMinor || 0,
        transfer_data: { destination: account.connectedAccountId },
        metadata: {
          orderId: String(order._id),
          sellerOrganizationId: String(order.sellerOrganizationId),
          chargeStrategy: 'destination_charge',
        },
      },
    },
  };
}

export async function simulateStudentPaymentEvent(studentUserId, { orderId, outcome = 'succeeded' }, req) {
  if (!isLocalMarketplaceSimulationAllowed(req)) {
    throw fail(403, 'Marketplace simulation is not available', 'simulation_denied');
  }
  if (!['succeeded', 'failed', 'canceled'].includes(outcome)) {
    throw fail(400, 'Unsupported simulation outcome', 'invalid_outcome');
  }
  const order = await CommerceOrder.findOne({
    _id: orderId,
    purchaserType: 'user',
    purchaserId: studentUserId,
  }).select('+providerReference');
  if (!order) throw fail(404, 'Order not found', 'order_not_found');
  const account = await MarketplaceProviderAccount.findOne({
    organizationId: order.sellerOrganizationId,
  }).select('+connectedAccountId');
  if (!account?.connectedAccountId) {
    throw fail(409, 'Seller payment capabilities are not ready', 'seller_not_ready');
  }
  return processMarketplaceWebhook(paymentEvent({ order, account, outcome }));
}

export async function simulateRefundEvent(studentUserId, { refundId }, req) {
  if (!isLocalMarketplaceSimulationAllowed(req)) {
    throw fail(403, 'Marketplace simulation is not available', 'simulation_denied');
  }
  const refund = await CommerceRefund.findOne({
    _id: refundId,
    requesterType: 'user',
    requesterId: studentUserId,
  }).select('+providerReference');
  if (!refund) throw fail(404, 'Refund request not found', 'refund_not_found');
  const eventId = `evt_sim_refund_${String(refund._id)}`;
  return processMarketplaceWebhook({
    id: eventId,
    type: 'refund.updated',
    data: {
      object: {
        id: `re_sim_${String(refund._id)}`,
        status: 'succeeded',
        amount: refund.amountMinor,
        currency: String(refund.currency || '').toLowerCase(),
        metadata: { refundId: String(refund._id), orderId: String(refund.orderId) },
      },
    },
  });
}
