import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ISO_3166_ALPHA2, coerceCountryCode, countryDisplayName } from '@shared/international/country.js';
import { currencyMinorUnits } from '@shared/international/currency.js';
import { AGENT_SERVICE_CATEGORY_OPTIONS, agentServiceCategoryLabel } from '@shared/agent/serviceTaxonomy.js';
import { educationServicePriceFromInput, educationServicePriceInput } from '@shared/agent/servicePricing.js';
import { agentApi } from '../../services/agentService';
import { MultiSelect } from '../../components/forms/MultiSelect';
import { btnPrimary, cardClass, inputClass, labelClass, muted } from './agentUi';
import { ROUTES } from '../../constants';

const PRICED_MODES = new Set(['fixed_price', 'starting_from']);
const EMPTY = Object.freeze({
  title: '', category: AGENT_SERVICE_CATEGORY_OPTIONS[0].value, description: '', eligibilityNotes: '',
  countriesServed: [], destinationCountries: [], journeyType: 'study_abroad',
  deliveryMode: 'online', pricingMode: 'contact_for_details', amount: '', currency: 'PKR', durationEstimate: '',
});

function emptyForm() {
  return { ...EMPTY, countriesServed: [], destinationCountries: [] };
}

function normalizeCodes(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((item) => coerceCountryCode(item)).filter(Boolean))];
}

function formFromService(service) {
  return {
    title: service.title || '',
    category: service.category || AGENT_SERVICE_CATEGORY_OPTIONS[0].value,
    description: service.description || '',
    eligibilityNotes: service.eligibilityNotes || '',
    countriesServed: normalizeCodes(service.countriesServed),
    destinationCountries: normalizeCodes(service.destinationCountries),
    journeyType: service.journeyType || 'other',
    deliveryMode: service.deliveryMode || 'online',
    pricingMode: service.pricingMode || 'contact_for_details',
    amount: service.price?.amountMinor != null ? educationServicePriceInput(service.price) : '',
    currency: service.price?.currency || 'PKR',
    durationEstimate: service.durationEstimate || '',
  };
}

function payloadFromForm(form) {
  const payload = {
    title: form.title,
    category: form.category,
    description: form.description,
    eligibilityNotes: form.eligibilityNotes,
    countriesServed: normalizeCodes(form.countriesServed),
    destinationCountries: normalizeCodes(form.destinationCountries),
    journeyType: form.journeyType,
    deliveryMode: form.deliveryMode,
    pricingMode: form.pricingMode,
    durationEstimate: form.durationEstimate,
  };
  if (PRICED_MODES.has(form.pricingMode)) payload.price = educationServicePriceFromInput(form.amount, form.currency);
  return payload;
}

