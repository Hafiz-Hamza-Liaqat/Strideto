import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatPhoneE164,
  getCountryCallingCode,
  listPhoneCountries,
  normalizeNationalNumberInput,
  parseE164ToPhoneParts,
} from '@shared/international/phone.js';
import { normalizeCountryCode } from '@shared/international/country.js';
import { controlShellClassName, inputControlClassName } from './controlClasses.js';
import { SearchableSelect } from './SearchableSelect.jsx';

function stripNationalInput(raw) {
  return normalizeNationalNumberInput(raw);
}

function emptyPhoneValue(countryCode = '') {
  const code = normalizeCountryCode(countryCode) || '';
  const callingCode = getCountryCallingCode(code) || '';
  return { countryCode: code, callingCode, dialCode: callingCode, nationalNumber: '', e164: null };
}

function parseControlledValue(value, preferredCountry) {
  if (value == null || value === '') return emptyPhoneValue(preferredCountry);
  if (typeof value === 'string') {
    const parsed = parseE164ToPhoneParts(value, { preferredCountry });
    if (parsed) {
      return {
        countryCode: parsed.countryCode,
        callingCode: parsed.callingCode,
        dialCode: parsed.callingCode,
        nationalNumber: parsed.nationalNumber,
        e164: formatPhoneE164({
          countryCode: parsed.countryCode,
          dialCode: parsed.callingCode,
          nationalNumber: parsed.nationalNumber,
        }),
      };
    }
    return { ...emptyPhoneValue(preferredCountry), nationalNumber: stripNationalInput(value) };
  }
  const countryCode = normalizeCountryCode(value.countryCode) || preferredCountry || '';
  const callingCode = String(value.callingCode || value.dialCode || getCountryCallingCode(countryCode) || '').replace(/[^\d]/g, '');
  const nationalNumber = stripNationalInput(value.nationalNumber);
  return {
    countryCode,
    callingCode,
    dialCode: callingCode,
    nationalNumber,
    e164: formatPhoneE164({ countryCode, dialCode: callingCode, nationalNumber }),
  };
}

/**
 * International phone input. Selection identity is ISO alpha-2, not dial code.
 * onChange receives `{ countryCode, callingCode, dialCode, nationalNumber, e164 }`.
 * e164 is the only authoritative persisted number. No silent US/PK default.
 */
export function PhoneInput({
  value,
  onChange,
  defaultCountry = '',
  disabled = false,
  id,
  nationalId,
  countryId,
  error = false,
  className = '',
}) {
  const { i18n } = useTranslation();
  const locale = i18n.language || 'en';
  const preferred = normalizeCountryCode(defaultCountry) || '';
  const parsed = useMemo(() => parseControlledValue(value, preferred), [value, preferred]);
  const userChoseCountryRef = useRef(false);
  const lastPrefRef = useRef(preferred);

  const options = useMemo(() => listPhoneCountries(locale), [locale]);

  const emit = (next, { userCountry = false } = {}) => {
    if (userCountry) userChoseCountryRef.current = true;
    const countryCode = normalizeCountryCode(next.countryCode) || '';
    const callingCode = String(next.callingCode || next.dialCode || getCountryCallingCode(countryCode) || '').replace(/[^\d]/g, '');
    const nationalNumber = stripNationalInput(next.nationalNumber);
    onChange?.({
      countryCode,
      callingCode,
      dialCode: callingCode,
      nationalNumber,
      e164: formatPhoneE164({ countryCode, dialCode: callingCode, nationalNumber }),
    });
  };

  useEffect(() => {
    if (!preferred || userChoseCountryRef.current) return;
    if (preferred === lastPrefRef.current) return;
    lastPrefRef.current = preferred;
    if (parsed.countryCode === preferred) return;
    if (parsed.nationalNumber && parsed.countryCode) return;
    emit({
      countryCode: preferred,
      callingCode: getCountryCallingCode(preferred) || '',
      nationalNumber: parsed.nationalNumber,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync prefix from explicit Country only
  }, [preferred]);

  return (
    <div className={`flex flex-col gap-2 sm:flex-row min-w-0 ${className}`}>
      <div className="min-w-0 sm:w-[min(100%,18rem)] sm:shrink-0">
        <SearchableSelect
          id={countryId || `${id}-country`}
          aria-label="Phone country"
          value={parsed.countryCode}
          disabled={disabled}
          error={error}
          placeholder="Search country or +code"
          options={options}
          getOptionKey={(row) => row.countryCode}
          getOptionLabel={(row) => `${row.name} (+${row.callingCode})`}
          getOptionSearchText={(row) => `${row.name} ${row.countryCode} +${row.callingCode} ${row.callingCode}`}
          renderOption={(row) => (
            <>
              <span className="min-w-0 truncate">{row.name}</span>
              <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {row.countryCode} (+{row.callingCode})
              </span>
            </>
          )}
          onChange={(countryCode) => {
            emit({
              countryCode,
              callingCode: getCountryCallingCode(countryCode) || '',
              nationalNumber: parsed.nationalNumber,
            }, { userCountry: true });
          }}
        />
      </div>
      <div className={controlShellClassName('flex-1 min-w-0')}>
        <span
          className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-sm text-gray-500 dark:text-gray-400"
          aria-hidden="true"
        >
          {parsed.callingCode ? `+${parsed.callingCode}` : '+'}
        </span>
        <label htmlFor={nationalId || id} className="sr-only">
          Phone number
        </label>
        <input
          id={nationalId || id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          disabled={disabled}
          value={parsed.nationalNumber}
          onChange={(event) =>
            emit({
              ...parsed,
              nationalNumber: stripNationalInput(event.target.value),
            })
          }
          className={`${inputControlClassName({ error })} ps-16`}
        />
      </div>
    </div>
  );
}

export default PhoneInput;
