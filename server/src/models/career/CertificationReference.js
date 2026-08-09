import mongoose from 'mongoose';

// _id: true (default) — stable ObjectId per certification record for child-record CRUD
export const certificationReferenceSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    issuer: { type: String, trim: true, default: '' },
    issuedAt: { type: Date },
    expiresAt: { type: Date },
    credentialId: { type: mongoose.Schema.Types.ObjectId, ref: 'Credential' },
    externalUrl: { type: String, trim: true, default: '' },
  },
  // _id: true is the Mongoose default; explicitly allowing it for stable child-record addressing
  {}
);

export const CertificationReference = certificationReferenceSchema;
