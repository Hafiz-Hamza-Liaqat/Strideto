import { useEffect, useState } from 'react';
import { agentApi } from '../../services/agentService';

const EMPTY = { legalName: '', displayName: '', countryCode: '', officialEmail: '', officialWebsite: '', registrationNumber: '', licenseNumber: '', registeredAddress: { addressLine1: '', city: '', countryCode: '' }, authorizedRepresentative: { fullName: '', title: '', email: '' } };

export default function AgentVerification() {
  const [summary, setSummary] = useState(null); const [details, setDetails] = useState(null);
  const [profile, setProfile] = useState(EMPTY); const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = async () => { const { data } = await agentApi.getVerification(); setSummary(data); const response = await agentApi.getVerificationDetails(data.organizationId); setDetails(response.data); };
  useEffect(() => { load().catch((err) => setError(err.response?.data?.error || 'Unable to load verification.')).finally(() => setLoading(false)); }, []);
  const set = (key) => (event) => setProfile((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); setMessage(''); try { const method = details?.status === 'needs_information' ? agentApi.respondToVerification : agentApi.submitVerification; await method(summary.organizationId, profile); await load(); setMessage('Verification submitted for review.'); } catch (err) { setError(err.response?.data?.error || 'Unable to submit verification.'); } finally { setBusy(false); } };
  if (loading) return <p className="text-sm text-slate-500">Loading verification…</p>;
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Verification</h1><p className="mt-1 text-sm text-slate-500">Mission 2 review is authoritative. Profile completion alone does not verify an agent.</p></div>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
    <section className="rounded-xl border bg-white p-5"><p className="text-sm">Status: <strong>{details?.status || summary?.verificationStatus || 'draft'}</strong></p>{details?.informationRequestReason && <p className="mt-2 text-sm text-amber-700">Information requested: {details.informationRequestReason}</p>}<div className="mt-3 flex flex-wrap gap-2">{(details?.earnedBadges || summary?.trustBadges || []).map((badge) => <span key={badge} className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-800">{badge.replaceAll('_', ' ')}</span>)}</div></section>
    {['draft', 'email_verified', 'needs_information', 'rejected', 'expired'].includes(details?.status || summary?.verificationStatus) && <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
      {['legalName','displayName','countryCode','officialEmail','officialWebsite','registrationNumber','licenseNumber'].map((key) => <label key={key} className="text-sm">{key.replace(/([A-Z])/g, ' $1')}<input required={['legalName','displayName','countryCode','officialEmail','officialWebsite'].includes(key)} value={profile[key]} onChange={set(key)} className="mt-1 w-full rounded-lg border p-2" /></label>)}
      <label className="text-sm">Registered address<input required value={profile.registeredAddress.addressLine1} onChange={(e) => setProfile((p) => ({ ...p, registeredAddress: { ...p.registeredAddress, addressLine1: e.target.value } }))} className="mt-1 w-full rounded-lg border p-2" /></label>
      <label className="text-sm">Representative name<input required value={profile.authorizedRepresentative.fullName} onChange={(e) => setProfile((p) => ({ ...p, authorizedRepresentative: { ...p.authorizedRepresentative, fullName: e.target.value } }))} className="mt-1 w-full rounded-lg border p-2" /></label>
      <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 md:col-span-2">{busy ? 'Submitting…' : 'Submit for verification'}</button>
    </form>}
    <p className="text-xs text-slate-500">Evidence documents are never public. Evidence upload requires an existing secure document reference; direct file upload is not introduced here.</p>
  </div>;
}
