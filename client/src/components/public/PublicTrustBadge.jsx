import { AUTHORITY_KINDS, authorityLabel } from '@shared/publicDiscovery/publicTruth.js';

const STYLES = {
  [AUTHORITY_KINDS.EMPLOYER_POSTED]: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  [AUTHORITY_KINDS.OFFICIAL_INSTITUTION]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  [AUTHORITY_KINDS.INSTITUTION_SCHOLARSHIP]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  [AUTHORITY_KINDS.SOURCE_BACKED]: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  [AUTHORITY_KINDS.AGENT_STATEMENT]: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  [AUTHORITY_KINDS.STRIDETO_RECOMMENDATION]: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  [AUTHORITY_KINDS.USER_GENERATED]: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  [AUTHORITY_KINDS.UNKNOWN]: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

export function PublicTrustBadge({ kind, label }) {
  if (!kind && !label) return null;
  const text = label || authorityLabel(kind);
  const style = STYLES[kind] || STYLES[AUTHORITY_KINDS.UNKNOWN];
  return (
    <span className={`inline-flex items-center rounded-full text-xs font-medium px-2 py-0.5 ${style}`}>
      {text}
    </span>
  );
}
