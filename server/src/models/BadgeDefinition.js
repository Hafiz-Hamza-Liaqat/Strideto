import mongoose from 'mongoose';

const badgeDefinitionSchema = new mongoose.Schema(
  {
    badgeType: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    points: { type: Number, default: 10 },
    icon: { type: String },
  },
  { timestamps: true }
);

export const BadgeDefinition = mongoose.model('BadgeDefinition', badgeDefinitionSchema);
