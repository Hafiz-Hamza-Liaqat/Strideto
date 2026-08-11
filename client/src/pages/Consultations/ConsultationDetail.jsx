import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import MessageThread from '../../components/consultations/MessageThread';
import { studentConsultationApi } from '../../services/agentService';
import { ui } from '../../design-system/surfaceClasses';

export default function ConsultationDetail() {
  const { consultationId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => studentConsultationApi.get(consultationId).then((response) => setData(response.data)).catch((e) => setError(e.response?.data?.error || 'Unable to load consultation.'));
  useEffect(() => { void load(); }, [consultationId]); // eslint-disable-line react-hooks/exhaustive-deps
  const transition = async (status) => {
    const requestedStart = status === 'reschedule_requested' ? window.prompt('Enter the proposed start as an ISO instant, for example 2026-08-20T10:00:00Z') : '';
    if (status === 'reschedule_requested' && !requestedStart) return;
    setBusy(true);
    setError('');
    try {
      await studentConsultationApi.transition(consultationId, { status, ...(requestedStart ? { requestedStart } : {}) });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };
  if (!data) return <div className={`mx-auto max-w-4xl p-8 ${ui.muted}`} role="status">{error || 'Loading consultation…'}</div>;
  const c = data.consultation;
  return (
    <div className={`mx-auto max-w-4xl space-y-5 px-4 py-10 ${ui.page}`}>
      <header className={`${ui.card} p-6`}>
        <div className="flex justify-between gap-3">
          <h1 className="text-2xl font-semibold break-words">{c.purpose}</h1>
          <span className={ui.badge}>{c.status.replaceAll('_', ' ')}</span>
        </div>
        <p className="mt-3 text-sm">{new Date(c.confirmedStart || c.requestedWindow.start).toLocaleString([], { timeZone: c.timezone })} · {c.timezone}</p>
        <p className={`mt-1 ${ui.muted}`}>{c.durationMinutes} minutes · {c.meetingMode.replaceAll('_', ' ')} · {c.paymentState.replaceAll('_', ' ')}</p>
        {c.meetingMetadata?.link ? <a className={`mt-3 block text-sm ${ui.link}`} href={c.meetingMetadata.link} rel="noreferrer">Open authorized meeting link</a> : null}
        {c.restricted ? <p className={`mt-3 ${ui.warning}`}>The organization is currently restricted. Private meeting metadata is withheld.</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {['requested', 'pending_confirmation', 'confirmed', 'reschedule_requested'].includes(c.status) ? (
            <button disabled={busy} onClick={() => transition('cancelled')} className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:text-red-400">Cancel</button>
          ) : null}
          {['requested', 'pending_confirmation', 'confirmed'].includes(c.status) ? (
            <button disabled={busy} onClick={() => transition('reschedule_requested')} className={ui.secondaryBtn}>Request reschedule</button>
          ) : null}
          {c.status === 'reschedule_requested' ? (
            <button disabled={busy || c.restricted} onClick={() => transition('confirmed')} className={ui.primaryBtn}>Accept reschedule</button>
          ) : null}
        </div>
        {error ? <p className={`mt-3 text-sm text-red-700 dark:text-red-400`} role="alert">{error}</p> : null}
      </header>
      <section className={`${ui.card} p-5`}>
        <h2 className="font-semibold">History</h2>
        <div className="mt-3 space-y-2">
          {data.history.map((event) => (
            <p key={event.id} className={`text-sm ${ui.muted}`}>{new Date(event.createdAt).toLocaleString()} · {event.toStatus.replaceAll('_', ' ')}</p>
          ))}
        </div>
      </section>
      <MessageThread threadId={data.threadId} loadMessages={studentConsultationApi.getMessages} sendMessage={studentConsultationApi.sendMessage} canShareDocuments />
    </div>
  );
}
