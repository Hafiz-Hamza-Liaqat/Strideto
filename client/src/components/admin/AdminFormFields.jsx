import { useId } from 'react';

/** Shared admin form field styles — light + dark mode, consistent height. */
export const adminFieldClass =
  'w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 ' +
  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm ' +
  'placeholder:text-gray-500 dark:placeholder:text-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/40 dark:focus:ring-mint/40 focus:border-primary dark:focus:border-mint ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export const adminLabelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

export function AdminLabel({ htmlFor, children, className = '' }) {
  if (!children) return null;
  return (
    <label htmlFor={htmlFor} className={`${adminLabelClass} ${className}`}>
      {children}
    </label>
  );
}

export function AdminInput({
  id: idProp,
  name,
  label,
  hint,
  className = '',
  ...props
}) {
  const autoId = useId();
  const id = idProp || (name ? `admin-${name}` : autoId);
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      <AdminLabel htmlFor={id}>{label}</AdminLabel>
      <input
        id={id}
        name={name || id}
        aria-describedby={hintId}
        className={adminFieldClass}
        {...props}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
}

export function AdminTextarea({
  id: idProp,
  name,
  label,
  hint,
  className = '',
  rows = 4,
  ...props
}) {
  const autoId = useId();
  const id = idProp || (name ? `admin-${name}` : autoId);
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      <AdminLabel htmlFor={id}>{label}</AdminLabel>
      <textarea
        id={id}
        name={name || id}
        rows={rows}
        aria-describedby={hintId}
        className={`${adminFieldClass} min-h-[80px] resize-y`}
        {...props}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
}

export function AdminSelect({
  id: idProp,
  name,
  label,
  hint,
  children,
  className = '',
  wrapperClassName = '',
  ...props
}) {
  const autoId = useId();
  const id = idProp || (name ? `admin-${name}` : autoId);
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={wrapperClassName || className}>
      <AdminLabel htmlFor={id}>{label}</AdminLabel>
      <AdminSelectBare id={id} name={name || id} hintId={hintId} {...props}>
        {children}
      </AdminSelectBare>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Select without label wrapper — for filter bars and inline use. */
export function AdminSelectBare({ id, name, hintId, className = '', children, ...props }) {
  return (
    <select
      id={id}
      name={name}
      aria-describedby={hintId}
      className={`${adminFieldClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </select>
  );
}
