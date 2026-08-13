import { useId, useMemo } from 'react';
import { CountrySelect } from './CountrySelect.jsx';
import { inputControlClassName, selectControlClassName } from './controlClasses.js';
import { regionsForCountry } from '@shared/international/regions.js';

/**
 * Canonical listing/filter cascade: Country → Region → City.
 * Country change clears region and city. Region change clears city.
 * Region options come from the country catalog (never mixed across countries).
 * Extra facet regions for the selected country may be merged in.
 */
export function LocationCascadeFilter({
  countryCode = '',
  region = '',
  city = '',
  onChange,
  facetRegions = [],
  facetCities = [],
  disabled = false,
  showCity = true,
  showRegion = true,
  allowAllCountries = true,
  idPrefix = 'loc',
  className = '',
  countryClassName = '',
  countryInputClassName = '',
  countryListClassName = '',
  selectClassName = '',
}) {
  const regionId = useId();
  const cityId = useId();
  const catalog = useMemo(() => regionsForCountry(countryCode), [countryCode]);
  const regionOptions = useMemo(() => {
    const set = new Set(catalog);
    (facetRegions || []).forEach((item) => {
      const value = typeof item === 'string' ? item : item?.value;
      if (value) set.add(value);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [catalog, facetRegions]);

  const patch = (partial) => {
    onChange?.({
      countryCode,
      region,
      city,
      ...partial,
    });
  };

  const selectClass = selectClassName || selectControlClassName();
  const hasCatalog = catalog.length > 0;

  return (
    <div className={`flex flex-col sm:flex-row gap-2 sm:gap-3 min-w-0 ${className}`}>
      <div className={`min-w-0 flex-1 ${countryClassName}`}>
        <label htmlFor={`${idPrefix}-country`} className="sr-only">Country</label>
        <CountrySelect
          id={`${idPrefix}-country`}
          value={countryCode}
          allowAll={allowAllCountries}
          disabled={disabled}
          inputClassName={countryInputClassName}
          listClassName={countryListClassName}
          onChange={(code) => patch({ countryCode: code || '', region: '', city: '' })}
        />
      </div>
      {showRegion ? (
        <div className="min-w-0 flex-1">
          <label htmlFor={regionId} className="sr-only">State / Province / Region</label>
          {regionOptions.length > 0 ? (
            <select
              id={regionId}
              disabled={disabled || !countryCode}
              value={region}
              onChange={(event) => patch({ region: event.target.value, city: '' })}
              className={selectClass}
            >
              <option value="">{countryCode ? 'All regions' : 'Select a country first'}</option>
              {regionOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          ) : (
            <input
              id={regionId}
              type="text"
              disabled={disabled || !countryCode}
              value={region}
              onChange={(event) => patch({ region: event.target.value, city: '' })}
              placeholder={countryCode && !hasCatalog ? 'No region catalog — type a region or leave blank' : 'State / Province / Region'}
              className={countryInputClassName || inputControlClassName()}
              autoComplete="address-level1"
            />
          )}
        </div>
      ) : null}
      {showCity ? (
        <div className="min-w-0 flex-1">
          <label htmlFor={cityId} className="sr-only">City</label>
          {facetCities?.length ? (
            <select
              id={cityId}
              disabled={disabled || !countryCode}
              value={city}
              onChange={(event) => patch({ city: event.target.value })}
              className={selectClass}
            >
              <option value="">All cities</option>
              {facetCities.map((item) => {
                const value = typeof item === 'string' ? item : item?.value;
                return <option key={value} value={value}>{value}</option>;
              })}
            </select>
          ) : (
            <input
              id={cityId}
              type="text"
              disabled={disabled || !countryCode}
              value={city}
              onChange={(event) => patch({ city: event.target.value })}
              placeholder="City"
              className={countryInputClassName || inputControlClassName()}
              autoComplete="address-level2"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

export default LocationCascadeFilter;