function ServiceFields({ form, setForm, countryOptions, prefix }) {
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  let amountStep = '0.01';
  try { amountStep = String(1 / (10 ** currencyMinorUnits(form.currency))); } catch { /* validation explains invalid currency */ }
  return (
    <>
      <label className={`${labelClass} md:col-span-2`} htmlFor={`${prefix}-title`}>Title<input id={`${prefix}-title`} required value={form.title} onChange={set('title')} className={inputClass} /></label>
      <label className={labelClass} htmlFor={`${prefix}-category`}>Category
        <select id={`${prefix}-category`} value={form.category} onChange={set('category')} className={inputClass}>
          {AGENT_SERVICE_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className={labelClass} htmlFor={`${prefix}-delivery`}>Delivery
        <select id={`${prefix}-delivery`} value={form.deliveryMode} onChange={set('deliveryMode')} className={inputClass}>
          <option value="online">Online</option><option value="in_person">In person</option><option value="hybrid">Hybrid</option>
        </select>
      </label>
      <label className={labelClass} htmlFor={`${prefix}-journey`}>Journey
        <select id={`${prefix}-journey`} value={form.journeyType} onChange={set('journeyType')} className={inputClass}>
          <option value="study_abroad">Study abroad</option><option value="work_abroad">Work mobility</option><option value="immigration">Mobility information</option><option value="scholarship">Scholarship</option><option value="other">Other</option>
        </select>
      </label>
      <label className={labelClass} htmlFor={`${prefix}-duration`}>Duration estimate<input id={`${prefix}-duration`} value={form.durationEstimate} onChange={set('durationEstimate')} className={inputClass} placeholder="Example: About 2 weeks" /></label>
      <label className={`${labelClass} md:col-span-2`} htmlFor={`${prefix}-description`}>Description<textarea id={`${prefix}-description`} required rows="4" value={form.description} onChange={set('description')} className={inputClass} /></label>
      <label className={`${labelClass} md:col-span-2`} htmlFor={`${prefix}-eligibility`}>Eligibility or limitations<textarea id={`${prefix}-eligibility`} rows="3" value={form.eligibilityNotes} onChange={set('eligibilityNotes')} className={inputClass} placeholder="Provider-maintained eligibility information or service limitations" /></label>
      <label className={labelClass}>Countries served
        <MultiSelect className="mt-1" value={form.countriesServed} onChange={(countriesServed) => setForm((current) => ({ ...current, countriesServed: normalizeCodes(countriesServed) }))} options={countryOptions} emptyLabel="Select countries you serve" />
      </label>
      <label className={labelClass}>Destinations
        <MultiSelect className="mt-1" value={form.destinationCountries} onChange={(destinationCountries) => setForm((current) => ({ ...current, destinationCountries: normalizeCodes(destinationCountries) }))} options={countryOptions} emptyLabel="Select destination countries" />
      </label>
      <label className={labelClass} htmlFor={`${prefix}-pricing`}>Pricing
        <select id={`${prefix}-pricing`} value={form.pricingMode} onChange={set('pricingMode')} className={inputClass}>
          <option value="free">Free</option><option value="fixed_price">Fixed price</option><option value="starting_from">Starting from</option><option value="paid_future">Paid service — checkout not configured</option><option value="contact_for_details">Contact for details</option>
        </select>
      </label>
      {PRICED_MODES.has(form.pricingMode) ? (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className={labelClass} htmlFor={`${prefix}-amount`}>Service price
            <input id={`${prefix}-amount`} required inputMode="decimal" type="number" min="0" step={amountStep} value={form.amount} onChange={set('amount')} className={inputClass} placeholder="150.00" />
          </label>
          <label className={labelClass} htmlFor={`${prefix}-currency`}>Currency
            <input id={`${prefix}-currency`} required maxLength={3} value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} className={inputClass} placeholder="USD" />
          </label>
        </div>
      ) : null}
      {form.category === 'visa_process_guidance_informational' ? <p className={`md:col-span-2 ${muted}`}>This service is informational guidance only. It is not legal representation, government approval, or a visa guarantee.</p> : null}
      {form.category === 'work_mobility_guidance' ? <p className={`md:col-span-2 ${muted}`}>Work mobility guidance does not guarantee employment, work authorization, or government approval.</p> : null}
    </>
  );
}

