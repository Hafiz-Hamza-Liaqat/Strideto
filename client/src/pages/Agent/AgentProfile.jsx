import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ISO_3166_ALPHA2, countryDisplayName } from '@shared/international/country.js';
import { AGENT_SERVICE_CATEGORIES } from '@shared/agent/constants.js';
import { agentApi } from '../../services/agentService';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { LocationFields } from '../../components/forms/LocationFields';
import { PhoneInput } from '../../components/forms/PhoneInput';
import { MultiSelect } from '../../components/forms/MultiSelect';
import { inputControlClassName, textareaControlClassName } from '../../components/forms/controlClasses';

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

const SPECIALTY_OPTIONS = Object.values(AGENT_SERVICE_CATEGORIES).map((value) => ({
  value,
  label: value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}));

function buildCountryOptions(locale) {
  return ISO_3166_ALPHA2.map((code) => ({
    value: code,
    label: countryDisplayName(code, locale),
  })).sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: 'base' }));
}

function normalizeList(value) {
  return Array.isArray(value) ? value : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export default function AgentProfile() {
  const { i18n } = useTranslation();
  const countryOptions = useMemo(() => buildCountryOptions(i18n.language || 'en'), [i18n.language]);

  const [completeness, setCompleteness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({});
  const [accountType, setAccountType] = useState('professional');
  const [legalName, setLegalName] = useState('');
  const [phoneValue, setPhoneValue] = useState('');
  const [officeLocation, setOfficeLocation] = useState({ countryCode: '', region: '', city: '', addressLine1: '', postalCode: '' });

  useEffect(() => {
    Promise.all([agentApi.getProfile(), agentApi.getCompleteness()])
      .then(([pr, cr]) => {
        const profile = pr.data.profile || {};
        setForm(profile);
        setAccountType(pr.data.accountType || (profile.agentType === 'agency' ? 'agency' : 'professional'));
        setLegalName(pr.data.organization?.legalName || '');
        setPhoneValue(profile.phone || '');
        setOfficeLocation({
          addressLine1: profile.officeLocation?.addressLine1 || '',
          city: profile.officeLocation?.city || '',
          region: profile.officeLocation?.region || '',
          postalCode: profile.officeLocation?.postalCode || '',
          countryCode: profile.officeLocation?.countryCode || profile.countryCode || '',
        });
        setCompleteness(cr.data.completeness);
      })
      .catch((e) => setError(e.response?.data?.error || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const { data } = await agentApi.updateProfile({
        professionalName: form.professionalName,
        professionalSummary: form.professionalSummary,
        countryCode: form.countryCode,
        serviceCountries: normalizeList(form.serviceCountries).map((item) => item.toUpperCase()),
        destinationCountries: normalizeList(form.destinationCountries).map((item) => item.toUpperCase()),
        languages: normalizeList(form.languages).map((item) => item.toLowerCase()),
        specialties: normalizeList(form.specialties),
        yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : null,
        website: form.website,
        officialEmail: form.officialEmail,
        phone: typeof phoneValue === 'object' ? (phoneValue.e164 || phoneValue.nationalNumber || '') : phoneValue,
        officeLocation: {
          ...officeLocation,
          countryCode: (officeLocation.countryCode || form.countryCode || '').toUpperCase(),
        },
        legalName: accountType === 'agency' ? legalName : undefined,
      });
      setForm(data.profile || form);
      setSuccess(true);
      const cr = await agentApi.getCompleteness();
      setCompleteness(cr.data.completeness);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500 dark:text-gray-400 text-sm">Loading profile…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{accountType === 'agency' ? 'Agency profile' : 'Professional profile'}</h1>
        <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">Self-declared information. Verified trust badges come from verification only. Account type is {accountType}.</p>
      </div>
      {completeness && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Profile completeness: {completeness.overall}%</p>
          <p className="text-xs text-slate-400 italic">{completeness.verificationNote}</p>
        </div>
      )}
      {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200 text-sm">Profile saved.</div>}
      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
        <p className="text-sm text-slate-600 dark:text-gray-300">Account type: <strong>{accountType === 'agency' ? 'Agency / organization' : 'Individual professional'}</strong> (set at registration)</p>
        {accountType === 'agency' ? (
          <div>
            <label htmlFor="legalName" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Legal entity name</label>
            <input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} className={inputControlClassName()} />
          </div>
        ) : null}
        <div>
          <label htmlFor="agent-profile-professionalName" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">{accountType === 'agency' ? 'Public display name' : 'Professional name'}</label>
          <input id="agent-profile-professionalName" value={form.professionalName || ''} onChange={set('professionalName')} className={inputControlClassName()} />
        </div>
        <div>
          <label htmlFor="agent-profile-officialEmail" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Official email</label>
          <input id="agent-profile-officialEmail" type="email" value={form.officialEmail || ''} onChange={set('officialEmail')} className={inputControlClassName()} />
        </div>
        <div>
          <label htmlFor="agent-profile-website" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Official website</label>
          <input id="agent-profile-website" type="url" value={form.website || ''} onChange={set('website')} className={inputControlClassName()} />
        </div>
        <div>
          <span className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Phone</span>
          <PhoneInput id="agent-profile-phone" value={phoneValue} defaultCountry={form.countryCode || 'US'} onChange={setPhoneValue} />
        </div>
        <div>
          <label htmlFor="agent-profile-country" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Primary country</label>
          <CountrySelect id="agent-profile-country" value={form.countryCode || ''} onChange={(code) => setForm((f) => ({ ...f, countryCode: code }))} />
        </div>
        <div>
          <label htmlFor="agent-profile-yearsOfExperience" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Years of experience (self-declared)</label>
          <input id="agent-profile-yearsOfExperience" type="number" value={form.yearsOfExperience ?? ''} onChange={set('yearsOfExperience')} className={inputControlClassName()} />
        </div>
        <div>
          <label htmlFor="agent-profile-professionalSummary" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Biography / about</label>
          <textarea id="agent-profile-professionalSummary" rows={4} value={form.professionalSummary || ''} onChange={set('professionalSummary')} maxLength={2000} className={textareaControlClassName()} placeholder="Describe your professional background…" />
        </div>
        <div>
          <label htmlFor="agent-profile-officeAddress" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Office / registered address</label>
          <input id="agent-profile-officeAddress" className={inputControlClassName()} value={officeLocation.addressLine1 || ''} onChange={(e) => setOfficeLocation((loc) => ({ ...loc, addressLine1: e.target.value }))} />
        </div>
        <LocationFields value={officeLocation} onChange={setOfficeLocation} idPrefix="agent-profile-office" />
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Service regions</label>
          <MultiSelect value={normalizeList(form.serviceCountries)} onChange={(serviceCountries) => setForm((f) => ({ ...f, serviceCountries }))} options={countryOptions} emptyLabel="Select countries you serve" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Destination / country expertise</label>
          <MultiSelect value={normalizeList(form.destinationCountries)} onChange={(destinationCountries) => setForm((f) => ({ ...f, destinationCountries }))} options={countryOptions} emptyLabel="Select destination countries" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Languages</label>
          <MultiSelect value={normalizeList(form.languages)} onChange={(languages) => setForm((f) => ({ ...f, languages }))} options={LANGUAGE_OPTIONS} emptyLabel="Select languages" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Service specialties</label>
          <MultiSelect value={normalizeList(form.specialties)} onChange={(specialties) => setForm((f) => ({ ...f, specialties }))} options={SPECIALTY_OPTIONS} emptyLabel="Select specialties" />
        </div>
        <button type="submit" disabled={saving} className="min-h-[44px] px-4 py-2 text-sm bg-primary text-white rounded-lg font-medium disabled:opacity-60">{saving ? 'Saving…' : 'Save profile'}</button>
      </form>
    </div>
  );
}
