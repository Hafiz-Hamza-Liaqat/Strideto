import mongoose from 'mongoose';
import {
  CASE_APPLICATION_OUTCOMES,
  CASE_APPLICATION_STATUSES,
  SUBMISSION_METHODS,
} from '../../../../shared/services/cases.js';

const institutionSnapshotSchema = new mongoose.Schema({
  officialName: { type: String, required: true, trim: true, maxlength: 250 },
  countryCode: { type: String, trim: true, uppercase: true, maxlength: 2, default: '' },
  city: { type: String, trim: true, maxlength: 120, default: '' },
}, { _id: false });

const programSnapshotSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 250, default: '' },
  degreeLevel: { type: String, trim: true, maxlength: 100, default: '' },
  campus: { type: String, trim: true, maxlength: 150, default: '' },
}, { _id: false });

const intakeSnapshotSchema = new mongoose.Schema({
  cycleLabel: { type: String, trim: true, maxlength: 150, default: '' },
  startDate: { type: String, trim: true, maxlength: 40, default: '' },
  deadlineDate: { type: String, trim: true, maxlength: 40, default: '' },
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  from: { type: String, enum: [...CASE_APPLICATION_STATUSES, null], default: null },
  to: { type: String, enum: CASE_APPLICATION_STATUSES, required: true },
  actorMembershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentMembership', required: true },
  note: { type: String, trim: true, maxlength: 500, default: '' },
  occurredAt: { type: Date, required: true, default: Date.now },
}, { _id: true });

const schema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProfessionalCase', required: true },
  creationCommandId: { type: String, trim: true, maxlength: 100, default: null },
  institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CanonicalInstitution', default: null },
  institutionSnapshot: { type: institutionSnapshotSchema, required: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', default: null },
  programSnapshot: { type: programSnapshotSchema, default: () => ({}) },
  intakeSnapshot: { type: intakeSnapshotSchema, default: () => ({}) },
  destinationCountry: { type: String, trim: true, uppercase: true, maxlength: 2, default: '' },
  status: { type: String, enum: CASE_APPLICATION_STATUSES, required: true, default: 'preparing' },
  deadlineAt: { type: Date, default: null },
  submissionMethod: { type: String, enum: [...SUBMISSION_METHODS, null], default: null },
  submittedAt: { type: Date, default: null },
  outcome: { type: String, enum: [...CASE_APPLICATION_OUTCOMES, null], default: null },
  outcomeNote: { type: String, trim: true, maxlength: 1000, default: '' },
  evidenceReference: { type: String, trim: true, maxlength: 500, default: '' },
  statusHistory: { type: [statusHistorySchema], default: [] },
}, {
  timestamps: true,
  collection: 'professional_case_applications',
  autoIndex: false,
});

schema.index({ caseId: 1, createdAt: -1 }, { name: 'education_case_application_case_created' });
schema.index({ caseId: 1, status: 1, deadlineAt: 1 }, { name: 'education_case_application_case_status_deadline' });
schema.index(
  { caseId: 1, creationCommandId: 1 },
  { name: 'education_case_application_command_unique', unique: true, partialFilterExpression: { creationCommandId: { $type: 'string' } } }
);

export const ProfessionalCaseApplication = mongoose.models.ProfessionalCaseApplication
  || mongoose.model('ProfessionalCaseApplication', schema);
