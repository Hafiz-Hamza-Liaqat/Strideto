import { useTranslation } from 'react-i18next';
import { CountrySelect } from '../forms/CountrySelect';
import { adminFieldClass } from './AdminFormFields';
import { coerceCountryCode, countryDisplayName } from '@shared/international/country.js';

/**
 * Admin location authoring: Country * + State/Province/Region + City.
 *
 * - `mode="code"` persists ISO alpha-2 in `countryCode` (jobs, internships, admissions).
 * - `mode="name"` persists a display name in `country` (CMS scholarships, foreign studies, etc.).
 */
export function AdminLocationFields({
  value = {},
  onChange,
  mode = 'code',
  countryRequired = false,
  showWorkMode = false,
  className = '',
}) {
  const { t } = useTranslation('admin');
  const countryCode =
    mode === 'code'
      ? (value.countryCode || '')
      : (coerceCountryCode(value.country) || '');

  const region = value.region ?? value.province ?? '';
  const city = value.city || '';
  const workMode = value.workMode || 'unspecified';

  const patch = (partial) => {
    const next = { ...value, ...partial };
    if (partial.region !== undefined && next.province === undefined) {
      next.province = partial.region;
    }
    if (partial.province !== undefined && next.region === undefined) {
      next.region = partial.province;
    }
    onChange?.(next);
  };

  const onCountry = (code) => {
    if (mode === 'code') {
      patch({ countryCode: code || '', region: '', province: '', city: '' });
      return;
    }
    patch({
      country: code ? (countryDisplayName(code) || code) : '',
      region: '',
      province: '',
      city: '',
    });
  };

  return (
    <div className={`grid gap-3 ${className}`}>
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          {t('colCountry')}{countryRequired ? ' *' : ''}
        </label>
        <CountrySelect
          value={countryCode}
          onChange={onCountry}
          inputClassName={adminFieldClass}
          placeholder={t('countryPlaceholder')}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">{t('fieldRegion')}</label>
        <input
          className={adminFieldClass}
          placeholder={t('provincePlaceholder')}
          value={region}
          onChange={(e) => patch({ region: e.target.value, province: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">{t('fieldCity')}</label>
        <input
          className={adminFieldClass}
          placeholder={t('fieldCity')}
          value={city}
          onChange={(e) => patch({ city: e.target.value })}
        />
      </div>
      {showWorkMode ? (
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('fieldWorkMode')}</label>
          <select
            className={adminFieldClass}
            value={workMode}
            onChange={(e) => patch({ workMode: e.target.value })}
          >
            <option value="unspecified">{t('workModeUnspecified')}</option>
            <option value="remote">{t('workModeRemote')}</option>
            <option value="hybrid">{t('workModeHybrid')}</option>
            <option value="on_site">{t('workModeOnSite')}</option>
          </select>
        </div>
      ) : null}
    </div>
  );
}

export default AdminLocationFields;
