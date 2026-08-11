import { useEffect, useState } from 'react';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { ACCEPTANCE_SCOPES, ACCEPTANCE_STATUSES } from '@shared/education/acceptanceExplorer.js';
import { PageState, Panel, StatusBadge, fieldClass, humanize, primaryButton, secondaryButton } from './InstitutionUi';

export default function InstitutionTestAcceptance() {
  const { organizationId } = useInstitutionAuth();
  const [records, setRecords] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ testId: '', acceptanceScope: 'institution', acceptanceStatus: 'accepted', minimumOverallScore: '', programId: '' });

  const load = (query = q) => Promise.all([
    institutionPortalApi.listTestAcceptance(organizationId, { q: query }),
    institutionPortalApi.programs(organizationId, { limit: 50 }),
  ]).then(([ta, programsRes]) => {
    setRecords(ta.data.records || []);
    setPrograms(programsRes.data.programs || []);
  }).catch((err) => setError(err.response?.data?.error || 'Unable to load Test Acceptance.'))
    .finally(() => setLoading(false));

  useEffect(() => { load(''); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (event) => {
    event.preventDefault(); setError(''); setNotice('');
    try {
      await institutionPortalApi.createTestAcceptance(organizationId, {
        ...form,
        programId: form.programId || null,
        minimumOverallScore: form.minimumOverallScore === '' ? null : Number(form.minimumOverallScore),
      });
      setNotice('Test Acceptance draft recorded. Country-wide policy cannot be overwritten.');
      await load(q);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not record Test Acceptance.');
    }
  };

  if (loading) return <PageState>Loading Test Acceptance…</PageState>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Test Acceptance</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Institution and Program scope only. Country-wide policy is protected. History is preserved by supersession.</p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      {notice ? <PageState tone="success">{notice}</PageState> : null}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <input className={`${fieldClass} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" aria-label="Filter test acceptance" />
        <button className={secondaryButton} type="submit">Search</button>
        <button className={secondaryButton} type="button" onClick={() => { setQ(''); load(''); }}>Reset</button>
      </form>
      {!records.length ? <PageState>No Test Acceptance records.</PageState> : records.map((r) => (
        <Panel key={r._id}>
          <StatusBadge value={r.acceptanceStatus} />
          <StatusBadge label="Scope" value={r.acceptanceScope} />
          {r.supersededById ? <p className="text-xs mt-2 text-gray-500">Superseded</p> : null}
        </Panel>
      ))}
      <Panel title="Add Institution / Program Test Acceptance">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Test catalog ID<input required className={`${fieldClass} mt-1`} value={form.testId} onChange={(e) => setForm({ ...form, testId: e.target.value })} /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Scope
            <select className={`${fieldClass} mt-1`} value={form.acceptanceScope} onChange={(e) => setForm({ ...form, acceptanceScope: e.target.value })}>
              {[ACCEPTANCE_SCOPES.INSTITUTION, ACCEPTANCE_SCOPES.PROGRAM, ACCEPTANCE_SCOPES.PROGRAM_INTAKE].map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Program (for program scope)
            <select className={`${fieldClass} mt-1`} value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
              <option value="">Institution scope</option>
              {programs.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Status
            <select className={`${fieldClass} mt-1`} value={form.acceptanceStatus} onChange={(e) => setForm({ ...form, acceptanceStatus: e.target.value })}>
              {Object.values(ACCEPTANCE_STATUSES).map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Minimum overall score<input type="number" className={`${fieldClass} mt-1`} value={form.minimumOverallScore} onChange={(e) => setForm({ ...form, minimumOverallScore: e.target.value })} /></label>
          <div className="sm:col-span-2"><button className={primaryButton}>Record draft</button></div>
        </form>
      </Panel>
    </div>
  );
}
