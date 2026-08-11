import { asyncHandler } from '../utils/asyncHandler.js';
import { hiringOwnerIdFrom } from '../services/employer/employerOrganizationService.js';
import { loadEmployerPublishingUsage } from '../services/employer/employerPublishingQuota.js';
import { isStripeConfigured } from '../services/paymentService.js';
import { CommerceOrder } from '../models/commerce/CommerceOrder.js';
import { CommerceTransaction } from '../models/commerce/CommerceTransaction.js';
import { CommerceRefund } from '../models/commerce/CommerceRefund.js';

export const getPlansUsage = asyncHandler(async (req, res) => {
  const ownerId = hiringOwnerIdFrom(req);
  const snapshot = await loadEmployerPublishingUsage(ownerId);
  res.json({
    organizationId: req.employer.organizationId,
    hiringOwnerId: ownerId,
    ...snapshot,
    consumesQuotaOn: {
      privateDraft: false,
      submitForReview: true,
      majorEditReopenRepost: true,
    },
  });
});

export const getBillingOverview = asyncHandler(async (req, res) => {
  const ownerId = hiringOwnerIdFrom(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const query = { purchaserType: 'employer', purchaserId: ownerId };
  const [orders, transactions, refunds] = await Promise.all([
    CommerceOrder.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CommerceTransaction.find({ 'payer.ownerType': 'employer', 'payer.ownerId': ownerId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    CommerceRefund.find({ requesterType: 'employer', requesterId: ownerId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const providerConfigured = isStripeConfigured();
  res.json({
    provider: {
      configured: providerConfigured,
      state: providerConfigured ? 'configured' : 'not_configured',
    },
    orders: orders.map((order) => ({
      _id: order._id,
      status: order.status,
      amountMinor: order.amountMinor,
      currency: order.currency,
      createdAt: order.createdAt,
      productId: order.productId,
    })),
    transactions: transactions.map((tx) => ({
      _id: tx._id,
      status: tx.status,
      amountMinor: tx.amountMinor,
      currency: tx.currency,
      providerReference: tx.providerReference || tx.providerTxnId || null,
      createdAt: tx.createdAt,
    })),
    refunds: refunds.map((r) => ({
      _id: r._id,
      status: r.status,
      amountMinor: r.amountMinor,
      currency: r.currency,
      createdAt: r.createdAt,
    })),
    pagination: { page, limit },
  });
});
