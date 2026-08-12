import { FormField } from '../common/FormField.jsx';
import { CountrySelect } from './CountrySelect.jsx';
import { inputControlClassName, selectControlClassName } from './controlClasses.js';

function RegionControl({ id, value, onChange, disabled, error, regionOptions, label }) {
  if (Array.isArray(regionOptions) && regionOptions.length > 0) {
    return (
      <select
        id={id}
        disabled={disabled}
        value={value || ''}
        onChange={(event) => onChange?.(event.target.value)}
        className={selectControlClassName({ error })}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {regionOptions.map((option) => {
          const optValue = typeof option === 'string' ? option : option.value;
          const optLabel = typeof option === 'string' ? option : option.label;
          return (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          );
        })}
      </select>
    );
  }

  return (
    <input
      id={id}
      type="text"
      disabled={disabled}
      value={value || ''}
      onChange={(event) => onChange?.(event.target.value)}
      className={inputControlClassName({ error })}
      autoComplete="address-level1"
    />
  );
}

function CityControl({ id, value, onChange, disabled, error, cityOptions }) {
  if (Array.isArray(cityOptions) && cityOptions.length > 0) {
    return (
      <select
        id={id}
        disabled={disabled}
        value={value || ''}
        onChange={(event) => onChange?.(event.target.value)}
        className={selectControlClassName({ error })}
      >
        <option value="">Select city</option>
        {cityOptions.map((option) => {
          const optValue = typeof option === 'string' ? option : option.value;
          const optLabel = typeof option === 'string' ? option : option.label;
          return (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          );
        })}
      </select>
    );
  }

  return (
    <input
      id={id}
      type="text"
      disabled={disabled}
      value={value || ''}
      onChange={(event) => onChange?.(event.target.value)}
      className={inputControlClassName({ error })}
      autoComplete="address-level2"
    />
  );
}

/**
 * Canonical location fields: `{ countryCode, region, city }`.
 */
export function LocationFields({
  value = {},
  onChange,
  disabled = false,
  errors = {},
  idPrefix = 'location',
  regionLabel = 'State / Province / Region',
  regionOptions,
  cityOptions,
  className = '',
}) {
  const countryCode = value.countryCode || '';
  const region = value.region || '';
  const city = value.city || '';

  const patch = (partial) => onChange?.({ countryCode, region, city, ...partial });

  return (
    <div className={`space-y-4 ${className}`}>
      <FormField label="Country" id={`${idPrefix}-country`} error={errors.countryCode}>
        <CountrySelect
          id={`${idPrefix}-country`}
          value={countryCode}
          disabled={disabled}
          error={Boolean(errors.countryCode)}
          onChange={(code) => patch({ countryCode: code })}
        />
      </FormField>

      <FormField label={regionLabel} id={`${idPrefix}-region`} error={errors.region}>
        <RegionControl
          id={`${idPrefix}-region`}
          label={regionLabel}
          value={region}
          disabled={disabled}
          error={Boolean(errors.region)}
          regionOptions={regionOptions}
          onChange={(next) => patch({ region: next })}
        />
      </FormField>

      <FormField label="City" id={`${idPrefix}-city`} error={errors.city}>
        <CityControl
          id={`${idPrefix}-city`}
          value={city}
          disabled={disabled}
          error={Boolean(errors.city)}
          cityOptions={cityOptions}
          onChange={(next) => patch({ city: next })}
        />
      </FormField>
    </div>
  );
}

export default LocationFields;
