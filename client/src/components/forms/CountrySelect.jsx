import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ISO_3166_ALPHA2,
  coerceCountryCode,
  countryDisplayName,
  normalizeCountryCode,
} from '@shared/international/country.js';
import { inputControlClassName } from './controlClasses.js';

function useDisplayLocale() {
  const { i18n } = useTranslation();
  return i18n.language || 'en';
}

function buildCountryOptions(locale, allowAll, allLabel) {
  const rows = ISO_3166_ALPHA2.map((code) => ({
    code,
    name: countryDisplayName(code, locale),
  })).sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }));

  if (allowAll) {
    return [{ code: '', name: allLabel }, ...rows];
  }
  return rows;
}

/**
 * Searchable ISO country selector backed by shared/international/country.js.
 */
export function CountrySelect({
  value,
  onChange,
  allowAll = false,
  disabled = false,
  id,
  error = false,
  className = '',
  placeholder = 'Search countries…',
  allLabel = 'All countries',
}) {
  const locale = useDisplayLocale();
  const listId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const normalizedValue =
    normalizeCountryCode(value) || (allowAll && value === '' ? '' : coerceCountryCode(value) || '');

  const options = useMemo(() => {
    const rows = buildCountryOptions(locale, allowAll, allLabel);
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q)
    );
  }, [locale, allowAll, allLabel, query]);

  const selectedLabel = useMemo(() => {
    if (allowAll && normalizedValue === '') return allLabel;
    return normalizedValue ? countryDisplayName(normalizedValue, locale) : '';
  }, [allowAll, normalizedValue, allLabel, locale]);

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

  const pick = (code) => {
    onChange?.(code);
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
        disabled={disabled}
        value={open ? query : selectedLabel}
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
            options.map((row) => (
              <li key={row.code || '__all'} role="option" aria-selected={row.code === normalizedValue}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-start text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(row.code)}
                >
                  <span>{row.name}</span>
                  {row.code ? <span className="text-xs text-gray-500 dark:text-gray-400">{row.code}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export default CountrySelect;
