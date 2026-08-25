import { useEffect, useState } from 'react';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { testsApi } from '../../services/listingsService';
import { ACCEPTANCE_SCOPES, ACCEPTANCE_STATUSES } from '@shared/education/acceptanceExplorer.js';
import { PageState, Panel, StatusBadge, fieldClass, humanize, primaryButton, secondaryButton } from './InstitutionUi';

const EMPTY_FORM = {
  testId: '',
  acceptanceScope: 'institution',
  acceptanceStatus: 'accepted',
  minimumOverallScore: '',
  programId: '',
  intake: '',
  effectiveFrom: '',
  effectiveUntil: '',
  resultValidityMonths: '',
  sectionMinimums: [{ sectionName: '', minimum: '' }],
};

function testLabel(test) {
  if (!test) return 'Unknown test';
  const provider = test.providerId?.name ? ` · ${test.providerId.name}` : '';
  return `${test.name || test.shortName || test.slug || test._id}${provider}`;
}

function recordTestLabel(record) {
  const t = record?.testId;
  if (t && typeof t === 'object') return testLabel(t);
  return record?.testId ? String(record.testId) : 'Unknown test';
}

export default function InstitutionTestAcceptance() {
  const { organizationId } = useInstitutionAuth();
  const [records, setRecords] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const load = (query = q) => Promise.all([
    institutionPortalApi.listTestAcceptance(organizationId, { q: query }),
    institutionPortalApi.programs(organizationId, { limit: 50 }),
    testsApi.list({ limit: 50 }),
  ]).then(([ta, programsRes, testsRes]) => {
    setRecords(ta.data.records || []);
    setPrograms(programsRes.data.programs || []);
    setCatalog(testsRes.data.data || []);
  }).catch((err) => setError(err.response?.data?.error || 'Unable to load Test Acceptance.'))
    .finally(() => setLoading(false));

  useEffect(() => { load(''); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedProgram = programs.find((p) => p._id === form.programId);
  const programIntakes = Array.isArray(selectedProgram?.intakes) ? selectedProgram.intakes : [];

  const updateSection = (index, patch) => {
    setForm((current) => {
      const next = [...(current.sectionMinimums || [])];
      next[index] = { ...next[index], ...patch };
      return { ...current, sectionMinimums: next };
    });
  };

  const submit = async (event) => {
    event.preventDefault(); setError(''); setNotice('');
    const sectionMinimums = (form.sectionMinimums || [])
      .filter((row) => String(row.sectionName || '').trim() && row.minimum !== '')
      .map((row) => ({
        sectionName: String(row.sectionName).trim(),
        minimum: Number(row.minimum),
      }));
    try {
      await institutionPortalApi.createTestAcceptance(organizationId, {
        testId: form.testId,
        acceptanceScope: form.acceptanceScope,
        acceptanceStatus: form.acceptanceStatus,
        programId: form.acceptanceScope === ACCEPTANCE_SCOPES.INSTITUTION ? null : (form.programId || null),
        intake: form.acceptanceScope === ACCEPTANCE_SCOPES.PROGRAM_INTAKE ? form.intake : '',
        minimumOverallScore: form.minimumOverallScore === '' ? null : Number(form.minimumOverallScore),
        sectionMinimums,
        effectiveFrom: form.effectiveFrom || null,
        effectiveUntil: form.effectiveUntil || null,
        resultValidityMonths: form.resultValidityMonths === '' ? null : Number(form.resultValidityMonths),
      });
      setNotice('Test Acceptance draft recorded. Publish when ready. Country-wide policy cannot be overwritten.');
      setForm(EMPTY_FORM);
      await load(q);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not record Test Acceptance.');
    }
  };

  const publish = async (id) => {
    setBusyId(id); setError(''); setNotice('');
    try {
      await institutionPortalApi.publishTestAcceptance(organizationId, id);
      setNotice('Test Acceptance published.');
      await load(q);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not publish Test Acceptance.');
    } finally {
      setBusyId('');
    }
  };

  const archive = async (id) => {
    setBusyId(id); setError(''); setNotice('');
    try {
      await institutionPortalApi.archiveTestAcceptance(organizationId, id);
      setNotice('Test Acceptance archived.');
      await load(q);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not archive Test Acceptance.');
    } finally {
      setBusyId('');
    }
  };

  if (loading) return <PageState>Loading Test Acceptance…</PageState>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Test Acceptance</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Institution and Program scope only. Country-wide policy is protected. History is preserved by supersession.
          Drafts are not student-visible until published.
        </p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      {notice ? <PageState tone="success">{notice}</PageState> : null}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <input className={`${fieldClass} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by test or program" aria-label="Filter test acceptance" />
        <button className={secondaryButton} type="submit">Search</button>
        <button className={secondaryButton} type="button" onClick={() => { setQ(''); load(''); }}>Reset</button>
      </form>
      {!records.length ? <PageState>No Test Acceptance records.</PageState> : records.map((r) => (
        <Panel key={r._id}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={r.acceptanceStatus} />
            <StatusBadge label="Scope" value={r.acceptanceScope} />
            <StatusBadge label="Publication" value={r.status} />
          </div>
          <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{recordTestLabel(r)}</p>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            Overall min: {r.minimumOverallScore ?? '—'}
            {r.resultValidityMonths ? ` · Result age ≤ ${r.resultValidityMonths} months` : ''}
          </p>
          {(r.sectionMinimums || []).length ? (
            <ul className="mt-1 text-xs text-gray-600 dark:text-gray-400 list-disc pl-5">
              {r.sectionMinimums.map((s) => (
                <li key={`${s.sectionName}-${s.minimum}`}>{s.sectionName}: {s.minimum}{s.scale ? ` (${s.scale})` : ''}</li>
              ))}
            </ul>
          ) : null}
          {(r.effectiveFrom || r.effectiveUntil) ? (
            <p className="mt-1 text-xs text-gray-500">
              Policy effective: {r.effectiveFrom ? new Date(r.effectiveFrom).toLocaleDateString() : '—'}
              {' → '}
              {r.effectiveUntil ? new Date(r.effectiveUntil).toLocaleDateString() : '—'}
            </p>
          ) : null}
          {r.intake ? <p className="mt-1 text-xs text-gray-500">Intake: {r.intake}</p> : null}
          {r.supersededById ? <p className="text-xs mt-2 text-gray-500">Superseded</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {r.status === 'draft' ? (
              <button type="button" className={primaryButton} disabled={busyId === r._id} onClick={() => publish(r._id)}>
                {busyId === r._id ? 'Publishing…' : 'Publish'}
              </button>
            ) : null}
            {r.status === 'published' ? (
              <button type="button" className={secondaryButton} disabled={busyId === r._id} onClick={() => archive(r._id)}>
                {busyId === r._id ? 'Archiving…' : 'Archive'}
              </button>
            ) : null}
          </div>
        </Panel>
      ))}
      <Panel title="Add Institution / Program Test Acceptance">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Test (catalog)
            <select
              required
              className={`${fieldClass} mt-1`}
              value={form.testId}
              onChange={(e) => setForm({ ...form, testId: e.target.value })}
            >
              <option value="">Select published test</option>
              {catalog.map((t) => (
                <option key={t._id} value={t._id}>{testLabel(t)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Scope
            <select className={`${fieldClass} mt-1`} value={form.acceptanceScope} onChange={(e) => setForm({ ...form, acceptanceScope: e.target.value })}>
              {[ACCEPTANCE_SCOPES.INSTITUTION, ACCEPTANCE_SCOPES.PROGRAM, ACCEPTANCE_SCOPES.PROGRAM_INTAKE].map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
            </select>
          </label>
          {form.acceptanceScope !== ACCEPTANCE_SCOPES.INSTITUTION ? (
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Program
              <select required className={`${fieldClass} mt-1`} value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value, intake: '' })}>
                <option value="">Select program</option>
                {programs.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </label>
          ) : null}
          {form.acceptanceScope === ACCEPTANCE_SCOPES.PROGRAM_INTAKE ? (
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Intake
              {programIntakes.length ? (
                <select required className={`${fieldClass} mt-1`} value={form.intake} onChange={(e) => setForm({ ...form, intake: e.target.value })}>
                  <option value="">Select intake</option>
                  {programIntakes.map((intake) => (
                    <option key={intake.cycleLabel} value={intake.cycleLabel}>{intake.cycleLabel || 'Unnamed intake'}</option>
                  ))}
                </select>
              ) : (
                <input required className={`${fieldClass} mt-1`} value={form.intake} onChange={(e) => setForm({ ...form, intake: e.target.value })} placeholder="e.g. Fall 2026" />
              )}
            </label>
          ) : null}
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Status
            <select className={`${fieldClass} mt-1`} value={form.acceptanceStatus} onChange={(e) => setForm({ ...form, acceptanceStatus: e.target.value })}>
              {Object.values(ACCEPTANCE_STATUSES).map((v) => <option key={v} value={v}>{humanize(v)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Minimum overall score
            <input type="number" min="0" step="any" className={`${fieldClass} mt-1`} value={form.minimumOverallScore} onChange={(e) => setForm({ ...form, minimumOverallScore: e.target.value })} placeholder="e.g. 6.5" />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Result validity (months)
            <input type="number" min="1" step="1" className={`${fieldClass} mt-1`} value={form.resultValidityMonths} onChange={(e) => setForm({ ...form, resultValidityMonths: e.target.value })} placeholder="e.g. 24" />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Policy effective from
            <input type="date" className={`${fieldClass} mt-1`} value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Policy effective until
            <input type="date" className={`${fieldClass} mt-1`} value={form.effectiveUntil} onChange={(e) => setForm({ ...form, effectiveUntil: e.target.value })} />
          </label>
          <div className="sm:col-span-2 space-y-2">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Section minimums (optional)</p>
            {(form.sectionMinimums || []).map((row, index) => (
              <div key={`section-${index}`} className="grid gap-2 sm:grid-cols-2">
                <input
                  className={fieldClass}
                  value={row.sectionName}
                  onChange={(e) => updateSection(index, { sectionName: e.target.value })}
                  placeholder="Section name (e.g. Listening)"
                  aria-label={`Section name ${index + 1}`}
                />
                <input
                  type="number"
                  step="any"
                  className={fieldClass}
                  value={row.minimum}
                  onChange={(e) => updateSection(index, { minimum: e.target.value })}
                  placeholder="Minimum"
                  aria-label={`Section minimum ${index + 1}`}
                />
              </div>
            ))}
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setForm((current) => ({
                ...current,
                sectionMinimums: [...(current.sectionMinimums || []), { sectionName: '', minimum: '' }],
              }))}
            >
              Add section
            </button>
          </div>
          <div className="sm:col-span-2"><button className={primaryButton}>Record draft</button></div>
        </form>
      </Panel>
    </div>
  );
}
