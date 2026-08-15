/**
 * GBS Case intake, list query, and DTO projections (Phase 17D-8A).
 */
import {
  CASE_CANCEL_REASON_CODES,
  CASE_STATUSES,
  CASE_TASK_INPUT_TYPES,
  CASE_TASK_KEYS,
  CASE_UNABLE_REASON_CODES,
  CASE_WORKFLOW_TEMPLATES,
  GBS_CASE_BOUNDS,
  isEmittedCaseStatus,
  isOpaqueCaseRef,
  isOpaqueTaskRef,
  isValidCancelReason,
  isValidCaseTaskKey,
  isValidUnableReason,
  taskAllowedForTemplate,
  taskCatalogEntry,
  workflowTemplateForCapability,
} from './caseContract.js';

function boundText(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function rejectUnknown(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_body' };
  }
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) return { ok: false, error: 'unknown_field' };
  }
  return { ok: true };
}

const ACTION_ALLOWED = new Set([
  'expectedVersion',
  'commandId',
  'creationCommandId',
  'subjectType',
  'subjectId',
]);
const REQUEST_TASK_ALLOWED = new Set([
  ...ACTION_ALLOWED,
  'taskKey',
  'note',
]);
const COMPLETE_TASK_ALLOWED = new Set([
  'expectedVersion',
  'commandId',
  'creationCommandId',
  'value',
  'choice',
  'confirmed',
]);
const CANCEL_ALLOWED = new Set([
  ...ACTION_ALLOWED,
  'reasonCode',
  'note',
]);
const UNABLE_ALLOWED = new Set([
  ...ACTION_ALLOWED,
  'reasonCode',
  'note',
]);
const ENSURE_ALLOWED = new Set([
  'commandId',
  'creationCommandId',
  'subjectType',
  'subjectId',
]);

