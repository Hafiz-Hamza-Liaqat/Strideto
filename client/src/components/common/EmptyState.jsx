import { Link } from 'react-router-dom';
import { Button } from './Button';

/**
 * Action-oriented empty state (Phase B.4).
 */
export function EmptyState({
  icon = '✨',
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  className = '',
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white/60 dark:bg-gray-800/40 p-8 sm:p-10 text-center ${className}`}
      role="status"
    >
      {icon ? (
        <div className="text-3xl mb-3" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      {title ? (
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 font-heading">{title}</h2>
      ) : null}
      {description ? (
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6 leading-relaxed">{description}</p>
      ) : null}
      {actionLabel && (actionTo || onAction) ? (
        actionTo ? (
          <Link to={actionTo} onClick={onAction}>
            <Button variant="primary" type="button">{actionLabel}</Button>
          </Link>
        ) : (
          <Button variant="primary" type="button" onClick={onAction}>
            {actionLabel}
          </Button>
        )
      ) : null}
    </div>
  );
}

export default EmptyState;
