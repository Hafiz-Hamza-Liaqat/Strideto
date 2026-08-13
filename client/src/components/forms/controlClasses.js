const CONTROL_BASE =
  'w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none transition-shadow duration-200 focus-visible:ring-2 focus-visible:border-transparent disabled:opacity-60 disabled:cursor-not-allowed [color-scheme:light] dark:[color-scheme:dark]';

const CONTROL_BORDER_DEFAULT = 'border-gray-300 dark:border-gray-600 focus-visible:ring-primary';
const CONTROL_BORDER_ERROR = 'border-red-500 dark:border-red-400 focus-visible:ring-red-500';

function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ');
}

/** Theme-aware class string for text inputs. */
export function inputControlClassName({ error = false, className = '' } = {}) {
  return joinClasses(
    CONTROL_BASE,
    error ? CONTROL_BORDER_ERROR : CONTROL_BORDER_DEFAULT,
    className
  );
}

/** Theme-aware class string for native selects. */
export function selectControlClassName(options = {}) {
  return inputControlClassName(options);
}

/** Theme-aware class string for textareas. */
export function textareaControlClassName({ error = false, className = '', rowsClass = 'min-h-[6rem]' } = {}) {
  return joinClasses(inputControlClassName({ error, className }), rowsClass);
}

/** Relative wrapper used by composite controls (password toggle, phone prefix). */
export function controlShellClassName(className = '') {
  return joinClasses('relative w-full', className);
}