export function parseExpectedVersion(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export function parseCasePage(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n;
}

export function parseCaseLimit(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return GBS_CASE_BOUNDS.PAGE_DEFAULT;
  return Math.min(n, GBS_CASE_BOUNDS.PAGE_MAX);
}

export function parseCaseListQuery(query = {}) {
  const page = parseCasePage(query.page);
  const limit = parseCaseLimit(query.limit);
  const status = typeof query.status === 'string' && isEmittedCaseStatus(query.status) ? query.status : undefined;
  const capabilityId = typeof query.capabilityId === 'string' && query.capabilityId.trim()
    ? query.capabilityId.trim()
    : undefined;
  const jurisdictionId = typeof query.jurisdictionId === 'string' && query.jurisdictionId.trim()
    ? query.jurisdictionId.trim()
    : undefined;
  const workflowTemplateKey = typeof query.workflowTemplateKey === 'string'
    && Object.values(CASE_WORKFLOW_TEMPLATES).includes(query.workflowTemplateKey)
    ? query.workflowTemplateKey
    : typeof query.caseType === 'string'
      && Object.values(CASE_WORKFLOW_TEMPLATES).includes(query.caseType)
      ? query.caseType
      : undefined;
  const sort = query.sort === 'newest' ? 'newest' : 'recently_updated';
  return { page, limit, status, capabilityId, jurisdictionId, workflowTemplateKey, sort };
}

export function allowlistedActionInput(body = {}) {
  const gate = rejectUnknown(body, ACTION_ALLOWED);
  if (!gate.ok) return gate;
  return {
    ok: true,
    value: {
      commandId: boundText(body.commandId || body.creationCommandId, GBS_CASE_BOUNDS.COMMAND_ID_MAX) || undefined,
    },
  };
}

export function allowlistedEnsureInput(body = {}) {
  const gate = rejectUnknown(body, ENSURE_ALLOWED);
  if (!gate.ok) return gate;
  return {
    ok: true,
    value: {
      commandId: boundText(body.commandId || body.creationCommandId, GBS_CASE_BOUNDS.COMMAND_ID_MAX) || undefined,
    },
  };
}

export function allowlistedRequestTaskInput(body = {}) {
  const gate = rejectUnknown(body, REQUEST_TASK_ALLOWED);
  if (!gate.ok) return gate;
  const taskKey = typeof body.taskKey === 'string' ? body.taskKey.trim() : '';
  if (!isValidCaseTaskKey(taskKey)) return { ok: false, error: 'invalid_task_key' };
  return {
    ok: true,
    value: {
      taskKey,
      note: boundText(body.note, GBS_CASE_BOUNDS.NOTE_MAX) || undefined,
      commandId: boundText(body.commandId || body.creationCommandId, GBS_CASE_BOUNDS.COMMAND_ID_MAX) || undefined,
    },
  };
}

export function allowlistedCompleteTaskInput(body = {}, task = {}) {
  const gate = rejectUnknown(body, COMPLETE_TASK_ALLOWED);
  if (!gate.ok) return gate;
  const inputType = task.customerInputType || CASE_TASK_INPUT_TYPES.NONE;
  let customerValue = '';
  if (inputType === CASE_TASK_INPUT_TYPES.SHORT_TEXT) {
    customerValue = boundText(body.value, GBS_CASE_BOUNDS.SHORT_TEXT_MAX);
    if (!customerValue) return { ok: false, error: 'task_value_required' };
  } else if (inputType === CASE_TASK_INPUT_TYPES.CHOICE) {
    const entry = taskCatalogEntry(task.taskKey);
    const choice = boundText(body.choice || body.value, 40);
    if (!entry?.choices?.includes(choice)) return { ok: false, error: 'invalid_task_choice' };
    customerValue = choice;
  } else if (inputType === CASE_TASK_INPUT_TYPES.CONFIRMATION) {
    if (body.confirmed !== true && body.value !== true && body.value !== 'confirmed') {
      return { ok: false, error: 'task_confirmation_required' };
    }
    customerValue = 'confirmed';
  }
  return {
    ok: true,
    value: {
      customerValue,
      commandId: boundText(body.commandId || body.creationCommandId, GBS_CASE_BOUNDS.COMMAND_ID_MAX) || undefined,
    },
  };
}

export function allowlistedCancelInput(body = {}) {
  const gate = rejectUnknown(body, CANCEL_ALLOWED);
  if (!gate.ok) return gate;
  const reasonCode = body.reasonCode || CASE_CANCEL_REASON_CODES.OTHER;
  if (!isValidCancelReason(reasonCode)) return { ok: false, error: 'invalid_reason_code' };
  return {
    ok: true,
    value: {
      reasonCode,
      note: boundText(body.note, GBS_CASE_BOUNDS.NOTE_MAX) || undefined,
      commandId: boundText(body.commandId || body.creationCommandId, GBS_CASE_BOUNDS.COMMAND_ID_MAX) || undefined,
    },
  };
}

export function allowlistedUnableInput(body = {}) {
  const gate = rejectUnknown(body, UNABLE_ALLOWED);
  if (!gate.ok) return gate;
  const reasonCode = body.reasonCode || CASE_UNABLE_REASON_CODES.OTHER;
  if (!isValidUnableReason(reasonCode)) return { ok: false, error: 'invalid_reason_code' };
  return {
    ok: true,
    value: {
      reasonCode,
      note: boundText(body.note, GBS_CASE_BOUNDS.NOTE_MAX) || undefined,
      commandId: boundText(body.commandId || body.creationCommandId, GBS_CASE_BOUNDS.COMMAND_ID_MAX) || undefined,
    },
  };
}

function taskProjection(task) {
  if (!task) return null;
  return {
    publicTaskRef: task.publicTaskRef,
    taskKey: task.taskKey,
    type: task.type,
    title: task.title,
    description: task.description,
    status: task.status,
    required: task.required === true,
    customerInputType: task.customerInputType,
    choices: task.choices || undefined,
    customerValue: task.customerValue || undefined,
    createdAt: task.createdAt,
    completedAt: task.completedAt || null,
  };
}

function timelineProjection(event) {
  if (!event) return null;
  return {
    eventType: event.eventType,
    actorType: event.actorType,
    at: event.at,
    taskKey: event.taskKey || undefined,
    fromStatus: event.fromStatus || undefined,
    toStatus: event.toStatus || undefined,
    milestoneKey: event.milestoneKey || undefined,
  };
}

function sharedCaseProjection(record) {
  return {
    publicCaseRef: record.publicCaseRef,
    publicQuoteRef: record.publicQuoteRefSnapshot,
    requestPublicRef: record.requestPublicRefSnapshot,
    workflowTemplateKey: record.workflowTemplateKey,
    status: record.status,
    currentMilestoneKey: record.currentMilestoneKey,
    capabilityId: record.capabilityId,
    capabilityPublicName: record.capabilityPublicNameSnapshot,
    title: record.titleSnapshot,
    jurisdictionId: record.jurisdictionId,
    jurisdictionName: record.jurisdictionNameSnapshot,
    countryCode: record.countryCode,
    entityTypeId: record.entityTypeId || null,
    actingFor: record.actingForSnapshot,
    existingBusinessName: record.existingBusinessNameSnapshot || undefined,
    preferredLanguage: record.preferredLanguageSnapshot || undefined,
    proposedBusinessName: record.proposedBusinessName || undefined,
    customerTasks: (record.customerTasks || []).map(taskProjection),
    timelineEvents: (record.timelineEvents || []).map(timelineProjection),
    openedAt: record.openedAt,
    preparationStartedAt: record.preparationStartedAt || null,
    readyForSubmissionAt: record.readyForSubmissionAt || null,
    cancelledAt: record.cancelledAt || null,
    unableToProceedAt: record.unableToProceedAt || null,
    completedAt: record.completedAt || null,
    cancelReasonCode: record.cancelReasonCode || undefined,
    unableReasonCode: record.unableReasonCode || undefined,
    recordVersion: record.recordVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function customerCaseProjection(record, extras = {}) {
  if (!record) return null;
  return {
    ...sharedCaseProjection(record),
    providerDisplayName: extras.providerDisplayName || record.providerDisplayNameSnapshot || 'Provider',
    providerKind: extras.providerKind || record.providerKindSnapshot || 'independent',
    readyForSubmissionCopy:
      'The provider has marked this Case ready for the next filing or submission step. Strideto has not submitted anything to a government authority.',
  };
}

export function providerCaseProjection(record, customerSafe = {}) {
  if (!record) return null;
  return {
    ...sharedCaseProjection(record),
    customerDisplayName: customerSafe.displayName || 'Customer',
    customerSummary: record.customerSummarySnapshot,
  };
}

export function customerCaseListItem(record, extras = {}) {
  const full = customerCaseProjection(record, extras);
  if (!full) return null;
  return {
    publicCaseRef: full.publicCaseRef,
    title: full.title,
    providerDisplayName: full.providerDisplayName,
    providerKind: full.providerKind,
    capabilityPublicName: full.capabilityPublicName,
    jurisdictionName: full.jurisdictionName,
    workflowTemplateKey: full.workflowTemplateKey,
    status: full.status,
    currentMilestoneKey: full.currentMilestoneKey,
    openedAt: full.openedAt,
    updatedAt: full.updatedAt,
  };
}

export function providerCaseListItem(record, customerSafe = {}) {
  const full = providerCaseProjection(record, customerSafe);
  if (!full) return null;
  return {
    publicCaseRef: full.publicCaseRef,
    customerDisplayName: full.customerDisplayName,
    title: full.title,
    capabilityPublicName: full.capabilityPublicName,
    jurisdictionName: full.jurisdictionName,
    workflowTemplateKey: full.workflowTemplateKey,
    status: full.status,
    currentMilestoneKey: full.currentMilestoneKey,
    updatedAt: full.updatedAt,
    openedAt: full.openedAt,
  };
}

export {
  CASE_STATUSES,
  CASE_TASK_KEYS,
  CASE_WORKFLOW_TEMPLATES,
  isOpaqueCaseRef,
  isOpaqueTaskRef,
  taskAllowedForTemplate,
  taskCatalogEntry,
  workflowTemplateForCapability,
};
