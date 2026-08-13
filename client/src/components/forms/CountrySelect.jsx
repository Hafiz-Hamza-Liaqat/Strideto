import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ISO_3166_ALPHA2,
  coerceCountryCode,
  countryDisplayName,
  normalizeCountryCode,
} from '@shared/international/country.js';
import { SearchableSelect } from './SearchableSelect.jsx';

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
  inputClassName = '',
  placeholder = 'Search country...',
  allLabel = 'All countries',
}) {
  const { i18n } = useTranslation();
  const locale = i18n.language || 'en';

  const normalizedValue =
    normalizeCountryCode(value) || (allowAll && value === '' ? '' : coerceCountryCode(value) || '');

  const options = useMemo(
    () => buildCountryOptions(locale, allowAll, allLabel),
    [locale, allowAll, allLabel]
  );

  return (
    <SearchableSelect
      id={id}
      className={className}
      inputClassName={inputClassName}
      value={normalizedValue}
      disabled={disabled}
      error={error}
      placeholder={placeholder}
      options={options}
      getOptionKey={(row) => row.code}
      getOptionLabel={(row) => row.name}
      getOptionSearchText={(row) => `${row.name} ${row.code}`}
      renderOption={(row) => (
        <>
          <span className="min-w-0 truncate">{row.name}</span>
          {row.code ? <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{row.code}</span> : null}
        </>
      )}
      onChange={(code) => onChange?.(code)}
    />
  );
}

export default CountrySelect;
