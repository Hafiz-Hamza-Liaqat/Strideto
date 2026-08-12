import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { isValidTimeZone } from '@shared/international/timezone.js';
import { inputControlClassName } from './controlClasses.js';

function listIanaTimeZones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone').filter(isValidTimeZone);
    }
  } catch {
    /* runtime may not expose supportedValuesOf */
  }
  return ['UTC', 'Europe/London', 'America/New_York', 'Asia/Tokyo', 'Australia/Sydney'];
}

const IANA_ZONES = listIanaTimeZones();

/**
 * Searchable IANA timezone picker. No silent regional default — caller must supply value.
 */
export function TimezoneSelect({
  value = '',
  onChange,
  disabled = false,
  id,
  error = false,
  className = '',
  placeholder = 'Search IANA timezones…',
  required = false,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return IANA_ZONES;
    return IANA_ZONES.filter((zone) => zone.toLowerCase().includes(q));
  }, [query]);

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

  const pick = (zone) => {
    onChange?.(zone);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        required={required}
        disabled={disabled}
        value={open ? query : (value || '')}
        placeholder={placeholder}
        onFocus={() => !disabled && setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        className={inputControlClassName({ error })}
      />
      {open && !disabled ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No matches</li>
          ) : (
            options.slice(0, 80).map((zone) => (
              <li key={zone} role="option" aria-selected={zone === value}>
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-start text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(zone)}
                >
                  {zone}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {!value && !open ? (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Select an explicit IANA zone. No silent default is applied.</p>
      ) : null}
    </div>
  );
}

export default TimezoneSelect;
