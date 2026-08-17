import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ISO_3166_ALPHA2, coerceCountryCode, countryDisplayName } from '@shared/international/country.js';
import { AGENT_SERVICE_CATEGORIES } from '@shared/agent/constants.js';
import { agentApi } from '../../services/agentService';
import { MultiSelect } from '../forms/MultiSelect';
import { btnPrimary, cardClass, labelClass, muted } from '../../pages/Agent/agentUi';

const SPECIALTY_OPTIONS = Object.values(AGENT_SERVICE_CATEGORIES).map((value) => ({
  value,
  label: value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}));

function normalizeCodes(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((item) => coerceCountryCode(item)).filter(Boolean))];
}

function normalizeList(value) {
  return Array.isArray(value) ? value : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function EducationProfessionalProfileSection() {
  const { i18n } = useTranslation();
  const countryOptions = useMemo(
    () => ISO_3166_ALPHA2.map((code) => ({ value: code, label: countryDisplayName(code, i18n.language || 'en') }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language || 'en', { sensitivity: 'base' })),
    [i18n.language]
  );
  const [eduProfile, setEduProfile] = useState({ specialties: [], destinationCountries: [] });
  const [eduBusy, setEduBusy] = useState(false);
  const [eduMessage, setEduMessage] = useState('');
  const [eduError, setEduError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    agentApi.getProfile()
      .then(({ data }) => {
        const profile = data.profile || {};
        setEduProfile({
          specialties: normalizeList(profile.specialties),
          destinationCountries: normalizeCodes(profile.destinationCountries),
        });
      })
      .catch(() => setEduError('Unable to load Education professional profile.'))
      .finally(() => setLoading(false));
  }, []);

  const saveEduProfile = async (event) => {
    event.preventDefault();
    if (eduBusy) return;
    setEduBusy(true);
    setEduError('');
    setEduMessage('');
    try {
      const { data } = await agentApi.updateProfile({
        specialties: normalizeList(eduProfile.specialties),
        destinationCountries: normalizeCodes(eduProfile.destinationCountries),
      });
      const profile = data.profile || {};
      setEduProfile({
        specialties: normalizeList(profile.specialties),
        destinationCountries: normalizeCodes(profile.destinationCountries),
      });
      setEduMessage('Education professional profile saved.');
    } catch (err) {
      setEduError(err.response?.data?.error || 'Unable to save Education professional profile.');
    } finally {
      setEduBusy(false);
    }
  };

  if (loading) return <p className={muted}>Loading Education professional profile…</p>;

  return (
    <section className={`${cardClass} space-y-4`} aria-labelledby="edu-professional-profile-heading">
      <div>
        <h2 id="edu-professional-profile-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
          Education professional profile
        </h2>
        <p className={`mt-1 ${muted}`}>
          Used for your Education &amp; Mobility professional profile and discovery.
          These fields are not Business Services capabilities or jurisdictions.
        </p>
      </div>
      {eduError ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{eduError}</p> : null}
      {eduMessage ? <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300" role="status">{eduMessage}</p> : null}
      <form onSubmit={saveEduProfile} className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Specialties
          <MultiSelect
            className="mt-1"
            value={eduProfile.specialties}
            onChange={(specialties) => setEduProfile((f) => ({ ...f, specialties: normalizeList(specialties) }))}
            options={SPECIALTY_OPTIONS}
            emptyLabel="Select Education specialties"
          />
        </label>
        <label className={labelClass}>
          Destination / country expertise
          <MultiSelect
            className="mt-1"
            value={eduProfile.destinationCountries}
            onChange={(destinationCountries) => setEduProfile((f) => ({ ...f, destinationCountries: normalizeCodes(destinationCountries) }))}
            options={countryOptions}
            emptyLabel="Select destination countries"
          />
        </label>
        <button type="submit" disabled={eduBusy} aria-busy={eduBusy} className={`${btnPrimary} md:col-span-2`}>
          {eduBusy ? 'Saving…' : 'Save Education professional profile'}
        </button>
      </form>
    </section>
  );
}
