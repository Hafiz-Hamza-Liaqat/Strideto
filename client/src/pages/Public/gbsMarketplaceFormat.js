import { formatMoney } from '@shared/international/dateDisplay.js';

export function formatProfessionalFee(summary) {
  if (!summary) return 'Quote required';
  if (summary.kind === 'quote_required') return 'Quote required';
  if (summary.kind === 'range' && Number.isFinite(summary.minAmountMinor) && Number.isFinite(summary.maxAmountMinor)) {
    return `${formatMoney({ amountMinor: summary.minAmountMinor, currency: summary.currency })} – ${formatMoney({ amountMinor: summary.maxAmountMinor, currency: summary.currency })}`;
  }
  if (Number.isFinite(summary.amountMinor) && summary.currency) {
    const amount = formatMoney({ amountMinor: summary.amountMinor, currency: summary.currency });
    if (summary.kind === 'starting_at') return `Starting at ${amount}`;
    return amount;
  }
  return summary.label || 'Professional service fee not listed';
}

export function formatGovernmentFee(fee) {
  if (!fee?.listed || fee.amount == null || !fee.currency) return 'Official fee not listed here';
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: fee.currency }).format(fee.amount);
  } catch {
    return `${fee.currency} ${fee.amount}`;
  }
}

export function turnaroundLabel(item) {
  if (!item?.providerTurnaroundEstimate || !item.turnaroundUnit) return null;
  const unit = String(item.turnaroundUnit).replaceAll('_', ' ');
  const n = item.providerTurnaroundEstimate;
  return `${n} ${unit}`;
}

export function providerKindLabel(kind) {
  return kind === 'agency' ? 'Agency' : 'Independent';
}
