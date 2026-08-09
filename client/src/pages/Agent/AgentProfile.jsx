import { useEffect, useState } from 'react';
import { agentApi } from '../../services/agentService';

export default function AgentProfile() {
  const [profile, setProfile] = useState(null);
  const [completeness, setCompleteness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    Promise.all([agentApi.getProfile(), agentApi.getCompleteness()])
      .then(([pr, cr]) => {
        setProfile(pr.data.profile);
        setForm(pr.data.profile || {});
        setCompleteness(cr.data.completeness);
      })
      .catch((e) => setError(e.response?.data?.error || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toList = (value) => Array.isArray(value)
    ? value
    : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

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
        serviceCountries: toList(form.serviceCountries).map((item) => item.toUpperCase()),
        destinationCountries: toList(form.destinationCountries).map((item) => item.toUpperCase()),
        languages: toList(form.languages).map((item) => item.toLowerCase()),
        specialties: toList(form.specialties),
        yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : null,
        website: form.website,
        officialEmail: form.officialEmail,
        phone: form.phone,
      });
      setProfile(data.profile);
      setSuccess(true);
      // Refresh completeness
      const cr = await agentApi.getCompleteness();
      setCompleteness(cr.data.completeness);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500 text-sm">Loading profile…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#0F172A]">Professional Profile</h1>
        <p className="text-slate-500 text-sm mt-1">
          Self-declared information. Verified trust badges come from the verification process only.
        </p>
      </div>

      {/* Completeness bar */}
      {completeness && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-[#0F172A]">
              Profile Completeness: {completeness.overall}%
            </p>
            <span className="text-xs text-slate-400 italic">{completeness.verificationNote}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-[#1D4ED8] h-2 rounded-full"
              style={{ width: `${completeness.overall}%` }}
            />
          </div>
          {completeness.nextStep && (
            <p className="text-xs text-slate-500 mt-1.5">Next: {completeness.nextStep}</p>
          )}
        </div>
      )}

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">Profile saved.</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-4">
        {[
          { label: 'Professional Name', key: 'professionalName', type: 'text' },
          { label: 'Official Email', key: 'officialEmail', type: 'email' },
          { label: 'Website', key: 'website', type: 'url' },
          { label: 'Phone', key: 'phone', type: 'tel' },
          { label: 'Country (ISO code)', key: 'countryCode', type: 'text', maxLength: 2 },
          { label: 'Years of Experience (self-declared)', key: 'yearsOfExperience', type: 'number', min: 0 },
        ].map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">{field.label}</label>
            <input
              type={field.type}
              value={form[field.key] || ''}
              onChange={set(field.key)}
              maxLength={field.maxLength}
              min={field.min}
              className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-[#0F172A] mb-1">
            Professional Summary
          </label>
          <textarea
            rows={4}
            value={form.professionalSummary || ''}
            onChange={set('professionalSummary')}
            maxLength={2000}
            className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Describe your professional background and approach…"
          />
          <p className="text-xs text-slate-400 mt-1">
            This is agent/agency content — not an official Strideto fact or guarantee.
          </p>
        </div>
        {[
          { label: 'Service Countries (comma separated)', key: 'serviceCountries' },
          { label: 'Destination Countries (comma separated)', key: 'destinationCountries' },
          { label: 'Languages (comma separated)', key: 'languages' },
          { label: 'Specialties (comma separated)', key: 'specialties' },
        ].map((field) => <div key={field.key}><label className="block text-sm font-medium text-[#0F172A] mb-1">{field.label}</label><input value={Array.isArray(form[field.key]) ? form[field.key].join(', ') : (form[field.key] || '')} onChange={set(field.key)} className="w-full px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-sm" /></div>)}
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-[#1D4ED8] text-white rounded-lg font-medium hover:bg-[#1e40af] disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
