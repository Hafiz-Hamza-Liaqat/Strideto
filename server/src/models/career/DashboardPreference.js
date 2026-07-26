import mongoose from 'mongoose';

/**
 * Per-user dashboard layout preference (C.8.3 personalization).
 */
const dashboardPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    layout: {
      hero: { type: [String], default: [] },
      main: { type: [String], default: [] },
      aside: { type: [String], default: [] },
    },
    hiddenWidgets: { type: [String], default: [] },
    version: { type: String, trim: true, default: '2.0' },
  },
  { timestamps: true, collection: 'dashboardPreferences' }
);

export const DashboardPreference = mongoose.model('DashboardPreference', dashboardPreferenceSchema);
