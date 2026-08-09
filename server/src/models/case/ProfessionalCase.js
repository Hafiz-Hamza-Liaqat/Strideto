import mongoose from 'mongoose';
import { CASE_LIFECYCLES, CASE_OUTCOMES, CASE_TYPES } from '../../../../shared/services/cases.js';
const schema = new mongoose.Schema({
  studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  assignedMembershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentMembership', required: true, index: true },
  authorizedMembershipIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AgentMembership' }],
  consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', default: null }, relationshipId: { type: mongoose.Schema.Types.ObjectId, default: null },
  caseType: { type: String, enum: CASE_TYPES, required: true }, workflowId: { type: String, required: true }, workflowVersion: { type: Number, required: true },
  lifecycle: { type: String, enum: CASE_LIFECYCLES, default: 'awaiting_student_acceptance', index: true }, currentStage: { type: String, required: true },
  title: { type: String, required: true, maxlength: 200 }, summary: { type: String, maxlength: 2000, default: '' }, destinationCountry: { type: String, maxlength: 2, default: '' },
  relatedReferences: [{ kind: { type: String, enum: ['program', 'scholarship', 'opportunity'] }, ref: { type: String, maxlength: 100 } }],
  openedAt: { type: Date, default: null }, closedAt: { type: Date, default: null }, outcome: { type: String, enum: [...CASE_OUTCOMES, null], default: null },
  processCompleted: { type: Boolean, default: false }, externalResult: { type: String, maxlength: 200, default: '' },
}, { timestamps: true, collection: 'professional_cases' });
schema.index({ organizationId: 1, assignedMembershipId: 1, lifecycle: 1 });
export const ProfessionalCase = mongoose.models.ProfessionalCase || mongoose.model('ProfessionalCase', schema);
