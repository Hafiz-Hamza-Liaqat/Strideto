/**
 * Shared role-sidebar current/hover/focus classes.
 * Current state is route-derived (aria-current), never a sticky :hover.
 */
export function portalNavLinkClass(isCurrent) {
  const base =
    'block px-3 py-2.5 rounded-lg text-sm font-medium min-h-[44px] flex items-center border-s-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
  if (isCurrent) {
    return `${base} border-[var(--accent-orange,#F97316)] bg-primary/10 text-primary dark:text-mint`;
  }
  return `${base} border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800`;
}
