import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ISO_3166_ALPHA2, coerceCountryCode, countryDisplayName } from '@shared/international/country.js';
import { agentApi } from '../../services/agentService';
import { MultiSelect } from '../../components/forms/MultiSelect';
import { btnPrimary, cardClass, inputClass, labelClass, muted } from './agentUi';

const EMPTY = {
  title: '', category: 'study_abroad_guidance', description: '',
  countriesServed: [], destinationCountries: [], journeyType: 'study_abroad',
  deliveryMode: 'online', pricingMode: 'contact_for_details', durationEstimate: '', amountMinor: '', currency: 'PKR',
};

function normalizeCodes(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((item) => coerceCountryCode(item)).filter(Boolean))];
}

export default function AgentServices() {
  const { i18n } = useTranslation();
  const countryOptions = useMemo(
    () => ISO_3166_ALPHA2.map((code) => ({ value: code, label: countryDisplayName(code, i18n.language || 'en') }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language || 'en', { sensitivity: 'base' })),
    [i18n.language]
  );
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const load = (query) => agentApi.getServices(query ? { params: query } : undefined).then(({ data }) => setServices(data.services));
  useEffect(() => { load().catch(() => setError('Unable to load services.')).finally(() => setLoading(false)); }, []);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const payload = {
        ...form,
        countriesServed: normalizeCodes(form.countriesServed),
        destinationCountries: normalizeCodes(form.destinationCountries),
      };
      if (['fixed_price', 'starting_from'].includes(form.pricingMode)) {
        payload.price = { amountMinor: Number.parseInt(form.amountMinor, 10), currency: form.currency || 'PKR' };
      }
      await agentApi.createService(payload);
      setForm(EMPTY); await load(q ? { q } : undefined); setMessage('Draft service created.');
    } catch (err) { setError(err.response?.data?.error || 'Unable to create service.'); }
    finally { setBusy(false); }
  };
  const activate = async (service) => {
    setBusy(true); setError(''); setMessage('');
    try { await agentApi.updateService(service._id, { status: 'active' }); await load(q ? { q } : undefined); setMessage('Service activated.'); }
    catch (err) { setError(err.response?.data?.error || 'Approval is required before activation.'); }
    finally { setBusy(false); }
  };

  if (loading) return <p className={muted}>Loading services…</p>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Education & Mobility Services</h1>
        <p className={muted}>Create truthful draft education services. This form never includes LLC formation, Registered Agent, registered office, or EIN assistance. Activation requires approved Education & Mobility professional verification.</p>
      </div>
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</p> : null}
      {message ? <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">{message}</p> : null}
      <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); load(q ? { q } : undefined).catch(() => setError('Search failed.')); }}>
        <label className={labelClass}>Search<input value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="Service name" /></label>
        <button type="submit" className="self-end min-h-[44px] rounded-lg border px-4 text-sm">Apply</button>
        <button type="button" className="self-end min-h-[44px] rounded-lg border px-4 text-sm" onClick={() => { setQ(''); load(); }}>Reset</button>
      </form>
      <form onSubmit={submit} className={`grid gap-4 ${cardClass} md:grid-cols-2`}>
        <label className={`${labelClass} md:col-span-2`}>Title<input required value={form.title} onChange={set('title')} className={inputClass} /></label>
        <label className={labelClass}>Category<select value={form.category} onChange={set('category')} className={inputClass}><option value="study_abroad_guidance">Study abroad guidance</option><option value="university_application_support">University application support</option><option value="scholarship_guidance">Scholarship guidance</option><option value="document_review">Document review</option><option value="career_guidance">Career guidance</option><option value="other">Other</option></select></label>
        <label className={labelClass}>Delivery<select value={form.deliveryMode} onChange={set('deliveryMode')} className={inputClass}><option value="online">Online</option><option value="in_person">In person</option><option value="hybrid">Hybrid</option></select></label>
        <label className={`${labelClass} md:col-span-2`}>Description<textarea required rows="4" value={form.description} onChange={set('description')} className={inputClass} /></label>
        <label className={labelClass}>Countries served
          <MultiSelect className="mt-1" value={form.countriesServed} onChange={(countriesServed) => setForm((f) => ({ ...f, countriesServed: normalizeCodes(countriesServed) }))} options={countryOptions} emptyLabel="Select countries you serve" />
        </label>
        <label className={labelClass}>Destinations
          <MultiSelect className="mt-1" value={form.destinationCountries} onChange={(destinationCountries) => setForm((f) => ({ ...f, destinationCountries: normalizeCodes(destinationCountries) }))} options={countryOptions} emptyLabel="Select destination countries" />
        </label>
        <label className={labelClass}>Pricing<select value={form.pricingMode} onChange={set('pricingMode')} className={inputClass}><option value="free">Free</option><option value="fixed_price">Fixed price (integer minor units)</option><option value="starting_from">Starting from (integer minor units)</option><option value="paid_future">Paid (future payment support)</option><option value="contact_for_details">Contact for details</option></select></label>
        {['fixed_price', 'starting_from'].includes(form.pricingMode) ? (
          <>
            <label className={labelClass}>Amount (minor units)<input required type="number" min="0" step="1" value={form.amountMinor} onChange={set('amountMinor')} className={inputClass} /></label>
            <label className={labelClass}>Currency<input required maxLength={3} value={form.currency} onChange={set('currency')} className={inputClass} /></label>
          </>
        ) : null}
        <label className={labelClass}>Duration / limitations<input value={form.durationEstimate} onChange={set('durationEstimate')} className={inputClass} /></label>
        <button disabled={busy} className={`${btnPrimary} md:col-span-2`}>{busy ? 'Saving…' : 'Create draft service'}</button>
      </form>
      <section className="space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Your services</h2>
        {services.length === 0 ? <p className={`${cardClass} ${muted}`}>No services yet.</p> : services.map((service) => (
          <article key={service._id} className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">{service.title}</h3>
                <p className={`mt-1 ${muted}`}>{service.description}</p>
              </div>
              <span className="rounded-full bg-slate-100 dark:bg-gray-900 px-2 py-1 text-xs text-gray-800 dark:text-gray-200">{service.status}</span>
            </div>
            {service.status === 'draft' ? <button type="button" disabled={busy} onClick={() => activate(service)} className="mt-4 text-sm font-medium text-primary">Request activation</button> : null}
          </article>
        ))}
      </section>
    </div>
  );
}
