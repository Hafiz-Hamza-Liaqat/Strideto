import { Children, cloneElement, isValidElement } from 'react';

export function FormField({ label, id, error, children, className = '' }) {
  const errorId = error && id ? `${id}-error` : undefined;
  const childItems = Children.toArray(children);
  const onlyChild = childItems.length === 1 ? childItems[0] : null;
  const control = isValidElement(onlyChild)
    ? cloneElement(onlyChild, {
        'aria-invalid': error ? true : onlyChild.props['aria-invalid'],
        'aria-describedby': [onlyChild.props['aria-describedby'], errorId].filter(Boolean).join(' ') || undefined,
      })
    : children;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      {control}
      {error && <p id={errorId} className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
    </div>
  );
}
