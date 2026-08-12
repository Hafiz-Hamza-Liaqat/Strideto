import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { inputControlClassName } from './controlClasses.js';

function toggleValue(list, value) {
  const set = new Set(Array.isArray(list) ? list : []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set];
}

/**
 * Searchable multi-select with chip summary. Options: `{ value, label }`.
 */
export function MultiSelect({
  value = [],
  onChange,
  options = [],
  disabled = false,
  id,
  error = false,
  className = '',
  placeholder = 'Search…',
  emptyLabel = 'None selected',
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(Array.isArray(value) ? value : []), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (row) =>
        row.label.toLowerCase().includes(q) ||
        String(row.value).toLowerCase().includes(q)
    );
  }, [options, query]);

  const selectedLabels = useMemo(
    () =>
      options
        .filter((row) => selected.has(row.value))
        .map((row) => row.label),
    [options, selected]
  );

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    function onDocClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`${inputControlClassName({ error })} text-left flex flex-wrap gap-1 min-h-[44px] items-center`}
      >
        {selectedLabels.length ? (
          selectedLabels.map((label) => (
            <span
              key={label}
              className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary dark:text-mint"
            >
              {label}
            </span>
          ))
        ) : (
          <span className="text-gray-400 dark:text-gray-500">{emptyLabel}</span>
        )}
      </button>
      {open && !disabled ? (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className={`${inputControlClassName()} rounded-b-none border-0 border-b border-gray-200 dark:border-gray-600`}
            autoFocus
          />
          <ul id={listId} role="listbox" className="max-h-56 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No matches</li>
            ) : (
              filtered.map((row) => {
                const checked = selected.has(row.value);
                return (
                  <li key={row.value} role="option" aria-selected={checked}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onChange?.(toggleValue(value, row.value))}
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-primary bg-primary text-white' : 'border-gray-300 dark:border-gray-500'}`}
                      >
                        {checked ? '✓' : ''}
                      </span>
                      <span className="flex-1">{row.label}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{row.value}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default MultiSelect;
