import { getTrustStateDisplay, SKILL_CLAIM_STATUSES } from '@shared/career/skillVerification.js';

/**
 * Renders a skill's trust state as a distinct, self-describing badge.
 *
 * Deliberately NOT one generic checkmark: "claimed", "evidence submitted",
 * "evidence-backed" and "verified" are four different assertions, and an
 * employer must be able to tell them apart at a glance. Only `verified` gets
 * the success treatment and the check glyph; everything else reads as what it
 * actually is.
 *
 * The label and tone come from the shared display contract, so the server and
 * the UI can never disagree about what a state means.
 */
const TONE_CLASSES = {
  neutral: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
  info: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700',
  progress: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700',
  success: 'bg-emerald-50 text-emerald-900 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-600',
  warning: 'bg-orange-50 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-700',
  danger: 'bg-red-50 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-700',
  muted: 'bg-gray-50 text-gray-500 border-gray-200 line-through dark:bg-gray-900 dark:text-gray-500 dark:border-gray-700',
};

export function SkillTrustBadge({ trustState, verificationMethod, className = '', showDescription = false }) {
  // Method-specific wording where there is one: "Credential verified",
  // "Reference verified" and "Assessment verified" are different assertions,
  // and a single "Verified" pill would quietly equate them.
  const display = getTrustStateDisplay(trustState, verificationMethod);
  const tone = TONE_CLASSES[display.tone] ?? TONE_CLASSES.neutral;
  const isVerified = trustState === SKILL_CLAIM_STATUSES.VERIFIED;

  return (
    <span className={`inline-flex flex-col gap-0.5 min-w-0 ${className}`}>
      <span
        className={`inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full border text-xs font-medium break-words ${tone}`}
        /* The state is spelled out for assistive tech, not conveyed by colour alone. */
        title={display.description}
      >
        {isVerified ? (
          <svg aria-hidden="true" viewBox="0 0 20 20" className="w-3 h-3 shrink-0 fill-current">
            <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0z" />
          </svg>
        ) : null}
        {/*
          Wraps, never truncates. The label IS the assertion — "Claimed"
          clipped to "Cl…" next to a neighbouring "Verified" is precisely the
          confusion this component exists to prevent. Two lines in a narrow
          column is the correct trade.
        */}
        <span className="whitespace-normal break-words">{display.label}</span>
      </span>
      {showDescription ? (
        <span className="text-[11px] leading-snug text-gray-600 dark:text-gray-400 break-words">
          {display.description}
        </span>
      ) : null}
    </span>
  );
}

export default SkillTrustBadge;
