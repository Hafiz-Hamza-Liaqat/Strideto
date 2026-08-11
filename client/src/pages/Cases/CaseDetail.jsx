/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { studentCaseApi } from '../../services/agentService';
import { ui } from '../../design-system/surfaceClasses';

const label = (v) => (v || '').replaceAll('_', ' ');

export default function CaseDetail() {
  const { caseId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => studentCaseApi.get(caseId).then((r) => setData(r.data)).catch((e) => setError(e.response?.data?.error || 'Unable to load case.'));
  useEffect(() => { void load(); }, [caseId]);
  const act = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };
  if (!data) {
    return <div className={`mx-auto max-w-5xl p-8 ${ui.muted}`} role="status">{error || 'Loading case…'}</div>;
  }
  const c = data.case;
  return (
    <div className={`mx-auto max-w-5xl space-y-5 px-4 py-10 ${ui.page}`}>
      <header>
        <p className="text-sm uppercase text-blue-700 dark:text-blue-300">{label(c.caseType)} case</p>
        <h1 className={`${ui.h1} break-words`}>{c.title}</h1>
        <p className={`mt-2 ${ui.muted}`}>{label(c.lifecycle)} · {label(c.currentStage)}</p>
      </header>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      {c.lifecycle === 'awaiting_student_acceptance' ? (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950/40">
          <h2 className="font-semibold text-gray-900 dark:text-white">Your consent is required</h2>
          <p className={`mt-1 ${ui.muted}`}>Accepting starts this professional case. The Agent receives no automatic Vault access.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => act(() => studentCaseApi.decideProposal(caseId, 'accept'))} className={ui.primaryBtn}>Accept</button>
            <button disabled={busy} onClick={() => act(() => studentCaseApi.decideProposal(caseId, 'reject'))} className={ui.secondaryBtn}>Reject</button>
          </div>
        </section>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${ui.card} p-5`}>
          <h2 className="font-semibold">Tasks and document requests</h2>
          {data.tasks.length === 0 && data.documentRequests.length === 0 ? (
            <p className={`mt-3 ${ui.muted}`}>Nothing requested.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {data.tasks.map((t) => (
                <div key={t._id} className="rounded border border-gray-200 p-3 text-sm dark:border-gray-700">
                  <b>{t.title}</b>
                  <p>{label(t.status)} · owned by {t.responsibleActor}</p>
                  {t.responsibleActor === 'student' && t.status !== 'completed' ? (
                    <button onClick={() => act(() => studentCaseApi.completeTask(caseId, t._id))} className={`mt-2 min-h-[44px] ${ui.link}`}>Mark complete</button>
                  ) : null}
                </div>
              ))}
              {data.documentRequests.map((d) => (
                <div key={d._id} className="rounded border border-gray-200 p-3 text-sm dark:border-gray-700">
                  <b>{d.documentType}</b>
                  <p>{d.purpose} · {label(d.status)}</p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">A request never grants access. Share one exact Vault document separately.</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className={`${ui.card} p-5`}>
          <h2 className="font-semibold">Student approvals</h2>
          <div className="mt-3 space-y-3">
            {data.approvals.length === 0 ? (
              <p className={ui.muted}>No approval requests.</p>
            ) : data.approvals.map((a) => (
              <div key={a._id} className="rounded border border-gray-200 p-3 text-sm dark:border-gray-700">
                <b>{label(a.actionType)}</b>
                <p>{a.explanation}</p>
                <p className="mt-1">Status: {a.status}</p>
                {a.status === 'pending' ? (
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button onClick={() => act(() => studentCaseApi.decideApproval(caseId, a._id, 'approve'))} className={`min-h-[44px] ${ui.link}`}>Approve</button>
                    <button onClick={() => act(() => studentCaseApi.decideApproval(caseId, a._id, 'reject'))} className="min-h-[44px] text-red-700 dark:text-red-400">Reject</button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className={`${ui.card} p-5`}>
        <h2 className="font-semibold">Immutable timeline</h2>
        <div className="mt-3 space-y-2">
          {data.timeline.map((e) => (
            <div key={e._id} className="border-s-2 border-gray-200 ps-3 text-sm dark:border-gray-600">
              <b>{label(e.eventType)}</b>
              <p className={`text-xs ${ui.muted}`}>{new Date(e.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>
      {['active', 'paused'].includes(c.lifecycle) ? (
        <button disabled={busy} onClick={() => act(() => studentCaseApi.updateLifecycle(caseId, 'closing'))} className="min-h-[44px] rounded border border-red-300 px-4 py-2 text-red-700 dark:border-red-700 dark:text-red-400">Request case closure</button>
      ) : null}
    </div>
  );
}
