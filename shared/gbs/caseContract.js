/**
 * GBS Case pre-submission contract (Phase 17D-8A).
 *
 * Operational tracking only. No government filing, payment, documents,
 * messaging, or My Businesses.
 */
import { BUSINESS_SERVICES_CAPABILITY_IDS } from './businessServicesCapabilities.js';

export const GBS_CASE_SCHEMA_VERSION = '17d-8a.0';

export const CASE_STATUSES = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  AWAITING_CLIENT: 'awaiting_client',
  READY_FOR_SUBMISSION: 'ready_for_submission',
  CANCELLED: 'cancelled',
  UNABLE_TO_PROCEED: 'unable_to_proceed',
  COMPLETED: 'completed',
});

export const CASE_STATUSES_EMITTED = Object.freeze(Object.values(CASE_STATUSES));

export const CASE_TERMINAL_STATUSES = Object.freeze([
  CASE_STATUSES.CANCELLED,
  CASE_STATUSES.UNABLE_TO_PROCEED,
  CASE_STATUSES.COMPLETED,
]);

export const CASE_CUSTOMER_CANCELLABLE_STATUSES = Object.freeze([
  CASE_STATUSES.OPEN,
  CASE_STATUSES.IN_PROGRESS,
  CASE_STATUSES.AWAITING_CLIENT,
  CASE_STATUSES.READY_FOR_SUBMISSION,
]);

export const CASE_MILESTONES = Object.freeze({
  CASE_OPENED: 'case_opened',
  PREPARATION: 'preparation',
  AWAITING_CUSTOMER_ACTION: 'awaiting_customer_action',
  READY_FOR_SUBMISSION: 'ready_for_submission',
  CANCELLED: 'cancelled',
  UNABLE_TO_PROCEED: 'unable_to_proceed',
  SERVICE_COMPLETED: 'service_completed',
});

export const CASE_WORKFLOW_TEMPLATES = Object.freeze({
  COMPANY_FORMATION: 'company_formation',
  GENERIC_PROFESSIONAL_SERVICE: 'generic_professional_service',
});

export const CASE_TASK_TYPES = Object.freeze({
  CUSTOMER_ACTION: 'customer_action',
  PROVIDER_ACTION: 'provider_action',
  INFORMATIONAL: 'informational',
});

export const CASE_TASK_STATUSES = Object.freeze({
  OPEN: 'open',
  COMPLETED: 'completed',
});

export const CASE_TASK_INPUT_TYPES = Object.freeze({
  NONE: 'none',
  SHORT_TEXT: 'short_text',
  CHOICE: 'choice',
  CONFIRMATION: 'confirmation',
});

export const CASE_TASK_KEYS = Object.freeze({
  PROPOSED_BUSINESS_NAME: 'proposed_business_name',
  CONFIRM_SERVICE_SCOPE: 'confirm_service_scope',
  PREFERRED_CONTACT_WINDOW: 'preferred_contact_window',
  ADDITIONAL_NOTE: 'additional_non_sensitive_note',
});

export const CASE_CANCEL_REASON_CODES = Object.freeze({
  CHANGED_MIND: 'changed_mind',
  NO_LONGER_NEEDED: 'no_longer_needed',
  OTHER: 'other',
});

export const CASE_UNABLE_REASON_CODES = Object.freeze({
  CUSTOMER_INFORMATION_UNAVAILABLE: 'customer_information_unavailable',
  SCOPE_ISSUE: 'scope_issue',
  AUTHORITY_LOST: 'authority_lost',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  OTHER: 'other',
});

export const CASE_TIMELINE_ACTORS = Object.freeze({
  SYSTEM: 'system',
  CUSTOMER: 'customer',
  PROVIDER: 'provider',
});

export const CASE_TIMELINE_EVENT_TYPES = Object.freeze({
  CASE_OPENED: 'case_opened',
  PREPARATION_STARTED: 'preparation_started',
  CUSTOMER_ACTION_REQUESTED: 'customer_action_requested',
  CUSTOMER_ACTION_COMPLETED: 'customer_action_completed',
  PREPARATION_RESUMED: 'preparation_resumed',
  READY_FOR_SUBMISSION: 'ready_for_submission',
  CASE_CANCELLED: 'case_cancelled',
  CASE_UNABLE_TO_PROCEED: 'case_unable_to_proceed',
  GENERIC_SERVICE_COMPLETED: 'generic_service_completed',
});

export const GBS_CASE_BOUNDS = Object.freeze({
  REF_MIN: 16,
  REF_MAX: 64,
  COMMAND_ID_MAX: 120,
  NOTE_MAX: 500,
  TITLE_MAX: 160,
  DESCRIPTION_MAX: 500,
  SHORT_TEXT_MAX: 160,
  TASKS_MAX: 20,
  TIMELINE_MAX: 80,
  PAGE_DEFAULT: 20,
  PAGE_MAX: 50,
});

const STATUS_SET = new Set(CASE_STATUSES_EMITTED);
const TEMPLATE_SET = new Set(Object.values(CASE_WORKFLOW_TEMPLATES));
const TASK_KEY_SET = new Set(Object.values(CASE_TASK_KEYS));
const CANCEL_SET = new Set(Object.values(CASE_CANCEL_REASON_CODES));
const UNABLE_SET = new Set(Object.values(CASE_UNABLE_REASON_CODES));
const INPUT_SET = new Set(Object.values(CASE_TASK_INPUT_TYPES));

