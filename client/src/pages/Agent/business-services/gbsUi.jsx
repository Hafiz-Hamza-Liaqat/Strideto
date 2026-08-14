import { ui } from '../../../design-system/surfaceClasses';

export const wrap = 'min-w-0 break-words break-words-safe';
export const page = `${ui.page} space-y-6`;
export const card = `${ui.card} p-4 sm:p-5 min-w-0`;
export const h1 = `${ui.h1} text-2xl sm:text-3xl`;
export const h2 = 'text-lg font-semibold text-gray-900 dark:text-white break-words';
export const muted = ui.muted;
export const label = 'block text-sm font-medium text-gray-900 dark:text-white mb-1';
export const input = ui.input;
export const errorBox = `${ui.error} break-words`;
export const emptyBox = ui.empty;
export const skeleton = 'animate-pulse rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 h-24';

export function statusTone(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'verified' || key === 'approved') {
    return 'border border-emerald-700/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100';
  }
  if (key === 'suspended' || key === 'rejected' || key === 'revoked') {
    return 'border border-red-700/40 bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-100';
  }
  if (key === 'under_review' || key === 'evidence_submitted' || key === 'evidence_backed') {
    return 'border border-amber-700/40 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  }
  if (key === 'needs_information' || key === 'needs_policy' || key === 'stale' || key === 'not_catalogued') {
    return 'border border-orange-700/40 bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-100';
  }
  if (key === 'current') {
    return 'border border-sky-700/40 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100';
  }
  return 'border border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
}

export function StatusBadge({ status, label: text }) {
  const display = text || String(status || 'unknown').replace(/_/g, ' ');
  return (
    <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${wrap} ${statusTone(status)}`}>
      {display}
    </span>
  );
}

export const SETUP_STEPS = [
  'Choose provider subject',
  'Add a Business Services capability',
  'Define jurisdiction scope',
  'Submit required evidence metadata',
  'Reach VERIFIED after Admin review',
  'Create a private Service Listing',
  'Submit the listing for Admin review',
  'Public publication remains later',
];
