import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentMembership', required: true, unique: true, index: true },
  timezone: { type: String, required: true, trim: true },
  windows: [{ weekday: { type: Number, min: 0, max: 6, required: true }, startLocal: { type: String, required: true }, endLocal: { type: String, required: true } }],
  blockedDates: { type: [String], default: [] },
  effectiveFrom: { type: Date, default: null }, effectiveTo: { type: Date, default: null },
  minNoticeMinutes: { type: Number, min: 0, max: 10080, default: 60 },
  bookingHorizonDays: { type: Number, min: 1, max: 365, default: 90 },
  bufferMinutes: { type: Number, min: 0, max: 240, default: 15 },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true });
schema.index({ organizationId: 1, active: 1 });
export const AgentAvailability = mongoose.models.AgentAvailability || mongoose.model('AgentAvailability', schema);
