/**
 * Shared light/dark surface classes for Phase 11 theme closure.
 * Consumes Tailwind dark: variants driven by the frozen html.dark class.
 */
export const ui = {
  page: 'min-w-0 text-gray-900 dark:text-gray-100',
  h1: 'text-3xl font-semibold text-gray-900 dark:text-white break-words',
  muted: 'text-sm text-slate-500 dark:text-gray-400',
  card: 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
  filterPanel:
    'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4',
  input:
    'min-h-[44px] min-w-0 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500',
  primaryBtn:
    'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
  secondaryBtn:
    'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-40',
  error: 'rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-red-700 dark:text-red-300',
  warning: 'rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2 text-sm text-amber-800 dark:text-amber-200',
  empty:
    'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center text-slate-500 dark:text-gray-400',
  badge:
    'h-fit shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs text-slate-700 dark:text-slate-200',
  link: 'text-blue-700 dark:text-blue-300 hover:underline',
};
