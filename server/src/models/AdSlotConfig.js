import mongoose from 'mongoose';

const adSlotSchema = new mongoose.Schema(
  {
    slotId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    placement: { type: String, enum: ['banner_top', 'sidebar', 'in_feed', 'banner_bottom', 'header'], default: 'sidebar' },
    dimensions: { type: String },
    active: { type: Boolean, default: true },
    imageUrl: { type: String },
    targetUrl: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    priority: { type: Number, default: 0 },
    clickLimit: { type: Number },
    impressionLimit: { type: Number },
    clickCount: { type: Number, default: 0 },
    impressionCount: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'active', 'paused', 'expired'], default: 'active' },
  },
  { timestamps: true }
);

adSlotSchema.index({ placement: 1 });

export const AdSlotConfig = mongoose.model('AdSlotConfig', adSlotSchema);
