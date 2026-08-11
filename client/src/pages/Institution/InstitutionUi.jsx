export function humanize(value) {
  if (!value) return 'Not available';
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const BADGE_TONES = {
  approved: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
  draft: 'border-gray-300 bg-gray-50 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200',
  rejected: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
  needs_information: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
  verification_pending: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
  under_review: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
  stale: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
  review_due: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
};

export function StatusBadge({ value, label }) {
  const tone = BADGE_TONES[value] || 'border-gray-300 bg-gray-50 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200';
  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {label ? `${label}: ` : ''}{humanize(value)}
    </span>
  );
}

export function Panel({ title, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm sm:p-5 ${className}`}>
      {title ? <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2> : null}
      <div className={title ? 'mt-3' : ''}>{children}</div>
    </section>
  );
}

export function PageState({ children, tone = 'neutral', role = 'status' }) {
  const tones = {
    neutral: 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300',
    error: 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200',
    warning: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200',
    success: 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200',
  };
  return <div className={`rounded-lg border p-3 text-sm ${tones[tone]}`} role={role}>{children}</div>;
}

export const fieldClass = 'min-h-[44px] w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30';
export const primaryButton = 'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';
export const secondaryButton = 'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60';

export function portalChromeLabel(verificationStatus) {
  return verificationStatus === 'approved' ? 'Verified Institution' : 'Institution Portal';
}
