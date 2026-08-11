import { FRESHNESS_STATES } from '@shared/trust/sourceVerification.js';
import { freshnessPublicLabel, NOT_SPECIFIED } from '@shared/publicDiscovery/publicTruth.js';
import { formatDate } from '../../utils/formatDate';
import { publicHttpUrlOrNull } from '@shared/publicDiscovery/safePublicUrl.js';

const FRESHNESS_CLASS = {
  [FRESHNESS_STATES.FRESH]: 'text-emerald-700 dark:text-emerald-300',
  [FRESHNESS_STATES.REVIEW_DUE]: 'text-amber-700 dark:text-amber-300',
  [FRESHNESS_STATES.STALE]: 'text-amber-800 dark:text-amber-200',
  [FRESHNESS_STATES.BROKEN]: 'text-red-700 dark:text-red-300',
  [FRESHNESS_STATES.UNKNOWN]: 'text-gray-500 dark:text-gray-400',
};

export function ProvenanceStrip({
  sourceLabel,
  authorityLabel,
  lastReviewedAt,
  freshnessState,
  officialUrl,
  className = '',
}) {
  const url = publicHttpUrlOrNull(officialUrl);
  const freshness = freshnessState ? freshnessPublicLabel(freshnessState) : null;
  const caution = freshnessState === FRESHNESS_STATES.STALE
    || freshnessState === FRESHNESS_STATES.REVIEW_DUE
    || freshnessState === FRESHNESS_STATES.BROKEN;

  if (!sourceLabel && !authorityLabel && !lastReviewedAt && !freshness) return null;

  return (
    <div
      className={`text-xs text-gray-600 dark:text-gray-400 space-y-1 ${className}`}
      role="group"
      aria-label="Source and freshness"
    >
      {authorityLabel ? <p><span className="font-medium text-gray-700 dark:text-gray-300">Authority:</span> {authorityLabel}</p> : null}
      {sourceLabel ? <p><span className="font-medium text-gray-700 dark:text-gray-300">Source:</span> {sourceLabel}</p> : null}
      {lastReviewedAt ? (
        <p><span className="font-medium text-gray-700 dark:text-gray-300">Last reviewed:</span> {formatDate(lastReviewedAt) || NOT_SPECIFIED}</p>
      ) : null}
      {freshness ? (
        <p className={FRESHNESS_CLASS[freshnessState] || FRESHNESS_CLASS.unknown}>
          <span className="font-medium">Freshness:</span> {freshness}
        </p>
      ) : null}
      {url ? (
        <p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary dark:text-mint hover:underline break-words-safe">
            Official source
          </a>
        </p>
      ) : null}
      {caution ? (
        <p className="text-amber-800 dark:text-amber-200">Confirm this information with the official source before acting.</p>
      ) : null}
    </div>
  );
}
