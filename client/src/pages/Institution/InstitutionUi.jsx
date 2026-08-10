export function humanize(value) {
  if (!value) return 'Not available';
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StatusBadge({ value, label }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {label ? `${label}: ` : ''}{humanize(value)}
    </span>
  );
}

export function Panel({ title, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
      <div className={title ? 'mt-3' : ''}>{children}</div>
    </section>
  );
}

export function PageState({ children, tone = 'neutral', role = 'status' }) {
  const tones = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
    error: 'border-red-300 bg-red-50 text-red-800',
    warning: 'border-amber-300 bg-amber-50 text-amber-900',
    success: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  };
  return <div className={`rounded-lg border p-3 text-sm ${tones[tone]}`} role={role}>{children}</div>;
}

export const fieldClass = 'min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200';
export const primaryButton = 'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60';
export const secondaryButton = 'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60';
