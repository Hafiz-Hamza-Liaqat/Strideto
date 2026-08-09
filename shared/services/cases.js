export const CASE_TYPES = Object.freeze(['study', 'scholarship', 'work', 'visit', 'business', 'general_guidance', 'other']);
export const CASE_LIFECYCLES = Object.freeze(['proposed', 'awaiting_student_acceptance', 'active', 'paused', 'closing', 'completed', 'cancelled', 'transferred']);
export const CASE_OUTCOMES = Object.freeze(['successful', 'unsuccessful', 'withdrawn', 'cancelled', 'transferred', 'other', 'unknown']);
export const APPROVAL_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'expired', 'cancelled']);
export const HIGH_VALUE_ACTIONS = Object.freeze(['application_package_ready', 'final_document_set', 'external_submission', 'selection_change', 'scope_change', 'agent_transfer', 'case_closure']);
export const SUBMISSION_METHODS = Object.freeze(['student_self_submitted', 'agent_assisted_external', 'authorized_integration_future', 'unknown']);

const definitions = {
  study: ['intake', 'profile_review', 'shortlist', 'document_preparation', 'application_ready', 'submitted_external', 'decision_waiting', 'outcome', 'closed'],
  scholarship: ['intake', 'eligibility_review', 'shortlist', 'document_preparation', 'application_ready', 'submitted_external', 'decision_waiting', 'outcome', 'closed'],
  work: ['intake', 'profile_review', 'opportunity_search', 'application_preparation', 'submitted_external', 'interview', 'outcome', 'closed'],
  visit: ['intake', 'requirements_review', 'document_preparation', 'application_ready', 'submitted_external', 'decision_waiting', 'outcome', 'closed'],
  business: ['intake', 'requirements_review', 'business_plan', 'document_preparation', 'application_ready', 'submitted_external', 'outcome', 'closed'],
  general_guidance: ['intake', 'assessment', 'recommendations', 'action_plan', 'outcome', 'closed'],
  other: ['intake', 'assessment', 'action_plan', 'outcome', 'closed'],
};

export const WORKFLOW_VERSION = 1;
export function getWorkflow(caseType, version = WORKFLOW_VERSION) {
  const stages = definitions[caseType];
  if (!stages || version !== WORKFLOW_VERSION) return null;
  return Object.freeze({ id: `${caseType}-case`, version, caseType, stages: [...stages], terminalStages: ['closed'], transitions: Object.fromEntries(stages.map((stage, i) => [stage, i < stages.length - 1 ? [stages[i + 1]] : []])) });
}
export function canTransitionStage(caseType, version, from, to) { return Boolean(getWorkflow(caseType, version)?.transitions[from]?.includes(to)); }

export const LIFECYCLE_TRANSITIONS = Object.freeze({
  proposed: ['awaiting_student_acceptance', 'cancelled'], awaiting_student_acceptance: ['active', 'cancelled'],
  active: ['paused', 'closing', 'completed', 'cancelled', 'transferred'], paused: ['active', 'closing', 'cancelled', 'transferred'],
  closing: ['completed', 'cancelled'], completed: [], cancelled: [], transferred: [],
});
export function canTransitionLifecycle(from, to) { return Boolean(LIFECYCLE_TRANSITIONS[from]?.includes(to)); }
export function cleanCaseText(value, max = 2000) { return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : ''; }
export function boundedPage(query = {}) { const page = Math.max(1, Math.min(10000, Number(query.page) || 1)); const limit = Math.max(1, Math.min(50, Number(query.limit) || 20)); return { page, limit, skip: (page - 1) * limit }; }