export default function AgentServices() {
  const { i18n } = useTranslation();
  const countryOptions = useMemo(
    () => ISO_3166_ALPHA2.map((code) => ({ value: code, label: countryDisplayName(code, i18n.language || 'en') }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language || 'en', { sensitivity: 'base' })),
    [i18n.language]
  );
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const load = (query) => agentApi.getServices(query ? { params: query } : undefined).then(({ data }) => setServices(data.services));
  useEffect(() => { load().catch(() => setError('Unable to load Education services.')).finally(() => setLoading(false)); }, []);

  const run = async (operation, success, failure) => {
    setBusy(true); setError(''); setMessage('');
    try { await operation(); await load(q ? { q } : undefined); setMessage(success); }
    catch (err) { setError(err.response?.data?.error || err.message || failure); }
    finally { setBusy(false); }
  };
  const submit = async (event) => {
    event.preventDefault();
    await run(async () => { await agentApi.createService(payloadFromForm(form)); setForm(emptyForm()); }, 'Draft service created.', 'Unable to create service.');
  };
  const saveEdit = async (event) => {
    event.preventDefault();
    await run(async () => { await agentApi.updateService(editingId, payloadFromForm(editForm)); setEditingId(''); }, 'Service updated.', 'Unable to update service.');
  };
  const changeStatus = (service, status) => run(
    () => agentApi.updateService(service._id, { status }),
    status === 'archived' ? 'Service archived. Historical consultations and cases remain unchanged.' : 'Service activated.',
    'Unable to update service status.'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Education &amp; Mobility Services</h1>
        <p className={muted}>Create and maintain truthful Education services. Activation requires approved Education professional verification. Active services and Marketplace promotions remain separate.</p>
        <p className={`mt-2 ${muted}`}>Education specialties and destination expertise are edited on <Link className="text-primary hover:underline" to={ROUTES.AGENT_EDUCATION_PROFILE}>Education &amp; Mobility Profile</Link>.</p>
      </div>
      {error ? <p id="education-service-error" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</p> : null}
      {message ? <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300" role="status">{message}</p> : null}

      <form className="flex flex-wrap gap-3" onSubmit={(event) => { event.preventDefault(); load(q ? { q } : undefined).catch(() => setError('Search failed.')); }}>
        <label className={labelClass}>Search<input value={q} onChange={(event) => setQ(event.target.value)} className={inputClass} placeholder="Service name" /></label>
        <button type="submit" className="self-end min-h-[44px] rounded-lg border px-4 text-sm">Apply</button>
        <button type="button" className="self-end min-h-[44px] rounded-lg border px-4 text-sm" onClick={() => { setQ(''); load(); }}>Reset</button>
      </form>

      <form onSubmit={submit} aria-describedby={error ? 'education-service-error' : undefined} className={`grid gap-4 ${cardClass} md:grid-cols-2`}>
        <h2 className="font-semibold text-gray-900 dark:text-white md:col-span-2">Create a draft service</h2>
        <ServiceFields form={form} setForm={setForm} countryOptions={countryOptions} prefix="create-service" />
        <button disabled={busy} className={`${btnPrimary} md:col-span-2`}>{busy ? 'Saving…' : 'Create draft service'}</button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Your services</h2>
        {loading ? <p className={`${cardClass} ${muted}`} role="status">Loading services…</p> : services.length === 0 ? <p className={`${cardClass} ${muted}`}>No services yet.</p> : services.map((service) => (
          <article key={service._id} className={cardClass}>
            {editingId === service._id ? (
              <form onSubmit={saveEdit} className="grid gap-4 md:grid-cols-2" aria-label={`Edit ${service.title}`}>
                <h3 className="font-semibold text-gray-900 dark:text-white md:col-span-2">Edit service</h3>
                <ServiceFields form={editForm} setForm={setEditForm} countryOptions={countryOptions} prefix={`edit-service-${service._id}`} />
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <button disabled={busy} className={btnPrimary}>Save changes</button>
                  <button type="button" disabled={busy} className="min-h-[44px] rounded-lg border px-4 text-sm" onClick={() => setEditingId('')}>Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="font-medium text-gray-900 dark:text-white">{service.title}</h3><p className={`mt-1 ${muted}`}>{agentServiceCategoryLabel(service.category)} · {service.description}</p></div>
                  <span className="rounded-full bg-slate-100 dark:bg-gray-900 px-2 py-1 text-xs text-gray-800 dark:text-gray-200">{service.status}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" disabled={busy} onClick={() => { setEditingId(service._id); setEditForm(formFromService(service)); }} className="min-h-[44px] text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2">Edit</button>
                  {service.status !== 'active' ? <button type="button" disabled={busy} onClick={() => changeStatus(service, 'active')} className="min-h-[44px] text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2">Activate service</button> : null}
                  {service.status !== 'archived' ? <button type="button" disabled={busy} onClick={() => changeStatus(service, 'archived')} className="min-h-[44px] text-sm font-medium text-red-700 dark:text-red-300 focus-visible:outline focus-visible:outline-2">Archive service</button> : null}
                </div>
              </>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
