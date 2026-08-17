import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ISO_3166_ALPHA2, countryDisplayName } from '@shared/international/country.js';
import { LocationFields } from '../forms/LocationFields';
import { PhoneInput } from '../forms/PhoneInput';
import { MultiSelect } from '../forms/MultiSelect';
import { inputControlClassName, textareaControlClassName } from '../forms/controlClasses';
import { gbsProviderApi } from '../../services/gbsProviderApi';
import { useGbsProvider } from '../../pages/Agent/business-services/GbsProviderContext';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'Urdu' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'zh', label: 'Chinese' },
  { value: 'hi', label: 'Hindi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'tr', label: 'Turkish' },
  { value: 'fa', label: 'Persian' },
  { value: 'ms', label: 'Malay' },
  { value: 'id', label: 'Indonesian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
];

function buildCountryOptions(locale) {
  return ISO_3166_ALPHA2.map((code) => ({
    value: code,
    label: countryDisplayName(code, locale),
  })).sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: 'base' }));
}

function normalizeList(value) {
  return Array.isArray(value) ? value : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

/**
 * Business Formation professional presentation editor.
 * Writes only GbsProviderProfessionalProfile — never AgentProfile / Education fields.
 */
export function GbsProfessionalProfileSection() {
  const { i18n } = useTranslation();
  const { selected } = useGbsProvider();
  const countryOptions = useMemo(() => buildCountryOptions(i18n.language || 'en'), [i18n.language]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({});
  const [phoneValue, setPhoneValue] = useState('');
  const [officeLocation, setOfficeLocation] = useState({
    countryCode: '',
    region: '',
    city: '',
    addressLine1: '',
    postalCode: '',
  });

  useEffect(() => {
    if (!selected?.subjectType || !selected?.subjectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    gbsProviderApi.getProfessionalProfile(selected)
      .then(({ data }) => {
        const profile = data.profile || {};
        setForm(profile);
        setPhoneValue(profile.phone || '');
        setOfficeLocation({
          addressLine1: profile.officeLocation?.addressLine1 || '',
          city: profile.officeLocation?.city || '',
          region: profile.officeLocation?.region || '',
          postalCode: profile.officeLocation?.postalCode || '',
          countryCode: profile.officeLocation?.countryCode || '',
        });
      })
      .catch((e) => setError(e.response?.data?.error || 'Failed to load Business profile'))
      .finally(() => setLoading(false));
  }, [selected]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || !selected) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const { data } = await gbsProviderApi.updateProfessionalProfile(selected, {
        displayName: form.displayName,
        publicEmail: form.publicEmail,
        website: form.website,
        professionalSummary: form.professionalSummary,
        phone: typeof phoneValue === 'object' ? (phoneValue.e164 || '') : phoneValue,
        officeLocation,
        serviceCountries: normalizeList(form.serviceCountries).map((item) => item.toUpperCase()),
        languages: normalizeList(form.languages).map((item) => item.toLowerCase()),
      });
      setForm(data.profile || form);
      setSuccess(true);
    } catch (err) {
      setSuccess(false);
      setError(err.response?.data?.error || 'Failed to save Business profile');
    } finally {
      setSaving(false);
    }
  };

  if (!selected) {
    return <p className="text-sm text-slate-500 dark:text-gray-400">Select a Business subject to edit professional presentation.</p>;
  }
  if (loading) return <div className="text-slate-500 dark:text-gray-400 text-sm">Loading Business profile…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Business professional presentation</h2>
        <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">
          Contact and summary for Business Formation only. Saving here does not update Education &amp; Mobility profile fields.
          Capabilities and jurisdictions stay on their dedicated pages.
        </p>
      </div>
      {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm break-words" role="alert">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200 text-sm break-words" role="status">Business profile saved.</div>}
      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4" aria-busy={saving}>
        <div>
          <label htmlFor="gbs-profile-displayName" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Business display name</label>
          <input id="gbs-profile-displayName" value={form.displayName || ''} onChange={set('displayName')} className={inputControlClassName()} />
        </div>
        <div>
          <label htmlFor="gbs-profile-publicEmail" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Public email</label>
          <input id="gbs-profile-publicEmail" type="email" value={form.publicEmail || ''} onChange={set('publicEmail')} className={inputControlClassName()} />
        </div>
        <div>
          <label htmlFor="gbs-profile-website" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Website</label>
          <input id="gbs-profile-website" type="url" value={form.website || ''} onChange={set('website')} className={inputControlClassName()} />
        </div>
        <div>
          <span className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Phone</span>
          <PhoneInput id="gbs-profile-phone" value={phoneValue} defaultCountry={officeLocation.countryCode || ''} onChange={setPhoneValue} />
        </div>
        <div>
          <label htmlFor="gbs-profile-summary" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Professional summary</label>
          <textarea id="gbs-profile-summary" rows={4} value={form.professionalSummary || ''} onChange={set('professionalSummary')} maxLength={2000} className={textareaControlClassName()} placeholder="Describe your Business Formation practice…" />
        </div>
        <div>
          <label htmlFor="gbs-profile-officeAddress" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Office / location</label>
          <input id="gbs-profile-officeAddress" className={inputControlClassName()} value={officeLocation.addressLine1 || ''} onChange={(e) => setOfficeLocation((loc) => ({ ...loc, addressLine1: e.target.value }))} />
        </div>
        <LocationFields value={officeLocation} onChange={setOfficeLocation} idPrefix="gbs-profile-office" />
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Service regions</label>
          <MultiSelect value={normalizeList(form.serviceCountries)} onChange={(serviceCountries) => setForm((f) => ({ ...f, serviceCountries }))} options={countryOptions} emptyLabel="Select countries you serve" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Languages</label>
          <MultiSelect value={normalizeList(form.languages)} onChange={(languages) => setForm((f) => ({ ...f, languages }))} options={LANGUAGE_OPTIONS} emptyLabel="Select languages" />
        </div>
        <button type="submit" disabled={saving} aria-busy={saving} className="min-h-[44px] px-4 py-2 text-sm bg-primary text-white rounded-lg font-medium disabled:opacity-60">{saving ? 'Saving…' : 'Save Business profile'}</button>
      </form>
    </div>
  );
}