export function isEmittedCaseStatus(value) {
  return typeof value === 'string' && STATUS_SET.has(value);
}

export function isCaseTerminal(status) {
  return CASE_TERMINAL_STATUSES.includes(status);
}

export function isCustomerCancellableStatus(status) {
  return CASE_CUSTOMER_CANCELLABLE_STATUSES.includes(status);
}

export function isOpaqueCaseRef(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < GBS_CASE_BOUNDS.REF_MIN || trimmed.length > GBS_CASE_BOUNDS.REF_MAX) {
    return false;
  }
  if (/^CASE-\d+$/i.test(trimmed)) return false;
  if (/^[a-f0-9]{24}$/i.test(trimmed)) return false;
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
}

export function isOpaqueTaskRef(value) {
  return isOpaqueCaseRef(value);
}

export function isValidCaseTemplate(value) {
  return typeof value === 'string' && TEMPLATE_SET.has(value);
}

export function isValidCaseTaskKey(value) {
  return typeof value === 'string' && TASK_KEY_SET.has(value);
}

export function isValidCancelReason(value) {
  return typeof value === 'string' && CANCEL_SET.has(value);
}

export function isValidUnableReason(value) {
  return typeof value === 'string' && UNABLE_SET.has(value);
}

export function isValidTaskInputType(value) {
  return typeof value === 'string' && INPUT_SET.has(value);
}

export function workflowTemplateForCapability(capabilityId) {
  if (capabilityId === BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION) {
    return CASE_WORKFLOW_TEMPLATES.COMPANY_FORMATION;
  }
  return CASE_WORKFLOW_TEMPLATES.GENERIC_PROFESSIONAL_SERVICE;
}

export function templateAllowsInternalCompletion(templateKey) {
  return templateKey === CASE_WORKFLOW_TEMPLATES.GENERIC_PROFESSIONAL_SERVICE;
}

export const CASE_TASK_CATALOG = Object.freeze({
  [CASE_TASK_KEYS.PROPOSED_BUSINESS_NAME]: Object.freeze({
    taskKey: CASE_TASK_KEYS.PROPOSED_BUSINESS_NAME,
    type: CASE_TASK_TYPES.CUSTOMER_ACTION,
    title: 'Proposed business name',
    description: 'Share the proposed legal or trading name you would like the provider to use. This is not a government filing.',
    customerInputType: CASE_TASK_INPUT_TYPES.SHORT_TEXT,
    required: true,
    templates: Object.freeze([CASE_WORKFLOW_TEMPLATES.COMPANY_FORMATION, CASE_WORKFLOW_TEMPLATES.GENERIC_PROFESSIONAL_SERVICE]),
  }),
  [CASE_TASK_KEYS.CONFIRM_SERVICE_SCOPE]: Object.freeze({
    taskKey: CASE_TASK_KEYS.CONFIRM_SERVICE_SCOPE,
    type: CASE_TASK_TYPES.CUSTOMER_ACTION,
    title: 'Confirm service scope',
    description: 'Confirm that the accepted quote still matches the work you want the provider to prepare.',
    customerInputType: CASE_TASK_INPUT_TYPES.CONFIRMATION,
    required: true,
    templates: Object.freeze([CASE_WORKFLOW_TEMPLATES.COMPANY_FORMATION, CASE_WORKFLOW_TEMPLATES.GENERIC_PROFESSIONAL_SERVICE]),
  }),
  [CASE_TASK_KEYS.PREFERRED_CONTACT_WINDOW]: Object.freeze({
    taskKey: CASE_TASK_KEYS.PREFERRED_CONTACT_WINDOW,
    type: CASE_TASK_TYPES.CUSTOMER_ACTION,
    title: 'Preferred contact window',
    description: 'Choose when the provider may follow up inside this Case. This is not a chat thread.',
    customerInputType: CASE_TASK_INPUT_TYPES.CHOICE,
    choices: Object.freeze(['morning', 'afternoon', 'email_only']),
    required: false,
    templates: Object.freeze([CASE_WORKFLOW_TEMPLATES.COMPANY_FORMATION, CASE_WORKFLOW_TEMPLATES.GENERIC_PROFESSIONAL_SERVICE]),
  }),
  [CASE_TASK_KEYS.ADDITIONAL_NOTE]: Object.freeze({
    taskKey: CASE_TASK_KEYS.ADDITIONAL_NOTE,
    type: CASE_TASK_TYPES.CUSTOMER_ACTION,
    title: 'Additional non-sensitive note',
    description: 'Optional short note. Do not include identity documents, addresses, tax IDs, or payment details.',
    customerInputType: CASE_TASK_INPUT_TYPES.SHORT_TEXT,
    required: false,
    templates: Object.freeze([CASE_WORKFLOW_TEMPLATES.COMPANY_FORMATION, CASE_WORKFLOW_TEMPLATES.GENERIC_PROFESSIONAL_SERVICE]),
  }),
});

export function taskCatalogEntry(taskKey) {
  return CASE_TASK_CATALOG[taskKey] || null;
}

export function taskAllowedForTemplate(taskKey, templateKey) {
  const entry = taskCatalogEntry(taskKey);
  return Boolean(entry && entry.templates.includes(templateKey));
}

export const FORBIDDEN_CASE_FIELDS = Object.freeze([
  'submittedAt',
  'authorityReference',
  'registrationNumber',
  'formationDate',
  'authorityDecision',
  'governmentStatus',
  'paidAt',
  'paymentIntent',
  'submitted_to_authority',
  'rejected_by_authority',
]);
