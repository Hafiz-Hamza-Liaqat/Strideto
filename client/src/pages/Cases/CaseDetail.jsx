/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { studentCaseApi, studentTrustApi } from '../../services/agentService';
import { vaultApi } from '../../services/vaultApi';
import MessageThread from '../../components/consultations/MessageThread';
import CaseSectionPagination from '../../components/cases/CaseSectionPagination';
import { ui } from '../../design-system/surfaceClasses';

const label = (value) => (value || '').replaceAll('_', ' ');

export default function CaseDetail() {
  const { caseId } = useParams();
  const [data, setData] = useState(null);
  const [vaultDocuments, setVaultDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState({});
  const [reviewEligibility, setReviewEligibility] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
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
  const load = () => studentCaseApi.get(caseId, {
    ...Object.fromEntries(Object.entries(childPages).map(([key, value]) => [`${key}Page`, value])),
    taskStatus,
  }).then((response) => receiveCase(response.data));
  const setChildPage = (key, page) => setChildPages((current) => ({ ...current, [key]: page }));
  useEffect(() => {
    void load().catch((e) => setError(e.response?.data?.error || 'Unable to load Case.'));
  }, [caseId, childPages, taskStatus]);
  useEffect(() => {
    void vaultApi.list({ status: 'active', limit: 50 }).then((response) => setVaultDocuments(response.data.items || [])).catch(() => setVaultDocuments([]));
  }, [caseId]);
  useEffect(() => {
    if (data?.case?.lifecycle !== 'completed') { setReviewEligibility(null); return; }
    studentTrustApi.eligibility('professional_case', caseId).then((response) => setReviewEligibility(response.data)).catch(() => setReviewEligibility({ eligible: false }));
  }, [data?.case?.lifecycle, caseId]);
  const act = async (operation, success = 'Case updated.') => {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); await load(); setNotice(success); }
    catch (e) { setError(e.response?.data?.error || 'Action failed.'); }
    finally { setBusy(false); }
  };
  const trustLink = (action) => `/trust-center?action=${action}&contextType=professional_case&contextId=${encodeURIComponent(caseId)}`;
  const nextActions = useMemo(() => ({
    student: (data?.tasks || []).filter((row) => row.responsibleActor === 'student' && ['pending', 'in_progress'].includes(row.status)),
    provider: (data?.tasks || []).filter((row) => row.responsibleActor === 'agent' && ['pending', 'in_progress'].includes(row.status)),
  }), [data?.tasks]);
  if (!data) return <div className="mx-auto max-w-5xl space-y-3 p-8"><h1 className={ui.h1}>Case details</h1><p className={ui.muted} role="status">{error || 'Loading Case…'}</p></div>;
  const c = data.case;
  return (
    <div className={`mx-auto max-w-6xl space-y-5 px-4 py-10 ${ui.page}`}>
      <header>
        <p className="text-sm font-medium uppercase text-blue-700 dark:text-blue-300">{label(c.caseType)} professional Case</p>
        <h1 className={ui.h1}>{c.title}</h1>
        <p className={`mt-2 ${ui.muted}`}>{label(c.lifecycle)} · {label(c.currentStage)}</p>
      </header>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">{notice}</p> : null}

      {c.lifecycle === 'awaiting_student_acceptance' ? (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950/40">
          <h2 className="font-semibold">Your consent is required</h2>
          <p className={`mt-1 ${ui.muted}`}>Accepting starts this professional Case after the completed consultation. It does not grant automatic Vault access.</p>
          <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={() => act(() => studentCaseApi.decideProposal(caseId, 'accept'), 'Case accepted.')} className={ui.primaryBtn}>Accept Case</button><button disabled={busy} onClick={() => act(() => studentCaseApi.decideProposal(caseId, 'reject'), 'Case declined.')} className={ui.secondaryBtn}>Decline</button></div>
        </section>
      ) : null}

      <section className={`${ui.card} grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4`} aria-labelledby="student-case-overview">
        <h2 id="student-case-overview" className="sr-only">Case overview</h2>
        <div><p className="text-xs font-medium uppercase text-slate-500">Provider</p><p className="font-medium">{data.context?.provider?.name || 'Education Provider'}</p><p className={ui.muted}>{label(data.context?.provider?.type)}</p></div>
        <div><p className="text-xs font-medium uppercase text-slate-500">Education service</p><p className="font-medium">{data.context?.service?.title || 'Service unavailable'}</p><p className={ui.muted}>{label(data.context?.service?.category)}</p></div>
        <div><p className="text-xs font-medium uppercase text-slate-500">My next action</p><p className="font-medium">{nextActions.student[0]?.title || 'No pending Student task'}</p></div>
        <div><p className="text-xs font-medium uppercase text-slate-500">Provider next action</p><p className="font-medium">{nextActions.provider[0]?.title || 'No pending Provider task'}</p></div>
      </section>

      <section className={`${ui.card} p-5`} aria-labelledby="student-applications-heading">
        <h2 id="student-applications-heading" className="text-lg font-semibold">Applications in this Case</h2>
        <p className={`mt-1 ${ui.muted}`}>These are Provider-maintained STRIDETO workflow records, not official institution acknowledgments or decisions.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {(data.applications || []).length ? data.applications.map((application) => (
            <article key={application.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{application.institution?.officialName}</h3><p className={ui.muted}>{application.program?.name || 'Program not recorded'} · {application.intake?.cycleLabel || 'Intake not recorded'}</p></div><span className={ui.badge}>{label(application.status)}</span></div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="font-medium">Destination</dt><dd>{application.destinationCountry || 'Not recorded'}</dd></div><div><dt className="font-medium">Deadline</dt><dd>{application.deadlineAt ? new Date(application.deadlineAt).toLocaleDateString() : 'Not recorded'}</dd></div><div><dt className="font-medium">Submitted</dt><dd>{application.submittedAt ? new Date(application.submittedAt).toLocaleDateString() : 'Not recorded'}</dd></div><div><dt className="font-medium">Provider-recorded outcome</dt><dd>{label(application.outcome) || 'Not recorded'}</dd></div></dl>
              {application.statusHistory?.length ? <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Application history</summary><ol className="mt-2 space-y-1">{application.statusHistory.map((entry) => <li key={entry.id}>{label(entry.to)} · {new Date(entry.occurredAt).toLocaleString()}</li>)}</ol></details> : null}
            </article>
          )) : <p className={ui.muted}>No applications are recorded. Some guidance Cases do not require applications.</p>}
        </div>
        <CaseSectionPagination metadata={data.childPagination?.applications} onPageChange={(page) => setChildPage('applications', page)} label="Applications in this Case" />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${ui.card} p-5`} aria-labelledby="student-tasks-heading">
          <h2 id="student-tasks-heading" className="text-lg font-semibold">Tasks and deadlines</h2>
          <label className="mt-3 block text-sm font-medium">Task status<select className={ui.input} value={taskStatus} onChange={(event) => { setTaskStatus(event.target.value); setChildPage('tasks', 1); }}><option value="open">Open tasks</option><option value="">All tasks</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
          <div className="mt-3 space-y-3">{(data.tasks || []).length ? data.tasks.map((task) => <article key={task.id} className="rounded border border-gray-200 p-3 text-sm dark:border-gray-700"><p className="font-medium">{task.title}</p><p>{label(task.status)} · owned by {task.responsibleActor}{task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : ''}</p>{task.responsibleActor === 'student' && ['pending', 'in_progress'].includes(task.status) ? <button disabled={busy} onClick={() => act(() => studentCaseApi.completeTask(caseId, task.id), 'Student task completed.')} className={`mt-2 min-h-[44px] ${ui.link}`}>Mark my task complete</button> : null}</article>) : <p className={ui.muted}>No tasks recorded.</p>}</div>
          <CaseSectionPagination metadata={data.childPagination?.tasks} onPageChange={(page) => setChildPage('tasks', page)} label="Case tasks" />
        </section>
        <section className={`${ui.card} p-5`} aria-labelledby="student-approvals-heading">
          <h2 id="student-approvals-heading" className="text-lg font-semibold">Your approvals</h2>
          <div className="mt-3 space-y-3">{(data.approvals || []).length ? data.approvals.map((approval) => <article key={approval.id} className="rounded border border-gray-200 p-3 text-sm dark:border-gray-700"><p className="font-medium">{label(approval.actionType)}</p><p>{approval.explanation}</p><p>Status: {label(approval.status)}</p>{approval.status === 'pending' ? <div className="mt-2 flex flex-wrap gap-2"><button disabled={busy} onClick={() => act(() => studentCaseApi.decideApproval(caseId, approval.id, 'approve'), 'Approval recorded.')} className={ui.primaryBtn}>Approve</button><button disabled={busy} onClick={() => act(() => studentCaseApi.decideApproval(caseId, approval.id, 'reject'), 'Rejection recorded.')} className={ui.secondaryBtn}>Reject</button></div> : null}</article>) : <p className={ui.muted}>No approval requests.</p>}</div>
          <CaseSectionPagination metadata={data.childPagination?.approvals} onPageChange={(page) => setChildPage('approvals', page)} label="Case approvals" />
        </section>
      </div>

      <section className={`${ui.card} p-5`} aria-labelledby="student-documents-heading">
        <h2 id="student-documents-heading" className="text-lg font-semibold">Case document sharing</h2>
        <p className={`mt-1 ${ui.muted}`}>Sharing creates access to one exact Vault document for this Case and assigned Provider membership. It never exposes your full Vault.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {(data.documentRequests || []).length ? data.documentRequests.map((request) => (
            <article key={request.id} className="rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-700">
              <h3 className="font-semibold">{request.documentType} · {label(request.status)}</h3><p>{request.purpose}</p>{request.dueAt ? <p>Due {new Date(request.dueAt).toLocaleDateString()}</p> : null}
              {['requested', 'available', 'revoked'].includes(request.status) ? <div className="mt-3 grid gap-2"><label className="font-medium">Exact Vault document<select className={ui.input} value={selectedDocuments[request.id] || ''} onChange={(e) => setSelectedDocuments((old) => ({ ...old, [request.id]: e.target.value }))}><option value="">Select one document</option>{vaultDocuments.map((document) => <option key={document._id} value={document._id}>{document.displayName || document.title || document.documentType}</option>)}</select></label><button disabled={busy || !selectedDocuments[request.id]} className={ui.primaryBtn} onClick={() => act(() => studentCaseApi.shareDocument(caseId, request.id, selectedDocuments[request.id]), 'Exact document shared.')}>Share exact document</button></div> : null}
              {request.status === 'shared' ? <button disabled={busy} className={`mt-3 ${ui.secondaryBtn}`} onClick={() => act(() => studentCaseApi.revokeDocument(caseId, request.id), 'Document access revoked.')}>Revoke this document share</button> : null}
            </article>
          )) : <p className={ui.muted}>No document requests.</p>}
        </div>
        <CaseSectionPagination metadata={data.childPagination?.documentRequests} onPageChange={(page) => setChildPage('documentRequests', page)} label="Case document requests" />
      </section>

      {data.threadId ? <MessageThread threadId={caseId} loadMessages={(id) => studentCaseApi.getMessages(id)} sendMessage={(id, payload) => studentCaseApi.sendMessage(id, payload.text)} title="Case messages" description="This private thread is bound only to this professional Case and is separate from your consultation messages." placeholder="Write a Case message" readOnly={data.messagingStatus !== 'open'} /> : null}

      {(data.notes || []).length ? <section className={`${ui.card} p-5`} aria-labelledby="student-notes-heading"><h2 id="student-notes-heading" className="text-lg font-semibold">Provider notes shared with you</h2><div className="mt-3 space-y-2">{data.notes.map((note) => <article key={note.id} className="rounded border border-gray-200 p-3 text-sm dark:border-gray-700"><p className="whitespace-pre-wrap">{note.body}</p></article>)}</div><CaseSectionPagination metadata={data.childPagination?.notes} onPageChange={(page) => setChildPage('notes', page)} label="Shared Case notes" /></section> : null}

      <section className={`${ui.card} p-5`} aria-labelledby="student-timeline-heading"><h2 id="student-timeline-heading" className="text-lg font-semibold">Case activity timeline</h2><ol className="mt-3 space-y-2">{(data.timeline || []).map((entry) => <li key={entry.id} className="border-s-2 border-gray-200 ps-3 text-sm dark:border-gray-600"><p className="font-medium">{label(entry.eventType)}</p><p className={ui.muted}>{new Date(entry.createdAt).toLocaleString()}</p></li>)}</ol><CaseSectionPagination metadata={data.childPagination?.timeline} onPageChange={(page) => setChildPage('timeline', page)} label="Case activity timeline" /></section>

      <section className={`${ui.card} p-5`} aria-labelledby="case-trust-actions"><h2 id="case-trust-actions" className="text-lg font-semibold">Review, report, or dispute</h2><p className={`mt-1 ${ui.muted}`}>Reviews require a completed verified interaction. Reports are private allegations for moderation. Professional disputes are not payment disputes.</p><div className="mt-3 flex flex-wrap gap-2">{reviewEligibility?.eligible ? <Link className={ui.primaryBtn} to={trustLink('review')}>Review completed Case</Link> : null}<Link className={ui.secondaryBtn} to={trustLink('report')}>Report this Case</Link>{c.lifecycle === 'completed' ? <Link className={ui.secondaryBtn} to={trustLink('dispute')}>Open professional dispute</Link> : null}<Link className={ui.link} to="/trust-center">View Trust Center history</Link></div>{c.lifecycle === 'completed' && reviewEligibility && !reviewEligibility.eligible ? <p className={`mt-3 ${ui.muted}`}>Review unavailable: {reviewEligibility.reason || 'not eligible'}.</p> : null}</section>

      {['active', 'paused'].includes(c.lifecycle) ? <button disabled={busy} onClick={() => act(() => studentCaseApi.updateLifecycle(caseId, 'closing'), 'Case moved to closing.')} className="min-h-[44px] rounded border border-red-300 px-4 py-2 text-red-700 dark:border-red-700 dark:text-red-400">Request Case closure</button> : null}
    </div>
  );
}
