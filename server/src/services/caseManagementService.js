import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ProfessionalCase } from '../models/case/ProfessionalCase.js';
import { ProfessionalCaseApplication } from '../models/case/ProfessionalCaseApplication.js';
import { CaseApprovalRequest, CaseDocumentRequest, CaseEvent, CaseMessage, CaseNote, CaseNotificationEvent, CaseTask, CaseThread } from '../models/case/CaseRecords.js';
import { AgentMembership } from '../models/agent/AgentMembership.js';
import { AgentProfile } from '../models/agent/AgentProfile.js';
import { AgentService } from '../models/agent/AgentService.js';
import { CanonicalInstitution } from '../models/education/CanonicalInstitution.js';
import { Program } from '../models/education/Program.js';
import { User } from '../models/User.js';
import { Consultation } from '../models/consultation/Consultation.js';
import { VaultDocument } from '../models/vault/VaultDocument.js';
import { DocumentAccessGrant } from '../models/vault/DocumentAccessGrant.js';
import { canAccessDocument } from './vault/vaultAccessPolicy.js';
import { createGrant, revokeDocumentGrant } from './vault/VaultDocumentService.js';
import { logAudit } from './auditService.js';
import { legacyEducationPermissionsForRole, membershipSatisfiesDomainPermission, PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import { PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { boundedPage, canTransitionCaseApplicationStatus, canTransitionLifecycle, canTransitionStage, CASE_APPLICATION_OUTCOMES, CASE_APPLICATION_STATUSES, CASE_OUTCOMES, CASE_TYPES, cleanCaseText, getWorkflow, HIGH_VALUE_ACTIONS, SUBMISSION_METHODS, WORKFLOW_VERSION } from '../../../shared/services/cases.js';

function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function oid(value, label = 'id') { if (!mongoose.isValidObjectId(value)) fail(`Invalid ${label}`); return value; }
function hasEducationCaseAuthority(membership) {
  const domainAccess = Array.isArray(membership.domainAccess)
    ? membership.domainAccess
    : [{ domainId: PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY, permissions: legacyEducationPermissionsForRole(membership.role) }];
  return domainAccess.some((row) => row.domainId === PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY)
    && membershipSatisfiesDomainPermission(
      { ...membership, domainAccess },
      PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY,
      PROVIDER_DOMAIN_PERMISSIONS.EDUCATION_CASES_MANAGE
    );
}
async function agentScopes(agentAccountId) {
  const memberships = await AgentMembership.find({ agentAccountId, active: true }).lean();
  if (!memberships.length) fail('Active Agent membership required', 403);
  const authorized = memberships.filter(hasEducationCaseAuthority);
  if (!authorized.length) fail('Education Case authority required', 403);
  return authorized;
}
async function caseForStudent(userId, caseId, mutable = false) { const q = ProfessionalCase.findOne({ _id: oid(caseId, 'case id'), studentUserId: userId }); const record = mutable ? await q : await q.lean(); if (!record) fail('Case not found', 404); return record; }
async function caseForAgent(agentAccountId, caseId, mutable = false) {
  const memberships = await agentScopes(agentAccountId);
  const clauses = memberships.map((membership) => ({ organizationId: membership.organizationId, authorizedMembershipIds: membership._id }));
  const q = ProfessionalCase.findOne({ _id: oid(caseId, 'case id'), $or: clauses });
  const record = mutable ? await q : await q.lean();
  if (!record) fail('Case not found', 404);
  const membership = memberships.find((row) => String(row.organizationId) === String(record.organizationId) && record.authorizedMembershipIds.some((value) => String(value) === String(row._id)));
  if (!membership) fail('Case not found', 404);
  return { record, membership };
}
async function event(record, eventType, actorType, actorId, metadata = {}) { return CaseEvent.create({ caseId: record._id, organizationId: record.organizationId, eventType, actorType, actorId: String(actorId), metadata }); }
async function notify(record, recipientType, recipientId, eventType) {
  const event = await CaseNotificationEvent.create({ caseId: record._id, recipientType, recipientId: String(recipientId), eventType, deliveryAttempted: false });
  if (recipientType === 'agent') {
    const { notifyAgentMembership } = await import('./agentInboxNotificationBridge.js');
    await notifyAgentMembership({
      membershipId: recipientId,
      category: 'case',
      type: eventType,
      title: 'Case update',
      body: 'A case event requires your attention. Open the case for details.',
      link: `/agent/education/cases/${record._id}`,
      dedupeKey: `agent:case:${record._id}:${eventType}:${event._id}`,
    }).catch(() => {});
  }
  if (recipientType === 'student') {
    const { createUserNotificationOnce } = await import('./notificationService.js');
    const uniqueEvent = eventType === 'case_message' || eventType === 'document_request';
    await createUserNotificationOnce({
      recipientType: 'user',
      userId: recipientId,
      category: eventType === 'case_message' ? 'message' : 'case',
      type: eventType,
      title: eventType === 'document_request' ? 'A document was requested' : 'Case update',
      body: 'A case event requires your attention. Open the case for details.',
      link: `/cases/${record._id}`,
      dedupeKey: uniqueEvent
        ? `user:case:${record._id}:${eventType}:${event._id}`
        : `user:case:${record._id}:${eventType}`,
    }).catch(() => {});
  }
  return event;
}
async function audit(record, actorType, actorId, action, metadata = {}) { return logAudit({ actor: { userId: actorId, role: actorType }, action, targetType: 'ProfessionalCase', targetId: record._id, metadata: { organizationId: String(record.organizationId), ...metadata } }); }
const safe = (record) => ({ id: String(record._id), caseType: record.caseType, workflowId: record.workflowId, workflowVersion: record.workflowVersion, lifecycle: record.lifecycle, currentStage: record.currentStage, title: record.title, summary: record.summary, destinationCountry: record.destinationCountry, assignedMembershipId: String(record.assignedMembershipId), consultationId: record.consultationId ? String(record.consultationId) : null, openedAt: record.openedAt, closedAt: record.closedAt, outcome: record.outcome, processCompleted: record.processCompleted, externalResult: record.externalResult, createdAt: record.createdAt, updatedAt: record.updatedAt });
const applicationSafe = (record) => ({
  id: String(record._id),
  institutionId: record.institutionId ? String(record.institutionId) : null,
  institution: record.institutionSnapshot,
  programId: record.programId ? String(record.programId) : null,
  program: record.programSnapshot,
  intake: record.intakeSnapshot,
  destinationCountry: record.destinationCountry,
  status: record.status,
  deadlineAt: record.deadlineAt,
  submissionMethod: record.submissionMethod,
  submittedAt: record.submittedAt,
  outcome: record.outcome,
  outcomeNote: record.outcomeNote,
  evidenceReference: record.evidenceReference,
  statusHistory: (record.statusHistory || []).map((entry) => ({
    id: String(entry._id),
    from: entry.from,
    to: entry.to,
    note: entry.note,
    occurredAt: entry.occurredAt,
  })),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  statusAuthority: 'provider_maintained',
});
const eventSafe = (record) => ({ id: String(record._id), eventType: record.eventType, createdAt: record.createdAt });
const noteSafe = (record) => ({ id: String(record._id), visibility: record.visibility, body: record.body, createdAt: record.createdAt, updatedAt: record.updatedAt });
const approvalSafe = (record) => ({ id: String(record._id), actionType: record.actionType, explanation: record.explanation, proposedAction: record.proposedAction, status: record.status, studentComment: record.studentComment, requestedAt: record.requestedAt, respondedAt: record.respondedAt, expiresAt: record.expiresAt, createdAt: record.createdAt });
const taskSafe = (record) => ({ id: String(record._id), title: record.title, responsibleActor: record.responsibleActor, status: record.status, dueAt: record.dueAt, requirementRef: record.requirementRef, createdAt: record.createdAt, updatedAt: record.updatedAt });
const documentRequestSafe = (record) => ({ id: String(record._id), documentType: record.documentType, purpose: record.purpose, requirementRef: record.requirementRef, dueAt: record.dueAt, status: record.status, requestedAt: record.requestedAt, fulfilledAt: record.fulfilledAt, createdAt: record.createdAt, updatedAt: record.updatedAt });
const messageSafe = (record) => ({ id: String(record._id), senderActorType: record.senderActorType, text: record.text, createdAt: record.createdAt });

function childWindow(query, key) {
  const parsedPage = parseInt(query?.[`${key}Page`], 10);
  const parsedLimit = parseInt(query?.[`${key}Limit`], 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(50, parsedLimit) : 20;
  return { page, limit, skip: (page - 1) * limit };
}

async function boundedChildren(Model, filter, window, sort) {
  const [items, total] = await Promise.all([
    Model.find(filter).sort(sort).skip(window.skip).limit(window.limit).lean(),
    Model.countDocuments(filter),
  ]);
  return {
    items,
    pagination: {
      page: window.page,
      limit: window.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / window.limit)),
    },
  };
}

export async function proposeCase(agentAccountId, input = {}) {
  const memberships = await agentScopes(agentAccountId); if (!CASE_TYPES.includes(input.caseType)) fail('Unsupported case type');
  const consultation = await Consultation.findOne({ _id: oid(input.consultationId, 'consultation id'), status: 'completed' }).lean();
  const membership = consultation ? memberships.find((row) => String(row._id) === String(consultation.assignedMembershipId) && String(row.organizationId) === String(consultation.organizationId)) : null;
  if (!consultation) fail('A completed, assigned consultation is required', 403);
  if (!membership) fail('A completed consultation assigned to this Provider subject is required', 403);
  const workflow = getWorkflow(input.caseType, WORKFLOW_VERSION); const title = cleanCaseText(input.title, 200); if (!title) fail('Title is required');
  const record = await ProfessionalCase.create({ studentUserId: consultation.studentUserId, organizationId: membership.organizationId, assignedMembershipId: membership._id, authorizedMembershipIds: [membership._id], consultationId: consultation._id, caseType: input.caseType, workflowId: workflow.id, workflowVersion: workflow.version, lifecycle: 'awaiting_student_acceptance', currentStage: workflow.stages[0], title, summary: cleanCaseText(input.summary), destinationCountry: cleanCaseText(input.destinationCountry, 2).toUpperCase() });
  await CaseThread.create({ caseId: record._id, organizationId: record.organizationId, studentUserId: record.studentUserId, authorizedMembershipIds: [membership._id] });
  await event(record, 'case_proposed', 'agent', agentAccountId, { caseType: record.caseType, workflowVersion: record.workflowVersion }); await notify(record, 'student', record.studentUserId, 'case_proposal'); await audit(record, 'agent', agentAccountId, 'case.proposed', { caseType: record.caseType }); return safe(record);
}
export async function decideProposal(userId, caseId, input = {}) { const record = await caseForStudent(userId, caseId, true); if (record.lifecycle !== 'awaiting_student_acceptance') fail('Case proposal is no longer pending', 409); const accepted = input.decision === 'accept'; if (!accepted && input.decision !== 'reject') fail('Decision must be accept or reject'); record.lifecycle = accepted ? 'active' : 'cancelled'; record.openedAt = accepted ? new Date() : null; record.closedAt = accepted ? null : new Date(); if (!accepted) record.outcome = 'cancelled'; await record.save(); if (accepted) { const { recordHandoffConsent, CONSENT_PURPOSES } = await import('./consentGrantService.js'); await recordHandoffConsent({ subjectId: userId, counterpartyId: record.organizationId, counterpartyType: 'agent', purpose: CONSENT_PURPOSES.AGENT_CASE, resourceScope: `case:${record._id}`, grantedAt: new Date(), provenance: 'student_case_accept', auditIdentity: `case:${record._id}` }); } await event(record, accepted ? 'student_accepted' : 'student_rejected', 'student', userId); await notify(record, 'agent', record.assignedMembershipId, 'case_proposal_response'); await audit(record, 'student', userId, accepted ? 'case.accepted' : 'case.rejected'); return safe(record); }
export async function listCases(actorType, actorId, query = {}) {
  const { page, limit, skip } = boundedPage(query);
  let filter;
  if (actorType === 'student') filter = { studentUserId: actorId };
  else {
    const memberships = await agentScopes(actorId);
    filter = { $or: memberships.map((membership) => ({ organizationId: membership.organizationId, authorizedMembershipIds: membership._id })) };
  }
  if (query.lifecycle) filter.lifecycle = query.lifecycle;
  const term = String(query.q || '').trim().slice(0, 80);
  if (term) filter.title = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [rows, total] = await Promise.all([
    ProfessionalCase.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    ProfessionalCase.countDocuments(filter),
  ]);
  let attention;
  if (actorType === 'student') {
    const activeCases = await ProfessionalCase.find({ studentUserId: actorId, lifecycle: { $in: ['awaiting_student_acceptance', 'active'] } })
      .sort({ updatedAt: -1, _id: -1 }).limit(50).select('_id title lifecycle').lean();
    const ids = activeCases.map((row) => row._id);
    const [tasks, applications, documents, approvals] = ids.length ? await Promise.all([
      CaseTask.find({ caseId: { $in: ids }, responsibleActor: 'student', status: { $in: ['pending', 'in_progress'] } }).sort({ dueAt: 1, createdAt: -1, _id: -1 }).limit(5).select('caseId title status dueAt').lean(),
      ProfessionalCaseApplication.find({ caseId: { $in: ids }, status: { $in: ['needs_changes', 'ready_for_review', 'preparing'] } }).sort({ deadlineAt: 1, updatedAt: -1, _id: -1 }).limit(5).select('caseId institutionSnapshot programSnapshot status deadlineAt').lean(),
      CaseDocumentRequest.find({ caseId: { $in: ids }, status: 'requested' }).sort({ dueAt: 1, createdAt: -1, _id: -1 }).limit(5).select('caseId documentType status dueAt').lean(),
      CaseApprovalRequest.find({ caseId: { $in: ids }, status: 'pending' }).sort({ requestedAt: 1, _id: 1 }).limit(5).select('caseId actionType status requestedAt').lean(),
    ]) : [[], [], [], []];
    attention = {
      limit: 5,
      proposals: activeCases.filter((row) => row.lifecycle === 'awaiting_student_acceptance').slice(0, 5).map((row) => ({ id: String(row._id), caseId: String(row._id), title: row.title, status: row.lifecycle })),
      tasks: tasks.map((row) => ({ id: String(row._id), caseId: String(row.caseId), title: row.title, status: row.status, dueAt: row.dueAt })),
      applications: applications.map((row) => ({ id: String(row._id), caseId: String(row.caseId), title: row.programSnapshot?.name || row.institutionSnapshot?.officialName || 'Education application', status: row.status, dueAt: row.deadlineAt })),
      documentRequests: documents.map((row) => ({ id: String(row._id), caseId: String(row.caseId), title: row.documentType, status: row.status, dueAt: row.dueAt })),
      approvals: approvals.map((row) => ({ id: String(row._id), caseId: String(row.caseId), title: row.actionType.replaceAll('_', ' '), status: row.status, dueAt: row.requestedAt })),
    };
  }
  return { cases: rows.map(safe), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), ...(attention ? { attention } : {}) };
}
export async function getCase(actorType, actorId, caseId, query = {}) {
  const record = actorType === 'student'
    ? await caseForStudent(actorId, caseId)
    : (await caseForAgent(actorId, caseId)).record;
  const windows = Object.fromEntries(['timeline', 'notes', 'approvals', 'tasks', 'documentRequests', 'applications'].map((key) => [key, childWindow(query, key)]));
  const taskFilter = { caseId: record._id };
  if (query.taskStatus === 'open') taskFilter.status = { $in: ['pending', 'in_progress'] };
  else if (['pending', 'in_progress', 'completed', 'cancelled'].includes(query.taskStatus)) taskFilter.status = query.taskStatus;
  const [timelineResult, notesResult, approvalsResult, tasksResult, documentsResult, thread, applicationsResult, consultation, membership, student] = await Promise.all([
    boundedChildren(CaseEvent, { caseId: record._id }, windows.timeline, { createdAt: 1, _id: 1 }),
    boundedChildren(CaseNote, { caseId: record._id, ...(actorType === 'student' ? { visibility: 'shared' } : {}) }, windows.notes, { createdAt: -1, _id: -1 }),
    boundedChildren(CaseApprovalRequest, { caseId: record._id }, windows.approvals, { createdAt: -1, _id: -1 }),
    boundedChildren(CaseTask, taskFilter, windows.tasks, { createdAt: -1, _id: -1 }),
    boundedChildren(CaseDocumentRequest, { caseId: record._id }, windows.documentRequests, { createdAt: -1, _id: -1 }),
    CaseThread.findOne({ caseId: record._id }).lean(),
    boundedChildren(ProfessionalCaseApplication, { caseId: record._id }, windows.applications, { createdAt: 1, _id: 1 }),
    record.consultationId ? Consultation.findById(record.consultationId).select('agentServiceId serviceSnapshot').lean() : null,
    AgentMembership.findById(record.assignedMembershipId).select('agentAccountId').lean(),
    actorType === 'agent' ? User.findById(record.studentUserId).select('name email').lean() : null,
  ]);
  const [liveService, provider] = await Promise.all([
    consultation?.agentServiceId && !consultation.serviceSnapshot ? AgentService.findById(consultation.agentServiceId).select('title category').lean() : null,
    membership?.agentAccountId ? AgentProfile.findOne({ agentAccountId: membership.agentAccountId, organizationId: record.organizationId }).select('professionalName agentType slug').lean() : null,
  ]);
  return {
    case: safe(record),
    workflow: getWorkflow(record.caseType, record.workflowVersion),
    context: {
      provider: provider ? { name: provider.professionalName || 'Education Provider', type: provider.agentType, slug: provider.slug || '' } : null,
      student: student ? { name: student.name || 'Student', email: student.email } : null,
      service: consultation?.serviceSnapshot
        ? { id: String(consultation.agentServiceId), ...consultation.serviceSnapshot, source: 'engagement_snapshot' }
        : liveService ? { id: String(liveService._id), title: liveService.title, category: liveService.category, source: 'legacy_live_fallback' } : null,
    },
    applications: applicationsResult.items.map(applicationSafe),
    timeline: timelineResult.items.map(eventSafe),
    notes: notesResult.items.map(noteSafe),
    approvals: approvalsResult.items.map(approvalSafe),
    tasks: tasksResult.items.map(taskSafe),
    documentRequests: documentsResult.items.map(documentRequestSafe),
    childPagination: {
      applications: applicationsResult.pagination,
      tasks: tasksResult.pagination,
      documentRequests: documentsResult.pagination,
      timeline: timelineResult.pagination,
      notes: notesResult.pagination,
      approvals: approvalsResult.pagination,
    },
    taskStatus: query.taskStatus || '',
    threadId: thread ? String(thread._id) : null,
    messagingStatus: thread?.status || 'unavailable',
  };
}

