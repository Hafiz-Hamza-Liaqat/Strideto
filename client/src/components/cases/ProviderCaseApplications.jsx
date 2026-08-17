import { useEffect, useMemo, useState } from 'react';
import { agentApi } from '../../services/agentService';
import { ui } from '../../design-system/surfaceClasses';
import CaseSectionPagination from './CaseSectionPagination';

const transitions = {
  preparing: ['ready_for_submission', 'withdrawn'],
  ready_for_submission: ['preparing', 'provider_attested_submitted', 'withdrawn'],
  provider_attested_submitted: ['awaiting_decision', 'provider_recorded_offer', 'provider_recorded_unsuccessful', 'withdrawn'],
  awaiting_decision: ['provider_recorded_offer', 'provider_recorded_unsuccessful', 'withdrawn'],
  provider_recorded_offer: ['completed'],
  provider_recorded_unsuccessful: ['completed'],
  withdrawn: [],
  completed: [],
};
const label = (value) => (value || '').replaceAll('_', ' ');

function ApplicationCard({ application, caseId, reload, requestSubmissionApproval, disabled }) {
  const [status, setStatus] = useState('');
  const [deadlineAt, setDeadlineAt] = useState(application.deadlineAt ? application.deadlineAt.slice(0, 10) : '');
  const [submissionMethod, setSubmissionMethod] = useState('agent_assisted_external');
  const [statusNote, setStatusNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await agentApi.updateCaseApplication(caseId, application.id, {
        ...(status ? { status } : {}),
        deadlineAt: deadlineAt || null,
        ...(status === 'provider_attested_submitted' ? { submissionMethod } : {}),
        statusNote,
      });
      setStatus('');
      setStatusNote('');
      await reload();
    } catch (e) {
      setError(e.response?.data?.error || 'Application update failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{application.institution?.officialName}</h3>
          <p className={ui.muted}>{application.program?.name || 'Program not recorded'} · {application.intake?.cycleLabel || 'Intake not recorded'}</p>
        </div>
        <span className={ui.badge}>{label(application.status)}</span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="font-medium">Deadline</dt><dd>{application.deadlineAt ? new Date(application.deadlineAt).toLocaleDateString() : 'Not recorded'}</dd></div>
        <div><dt className="font-medium">Submitted</dt><dd>{application.submittedAt ? new Date(application.submittedAt).toLocaleDateString() : 'Not recorded'}</dd></div>
        <div><dt className="font-medium">Outcome</dt><dd>{label(application.outcome) || 'Not recorded'}</dd></div>
        <div><dt className="font-medium">Status authority</dt><dd>Provider-maintained in STRIDETO</dd></div>
      </dl>
      <p className={`mt-3 ${ui.warning}`}>This status is Provider-attested. It is not an official institution acknowledgment or decision.</p>
      {application.statusHistory?.length ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">Application history</summary>
          <ol className="mt-2 space-y-1">
            {application.statusHistory.map((entry) => <li key={entry.id}>{label(entry.to)} · {new Date(entry.occurredAt).toLocaleString()}</li>)}
          </ol>
        </details>
      ) : null}
      {!disabled && transitions[application.status]?.length ? (
        <form onSubmit={update} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Next application status
            <select className={ui.input} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Keep current status</option>
              {transitions[application.status].map((value) => <option key={value} value={value}>{label(value)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Known deadline
            <input className={ui.input} type="date" value={deadlineAt} onChange={(e) => setDeadlineAt(e.target.value)} />
          </label>
          {status === 'provider_attested_submitted' ? (
            <label className="text-sm font-medium">Submission method
              <select className={ui.input} value={submissionMethod} onChange={(e) => setSubmissionMethod(e.target.value)}>
                <option value="agent_assisted_external">Provider-assisted external submission</option>
                <option value="student_self_submitted">Student self-submitted</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
          ) : null}
          <label className="text-sm font-medium">Status note
            <input className={ui.input} maxLength={500} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
          </label>
          {error ? <p className={`${ui.error} sm:col-span-2`} role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button disabled={busy} className={ui.primaryBtn}>Save application</button>
            {application.status === 'ready_for_submission' ? (
              <button type="button" disabled={busy} className={ui.secondaryBtn} onClick={() => requestSubmissionApproval(application.id)}>Request Student submission approval</button>
            ) : null}
          </div>
        </form>
      ) : null}
    </article>
  );
}

export default function ProviderCaseApplications({ caseId, applications, lifecycle, reload, requestSubmissionApproval, pagination, onPageChange }) {
  const [institutions, setInstitutions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [mode, setMode] = useState('catalog');
  const [form, setForm] = useState({ institutionId: '', programId: '', intakeCycleLabel: '', institutionName: '', programName: '', destinationCountry: '', deadlineAt: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mutable = ['active', 'paused', 'closing'].includes(lifecycle);
  useEffect(() => {
    agentApi.listCaseCatalogInstitutions({ limit: 50 }).then((r) => setInstitutions(r.data.data || [])).catch(() => setInstitutions([]));
  }, []);
  useEffect(() => {
    if (!form.institutionId) { setPrograms([]); return; }
    agentApi.listCaseCatalogPrograms({ institutionId: form.institutionId, limit: 50 }).then((r) => setPrograms(r.data.data || [])).catch(() => setPrograms([]));
  }, [form.institutionId]);
  const selectedProgram = useMemo(() => programs.find((row) => String(row._id) === form.programId), [form.programId, programs]);
  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = mode === 'catalog'
        ? { institutionId: form.institutionId, programId: form.programId || null, intakeCycleLabel: form.intakeCycleLabel, deadlineAt: form.deadlineAt || null }
        : { institutionName: form.institutionName, programName: form.programName, intakeCycleLabel: form.intakeCycleLabel, destinationCountry: form.destinationCountry, deadlineAt: form.deadlineAt || null };
      await agentApi.createCaseApplication(caseId, payload, crypto.randomUUID());
      setForm({ institutionId: '', programId: '', intakeCycleLabel: '', institutionName: '', programName: '', destinationCountry: '', deadlineAt: '' });
      await reload();
    } catch (e) {
      setError(e.response?.data?.error || 'Application creation failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={`${ui.card} p-5`} aria-labelledby="case-applications-heading">
      <h2 id="case-applications-heading" className="text-lg font-semibold">Education applications</h2>
      <p className={`mt-1 ${ui.muted}`}>A Case may have zero or many applications. All statuses below are Provider-maintained unless supported by separate institution evidence.</p>
      <div className="mt-4 space-y-4">
        {applications.length ? applications.map((application) => (
          <ApplicationCard key={application.id} application={application} caseId={caseId} reload={reload} requestSubmissionApproval={requestSubmissionApproval} disabled={!mutable} />
        )) : <p className={ui.muted}>No applications recorded. This is valid for guidance-only Cases.</p>}
      </div>
      <CaseSectionPagination metadata={pagination} onPageChange={onPageChange} label="Education applications" />
      {mutable ? (
        <form onSubmit={create} className="mt-6 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50">
          <h3 className="font-semibold">Add application</h3>
          <fieldset className="mt-3 flex flex-wrap gap-4">
            <legend className="sr-only">Institution source</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={mode === 'catalog'} onChange={() => setMode('catalog')} /> STRIDETO catalog</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={mode === 'external'} onChange={() => setMode('external')} /> External institution snapshot</label>
          </fieldset>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {mode === 'catalog' ? (
              <>
                <label className="text-sm font-medium">Institution
                  <select required className={ui.input} value={form.institutionId} onChange={(e) => setForm((old) => ({ ...old, institutionId: e.target.value, programId: '', intakeCycleLabel: '' }))}>
                    <option value="">Select institution</option>
                    {institutions.map((row) => <option key={row._id} value={row._id}>{row.officialName}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium">Program (optional)
                  <select className={ui.input} value={form.programId} onChange={(e) => setForm((old) => ({ ...old, programId: e.target.value, intakeCycleLabel: '' }))}>
                    <option value="">Not recorded</option>
                    {programs.map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className="text-sm font-medium">Institution name<input required className={ui.input} maxLength={250} value={form.institutionName} onChange={(e) => setForm((old) => ({ ...old, institutionName: e.target.value }))} /></label>
                <label className="text-sm font-medium">Program name (optional)<input className={ui.input} maxLength={250} value={form.programName} onChange={(e) => setForm((old) => ({ ...old, programName: e.target.value }))} /></label>
                <label className="text-sm font-medium">Destination country code<input required className={ui.input} maxLength={2} value={form.destinationCountry} onChange={(e) => setForm((old) => ({ ...old, destinationCountry: e.target.value.toUpperCase() }))} /></label>
              </>
            )}
            <label className="text-sm font-medium">Intake (optional)
              {mode === 'catalog' && selectedProgram?.intakes?.length ? (
                <select className={ui.input} value={form.intakeCycleLabel} onChange={(e) => setForm((old) => ({ ...old, intakeCycleLabel: e.target.value }))}>
                  <option value="">Not recorded</option>
                  {selectedProgram.intakes.map((row) => <option key={`${row.cycleLabel}-${row.startDate}`} value={row.cycleLabel}>{row.cycleLabel}</option>)}
                </select>
              ) : <input className={ui.input} maxLength={150} value={form.intakeCycleLabel} onChange={(e) => setForm((old) => ({ ...old, intakeCycleLabel: e.target.value }))} />}
            </label>
            <label className="text-sm font-medium">Known deadline<input className={ui.input} type="date" value={form.deadlineAt} onChange={(e) => setForm((old) => ({ ...old, deadlineAt: e.target.value }))} /></label>
          </div>
          {error ? <p className={`mt-3 ${ui.error}`} role="alert">{error}</p> : null}
          <button disabled={busy} className={`mt-3 ${ui.primaryBtn}`}>Add application</button>
        </form>
      ) : null}
    </section>
  );
}
