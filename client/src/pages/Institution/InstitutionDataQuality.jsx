import { useEffect, useState } from 'react';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, StatusBadge, fieldClass, humanize, primaryButton } from './InstitutionUi';

export default function InstitutionDataQuality() {
  const { organizationId } = useInstitutionAuth();
  const [state, setState] = useState({ loading: true, programs: [], conflicts: [], events: [], error: '' });
  const [form, setForm] = useState({ programId: '', reconfirmationNote: '', sourceUrl: '' });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => Promise.all([institutionPortalApi.programs(organizationId), institutionPortalApi.conflicts(organizationId), institutionPortalApi.history(organizationId)])
    .then(([programs, conflicts, history]) => setState({ loading: false, programs: programs.data.programs || [], conflicts: conflicts.data.conflicts || [], events: history.data.events || [], error: '' }))
    .catch((error) => setState((current) => ({ ...current, loading: false, error: error.response?.data?.error || 'Data-quality information is unavailable.' })));
  useEffect(() => { load(); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reconfirm = async (event) => {
    event.preventDefault(); setBusy(true); setNotice('');
    try { await institutionPortalApi.reconfirmFreshness(organizationId, form); setNotice('Freshness reconfirmation recorded with an audit event.'); setForm({ ...form, reconfirmationNote: '', sourceUrl: '' }); await load(); }
    catch (error) { setState((current) => ({ ...current, error: error.response?.data?.error || 'Freshness could not be reconfirmed.' })); }
    finally { setBusy(false); }
  };

  if (state.loading) return <PageState>Loading data-quality evidence…</PageState>;
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-blue-700">Source truth and freshness</p><h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Data quality</h1><p className="mt-2 text-sm text-slate-600">Opening this page never marks data fresh. Reconfirmation requires an explicit, auditable action.</p></div>{state.error ? <PageState tone="error" role="alert">{state.error}</PageState> : null}{notice ? <PageState tone="success">{notice}</PageState> : null}<div className="grid gap-4 lg:grid-cols-2"><Panel title="Program freshness">{state.programs.length ? <ul className="space-y-3">{state.programs.map((program) => <li key={program._id} className="rounded-lg border border-slate-200 p-3"><p className="break-words font-semibold text-slate-900">{program.name}</p><div className="mt-2 flex flex-wrap gap-2"><StatusBadge label="Freshness" value={program.freshnessState || 'unknown'} /><StatusBadge label="Verification" value={program.verificationStatus || 'unverified'} /></div></li>)}</ul> : <PageState>No Program freshness records yet.</PageState>}</Panel><Panel title="Open conflicts">{state.conflicts.length ? <ul className="space-y-3">{state.conflicts.map((conflict) => <li key={conflict._id} className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"><strong>{humanize(conflict.field || conflict.conflictType || 'data conflict')}</strong><p className="mt-1">Status: {humanize(conflict.state)}</p></li>)}</ul> : <PageState>No open data conflicts.</PageState>}</Panel></div><Panel title="Explicit freshness reconfirmation"><form className="grid gap-4 sm:grid-cols-2" onSubmit={reconfirm}><label className="text-sm font-medium text-slate-700">Program<select className={`${fieldClass} mt-1`} value={form.programId} onChange={(event) => setForm({ ...form, programId: event.target.value })}><option value="">Institution profile</option>{state.programs.map((program) => <option key={program._id} value={program._id}>{program.name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Official source URL<input type="url" required className={`${fieldClass} mt-1`} value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} /></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">What was checked?<textarea required className={`${fieldClass} mt-1 min-h-24`} value={form.reconfirmationNote} onChange={(event) => setForm({ ...form, reconfirmationNote: event.target.value })} /></label><div className="sm:col-span-2"><button className={primaryButton} disabled={busy}>{busy ? 'Recording…' : 'Record reconfirmation'}</button></div></form></Panel><Panel title="Recent change history">{state.events.length ? <ul className="space-y-3">{state.events.slice(0, 10).map((event) => <li key={event._id} className="rounded-lg border border-slate-200 p-3 text-sm"><strong>{humanize(event.changeCategory || event.field)}</strong><p className="mt-1 text-slate-600">Field: {humanize(event.field)} · Source: {humanize(event.sourceType || 'institution_official')}</p></li>)}</ul> : <PageState>No audited Institution changes yet.</PageState>}</Panel></div>;
}