function optionalDate(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(`${label} must be a valid date`);
  return date;
}

function commandId(value) {
  if (!value) return randomUUID();
  const cleaned = cleanCaseText(value, 100);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,99}$/.test(cleaned)) fail('Invalid Idempotency-Key');
  return cleaned;
}

function applicationMutable(record) {
  if (!['active', 'paused', 'closing'].includes(record.lifecycle)) {
    fail('Applications can be changed only while the Case is active, paused, or closing', 409);
  }
}

function cleanSnapshot(input = {}) {
  return {
    institutionSnapshot: {
      officialName: cleanCaseText(input.institutionName, 250),
      countryCode: cleanCaseText(input.destinationCountry, 2).toUpperCase(),
      city: cleanCaseText(input.institutionCity, 120),
    },
    programSnapshot: {
      name: cleanCaseText(input.programName, 250),
      degreeLevel: cleanCaseText(input.degreeLevel, 100),
      campus: cleanCaseText(input.campus, 150),
    },
    intakeSnapshot: {
      cycleLabel: cleanCaseText(input.intakeCycleLabel, 150),
      startDate: cleanCaseText(input.intakeStartDate, 40),
      deadlineDate: cleanCaseText(input.intakeDeadlineDate, 40),
    },
  };
}

async function resolveApplicationCatalog(input = {}, current = null) {
  const incoming = cleanSnapshot(input);
  const institutionId = input.institutionId === undefined
    ? current?.institutionId || null
    : (input.institutionId ? oid(input.institutionId, 'institution id') : null);
  const programId = input.programId === undefined
    ? current?.programId || null
    : (input.programId ? oid(input.programId, 'program id') : null);
  let institution = null;
  let program = null;
  if (institutionId) {
    institution = await CanonicalInstitution.findOne({ _id: institutionId, status: 'published' }).lean();
    if (!institution) fail('Published canonical institution not found', 404);
  }
  if (programId) {
    program = await Program.findOne({ _id: programId, status: 'published' }).lean();
    if (!program) fail('Published canonical program not found', 404);
    if (!institution || String(program.institutionId) !== String(institution._id)) {
      fail('Canonical program must belong to the selected institution', 409);
    }
  }
  const institutionSnapshot = institution
    ? { officialName: institution.officialName, countryCode: institution.countryCode || '', city: institution.city || '' }
    : (input.institutionName !== undefined ? incoming.institutionSnapshot : current?.institutionSnapshot);
  if (!institutionSnapshot?.officialName) fail('An institution reference or bounded institution name is required');
  const programSnapshot = program
    ? { name: program.name, degreeLevel: program.degreeLevel || '', campus: program.campus || '' }
    : (input.programName !== undefined ? incoming.programSnapshot : current?.programSnapshot || {});
  let intakeSnapshot = input.intakeCycleLabel !== undefined ? incoming.intakeSnapshot : current?.intakeSnapshot || {};
  if (program && input.intakeCycleLabel) {
    const selected = (program.intakes || []).find((row) => row.cycleLabel === incoming.intakeSnapshot.cycleLabel && !['draft', 'archived'].includes(row.status));
    if (!selected) fail('Published intake is not configured on the selected canonical program', 404);
    intakeSnapshot = {
      cycleLabel: selected.cycleLabel || '',
      startDate: selected.startDate || '',
      deadlineDate: selected.deadlineDate || '',
    };
  }
  return {
    institutionId: institution?._id || null,
    institutionSnapshot,
    programId: program?._id || null,
    programSnapshot,
    intakeSnapshot,
    destinationCountry: institutionSnapshot.countryCode || cleanCaseText(input.destinationCountry, 2).toUpperCase(),
  };
}

