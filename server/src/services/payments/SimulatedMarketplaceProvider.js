/**
 * Local-only marketplace provider. Never imports Stripe. Never opens a network
 * socket. Used when marketplace Stripe is not_configured and the request Host
 * is localhost / 127.0.0.1.
 */
import crypto from 'crypto';
import { MarketplacePaymentProvider } from './MarketplacePaymentProvider.js';

function simId(prefix, seed) {
  const digest = crypto.createHash('sha256').update(String(seed || crypto.randomUUID())).digest('hex').slice(0, 24);
  return `${prefix}_${digest}`;
}

export class SimulatedMarketplaceProvider extends MarketplacePaymentProvider {
  configurationState() {
    return 'simulation_ready';
  }

  async createConnectedAccount({ country, metadata }, idempotencyKey) {
    return { accountId: simId('acct_sim', idempotencyKey || `${country}:${metadata?.organizationId || ''}`) };
  }

  async createOnboardingLink({ accountId }) {
    return {
      url: `https://localhost/simulation/connect/${accountId}`,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  async retrieveConnectedAccount(accountId) {
    return {
      accountId,
      detailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      chargesCapability: 'active',
      transfersCapability: 'active',
      requirementsCurrent: [],
      requirementsPastDue: [],
      disabledReason: '',
      country: 'PK',
      currencies: ['PKR'],
    };
  }

  async createPaymentIntent({ amountMinor, currency, connectedAccountId, applicationFeeMinor, metadata }, idempotencyKey) {
    return {
      paymentIntentId: simId('pi_sim', idempotencyKey || `${connectedAccountId}:${amountMinor}:${currency}`),
      state: 'requires_payment_method',
      clientSecret: null,
      applicationFeeMinor,
      metadata,
    };
  }

  async retrievePaymentIntent(id) {
    return {
      paymentIntentId: id,
      state: 'requires_payment_method',
      amountMinor: 0,
      currency: 'PKR',
      destinationAccountId: null,
      applicationFeeMinor: 0,
      metadata: {},
    };
  }

  async createRefund({ paymentIntentId, amountMinor, metadata }, idempotencyKey) {
    return {
      refundId: simId('re_sim', idempotencyKey || `${paymentIntentId}:${amountMinor}`),
      state: 'pending',
      amountMinor,
      currency: 'PKR',
      metadata,
    };
  }

  async retrieveRefund(id) {
    return { refundId: id, state: 'pending', amountMinor: 0, currency: 'PKR', paymentIntentId: null };
  }

  async retrievePayout(id) {
    return { payoutId: id, state: 'pending', amountMinor: 0, currency: 'PKR' };
  }

  constructWebhookEvent(rawBody, signature) {
    if (!Buffer.isBuffer(rawBody)) {
      throw Object.assign(new Error('Raw webhook body required'), { status: 400, code: 'raw_body_required' });
    }
    if (signature !== 'sim_local') {
      throw Object.assign(new Error('Invalid simulation signature'), { status: 400, code: 'invalid_signature' });
    }
    try {
      return JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw Object.assign(new Error('Invalid simulation payload'), { status: 400, code: 'invalid_payload' });
    }
  }
}

export const simulatedMarketplaceProvider = new SimulatedMarketplaceProvider();
