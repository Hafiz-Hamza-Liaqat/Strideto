import { useEffect, useState } from 'react';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { institutionPortalApi } from '../../services/institutionPortalService';
import { APPLICATION_MODES } from '../../../../shared/institution/institutionPortal.js';
import { PageState, Panel, StatusBadge, fieldClass, humanize, primaryButton, secondaryButton } from './InstitutionUi';
import { DateInput } from '../../components/forms/NativeTemporalInput';

const emptyIntake = {
  cycleLabel: '', applicationOpenDate: '', deadlineDate: '', startDate: '',
  applicationMode: APPLICATION_MODES.NOT_CONFIGURED, applicationUrl: '',
  capacity: '', requirements: '', feeAmount: '', feeCurrency: '', status: 'draft', sourceUrl: '',
};

export default function InstitutionIntakes() {
  const { organizationId } = useInstitutionAuth();
  const [programs, setPrograms] = useState([]);
  const [selected, setSelected] = useState('');
  const [intake, setIntake] = useState(emptyIntake);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = (query = q) => institutionPortalApi.programs(organizationId, { q: query, limit: 50 })
    .then(({ data }) => setPrograms(data.programs || []))
    .catch((err) => setError(err.response?.data?.error || 'Unable to load intakes.'))
    .finally(() => setLoading(false));

  useEffect(() => { load(''); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const program = programs.find((p) => p._id === selected);
  const save = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setNotice(''); setError('');
    try {
      const next = [...(program.intakes || [])];
      next.push({
        cycleLabel: intake.cycleLabel,
        applicationOpenDate: intake.applicationOpenDate,
        deadlineDate: intake.deadlineDate,
        startDate: intake.startDate,
        applicationMode: intake.applicationMode,
        applicationUrl: intake.applicationUrl,
        capacity: intake.capacity === '' ? null : Number(intake.capacity),
        requirements: intake.requirements,
        fee: intake.feeCurrency && intake.feeAmount !== '' ? { amountMinor: Number(intake.feeAmount), currency: intake.feeCurrency.toUpperCase() } : undefined,
        status: intake.status,
        sourceUrl: intake.sourceUrl,
      });
      await institutionPortalApi.updateProgram(organizationId, selected, { intakes: next });
      setNotice('Intake saved with date-only fields. No timezone was invented.');
      setIntake(emptyIntake);
      await load(q);
    } catch (err) {
      setError(err.response?.data?.error || 'Intake could not be saved.');
    }
  };

  if (loading) return <PageState>Loading intakes…</PageState>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Intakes / Admissions information</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Official Institution-managed admissions facts. Dates are YYYY-MM-DD only. Internal and external application modes are labelled separately.</p>
      </div>
      {error ? <PageState tone="error" role="alert">{error}</PageState> : null}
      {notice ? <PageState tone="success">{notice}</PageState> : null}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <input className={`${fieldClass} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter programs" aria-label="Filter programs" />
        <button className={secondaryButton} type="submit">Search</button>
        <button className={secondaryButton} type="button" onClick={() => { setQ(''); load(''); }}>Reset</button>
      </form>
      {(programs.flatMap((p) => (p.intakes || []).map((i) => ({ p, i })))).length === 0 ? <PageState>No intakes recorded.</PageState> : (
        <div className="space-y-3">
          {programs.map((p) => (p.intakes || []).map((i, idx) => (
            <Panel key={`${p._id}-${idx}`}>
              <p className="font-semibold text-gray-900 dark:text-white break-words">{p.name} · {i.cycleLabel || 'Unnamed intake'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge label="Mode" value={i.applicationMode || 'not_configured'} />
                <StatusBadge value={i.status || 'draft'} />
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Open {i.applicationOpenDate || '—'} · Deadline {i.deadlineDate || '—'} · Start {i.startDate || '—'}</p>
              {i.applicationMode === 'external' || i.applicationMode === 'both' ? <p className="mt-1 text-sm">Application happens on the Institution’s official website{i.applicationUrl ? `: ${i.applicationUrl}` : ''}.</p> : null}
              {i.applicationMode === 'internal' || i.applicationMode === 'both' ? <p className="mt-1 text-sm">Internal Strideto applications are enabled for this intake.</p> : null}
            </Panel>
          )))}
        </div>
      )}
      <Panel title="Add intake">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">Program
            <select required className={`${fieldClass} mt-1`} value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select a program</option>
              {programs.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="institution-intake-name">Intake name / term<input id="institution-intake-name" className={`${fieldClass} mt-1`} value={intake.cycleLabel} onChange={(e) => setIntake({ ...intake, cycleLabel: e.target.value })} required placeholder="Fall 2027" /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Application mode
            <select className={`${fieldClass} mt-1`} value={intake.applicationMode} onChange={(e) => setIntake({ ...intake, applicationMode: e.target.value })}>
              {Object.values(APPLICATION_MODES).map((m) => <option key={m} value={m}>{humanize(m)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Opening date<DateInput className={`${fieldClass} mt-1`} value={intake.applicationOpenDate} onChange={(e) => setIntake({ ...intake, applicationOpenDate: e.target.value })} /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Deadline<DateInput className={`${fieldClass} mt-1`} value={intake.deadlineDate} onChange={(e) => setIntake({ ...intake, deadlineDate: e.target.value })} /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Start date<DateInput className={`${fieldClass} mt-1`} value={intake.startDate} onChange={(e) => setIntake({ ...intake, startDate: e.target.value })} /></label>
          <div>
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="institution-intake-apply-url">Official application URL<input id="institution-intake-apply-url" type="url" className={`${fieldClass} mt-1`} value={intake.applicationUrl} onChange={(e) => setIntake({ ...intake, applicationUrl: e.target.value })} placeholder="https://www.example.edu/apply" /></label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Required when application mode is external.</p>
          </div>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="institution-intake-capacity">Capacity<input id="institution-intake-capacity" type="number" min="0" step="1" className={`${fieldClass} mt-1`} value={intake.capacity} onChange={(e) => setIntake({ ...intake, capacity: e.target.value })} placeholder="e.g. 250" /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2" htmlFor="institution-intake-requirements">Requirements<textarea id="institution-intake-requirements" className={`${fieldClass} mt-1`} value={intake.requirements} onChange={(e) => setIntake({ ...intake, requirements: e.target.value })} placeholder="Describe academic, language, document or eligibility requirements..." /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="institution-intake-fee-amount">Fee minor units<input id="institution-intake-fee-amount" type="number" min="0" step="1" className={`${fieldClass} mt-1`} value={intake.feeAmount} onChange={(e) => setIntake({ ...intake, feeAmount: e.target.value })} placeholder="e.g. 50000" /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200" htmlFor="institution-intake-fee-currency">Fee currency<input id="institution-intake-fee-currency" maxLength={3} className={`${fieldClass} mt-1`} value={intake.feeCurrency} onChange={(e) => setIntake({ ...intake, feeCurrency: e.target.value })} placeholder="USD" /></label>
          <label className="text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2" htmlFor="institution-intake-source-url">Source URL<input id="institution-intake-source-url" type="url" className={`${fieldClass} mt-1`} value={intake.sourceUrl} onChange={(e) => setIntake({ ...intake, sourceUrl: e.target.value })} placeholder="https://www.example.edu/admissions" /></label>
          <div className="sm:col-span-2"><button className={primaryButton}>Save intake</button></div>
        </form>
      </Panel>
    </div>
  );
}
