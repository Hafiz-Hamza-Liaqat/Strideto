/**
 * Shared card shell for dashboard widgets.
 */
export function WidgetShell({ title, action, children, className = '' }) {
  return (
    <section className={`p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-3 min-w-0">
          {title ? <h2 className="text-lg font-semibold text-gray-900 dark:text-white min-w-0 flex-1 break-words">{title}</h2> : <span />}
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
