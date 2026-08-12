import { useMemo } from 'react';
import {
  formatPhoneE164,
  getCountryCallingCode,
} from '@shared/international/phone.js';
import { ISO_3166_ALPHA2, normalizeCountryCode } from '@shared/international/country.js';
import { controlShellClassName, inputControlClassName, selectControlClassName } from './controlClasses.js';

const DEFAULT_COUNTRY = 'US';

function stripNationalInput(raw) {
  return String(raw || '').replace(/[^\d\s()-]/g, '');
}

function emptyPhoneValue(countryCode = DEFAULT_COUNTRY) {
  const code = normalizeCountryCode(countryCode) || DEFAULT_COUNTRY;
  const dialCode = getCountryCallingCode(code) || '';
  return { countryCode: code, dialCode, nationalNumber: '', e164: null };
}

function parseControlledValue(value, fallbackCountry) {
  if (value == null || value === '') return emptyPhoneValue(fallbackCountry);
  if (typeof value === 'string') {
    const digits = value.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) {
      for (const code of ISO_3166_ALPHA2) {
        const dial = getCountryCallingCode(code);
        if (!dial) continue;
        if (digits.startsWith(`+${dial}`)) {
          const nationalNumber = digits.slice(dial.length + 1);
          return {
            countryCode: code,
            dialCode: dial,
            nationalNumber,
            e164: formatPhoneE164({ dialCode: dial, nationalNumber }),
          };
        }
      }
    }
    return { ...emptyPhoneValue(fallbackCountry), nationalNumber: stripNationalInput(value) };
  }
  const countryCode = normalizeCountryCode(value.countryCode) || fallbackCountry;
  const dialCode = value.dialCode || getCountryCallingCode(countryCode) || '';
  const nationalNumber = stripNationalInput(value.nationalNumber);
  return {
    countryCode,
    dialCode,
    nationalNumber,
    e164: formatPhoneE164({ countryCode, dialCode, nationalNumber }),
  };
}

/**
 * International phone input: ISO country selector, dial code, national number (tel).
 * onChange receives `{ countryCode, dialCode, nationalNumber, e164 }`.
 */
export function PhoneInput({
  value,
  onChange,
  defaultCountry = DEFAULT_COUNTRY,
  disabled = false,
  id,
  nationalId,
  countryId,
  error = false,
  className = '',
}) {
  const parsed = useMemo(() => parseControlledValue(value, defaultCountry), [value, defaultCountry]);

  const emit = (next) => {
    const countryCode = normalizeCountryCode(next.countryCode) || DEFAULT_COUNTRY;
    const dialCode = next.dialCode || getCountryCallingCode(countryCode) || '';
    const nationalNumber = stripNationalInput(next.nationalNumber);
    const payload = {
      countryCode,
      dialCode,
      nationalNumber,
      e164: formatPhoneE164({ countryCode, dialCode, nationalNumber }),
    };
    onChange?.(payload);
  };

  const countryOptions = useMemo(
    () =>
      ISO_3166_ALPHA2.filter((code) => getCountryCallingCode(code))
        .map((code) => ({ code, dial: getCountryCallingCode(code) }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    []
  );

  return (
    <div className={`flex flex-col gap-2 sm:flex-row ${className}`}>
      <div className="sm:w-40 shrink-0">
        <label htmlFor={countryId || `${id}-country`} className="sr-only">
          Country calling code
        </label>
        <select
          id={countryId || `${id}-country`}
          disabled={disabled}
          value={parsed.countryCode}
          onChange={(event) => {
            const countryCode = event.target.value;
            emit({
              countryCode,
              dialCode: getCountryCallingCode(countryCode) || '',
              nationalNumber: parsed.nationalNumber,
            });
          }}
          className={selectControlClassName({ error })}
        >
          {countryOptions.map(({ code, dial }) => (
            <option key={code} value={code}>
              {code} (+{dial})
            </option>
          ))}
        </select>
      </div>
      <div className={controlShellClassName('flex-1')}>
        <span
          className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-sm text-gray-500 dark:text-gray-400"
          aria-hidden="true"
        >
          +{parsed.dialCode || '—'}
        </span>
        <label htmlFor={nationalId || id} className="sr-only">
          Phone number
        </label>
        <input
          id={nationalId || id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          value={parsed.nationalNumber}
          onChange={(event) =>
            emit({
              ...parsed,
              nationalNumber: stripNationalInput(event.target.value),
            })
          }
          className={`${inputControlClassName({ error })} ps-14`}
        />
      </div>
    </div>
  );
}

export default PhoneInput;
