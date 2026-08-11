import { useEffect, useState } from 'react';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, StatusBadge, fieldClass, primaryButton, secondaryButton } from './InstitutionUi';

export default function InstitutionScholarships() {
  const { organizationId } = useInstitutionAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ title: '', summary: '', amountMinor: '', currency: '', deadlineDate: '', cycleLabel: '', sourceUrl: '', nationalityScope: '', eligibility: '' });

  const load = (query = q) => institutionPortalApi.scholarships(organizationId, { q: query })
    .then(({ data }) => setItems(data.scholarships || []))
    .catch((err) => setError(err.response?.data?.error || 'Unable to load scholarships.'))
    .finally(() => setLoading(false));

  useEffect(() => { load(''); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (event) => {
    event.preventDefault(); setError(''); setNotice('');
    try {
      await institutionPortalApi.createScholarship(organizationId, {
        title: form.title,
        summary: form.summary,
        funding: form.amountMinor !== '' ? { type: 'fixed_amount', amountMinor: Number(form.amountMinor), currency: form.currency.toUpperCase() } : undefined,
        deadlineDate: form.deadlineDate,
        cycleLabel: form.cycleLabel,
        sourceUrl: form.sourceUrl,
        nationalityScope: form.nationalityScope ? form.nationalityScope.split(',').map((s) => s.trim()) : [],
        eligibility: form.eligibility,
        scholarshipType: 'institutional',
      });
      setNotice('Institution-owned scholarship draft saved. This does not claim third-party or government authority. No award is guaranteed.');
      setForm({ title: '', summary: '', amountMinor: '', currency: '', deadlineDate: '', cycleLabel: '', sourceUrl: '', nationalityScope: '', eligibility: '' });
      await load(q);
    } catch (err) {
      setError(err.response?.data?.error || 'Scholarship could not be created.');
    }
  };

  if (loading) return <PageState>Loading scholarships…</PageState>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scholarships & funding</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Verified + canonically claimed Institutions may manage their own scholarships. No guarantee wording. External awards require independent source authority.</p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      {notice ? <PageState tone="success">{notice}</PageState> : null}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <input className={`${fieldClass} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search scholarships" aria-label="Search scholarships" />
        <button className={secondaryButton} type="submit">Search</button>
        <button className={secondaryButton} type="button" onClick={() => { setQ(''); load(''); }}>Reset</button>
      </form>
      {!items.length ? <PageState>No Institution-owned scholarships.</PageState> : items.map((s) => (
        <Panel key={s._id}>
          <p className="font-semibold text-gray-900 dark:text-white">{s.title}</p>
          <StatusBadge value={s.status} />
          <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">{s.cycleLabel || 'Cycle not specified'} · Deadline {s.deadlineDate || '—'}</p>
        </Panel>
      ))}
      <Panel title="Create Institution-owned scholarship">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">Title<input required className={`${fieldClass} mt-1`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Amount (minor units)<input type="number" min="0" className={`${fieldClass} mt-1`} value={form.amountMinor} onChange={(e) => setForm({ ...form, amountMinor: e.target.value })} /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Currency<input maxLength={3} className={`${fieldClass} mt-1`} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Cycle / term<input className={`${fieldClass} mt-1`} value={form.cycleLabel} onChange={(e) => setForm({ ...form, cycleLabel: e.target.value })} /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Deadline<input type="date" className={`${fieldClass} mt-1`} value={form.deadlineDate} onChange={(e) => setForm({ ...form, deadlineDate: e.target.value })} /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">Nationality / residence scope<input className={`${fieldClass} mt-1`} value={form.nationalityScope} onChange={(e) => setForm({ ...form, nationalityScope: e.target.value })} placeholder="PK, GB" /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">Source URL<input className={`${fieldClass} mt-1`} value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">Eligibility criteria<textarea className={`${fieldClass} mt-1`} value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">Summary<textarea className={`${fieldClass} mt-1`} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></label>
          <div className="sm:col-span-2"><button className={primaryButton}>Create draft</button></div>
        </form>
      </Panel>
    </div>
  );
}
