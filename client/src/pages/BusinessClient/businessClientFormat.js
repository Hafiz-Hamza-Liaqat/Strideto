export const SERVICE_REQUEST_STATUS_LABELS = {
  submitted: 'Submitted',
  provider_reviewing: 'Provider reviewing',
  ready_for_quote: 'Ready for quote',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

export const QUOTE_STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
};

export function quoteStatusLabel(status) {
  return QUOTE_STATUS_LABELS[status] || String(status || '').replace(/_/g, ' ');
}

export function serviceRequestStatusLabel(status) {
  return SERVICE_REQUEST_STATUS_LABELS[status] || String(status || '').replace(/_/g, ' ');
}

export function providerKindLabel(kind) {
  return kind === 'agency' ? 'Agency' : 'Independent';
}

export function actingForLabel(value) {
  if (value === 'existing_business') return 'Existing business';
  if (value === 'formation_intent') return 'Formation intent';
  return 'Self';
}

export function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export const CASE_STATUS_LABELS = {
  open: 'Open',
  in_progress: 'Provider is preparing',
  awaiting_client: 'Awaiting your action',
  ready_for_submission: 'Ready for submission',
  cancelled: 'Cancelled',
  unable_to_proceed: 'Unable to proceed',
  completed: 'Service completed',
};

export const CASE_MILESTONE_LABELS = {
  case_opened: 'Case opened',
  preparation: 'Preparation',
  awaiting_customer_action: 'Awaiting customer action',
  ready_for_submission: 'Ready for submission',
  cancelled: 'Cancelled',
  unable_to_proceed: 'Unable to proceed',
  service_completed: 'Service completed',
};

export const CASE_TEMPLATE_LABELS = {
  company_formation: 'Company formation',
  generic_professional_service: 'Professional service',
};

export function caseStatusLabel(status) {
  return CASE_STATUS_LABELS[status] || String(status || '').replace(/_/g, ' ');
}

export function caseMilestoneLabel(key) {
  return CASE_MILESTONE_LABELS[key] || String(key || '').replace(/_/g, ' ');
}

export function caseTemplateLabel(key) {
  return CASE_TEMPLATE_LABELS[key] || String(key || '').replace(/_/g, ' ');
}

export function timelineEventLabel(eventType) {
  const labels = {
    case_opened: 'Case opened',
    preparation_started: 'Preparation started',
    customer_action_requested: 'Customer action requested',
    customer_action_completed: 'Customer action completed',
    preparation_resumed: 'Preparation resumed',
    ready_for_submission: 'Marked ready for the next submission step',
    case_cancelled: 'Case cancelled',
    case_unable_to_proceed: 'Provider unable to proceed',
    generic_service_completed: 'Professional service completed',
  };
  return labels[eventType] || String(eventType || '').replace(/_/g, ' ');
}
