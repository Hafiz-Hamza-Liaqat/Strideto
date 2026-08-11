import { useEffect, useState } from 'react';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { PageState, Panel, StatusBadge, fieldClass, humanize, primaryButton, secondaryButton } from './InstitutionUi';

export default function InstitutionDataQuality() {
  const { organizationId } = useInstitutionAuth();
  const [state, setState] = useState({ loading: true, programs: [], conflicts: [], events: [], error: '' });
  const [form, setForm] = useState({ programId: '', reconfirmationNote: '', sourceUrl: '' });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  const load = (query = q) => Promise.all([
    institutionPortalApi.programs(organizationId, { q: query, limit: 50 }),
    institutionPortalApi.conflicts(organizationId),
    institutionPortalApi.history(organizationId),
  ]).then(([programs, conflicts, history]) => setState({
    loading: false,
    programs: programs.data.programs || [],
    conflicts: conflicts.data.conflicts || [],
    events: history.data.events || [],
    error: '',
  })).catch((error) => setState((current) => ({ ...current, loading: false, error: error.response?.data?.error || 'Data-quality information is unavailable.' })));

  useEffect(() => { load(); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reconfirm = async (event) => {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      await institutionPortalApi.reconfirmFreshness(organizationId, form);
      setNotice('Freshness reconfirmation recorded with an audit event. Opening this page did not mark data fresh.');
      setForm({ ...form, reconfirmationNote: '', sourceUrl: '' });
      await load();
    } catch (error) {
      setState((current) => ({ ...current, error: error.response?.data?.error || 'Freshness could not be reconfirmed.' }));
    } finally { setBusy(false); }
  };

  if (state.loading) return <PageState>Loading data-quality evidence…</PageState>;

  const filteredConflicts = state.conflicts.filter((c) => !q || JSON.stringify(c).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Data quality</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Opening this page never marks data fresh. Conflicts show existing vs proposed values. Stronger authority cannot be silently overwritten.</p>
      </div>
      {state.error ? <PageState tone="error" role="alert">{state.error}</PageState> : null}
      {notice ? <PageState tone="success">{notice}</PageState> : null}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <input className={`${fieldClass} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" aria-label="Filter data quality" />
        <button className={secondaryButton} type="submit">Search</button>
        <button className={secondaryButton} type="button" onClick={() => { setQ(''); load(''); }}>Reset</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Program freshness">
          {state.programs.length ? state.programs.map((program) => (
            <div key={program._id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-2">
              <p className="break-words font-semibold text-gray-900 dark:text-white">{program.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge label="Freshness" value={program.freshnessState || 'unknown'} />
                <StatusBadge label="Verification" value={program.verificationStatus || 'unverified'} />
              </div>
            </div>
          )) : <PageState>No Program freshness records yet.</PageState>}
        </Panel>
        <Panel title="Open conflicts">
          {filteredConflicts.length ? filteredConflicts.map((conflict) => (
            <div key={conflict._id} className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm mb-2">
              <strong className="text-amber-900 dark:text-amber-200">{humanize(conflict.fieldScope || conflict.field || 'data conflict')}</strong>
              <p className="mt-1">Existing: {JSON.stringify(conflict.existingValue)?.slice(0, 180)}</p>
              <p>Proposed: {JSON.stringify(conflict.proposedValue)?.slice(0, 180)}</p>
              <p>Sources: {conflict.existingSourceType || '—'} vs {conflict.proposedSourceType || '—'}</p>
              <p>Status: {humanize(conflict.state)}</p>
            </div>
          )) : <PageState>No open data conflicts.</PageState>}
        </Panel>
      </div>
      <Panel title="Explicit freshness reconfirmation">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={reconfirm}>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Program
            <select className={`${fieldClass} mt-1`} value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
              <option value="">Institution profile</option>
              {state.programs.map((program) => <option key={program._id} value={program._id}>{program.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Official source URL<input type="url" required className={`${fieldClass} mt-1`} value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">What was checked?<textarea required className={`${fieldClass} mt-1 min-h-24`} value={form.reconfirmationNote} onChange={(e) => setForm({ ...form, reconfirmationNote: e.target.value })} /></label>
          <div className="sm:col-span-2"><button className={primaryButton} disabled={busy}>{busy ? 'Recording…' : 'Record reconfirmation'}</button></div>
        </form>
      </Panel>
      <Panel title="Recent change history">
        {state.events.length ? state.events.slice(0, 10).map((event) => (
          <div key={event._id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm mb-2">
            <strong>{humanize(event.changeCategory || event.field)}</strong>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Field: {humanize(event.field)} · Source: {humanize(event.sourceType || 'institution_official')}</p>
          </div>
        )) : <PageState>No audited Institution changes yet.</PageState>}
      </Panel>
    </div>
  );
}