function outcomeForStatus(status, requestedOutcome) {
  if (status === 'provider_recorded_offer') return 'offer_received';
  if (status === 'provider_recorded_unsuccessful') return 'unsuccessful';
  if (status === 'withdrawn') return 'withdrawn';
  if (requestedOutcome && !CASE_APPLICATION_OUTCOMES.includes(requestedOutcome)) fail('Invalid application outcome');
  return requestedOutcome || null;
}

export async function createApplication(agentAccountId, caseId, input = {}, idempotencyKey = '') {
  const { record, membership } = await caseForAgent(agentAccountId, caseId);
  applicationMutable(record);
  const catalog = await resolveApplicationCatalog(input);
  const creationCommandId = commandId(idempotencyKey);
  const existing = await ProfessionalCaseApplication.findOne({ caseId: record._id, creationCommandId }).lean();
  if (existing) return { application: applicationSafe(existing), created: false };
  const deadlineAt = optionalDate(input.deadlineAt || catalog.intakeSnapshot.deadlineDate, 'Application deadline');
  try {
    const application = await ProfessionalCaseApplication.create({
      caseId: record._id,
      creationCommandId,
      ...catalog,
      deadlineAt,
      status: 'preparing',
      statusHistory: [{ from: null, to: 'preparing', actorMembershipId: membership._id, note: 'Application record created' }],
    });
    await event(record, 'application_created', 'agent', agentAccountId, { applicationId: String(application._id), status: application.status });
    await notify(record, 'student', record.studentUserId, 'application_created');
    await audit(record, 'agent', agentAccountId, 'case.application_created', { applicationId: String(application._id) });
    return { application: applicationSafe(application), created: true };
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await ProfessionalCaseApplication.findOne({ caseId: record._id, creationCommandId }).lean();
      if (duplicate) return { application: applicationSafe(duplicate), created: false };
    }
    throw error;
  }
}

