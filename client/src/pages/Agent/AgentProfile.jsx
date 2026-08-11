import { useEffect, useState } from 'react';
import { agentApi } from '../../services/agentService';

const inputClass = 'w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary text-sm';

export default function AgentProfile() {
  const [completeness, setCompleteness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({});
  const [accountType, setAccountType] = useState('professional');
  const [legalName, setLegalName] = useState('');

  useEffect(() => {
    Promise.all([agentApi.getProfile(), agentApi.getCompleteness()])
      .then(([pr, cr]) => {
        setForm(pr.data.profile || {});
        setAccountType(pr.data.accountType || (pr.data.profile?.agentType === 'agency' ? 'agency' : 'professional'));
        setLegalName(pr.data.organization?.legalName || '');
        setCompleteness(cr.data.completeness);
      })
      .catch((e) => setError(e.response?.data?.error || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toList = (value) => Array.isArray(value) ? value : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null); setSuccess(false);
    try {
      const officeLocation = {
        addressLine1: form.officeAddressLine1 || form.officeLocation?.addressLine1 || '',
        city: form.officeCity || form.officeLocation?.city || '',
        region: form.officeRegion || form.officeLocation?.region || '',
        postalCode: form.officePostalCode || form.officeLocation?.postalCode || '',
        countryCode: (form.officeCountryCode || form.officeLocation?.countryCode || form.countryCode || '').toUpperCase(),
      };
      const { data } = await agentApi.updateProfile({
        professionalName: form.professionalName,
        professionalSummary: form.professionalSummary,
        countryCode: form.countryCode,
        serviceCountries: toList(form.serviceCountries).map((item) => item.toUpperCase()),
        destinationCountries: toList(form.destinationCountries).map((item) => item.toUpperCase()),
        languages: toList(form.languages).map((item) => item.toLowerCase()),
        specialties: toList(form.specialties),
        yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : null,
        website: form.website,
        officialEmail: form.officialEmail,
        phone: form.phone,
        officeLocation,
        legalName: accountType === 'agency' ? legalName : undefined,
      });
      setForm(data.profile || form);
      setSuccess(true);
      const cr = await agentApi.getCompleteness();
      setCompleteness(cr.data.completeness);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally { setSaving(false); }
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
            <input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} className={inputClass} />
          </div>
        ) : null}
        {[
          { label: accountType === 'agency' ? 'Public display name' : 'Professional name', key: 'professionalName' },
          { label: 'Official email', key: 'officialEmail', type: 'email' },
          { label: 'Official website', key: 'website', type: 'url' },
          { label: 'Phone', key: 'phone', type: 'tel' },
          { label: 'Country (ISO code)', key: 'countryCode', maxLength: 2 },
          { label: 'Years of experience (self-declared)', key: 'yearsOfExperience', type: 'number' },
        ].map((field) => (
          <div key={field.key}>
            <label htmlFor={`agent-profile-${field.key}`} className="block text-sm font-medium text-gray-900 dark:text-white mb-1">{field.label}</label>
            <input id={`agent-profile-${field.key}`} type={field.type || 'text'} value={form[field.key] || ''} onChange={set(field.key)} maxLength={field.maxLength} className={inputClass} />
          </div>
        ))}
        <div>
          <label htmlFor="agent-profile-professionalSummary" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Biography / about</label>
          <textarea id="agent-profile-professionalSummary" rows={4} value={form.professionalSummary || ''} onChange={set('professionalSummary')} maxLength={2000} className={inputClass} placeholder="Describe your professional background…" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-gray-900 dark:text-white">Office / registered address<input className={inputClass} value={form.officeAddressLine1 || form.officeLocation?.addressLine1 || ''} onChange={set('officeAddressLine1')} /></label>
          <label className="text-sm text-gray-900 dark:text-white">City / region<input className={inputClass} value={form.officeCity || form.officeLocation?.city || ''} onChange={set('officeCity')} /></label>
        </div>
        {[
          { label: 'Service regions (comma separated ISO)', key: 'serviceCountries' },
          { label: 'Destination / country expertise (comma separated)', key: 'destinationCountries' },
          { label: 'Languages (comma separated)', key: 'languages' },
          { label: 'Service specialties (comma separated)', key: 'specialties' },
        ].map((field) => (
          <div key={field.key}>
            <label htmlFor={`agent-profile-${field.key}`} className="block text-sm font-medium text-gray-900 dark:text-white mb-1">{field.label}</label>
            <input id={`agent-profile-${field.key}`} value={Array.isArray(form[field.key]) ? form[field.key].join(', ') : (form[field.key] || '')} onChange={set(field.key)} className={inputClass} />
          </div>
        ))}
        <button type="submit" disabled={saving} className="min-h-[44px] px-4 py-2 text-sm bg-primary text-white rounded-lg font-medium disabled:opacity-60">{saving ? 'Saving…' : 'Save profile'}</button>
      </form>
    </div>
  );
}
