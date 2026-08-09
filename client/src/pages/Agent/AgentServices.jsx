import { useEffect, useState } from 'react';
import { agentApi } from '../../services/agentService';

const EMPTY = {
  title: '', category: 'study_abroad_guidance', description: '',
  countriesServed: '', destinationCountries: '', journeyType: 'study_abroad',
  deliveryMode: 'online', pricingMode: 'contact_for_details', durationEstimate: '',
};
const csv = (value) => value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);

export default function AgentServices() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => agentApi.getServices().then(({ data }) => setServices(data.services));
  useEffect(() => { load().catch(() => setError('Unable to load services.')).finally(() => setLoading(false)); }, []);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await agentApi.createService({ ...form, countriesServed: csv(form.countriesServed), destinationCountries: csv(form.destinationCountries) });
      setForm(EMPTY); await load(); setMessage('Draft service created.');
    } catch (err) { setError(err.response?.data?.error || 'Unable to create service.'); }
    finally { setBusy(false); }
  };
  const activate = async (service) => {
    setBusy(true); setError(''); setMessage('');
    try { await agentApi.updateService(service._id, { status: 'active' }); await load(); setMessage('Service activated.'); }
    catch (err) { setError(err.response?.data?.error || 'Approval is required before activation.'); }
    finally { setBusy(false); }
  };

  if (loading) return <p className="text-sm text-slate-500">Loading services…</p>;
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold text-slate-900">Services</h1><p className="text-sm text-slate-500 mt-1">Create truthful draft services. Activation requires approved verification.</p></div>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
    <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
      <label className="text-sm md:col-span-2">Title<input required value={form.title} onChange={set('title')} className="mt-1 w-full rounded-lg border p-2" /></label>
      <label className="text-sm">Category<select value={form.category} onChange={set('category')} className="mt-1 w-full rounded-lg border p-2"><option value="study_abroad_guidance">Study abroad guidance</option><option value="university_application_support">University application support</option><option value="scholarship_guidance">Scholarship guidance</option><option value="document_review">Document review</option><option value="career_guidance">Career guidance</option><option value="other">Other</option></select></label>
      <label className="text-sm">Delivery<select value={form.deliveryMode} onChange={set('deliveryMode')} className="mt-1 w-full rounded-lg border p-2"><option value="online">Online</option><option value="in_person">In person</option><option value="hybrid">Hybrid</option></select></label>
      <label className="text-sm md:col-span-2">Description<textarea required rows="4" value={form.description} onChange={set('description')} className="mt-1 w-full rounded-lg border p-2" /></label>
      <label className="text-sm">Countries served (comma separated)<input value={form.countriesServed} onChange={set('countriesServed')} className="mt-1 w-full rounded-lg border p-2" /></label>
      <label className="text-sm">Destinations (comma separated)<input value={form.destinationCountries} onChange={set('destinationCountries')} className="mt-1 w-full rounded-lg border p-2" /></label>
      <label className="text-sm">Pricing<select value={form.pricingMode} onChange={set('pricingMode')} className="mt-1 w-full rounded-lg border p-2"><option value="free">Free</option><option value="paid_future">Paid (future payment support)</option><option value="contact_for_details">Contact for details</option></select></label>
      <label className="text-sm">Duration / limitations<input value={form.durationEstimate} onChange={set('durationEstimate')} className="mt-1 w-full rounded-lg border p-2" /></label>
      <button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 md:col-span-2">{busy ? 'Saving…' : 'Create draft service'}</button>
    </form>
    <section className="space-y-3"><h2 className="font-semibold">Your services</h2>{services.length === 0 ? <p className="rounded-xl border bg-white p-5 text-sm text-slate-500">No services yet.</p> : services.map((service) => <article key={service._id} className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium">{service.title}</h3><p className="mt-1 text-sm text-slate-500">{service.description}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{service.status}</span></div>{service.status === 'draft' && <button disabled={busy} onClick={() => activate(service)} className="mt-4 text-sm font-medium text-blue-700">Request activation</button>}</article>)}</section>
  </div>;
}
