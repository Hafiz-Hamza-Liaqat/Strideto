import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { studentConsultationApi } from '../../services/agentService';
import { ui } from '../../design-system/surfaceClasses';

export default function ConsultationRequest() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const serviceId = params.get('serviceId') || '';
  const marketplacePostId = params.get('marketplacePostId') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('booking'); // 'booking' | 'inquiry'
  const [form, setForm] = useState({ membershipId: '', requestedStart: '', durationMinutes: 30, consultationType: 'initial', meetingMode: 'video', purpose: '', studentNote: '' });
  useEffect(() => {
    if (!serviceId) {
      setError('Choose a service before requesting a consultation.');
      return;
    }
    studentConsultationApi.getAvailability(serviceId).then((r) => {
      setData(r.data);
      if (r.data.availability?.[0]) {
        setForm((old) => ({ ...old, membershipId: r.data.availability[0].membershipId }));
      } else {
        setMode('inquiry');
      }
    }).catch((e) => setError(e.response?.data?.error || 'No bookable availability is available.'));
  }, [serviceId]);
  const hasAvailability = Array.isArray(data?.availability) && data.availability.length > 0;
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      let payload = { agentServiceId: serviceId, marketplacePostId: marketplacePostId || undefined, purpose: form.purpose, studentNote: form.studentNote };
      if (mode === 'booking') {
        const selected = data?.availability?.find((a) => a.membershipId === form.membershipId);
        if (!selected) { setError('Select an agent to book with.'); return; }
        const requestedStart = new Date(form.requestedStart);
        if (Number.isNaN(requestedStart.getTime())) { setError('Enter a valid date and time.'); return; }
        payload = { ...payload, membershipId: form.membershipId, requestedStart: requestedStart.toISOString(), timezone: selected.timezone, durationMinutes: form.durationMinutes, consultationType: form.consultationType, meetingMode: form.meetingMode };
      }
      const response = await studentConsultationApi.request(payload);
      navigate(`/consultations/${response.data.consultation.id}`);
    } catch (e) {
      const payload = e.response?.data || {};
      setError(payload.error || payload.message || 'Consultation request failed.');
    } finally {
      setBusy(false);
    }
  };
  const ctaLabel = busy ? 'Requesting…' : mode === 'inquiry' ? (data?.paymentState === 'free' ? 'Request free consultation' : 'Send inquiry') : 'Request consultation';
  return (
    <div className={`mx-auto max-w-2xl px-4 py-10 min-w-0 overflow-x-hidden ${ui.page}`}>
      <h1 className={ui.h1}>Request consultation</h1>
      <p className={`mt-2 ${ui.muted}`}>Times are stored as UTC instants while preserving the provider IANA timezone.</p>
      {error ? <p className={`mt-4 ${ui.error}`} role="alert">{error}</p> : null}
      {data ? (
        <form onSubmit={submit} className={`mt-6 space-y-4 ${ui.card} p-6 min-w-0`}>
          {hasAvailability ? (
            <div className="flex gap-2" role="group" aria-label="Consultation action">
              <button type="button" onClick={() => setMode('booking')} className={mode === 'booking' ? ui.primaryBtn : ui.secondaryBtn}>Book a time slot</button>
              <button type="button" onClick={() => setMode('inquiry')} className={mode === 'inquiry' ? ui.primaryBtn : ui.secondaryBtn}>Send inquiry</button>
            </div>
          ) : null}
          {mode === 'booking' && hasAvailability ? (
            <>
              <label className="block text-sm">
                Agent availability
                <select
                  className={`${ui.input} mt-1`}
                  value={form.membershipId}
                  onChange={(e) => setForm({ ...form, membershipId: e.target.value })}
                  aria-label="Agent availability"
                >
                  {data.availability.map((a) => (
                    <option key={a.membershipId} value={a.membershipId}>
                      {a.timezone} · {a.windows.length} weekly windows
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">Requested start
                <input
                  type="datetime-local"
                  required
                  value={form.requestedStart}
                  onChange={(e) => setForm({ ...form, requestedStart: e.target.value })}
                  className={`${ui.input} mt-1`}
                />
              </label>
            </>
          ) : (
            <p className={`${ui.muted} break-words-safe`} role="status">
              {hasAvailability ? 'Your inquiry will be sent without a scheduled time. The provider will propose a time slot.' : 'No bookable times are currently published for this service. You can still send a consultation inquiry to the provider.'}
            </p>
          )}
          <label className="block text-sm">Purpose
            <input
              required
              maxLength={300}
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              className={`${ui.input} mt-1`}
            />
          </label>
          <label className="block text-sm">Note
            <textarea
              maxLength={2000}
              value={form.studentNote}
              onChange={(e) => setForm({ ...form, studentNote: e.target.value })}
              className={`${ui.input} mt-1`}
            />
          </label>
          <p className={ui.warning}>Payment status: {data.paymentState.replaceAll('_', ' ')}. Strideto does not collect or settle consultation payments in this release.</p>
          <button
            type="submit"
            disabled={busy}
            className={ui.primaryBtn}
            aria-disabled={busy}
          >
            {ctaLabel}
          </button>
        </form>
      ) : null}
    </div>
  );
}
