/**
 * Restrained public source/provenance area for entity detail pages (SEO-P7).
 */
export function PublicSourceSection({
  title = 'Source',
  children,
  className = '',
}) {
  if (!children) return null;

  return (
    <section
      className={`mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 min-w-0 ${className}`}
      aria-label={title}
    >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
      <div className="text-sm text-gray-700 dark:text-gray-300 min-w-0">{children}</div>
    </section>
  );
}
