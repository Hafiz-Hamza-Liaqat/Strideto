/**
 * Financial in-app notifications (Phase 9). Worker stays stopped. No email/SMS/push.
 * Fail-soft: never throws into payment processing.
 */
import { createUserNotificationOnce } from './notificationService.js';
import { notifyAgentOrganizationOwners } from './agentInboxNotificationBridge.js';
import { User } from '../models/User.js';
import { STAFF_ROLES, PERMISSIONS, hasPermission } from '../config/rbac.js';

async function finishQuietly(fn) {
  try {
    return await fn();
  } catch {
    return { created: false };
  }
}

async function notifyCommerceStaff({ type, title, body, link, dedupeKey }) {
  const staff = await User.find({ role: { $in: STAFF_ROLES } }).select('_id role').lean();
  const recipients = staff.filter((u) => hasPermission(u.role, PERMISSIONS.COMMERCE_ADMIN_READ));
  let created = 0;
  for (const user of recipients) {
    const outcome = await createUserNotificationOnce({
      recipientType: 'staff',
      userId: user._id,
      category: 'payment',
      type,
      title,
      body,
      link,
      dedupeKey: `${dedupeKey}:staff:${user._id}`,
    });
    if (outcome?.created) created += 1;
  }
  return { created };
}

export async function emitCommerceNotifications(kind, payload = {}) {
  return finishQuietly(async () => {
    if (kind === 'payment_paid') {
      const order = payload.order;
      if (!order?._id) return { created: false };
      if (order.purchaserType === 'user' && order.purchaserId) {
        await createUserNotificationOnce({
          recipientType: 'user',
          userId: order.purchaserId,
          category: 'payment',
          type: 'commerce.paid',
          title: 'Payment confirmed',
          body: 'A provider-confirmed payment was recorded for your order.',
          link: '/commerce-history',
          dedupeKey: `commerce:paid:${order._id}`,
        });
      }
      if (order.sellerOrganizationId) {
        await notifyAgentOrganizationOwners({
          organizationId: order.sellerOrganizationId,
          category: 'payment',
          type: 'commerce.paid',
          title: 'Service payment confirmed',
          body: 'A provider-confirmed payment was recorded for your organization.',
          link: '/agent/commerce',
          dedupeKey: `commerce:paid:seller:${order._id}`,
        });
      }
      return { created: true };
    }

    if (kind === 'payment_failed') {
      const orderId = payload.orderId;
      const purchaserId = payload.purchaserId;
      if (!orderId || !purchaserId) return { created: false };
      await createUserNotificationOnce({
        recipientType: 'user',
        userId: purchaserId,
        category: 'payment',
        type: 'commerce.failed',
        title: 'Payment failed',
        body: 'The payment provider reported a failed or cancelled attempt. The order is not paid.',
        link: '/commerce-history',
        dedupeKey: `commerce:failed:${orderId}`,
      });
      return { created: true };
    }

    if (kind === 'refund_completed') {
      const refund = payload.refund;
      if (!refund?._id) return { created: false };
      if (refund.requesterType === 'user' && refund.requesterId) {
        await createUserNotificationOnce({
          recipientType: 'user',
          userId: refund.requesterId,
          category: 'payment',
          type: 'commerce.refunded',
          title: 'Refund completed',
          body: 'A provider-confirmed refund was recorded.',
          link: '/commerce-history',
          dedupeKey: `commerce:refunded:${refund._id}`,
        });
      }
      return { created: true };
    }

    if (kind === 'reconciliation_mismatch') {
      const reason = payload.reason || 'mismatch';
      const orderId = payload.order?._id || payload.orderId;
      await notifyCommerceStaff({
        type: 'commerce.reconciliation',
        title: 'Commerce reconciliation needs attention',
        body: 'A provider event did not match the local order. No silent financial repair was applied.',
        link: '/admin/sc/commerce',
        dedupeKey: `commerce:recon:${orderId || 'unknown'}:${reason}`,
      });
      return { created: true };
    }

    if (kind === 'kyc_enabled') {
      if (!payload.organizationId) return { created: false };
      await notifyAgentOrganizationOwners({
        organizationId: payload.organizationId,
        category: 'payment',
        type: 'commerce.kyc',
        title: 'Payout capabilities updated',
        body: 'Provider KYC/capability state changed. Charges, transfers, and payouts remain separate.',
        link: '/agent/commerce',
        dedupeKey: `commerce:kyc:${payload.organizationId}:${payload.state || 'updated'}`,
      });
      return { created: true };
    }

    if (kind === 'payout_state') {
      if (!payload.organizationId) return { created: false };
      await notifyAgentOrganizationOwners({
        organizationId: payload.organizationId,
        category: 'payment',
        type: 'commerce.payout',
        title: 'Payout state updated',
        body: 'A provider payout event was recorded. Payout paid is provider-authoritative only.',
        link: '/agent/commerce',
        dedupeKey: `commerce:payout:${payload.organizationId}:${payload.state || 'updated'}`,
      });
      return { created: true };
    }

    return { created: false };
  });
}
