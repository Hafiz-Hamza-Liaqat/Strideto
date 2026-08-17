import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import MessageThread from '../../components/consultations/MessageThread';
import { agentApi } from '../../services/agentService';
import { btnSecondary, cardClass, muted } from './agentUi';

export default function AgentConsultationDetail() {
  const { consultationId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => agentApi.getConsultation(consultationId).then((response) => setData(response.data)).catch((e) => setError(e.response?.data?.error || 'Unable to load consultation.'));
  useEffect(() => { void load(); }, [consultationId]); // eslint-disable-line react-hooks/exhaustive-deps
  const transition = async (status) => {
    const requestedStart = status === 'reschedule_requested' ? window.prompt('Enter the proposed start as an ISO instant, for example 2026-08-20T10:00:00Z') : '';
    if (status === 'reschedule_requested' && !requestedStart) return;
    setBusy(true); setError('');
    try {
      await agentApi.transitionConsultation(consultationId, { status, ...(requestedStart ? { requestedStart } : {}) });
      await load();
    } catch (e) { setError(e.response?.data?.error || 'Action failed.'); }
    finally { setBusy(false); }
  };
  if (!data) return <div className={muted}>{error || 'Loading consultation…'}</div>;
  const c = data.consultation;
  const actions = { requested: ['confirmed', 'declined', 'reschedule_requested'], confirmed: ['reschedule_requested', 'cancelled', 'completed', 'no_show'], reschedule_requested: ['confirmed', 'declined', 'cancelled'] }[c.status] || [];
  return (
    <div className="space-y-5">
      <header className={cardClass}>
        <div className="flex justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white break-words-safe">{c.purpose}</h1>
          <span className="rounded-full bg-slate-100 dark:bg-gray-900 px-3 py-1 text-xs text-gray-800 dark:text-gray-200 h-fit">{c.status.replaceAll('_', ' ')}</span>
        </div>
        <p className="mt-3 text-sm text-gray-800 dark:text-gray-200">{new Date(c.confirmedStart || c.requestedWindow.start).toLocaleString([], { timeZone: c.timezone })} · {c.timezone}</p>
        <p className={`mt-1 ${muted}`}>{c.durationMinutes} minutes · {c.meetingMode.replaceAll('_', ' ')} · payment {c.paymentState.replaceAll('_', ' ')}</p>
        {c.service ? <p className={`mt-1 ${muted}`}>Service: {c.service.title} · {c.service.category.replaceAll('_', ' ')}</p> : null}
        <p className="mt-3 rounded bg-slate-50 dark:bg-gray-900 p-3 text-sm text-gray-800 dark:text-gray-200">Student note: {c.studentNote || 'None provided'}</p>
        {c.restricted ? <p className="mt-3 rounded bg-amber-50 dark:bg-amber-950/40 p-2 text-sm text-amber-800 dark:text-amber-200">Verification restriction is active. Confirmation and progression are blocked server-side.</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">{actions.map((action) => (
          <button key={action} type="button" disabled={busy || (c.restricted && action !== 'cancelled')} onClick={() => transition(action)} className={`${btnSecondary} capitalize`}>{action.replaceAll('_', ' ')}</button>
        ))}</div>
        {error ? <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
      </header>
      <section className={cardClass}>
        <h2 className="font-semibold text-gray-900 dark:text-white">Immutable lifecycle history</h2>
        <div className="mt-3 space-y-2">{data.history.map((event) => <p key={event.id} className={muted}>{new Date(event.createdAt).toLocaleString()} · {event.fromStatus || 'created'} → {event.toStatus}</p>)}</div>
      </section>
      <MessageThread threadId={data.threadId} loadMessages={agentApi.getConsultationMessages} sendMessage={agentApi.sendConsultationMessage} />
    </div>
  );
}
