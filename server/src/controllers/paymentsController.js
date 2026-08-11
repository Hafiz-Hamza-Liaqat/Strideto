import { asyncHandler } from '../utils/asyncHandler.js';
import { createCheckoutSession, handleStripeWebhook, isStripeConfigured } from '../services/paymentService.js';
import { FREE_BETA_PUBLISHING_POLICY } from '../config/freeBetaPublishingPolicy.js';

const SITE = (process.env.SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

/** POST /employer/jobs/:id/checkout — create Stripe checkout session */
export const createJobCheckout = asyncHandler(async (req, res) => {
  const employerId = req.employer.hiringOwnerId || req.employer.employerId;
  if (!isStripeConfigured() || FREE_BETA_PUBLISHING_POLICY.paidPublishingEnabled !== true) {
    return res.status(503).json({
      error: 'Payment gateway not configured. Contact support.',
      code: 'not_configured',
      state: 'not_configured',
      paid: false,
    });
  }
  const { planId } = req.body;
  if (!planId) return res.status(400).json({ error: 'planId is required' });

  const result = await createCheckoutSession({
    employerId,
    jobId: req.params.id,
    planId,
    successUrl: `${SITE}/employer/jobs?payment=success&jobId=${req.params.id}`,
    cancelUrl: `${SITE}/employer/jobs/new?payment=cancelled`,
  });

  res.json(result);
});

/** POST /webhooks/stripe — Stripe webhook (raw body) */
export const stripeWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  if (!signature) return res.status(400).json({ error: 'Missing stripe-signature' });

  try {
    const result = await handleStripeWebhook(req.body, signature);
    res.json({ received: true, ...result });
  } catch (err) {
    console.error('[Stripe webhook]', err.message);
    res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
});
