import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { computePosition, flip, shift, size, offset, autoUpdate } from '@floating-ui/dom';
import { createPortal } from 'react-dom';
import { inputControlClassName } from './controlClasses.js';

const LIST_MAX_HEIGHT = 360;
const LIST_MIN_WIDTH = 280;

/**
 * Accessible searchable combobox with viewport-bounded portal list.
 * Used by CountrySelect and PhoneInput — not a native <select>.
 */
export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  disabled = false,
  error = false,
  className = '',
  inputClassName = '',
  placeholder = 'Search…',
  getOptionKey = (option) => option.value,
  getOptionLabel = (option) => option.label,
  getOptionSearchText = (option) => option.label,
  renderOption,
  emptyLabel = 'No matches',
  'aria-label': ariaLabel,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: LIST_MIN_WIDTH, maxHeight: LIST_MAX_HEIGHT });

  const selected = useMemo(
    () => options.find((option) => getOptionKey(option) === value) || null,
    [options, value, getOptionKey]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => getOptionSearchText(option).toLowerCase().includes(q));
  }, [options, query, getOptionSearchText]);

  useEffect(() => {
    if (!open) setQuery('');
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    function onDoc(event) {
      if (rootRef.current?.contains(event.target) || listRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useLayoutEffect(() => {
    if (!open || !inputRef.current) return undefined;
    const reference = inputRef.current;
    const floating = listRef.current;
    if (!floating) return undefined;

    const cleanup = autoUpdate(reference, floating, () => {
      computePosition(reference, floating, {
        placement: 'bottom-start',
        strategy: 'fixed',
        middleware: [
          offset(4),
          flip({ padding: 8 }),
          shift({ padding: 8 }),
          size({
            padding: 8,
            apply({ availableWidth, availableHeight, rects, elements }) {
              const width = Math.min(
                Math.max(rects.reference.width, Math.min(LIST_MIN_WIDTH, availableWidth)),
                availableWidth
              );
              Object.assign(elements.floating.style, {
                width: `${width}px`,
                maxWidth: `${availableWidth}px`,
                maxHeight: `${Math.min(LIST_MAX_HEIGHT, availableHeight)}px`,
              });
            },
          }),
        ],
      }).then(({ x, y }) => {
        setCoords((prev) => ({ ...prev, top: y, left: x }));
      });
    });
    return cleanup;
  }, [open, filtered.length]);

  const pick = (option) => {
    onChange?.(getOptionKey(option), option);
    setOpen(false);
  };

  const selectedLabel = selected ? getOptionLabel(selected) : '';

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        disabled={disabled}
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => !disabled && setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            return;
          }
          if (event.key === 'Tab') {
            setOpen(false);
            return;
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) setOpen(true);
            setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
            return;
          }
          if (event.key === 'Enter' && open && filtered[activeIndex]) {
            event.preventDefault();
            pick(filtered[activeIndex]);
          }
        }}
        className={inputClassName || inputControlClassName({ error })}
      />
      {open && !disabled && typeof document !== 'undefined'
        ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="z-[80] overflow-y-auto overflow-x-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              margin: 0,
            }}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</li>
            ) : (
              filtered.map((option, idx) => {
                const key = getOptionKey(option);
                const active = idx === activeIndex;
                const selectedKey = value;
                return (
                  <li key={key === '' ? '__empty' : key} role="option" aria-selected={key === selectedKey} id={`${listId}-${idx}`}>
                    <button
                      type="button"
                      className={`flex w-full min-h-[44px] items-center justify-between gap-3 px-3 py-2 text-start text-sm ${
                        active
                          ? 'bg-primary/10 text-primary dark:bg-mint/15 dark:text-mint'
                          : 'text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700'
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => pick(option)}
                    >
                      {renderOption ? renderOption(option) : (
                        <span className="min-w-0 truncate">{getOptionLabel(option)}</span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body
        )
        : null}
    </div>
  );
}

export default SearchableSelect;
