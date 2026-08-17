import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import MessageThread from '../../components/consultations/MessageThread';
import ProviderCaseApplications from '../../components/cases/ProviderCaseApplications';
import CaseSectionPagination from '../../components/cases/CaseSectionPagination';
import { ui } from '../../design-system/surfaceClasses';

const label = (value) => (value || '').replaceAll('_', ' ');

export default function AgentCaseDetail() {
  const { caseId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [task, setTask] = useState({ title: '', responsibleActor: 'student', dueAt: '' });
  const [note, setNote] = useState({ body: '', visibility: 'shared' });
  const [documentRequest, setDocumentRequest] = useState({ documentType: '', purpose: '', dueAt: '' });
  const [submissionMethod, setSubmissionMethod] = useState('agent_assisted_external');
  const [caseOutcome, setCaseOutcome] = useState({ outcome: 'unknown', externalResult: '' });
  const [resolvedDocuments, setResolvedDocuments] = useState({});
  const [childPages, setChildPages] = useState({ applications: 1, tasks: 1, documentRequests: 1, timeline: 1, notes: 1, approvals: 1 });
  const [taskStatus, setTaskStatus] = useState('open');

  const receiveCase = (payload) => {
    setData(payload);
    setChildPages((current) => {
      let changed = false;
      const next = { ...current };
      Object.entries(payload.childPagination || {}).forEach(([key, metadata]) => {
        if (current[key] > metadata.totalPages) { next[key] = metadata.totalPages; changed = true; }
      });
      return changed ? next : current;
    });
  };
  const load = () => agentApi.getCase(caseId, {
    ...Object.fromEntries(Object.entries(childPages).map(([key, value]) => [`${key}Page`, value])),
    taskStatus,
  }).then((response) => receiveCase(response.data));
  useEffect(() => { load().catch((e) => setError(e.response?.data?.error || 'Unable to load Case.')); }, [caseId, childPages, taskStatus]); // eslint-disable-line react-hooks/exhaustive-deps
  const setChildPage = (key, page) => setChildPages((current) => ({ ...current, [key]: page }));

  const act = async (operation, success = 'Case updated.') => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
      await load();
      setNotice(success);
    } catch (e) {
      setError(e.response?.data?.error || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="space-y-3"><h1 className="text-2xl font-semibold">Case details</h1><p className={ui.muted} role="status">{error || 'Loading Case…'}</p></div>;
  const c = data.case;
  const mutable = ['active', 'paused', 'closing'].includes(c.lifecycle);
  const nextStages = data.workflow?.transitions?.[c.currentStage] || [];
  const requestApproval = (actionType, explanation, proposedAction = {}) => act(
    () => agentApi.requestCaseApproval(caseId, { actionType, explanation, proposedAction }),
    'Student approval requested.'
  );

  return (
    <div className="min-w-0 space-y-5">
      <header>
        <p className="text-sm font-medium uppercase text-blue-700 dark:text-blue-300">Education professional Case</p>
        <h1 className="break-words text-2xl font-semibold text-gray-900 dark:text-white">{c.title}</h1>
        <p className={ui.muted}>{label(c.lifecycle)} · {label(c.currentStage)}</p>
      </header>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">{notice}</p> : null}

      <section className={`${ui.card} grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4`} aria-labelledby="case-overview-heading">
        <h2 id="case-overview-heading" className="sr-only">Case overview</h2>
        <div><p className="text-xs font-medium uppercase text-slate-500">Student</p><p className="break-words font-medium">{data.context?.student?.name || 'Student'}</p><p className={`break-all ${ui.muted}`}>{data.context?.student?.email || ''}</p></div>
        <div><p className="text-xs font-medium uppercase text-slate-500">Education service</p><p className="font-medium">{data.context?.service?.title || 'Service unavailable'}</p><p className={ui.muted}>{label(data.context?.service?.category)}</p></div>
        <div><p className="text-xs font-medium uppercase text-slate-500">Case type</p><p className="font-medium">{label(c.caseType)}</p><p className={ui.muted}>{c.destinationCountry || 'No destination recorded'}</p></div>
        <div><p className="text-xs font-medium uppercase text-slate-500">Next stage</p><p className="font-medium">{nextStages.length ? label(nextStages[0]) : 'No further stage'}</p></div>
      </section>

      <ProviderCaseApplications
        caseId={caseId}
        applications={data.applications || []}
        lifecycle={c.lifecycle}
        reload={load}
        pagination={data.childPagination?.applications}
        onPageChange={(page) => setChildPage('applications', page)}
        requestSubmissionApproval={(applicationId) => requestApproval('external_submission', 'Approve this application for an external submission step. STRIDETO does not submit to the institution.', { applicationId })}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={`${ui.card} p-5`} aria-labelledby="workflow-heading">
          <h2 id="workflow-heading" className="text-lg font-semibold">Case workflow</h2>
          <p className={`mt-1 ${ui.muted}`}>Workflow v{c.workflowVersion}: {data.workflow?.stages?.map(label).join(' → ')}</p>
          {mutable && nextStages.length ? <div className="mt-3 space-y-3">
            {nextStages[0] === 'submitted_external' ? <label className="block text-sm font-medium">Truthful submission method<select className={ui.input} value={submissionMethod} onChange={(e) => setSubmissionMethod(e.target.value)}><option value="agent_assisted_external">Provider-assisted external submission</option><option value="student_self_submitted">Student self-submitted</option><option value="unknown">Unknown</option></select></label> : null}
            <div className="flex flex-wrap gap-2">
              <button disabled={busy || c.lifecycle !== 'active'} onClick={() => act(() => agentApi.updateCaseStage(caseId, { stage: nextStages[0], ...(nextStages[0] === 'submitted_external' ? { submissionMethod } : {}) }))} className={ui.primaryBtn}>Move to {label(nextStages[0])}</button>
              {nextStages[0] === 'submitted_external' ? <button disabled={busy} className={ui.secondaryBtn} onClick={() => requestApproval('external_submission', 'Approve recording the externally submitted Case stage. STRIDETO is not the submitting institution.')}>Request submission approval</button> : null}
            </div>
          </div> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {c.lifecycle === 'active' ? <button disabled={busy} className={ui.secondaryBtn} onClick={() => act(() => agentApi.updateCaseLifecycle(caseId, { lifecycle: 'paused' }))}>Pause Case</button> : null}
            {c.lifecycle === 'paused' ? <button disabled={busy} className={ui.secondaryBtn} onClick={() => act(() => agentApi.updateCaseLifecycle(caseId, { lifecycle: 'active' }))}>Resume Case</button> : null}
            {['active', 'paused'].includes(c.lifecycle) ? <button disabled={busy} className={ui.secondaryBtn} onClick={() => act(() => agentApi.updateCaseLifecycle(caseId, { lifecycle: 'closing' }))}>Move to closing</button> : null}
            {c.lifecycle === 'closing' ? <button disabled={busy} className={ui.secondaryBtn} onClick={() => requestApproval('case_closure', 'Approve completion of this professional Case.')}>Request completion approval</button> : null}
            {c.lifecycle === 'closing' ? <button disabled={busy} className={ui.primaryBtn} onClick={() => act(() => agentApi.updateCaseLifecycle(caseId, { lifecycle: 'completed' }), 'Case completed.')}>Complete approved Case</button> : null}
          </div>
          {mutable ? <form className="mt-5 grid gap-3" onSubmit={(event) => { event.preventDefault(); void act(() => agentApi.recordCaseOutcome(caseId, caseOutcome), 'Case outcome recorded.'); }}><h3 className="font-semibold">Case outcome</h3><label className="text-sm font-medium">Outcome<select className={ui.input} value={caseOutcome.outcome} onChange={(e) => setCaseOutcome((old) => ({ ...old, outcome: e.target.value }))}>{['successful', 'unsuccessful', 'withdrawn', 'cancelled', 'transferred', 'other', 'unknown'].map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><label className="text-sm font-medium">External result note<input className={ui.input} maxLength={200} value={caseOutcome.externalResult} onChange={(e) => setCaseOutcome((old) => ({ ...old, externalResult: e.target.value }))} /></label><button disabled={busy} className={ui.secondaryBtn}>Record outcome</button></form> : null}
        </section>

        <section className={`${ui.card} p-5`} aria-labelledby="tasks-heading">
          <h2 id="tasks-heading" className="text-lg font-semibold">Tasks and next actions</h2>
          <label className="mt-3 block max-w-xs text-sm font-medium">Task status
            <select className={ui.input} value={taskStatus} onChange={(event) => { setTaskStatus(event.target.value); setChildPage('tasks', 1); }}>
              <option value="open">Open tasks</option><option value="">All tasks</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
            </select>
          </label>
          <div className="mt-3 space-y-2">
            {(data.tasks || []).map((row) => (
              <article key={row.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
                <p className="font-medium">{row.title}</p>
                <p>{label(row.status)} · owned by {row.responsibleActor}{row.dueAt ? ` · due ${new Date(row.dueAt).toLocaleDateString()}` : ''}</p>
                {row.responsibleActor === 'agent' && ['pending', 'in_progress'].includes(row.status) ? <button disabled={busy} className={`mt-2 ${ui.link}`} onClick={() => act(() => agentApi.completeCaseTask(caseId, row.id), 'Provider task completed.')}>Mark Provider task complete</button> : null}
              </article>
            ))}
          </div>
          <CaseSectionPagination metadata={data.childPagination?.tasks} onPageChange={(page) => setChildPage('tasks', page)} label="Case tasks" />
          {mutable ? (
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void act(() => agentApi.createCaseTask(caseId, { ...task, dueAt: task.dueAt || null }), 'Task created.').then(() => setTask({ title: '', responsibleActor: 'student', dueAt: '' })); }}>
              <label className="text-sm font-medium sm:col-span-2">Task title<input required className={ui.input} maxLength={200} value={task.title} onChange={(e) => setTask((old) => ({ ...old, title: e.target.value }))} /></label>
              <label className="text-sm font-medium">Responsible party<select className={ui.input} value={task.responsibleActor} onChange={(e) => setTask((old) => ({ ...old, responsibleActor: e.target.value }))}><option value="student">Student</option><option value="agent">Provider</option></select></label>
              <label className="text-sm font-medium">Due date<input type="date" className={ui.input} value={task.dueAt} onChange={(e) => setTask((old) => ({ ...old, dueAt: e.target.value }))} /></label>
              <button disabled={busy} className={ui.primaryBtn}>Create task</button>
            </form>
          ) : null}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={`${ui.card} p-5`} aria-labelledby="documents-heading">
          <h2 id="documents-heading" className="text-lg font-semibold">Case documents</h2>
          <p className={`mt-1 ${ui.muted}`}>Only exact documents granted by this Student for this Case can be resolved. The Student’s Vault is never listed here.</p>
          <div className="mt-3 space-y-2">
            {(data.documentRequests || []).map((row) => (
              <article key={row.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
                <p className="font-medium">{row.documentType} · {label(row.status)}</p><p>{row.purpose}</p>
                {row.status === 'shared' ? <button disabled={busy} className={`mt-2 ${ui.link}`} onClick={() => act(async () => { const response = await agentApi.resolveCaseDocument(caseId, row.id); setResolvedDocuments((old) => ({ ...old, [row.id]: response.data })); }, 'Exact granted document verified.')}>Verify granted document</button> : null}
                {resolvedDocuments[row.id] ? <p className="mt-2 rounded bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Access granted: {resolvedDocuments[row.id].name}</p> : null}
              </article>
            ))}
          </div>
          <CaseSectionPagination metadata={data.childPagination?.documentRequests} onPageChange={(page) => setChildPage('documentRequests', page)} label="Case document requests" />
          {mutable ? (
            <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); void act(() => agentApi.requestCaseDocument(caseId, { ...documentRequest, dueAt: documentRequest.dueAt || null }), 'Document requested.').then(() => setDocumentRequest({ documentType: '', purpose: '', dueAt: '' })); }}>
              <label className="text-sm font-medium">Document type<input required className={ui.input} maxLength={100} value={documentRequest.documentType} onChange={(e) => setDocumentRequest((old) => ({ ...old, documentType: e.target.value }))} /></label>
              <label className="text-sm font-medium">Purpose<input required className={ui.input} maxLength={500} value={documentRequest.purpose} onChange={(e) => setDocumentRequest((old) => ({ ...old, purpose: e.target.value }))} /></label>
              <label className="text-sm font-medium">Due date<input type="date" className={ui.input} value={documentRequest.dueAt} onChange={(e) => setDocumentRequest((old) => ({ ...old, dueAt: e.target.value }))} /></label>
              <button disabled={busy} className={ui.primaryBtn}>Request exact document</button>
            </form>
          ) : null}
        </section>

        <section className={`${ui.card} p-5`} aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="text-lg font-semibold">Case notes</h2>
          <div className="mt-3 space-y-2">
            {(data.notes || []).map((row) => <article key={row.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700"><p className="font-medium">{row.visibility === 'agent_private' ? 'Provider internal note' : 'Student-visible note'}</p><p className="whitespace-pre-wrap">{row.body}</p></article>)}
          </div>
          <CaseSectionPagination metadata={data.childPagination?.notes} onPageChange={(page) => setChildPage('notes', page)} label="Case notes" />
          {mutable ? (
            <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); void act(() => agentApi.addCaseNote(caseId, note), 'Note added.').then(() => setNote({ body: '', visibility: 'shared' })); }}>
              <label className="text-sm font-medium">Visibility<select className={ui.input} value={note.visibility} onChange={(e) => setNote((old) => ({ ...old, visibility: e.target.value }))}><option value="shared">Student-visible</option><option value="agent_private">Provider internal only</option></select></label>
              <label className="text-sm font-medium">Note<textarea required className={ui.input} rows={3} maxLength={4000} value={note.body} onChange={(e) => setNote((old) => ({ ...old, body: e.target.value }))} /></label>
              <button disabled={busy} className={ui.primaryBtn}>Add note</button>
            </form>
          ) : null}
        </section>
      </div>

      <section className={`${ui.card} p-5`} aria-labelledby="approvals-heading">
        <h2 id="approvals-heading" className="text-lg font-semibold">Student approvals</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(data.approvals || []).map((row) => <article key={row.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700"><p className="font-medium">{label(row.actionType)} · {label(row.status)}</p><p>{row.explanation}</p></article>)}
        </div>
        <CaseSectionPagination metadata={data.childPagination?.approvals} onPageChange={(page) => setChildPage('approvals', page)} label="Student approvals" />
      </section>

      {data.threadId ? (
        <MessageThread
          threadId={caseId}
          loadMessages={(id) => agentApi.getCaseMessages(id)}
          sendMessage={(id, payload) => agentApi.sendCaseMessage(id, { text: payload.text })}
          title="Case messages"
          description="This private thread is bound only to this professional Case, Student, and authorized Education Provider subject. It is separate from the consultation thread."
          placeholder="Write a Case message"
          readOnly={data.messagingStatus !== 'open'}
        />
      ) : null}

      <section className={`${ui.card} p-5`} aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="text-lg font-semibold">Case activity timeline</h2>
        <ol className="mt-3 space-y-2">
          {(data.timeline || []).map((entry) => <li key={entry.id} className="border-s-2 border-gray-200 ps-3 text-sm dark:border-gray-600"><p className="font-medium">{label(entry.eventType)}</p><p className={ui.muted}>{new Date(entry.createdAt).toLocaleString()}</p></li>)}
        </ol>
        <CaseSectionPagination metadata={data.childPagination?.timeline} onPageChange={(page) => setChildPage('timeline', page)} label="Case activity timeline" />
      </section>
    </div>
  );
}