export async function updateApplication(agentAccountId, caseId, applicationId, input = {}) {
  const { record, membership } = await caseForAgent(agentAccountId, caseId);
  applicationMutable(record);
  const application = await ProfessionalCaseApplication.findOne({ _id: oid(applicationId, 'application id'), caseId: record._id });
  if (!application) fail('Application not found', 404);
  const identityKeys = ['institutionId', 'institutionName', 'institutionCity', 'programId', 'programName', 'degreeLevel', 'campus', 'intakeCycleLabel', 'intakeStartDate', 'intakeDeadlineDate', 'destinationCountry'];
  if (identityKeys.some((key) => input[key] !== undefined)) {
    if (!['preparing', 'ready_for_submission'].includes(application.status)) fail('Application target cannot change after submission', 409);
    const catalog = await resolveApplicationCatalog(input, application.toObject());
    Object.assign(application, catalog);
  }
  if (input.deadlineAt !== undefined) application.deadlineAt = optionalDate(input.deadlineAt, 'Application deadline');
  const nextStatus = input.status === undefined ? application.status : input.status;
  if (!CASE_APPLICATION_STATUSES.includes(nextStatus)) fail('Invalid application status');
  if (nextStatus !== application.status) {
    if (!canTransitionCaseApplicationStatus(application.status, nextStatus)) fail('Invalid application status transition', 409);
    if (nextStatus === 'provider_attested_submitted') {
      const exactApproval = await CaseApprovalRequest.exists({
        caseId: record._id,
        actionType: 'external_submission',
        status: 'approved',
        $or: [
          { 'proposedAction.applicationId': String(application._id) },
          { proposedAction: { $eq: {} } },
        ],
      });
      if (!exactApproval) fail('Student approval is required before Provider-attested submission', 409);
      if (!SUBMISSION_METHODS.includes(input.submissionMethod) || input.submissionMethod === 'authorized_integration_future') {
        fail('A truthful current submission method is required');
      }
      application.submissionMethod = input.submissionMethod;
      application.submittedAt = optionalDate(input.submittedAt, 'Submitted date') || new Date();
    }
    const from = application.status;
    application.status = nextStatus;
    application.outcome = outcomeForStatus(nextStatus, input.outcome);
    application.statusHistory.push({ from, to: nextStatus, actorMembershipId: membership._id, note: cleanCaseText(input.statusNote, 500) });
    await event(record, 'application_status_changed', 'agent', agentAccountId, { applicationId: String(application._id), from, to: nextStatus, authority: 'provider_maintained' });
    await notify(record, 'student', record.studentUserId, 'application_status_changed');
  }
  if (input.outcome !== undefined) application.outcome = outcomeForStatus(application.status, input.outcome);
  if (input.outcomeNote !== undefined) application.outcomeNote = cleanCaseText(input.outcomeNote, 1000);
  if (input.evidenceReference !== undefined) application.evidenceReference = cleanCaseText(input.evidenceReference, 500);
  await application.save();
  await audit(record, 'agent', agentAccountId, 'case.application_updated', { applicationId: String(application._id), status: application.status });
  return applicationSafe(application);
}

