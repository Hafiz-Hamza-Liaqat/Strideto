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
