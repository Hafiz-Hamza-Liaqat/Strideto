/**
 * AlertPreference — Mission 9 foundation.
 *
 * User alert subscription preferences for the action engine.
 * Reuses Mission 1 notification channel preferences at the User level;
 * this model captures per-alert-type opt-in/opt-out for education events.
 *
 * Delivery execution is DISABLED in Mission 9. No email, SMS, push, or
 * WhatsApp is sent. This model prepares the subscription layer only.
 * The worker remains off.
 *
 * User-owned; server derives userId from auth.
 */
import mongoose from 'mongoose';
import { ALERT_TYPES } from '../../../../shared/action/actionEngine.js';

const alertPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one preference document per user
    },
    preferences: {
      type: Map,
      of: Boolean,
      default: () =>
        new Map(Object.values(ALERT_TYPES).map((t) => [t, true])),
    },
    // Future: per-channel granularity. Mission 9 records intent only.
    channelOverrides: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const AlertPreference = mongoose.model('AlertPreference', alertPreferenceSchema);
