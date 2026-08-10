import { useEffect, useState } from 'react';
import { FormField } from '../../components/common/FormField';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, fieldClass, primaryButton } from './InstitutionUi';

const empty = { officialDisplayName: '', legalName: '', institutionType: '', countryCode: '', officialWebsite: '', officialAdmissionsWebsite: '', officialContactEmail: '', officialPhone: '', institutionDescription: '' };

export default function InstitutionProfile() {
  const { organizationId } = useInstitutionAuth();
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    institutionPortalApi.profile(organizationId)
      .then(({ data }) => setForm({ ...empty, ...data.profile }))
      .catch((requestError) => setError(requestError.response?.data?.error || 'Institution profile is unavailable.'))
      .finally(() => setLoading(false));
  }, [organizationId]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const save = async (event) => {
    event.preventDefault(); setMessage(''); setError('');
    if (!form.officialDisplayName.trim()) { setFieldError('Official display name is required.'); document.getElementById('institution-official-name')?.focus(); return; }
    setFieldError(''); setBusy(true);
    try {
      const { data } = await institutionPortalApi.updateProfile(organizationId, form);
      setForm({ ...empty, ...data.profile });
      setMessage('Profile saved as Institution-supplied information. Saving does not change verification or claim approval.');
    } catch (requestError) { setError(requestError.response?.data?.error || 'Profile could not be saved. Your entered values are preserved.'); }
    finally { setBusy(false); }
  };

  if (loading) return <PageState>Loading Institution profile…</PageState>;

  const fields = [
    ['legalName', 'Legal name', 'text'], ['institutionType', 'Institution type', 'text'], ['countryCode', 'Country code', 'text'],
    ['officialWebsite', 'Official website', 'url'], ['officialAdmissionsWebsite', 'Official admissions website', 'url'],
    ['officialContactEmail', 'Public contact email', 'email'], ['officialPhone', 'Public phone', 'tel'],
  ];

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-semibold text-blue-700">Official profile</p><h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Institution profile</h1><p className="mt-2 text-sm text-slate-600">Only public, source-backed Institution information belongs here. Do not enter private representative or security data.</p></div>
      {message ? <PageState tone="success">{message}</PageState> : null}{error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      <Panel>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="sm:col-span-2"><FormField id="institution-official-name" label="Official display name" error={fieldError}><input id="institution-official-name" className={fieldClass} value={form.officialDisplayName} onChange={set('officialDisplayName')} /></FormField></div>
          {fields.map(([key, label, type]) => <label key={key} className="text-sm font-medium text-slate-700">{label}<input type={type} className={`${fieldClass} mt-1`} value={form[key] || ''} onChange={set(key)} /></label>)}
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Source-backed description<textarea className={`${fieldClass} mt-1 min-h-28`} value={form.institutionDescription || ''} onChange={set('institutionDescription')} /></label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button className={primaryButton} disabled={busy}>{busy ? 'Saving…' : 'Save Institution profile'}</button><span className="text-sm text-slate-600">Completeness: {form.completenessScore || 0}% — not a verification badge.</span></div>
        </form>
      </Panel>
    </div>
  );
}
