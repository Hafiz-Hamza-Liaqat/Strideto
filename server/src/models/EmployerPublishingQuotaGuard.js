import mongoose from 'mongoose';
import {
  QUOTA_OWNER_TYPES,
  buildPublishingQuotaGuardId,
} from '../config/freeBetaPublishingPolicy.js';

const employerPublishingQuotaGuardSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    ownerType: {
      type: String,
      enum: QUOTA_OWNER_TYPES,
      required: true,
      immutable: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    revision: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'revision must be an integer',
      },
    },
  },
  {
    timestamps: true,
    collection: 'employerPublishingQuotaGuards',
  }
);

employerPublishingQuotaGuardSchema.index(
  { ownerType: 1, ownerId: 1 },
  { unique: true, name: 'publishing_quota_guard_owner_unique' }
);

employerPublishingQuotaGuardSchema.pre(
  'validate',
  function validateGuardIdentity(next) {
    try {
      const expectedId = buildPublishingQuotaGuardId(
        this.ownerType,
        this.ownerId
      );
      if (this._id !== expectedId) {
        this.invalidate(
          '_id',
          'Quota guard _id must match its namespaced owner identity'
        );
      }
    } catch (error) {
      this.invalidate('_id', error.message);
    }
    next();
  }
);

export const EmployerPublishingQuotaGuard = mongoose.model(
  'EmployerPublishingQuotaGuard',
  employerPublishingQuotaGuardSchema
);
