import mongoose from 'mongoose';
import { IDEMPOTENCY_STATUSES } from '../../../../shared/platform/idempotency.js';

const idempotencyRecordSchema = new mongoose.Schema(
  {
    principalId: { type: String, default: '' },
    tenantId: { type: String, default: '' },
    commandType: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    fingerprint: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(IDEMPOTENCY_STATUSES),
      default: IDEMPOTENCY_STATUSES.IN_PROGRESS,
    },
    resultRef: { type: String, default: '' },
    resultMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false }
);

idempotencyRecordSchema.index(
  { principalId: 1, tenantId: 1, commandType: 1, idempotencyKey: 1 },
  { unique: true, name: 'idempotency_record_command_unique' }
);
idempotencyRecordSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'idempotency_record_ttl' }
);

export const IdempotencyRecord = mongoose.model(
  'IdempotencyRecord',
  idempotencyRecordSchema
);
