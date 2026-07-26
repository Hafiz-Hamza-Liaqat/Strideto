import mongoose from 'mongoose';

const newsletterSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    subscribed: { type: Boolean, default: true },
    frequency: { type: String, enum: ['daily', 'weekly'], default: 'weekly' },
  },
  { timestamps: true }
);

newsletterSchema.index({ subscribed: 1 });

export const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', newsletterSchema);
