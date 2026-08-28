export const toolbarBtn =
  'px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40';

export function ToolbarButton({ onClick, active, disabled, children, title }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${toolbarBtn} ${active ? 'bg-primary/15 border-primary text-primary' : ''}`}
    >
      {children}
    </button>
  );
}
