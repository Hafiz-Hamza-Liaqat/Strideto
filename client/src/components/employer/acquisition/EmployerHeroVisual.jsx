import { Icon } from '../../brand/Icon';

const FLOW_STEPS = [
  { key: 'post', label: 'Post opportunity', icon: 'briefcase' },
  { key: 'discover', label: 'Candidate discovery', icon: 'search' },
  { key: 'apply', label: 'Applications through STRIDETO', icon: 'document' },
  { key: 'review', label: 'Employer workspace', icon: 'check' },
];

/**
 * Decorative employer hiring flow — illustrative only, no fabricated metrics.
 */
export function EmployerHeroVisual() {
  return (
    <div
      className="relative mx-auto w-full max-w-md lg:max-w-none lg:mx-0 pointer-events-none select-none"
      aria-hidden="true"
    >
      <div className="absolute -inset-4 rounded-3xl bg-primary/5 blur-2xl dark:bg-primary/10" />
      <div className="relative rounded-2xl border border-gray-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/80 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Employer workflow
        </p>
        <ol className="mt-4 space-y-3">
          {FLOW_STEPS.map((step, index) => (
            <li key={step.key} className="relative flex items-start gap-3">
              {index < FLOW_STEPS.length - 1 ? (
                <span
                  className="absolute start-[1.125rem] top-10 h-[calc(100%-0.25rem)] w-px bg-gray-200 dark:bg-gray-600"
                  aria-hidden="true"
                />
              ) : null}
              <span className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-mint">
                <Icon name={step.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 pt-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{step.label}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