export async function transitionStage(agentAccountId, caseId, input = {}) { const { record } = await caseForAgent(agentAccountId, caseId, true); if (record.lifecycle !== 'active') fail('Only active cases can progress', 409); if (!canTransitionStage(record.caseType, record.workflowVersion, record.currentStage, input.stage)) fail('Invalid workflow stage transition', 409); if (input.stage === 'submitted_external') { const approved = await CaseApprovalRequest.exists({ caseId: record._id, actionType: 'external_submission', status: 'approved' }); if (!approved) fail('Student approval is required before recording external submission', 409); if (!SUBMISSION_METHODS.includes(input.submissionMethod) || input.submissionMethod === 'authorized_integration_future') fail('A truthful current submission method is required'); } const from = record.currentStage; record.currentStage = input.stage; await record.save(); await event(record, 'stage_changed', 'agent', agentAccountId, { from, to: input.stage, ...(input.stage === 'submitted_external' ? { submissionMethod: input.submissionMethod, submittedByStrideto: false } : {}) }); await notify(record, 'student', record.studentUserId, 'stage_change'); await audit(record, 'agent', agentAccountId, 'case.stage_changed', { from, to: input.stage }); return safe(record); }
export async function transitionLifecycle(actorType, actorId, caseId, input = {}) { const record = actorType === 'student' ? await caseForStudent(actorId, caseId, true) : (await caseForAgent(actorId, caseId, true)).record; if (!canTransitionLifecycle(record.lifecycle, input.lifecycle)) fail('Invalid case lifecycle transition', 409); if (actorType === 'agent' && ['completed','transferred'].includes(input.lifecycle)) { const type = input.lifecycle === 'transferred' ? 'agent_transfer' : 'case_closure'; if (!await CaseApprovalRequest.exists({ caseId: record._id, actionType: type, status: 'approved' })) fail('Student approval is required', 409); } const from = record.lifecycle; record.lifecycle = input.lifecycle; if (['completed','cancelled','transferred'].includes(input.lifecycle)) { record.closedAt = new Date(); record.processCompleted = input.lifecycle === 'completed'; if (input.lifecycle !== 'completed') record.outcome = input.lifecycle === 'transferred' ? 'transferred' : (input.outcome || 'cancelled'); await CaseThread.updateOne({ caseId: record._id }, { $set: { status: 'read_only' } }); } await record.save(); await event(record, `case_${input.lifecycle}`, actorType, actorId, { from, to: input.lifecycle }); await audit(record, actorType, actorId, `case.${input.lifecycle}`, { from }); return safe(record); }
export async function addNote(agentAccountId, caseId, input = {}) { const { record, membership } = await caseForAgent(agentAccountId, caseId); const body = cleanCaseText(input.body, 4000); if (!body || !['shared','agent_private'].includes(input.visibility)) fail('Valid note and visibility required'); const note = await CaseNote.create({ caseId: record._id, authorMembershipId: membership._id, visibility: input.visibility, body }); if (input.visibility === 'shared') await event(record, 'shared_note_added', 'agent', agentAccountId, { noteId: String(note._id) }); await audit(record, 'agent', agentAccountId, 'case.note_added', { visibility: input.visibility }); return noteSafe(note); }
export async function requestApproval(agentAccountId, caseId, input = {}) { const { record, membership } = await caseForAgent(agentAccountId, caseId); if (!HIGH_VALUE_ACTIONS.includes(input.actionType)) fail('Unsupported approval action'); const explanation = cleanCaseText(input.explanation); if (!explanation) fail('Explanation required'); const approval = await CaseApprovalRequest.create({ caseId: record._id, actionType: input.actionType, requestedByMembershipId: membership._id, explanation, proposedAction: input.proposedAction || {}, expiresAt: input.expiresAt || null }); await event(record, 'student_approval_requested', 'agent', agentAccountId, { approvalId: String(approval._id), actionType: approval.actionType }); await notify(record, 'student', record.studentUserId, 'student_approval_request'); await audit(record, 'agent', agentAccountId, 'case.approval_requested', { actionType: approval.actionType }); return approvalSafe(approval); }
export async function decideApproval(userId, caseId, approvalId, input = {}) { const record = await caseForStudent(userId, caseId); if (!['approve','reject'].includes(input.decision)) fail('Decision must be approve or reject'); const approval = await CaseApprovalRequest.findOneAndUpdate({ _id: oid(approvalId, 'approval id'), caseId: record._id, status: 'pending', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }, { $set: { status: input.decision === 'approve' ? 'approved' : 'rejected', respondedAt: new Date(), studentComment: cleanCaseText(input.comment, 1000) } }, { new: true }).lean(); if (!approval) fail('Approval request is unavailable', 409); await event(record, `student_${approval.status}`, 'student', userId, { approvalId: String(approval._id), actionType: approval.actionType }); await notify(record, 'agent', record.assignedMembershipId, 'approval_response'); await audit(record, 'student', userId, `case.approval_${approval.status}`, { actionType: approval.actionType }); return approvalSafe(approval); }
export async function createTask(agentAccountId, caseId, input = {}) { const { record, membership } = await caseForAgent(agentAccountId, caseId); const title = cleanCaseText(input.title, 200); if (!title || !['student','agent'].includes(input.responsibleActor)) fail('Valid task required'); const task = await CaseTask.create({ caseId: record._id, title, responsibleActor: input.responsibleActor, responsibleMembershipId: input.responsibleActor === 'agent' ? membership._id : null, dueAt: input.dueAt || null, requirementRef: cleanCaseText(input.requirementRef,150), source: 'agent' }); await event(record, 'checklist_item_created', 'agent', agentAccountId, { taskId: String(task._id), responsibleActor: task.responsibleActor }); return taskSafe(task); }
export async function completeTask(actorType, actorId, caseId, taskId) { const record = actorType === 'student' ? await caseForStudent(actorId, caseId) : (await caseForAgent(actorId, caseId)).record; const filter = { _id: oid(taskId,'task id'), caseId: record._id, status: { $in: ['pending','in_progress'] }, responsibleActor: actorType }; const task = await CaseTask.findOneAndUpdate(filter, { $set: { status: 'completed' } }, { new: true }).lean(); if (!task) fail('Task not found or not owned by actor', 404); await event(record, 'checklist_item_completed', actorType, actorId, { taskId: String(task._id) }); return taskSafe(task); }
export async function requestDocument(agentAccountId, caseId, input = {}) { const { record, membership } = await caseForAgent(agentAccountId, caseId); const documentType = cleanCaseText(input.documentType,100), purpose = cleanCaseText(input.purpose,500); if (!documentType || !purpose) fail('Document type and purpose required'); const request = await CaseDocumentRequest.create({ caseId: record._id, documentType, purpose, requestedByMembershipId: membership._id, dueAt: input.dueAt || null, requirementRef: cleanCaseText(input.requirementRef,150) }); await event(record, 'document_requested', 'agent', agentAccountId, { requestId: String(request._id), documentType }); await notify(record, 'student', record.studentUserId, 'document_request'); await audit(record, 'agent', agentAccountId, 'case.document_requested', { documentType }); return documentRequestSafe(request); }
export async function shareDocument(userId, caseId, requestId, input = {}) {
  const record = await caseForStudent(userId, caseId);
  const request = await CaseDocumentRequest.findOne({ _id: oid(requestId, 'request id'), caseId: record._id });
  if (!request) fail('Document request not found', 404);
  if (!['requested', 'available', 'revoked'].includes(request.status)) fail('Document request is not available for sharing', 409);
  const document = await VaultDocument.findOne({ _id: oid(input.documentId, 'document id'), ownerUserId: userId }).lean();
  if (!document) fail('Vault document not found', 404);
  let grant = input.grantId
    ? await DocumentAccessGrant.findOne({
      _id: oid(input.grantId, 'grant id'),
      ownerUserId: userId,
      documentId: document._id,
      granteeType: 'agent',
      granteeId: String(record.assignedMembershipId),
      caseRef: String(record._id),
      status: 'active',
      revokedAt: null,
      permissions: 'view',
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).lean()
    : await DocumentAccessGrant.findOne({
      ownerUserId: userId,
      documentId: document._id,
      granteeType: 'agent',
      granteeId: String(record.assignedMembershipId),
      caseRef: String(record._id),
      status: 'active',
      revokedAt: null,
      permissions: 'view',
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).lean();
  if (!grant && !input.grantId) {
    grant = await createGrant(userId, document._id, {
      granteeType: 'agent',
      granteeId: String(record.assignedMembershipId),
      purpose: `Professional Case document: ${request.purpose}`,
      permissions: ['view'],
      caseRef: String(record._id),
    }, { actor: { type: 'student', id: String(userId) } });
  }
  if (!grant) fail('An exact active case-scoped Vault grant is required', 403);
  request.vaultDocumentId = document._id;
  request.grantId = grant._id;
  request.status = 'shared';
  request.fulfilledAt = new Date();
  await request.save();
  await event(record, 'document_shared', 'student', userId, { requestId: String(request._id), documentId: String(document._id), grantId: String(grant._id) });
  await notify(record, 'agent', record.assignedMembershipId, 'document_shared');
  await audit(record, 'student', userId, 'case.document_shared', { documentId: String(document._id), grantId: String(grant._id) });
  return documentRequestSafe(request);
}
export async function revokeSharedDocument(userId, caseId, requestId) {
  const record = await caseForStudent(userId, caseId);
  const request = await CaseDocumentRequest.findOne({ _id: oid(requestId, 'request id'), caseId: record._id, status: 'shared' });
  if (!request?.vaultDocumentId || !request?.grantId) fail('Shared document not found', 404);
  await revokeDocumentGrant(userId, request.vaultDocumentId, request.grantId, { actor: { type: 'student', id: String(userId) } });
  request.status = 'revoked';
  await request.save();
  await event(record, 'document_sharing_revoked', 'student', userId, { requestId: String(request._id), documentId: String(request.vaultDocumentId), grantId: String(request.grantId) });
  await notify(record, 'agent', record.assignedMembershipId, 'document_sharing_revoked');
  await audit(record, 'student', userId, 'case.document_sharing_revoked', { documentId: String(request.vaultDocumentId), grantId: String(request.grantId) });
  return documentRequestSafe(request);
}
export async function resolveCaseDocument(agentAccountId, caseId, requestId) { const { record, membership } = await caseForAgent(agentAccountId, caseId); const request = await CaseDocumentRequest.findOne({ _id: oid(requestId,'request id'), caseId: record._id, status: 'shared' }).lean(); if (!request) fail('Shared document not found',404); const document = await VaultDocument.findById(request.vaultDocumentId).lean(); const access = await canAccessDocument({ actor: { type: 'agent', id: String(membership._id) }, document, grantId: String(request.grantId), requiredPermission: 'view' }); if (!access.allowed) fail('Vault access denied',403); const grant = await DocumentAccessGrant.findById(request.grantId).lean(); if (grant.caseRef !== String(record._id)) fail('Vault case scope mismatch',403); return { documentId: String(document._id), name: document.displayName || document.title || 'Document', access: 'granted' }; }
export async function listMessages(actorType, actorId, caseId, query={}) { const record = actorType === 'student' ? await caseForStudent(actorId,caseId) : (await caseForAgent(actorId,caseId)).record; const thread = await CaseThread.findOne({ caseId: record._id }).lean(); const { page,limit,skip }=boundedPage(query); const [messages,total]=await Promise.all([CaseMessage.find({threadId:thread._id}).sort({createdAt:-1}).skip(skip).limit(limit).lean(),CaseMessage.countDocuments({threadId:thread._id})]); return {messages:messages.map(messageSafe),page,limit,total}; }
export async function sendMessage(actorType, actorId, caseId, input={}) { const record = actorType === 'student' ? await caseForStudent(actorId,caseId) : (await caseForAgent(actorId,caseId)).record; const thread=await CaseThread.findOne({caseId:record._id,status:'open'}).lean(); if(!thread) fail('Case messaging is closed',409); const text=cleanCaseText(input.text,4000); if(!text) fail('Message required'); const message=await CaseMessage.create({threadId:thread._id,senderActorType:actorType,senderId:String(actorId),text}); await notify(record,actorType==='student'?'agent':'student',actorType==='student'?record.assignedMembershipId:record.studentUserId,'case_message'); await audit(record,actorType,actorId,'case.message_created',{messageType:'text'}); return messageSafe(message); }
export async function recordOutcome(agentAccountId,caseId,input={}) { const {record}=await caseForAgent(agentAccountId,caseId,true); if(!CASE_OUTCOMES.includes(input.outcome)) fail('Invalid outcome'); record.outcome=input.outcome; record.externalResult=cleanCaseText(input.externalResult,200); await record.save(); await event(record,'outcome_recorded','agent',agentAccountId,{outcome:record.outcome,processCompleted:record.processCompleted}); return safe(record); }
export async function executeTransfer(agentAccountId,caseId,input={}) { const {record}=await caseForAgent(agentAccountId,caseId,true); const target=await AgentMembership.findOne({_id:oid(input.membershipId,'membership id'),organizationId:record.organizationId,active:true}).lean(); if(!target) fail('Active same-organization membership required',403); const approval=await CaseApprovalRequest.findOne({caseId:record._id,actionType:'agent_transfer',status:'approved','proposedAction.membershipId':String(target._id)}).lean(); if(!approval) fail('Exact Student-approved transfer required',409); const old=record.assignedMembershipId; record.assignedMembershipId=target._id; record.authorizedMembershipIds=[target._id]; await record.save(); await CaseThread.updateOne({caseId:record._id},{$set:{authorizedMembershipIds:[target._id]}}); await event(record,'agent_reassigned','agent',agentAccountId,{fromMembershipId:String(old),toMembershipId:String(target._id),vaultGrantsTransferred:false,privateNotesTransferred:false}); await notify(record,'student',record.studentUserId,'agent_reassignment'); await audit(record,'agent',agentAccountId,'case.agent_reassigned',{fromMembershipId:String(old),toMembershipId:String(target._id)}); return safe(record); }
