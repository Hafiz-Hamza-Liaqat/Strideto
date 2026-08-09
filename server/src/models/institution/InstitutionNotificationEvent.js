/**
 * InstitutionNotificationEvent — internal notification record (Mission 18).
 *
 * Stores prepared notification events only. No delivery in Mission 18.
 * No email/SMS/push/WhatsApp workers.
 */
import mongoose from 'mongoose';
import { INSTITUTION_NOTIFICATION_TYPES } from '../../../../shared/institution/institutionPortal.js';

const institutionNotificationEventSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    institutionAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InstitutionAccount',
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      enum: Object.values(INSTITUTION_NOTIFICATION_TYPES),
      required: true,
      index: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Delivery is always false in Mission 18 — no worker started
    delivered: { type: Boolean, default: false },
  },
  { timestamps: true }
);

institutionNotificationEventSchema.index({ organizationId: 1, eventType: 1, createdAt: -1 });

export const InstitutionNotificationEvent =
  mongoose.models.InstitutionNotificationEvent ||
  mongoose.model('InstitutionNotificationEvent', institutionNotificationEventSchema);
