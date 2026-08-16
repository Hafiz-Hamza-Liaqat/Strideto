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
  const [form, setForm] = useState({ membershipId: '', requestedStart: '', durationMinutes: 30, consultationType: 'initial', meetingMode: 'video', purpose: '', studentNote: '' });
  useEffect(() => {
    if (!serviceId) {
      setError('Choose a service before requesting a consultation.');
      return;
    }
    studentConsultationApi.getAvailability(serviceId).then((r) => {
      setData(r.data);
      if (r.data.availability?.[0]) setForm((old) => ({ ...old, membershipId: r.data.availability[0].membershipId }));
    }).catch((e) => setError(e.response?.data?.error || 'No bookable availability is available.'));
  }, [serviceId]);
  const hasAvailability = Array.isArray(data?.availability) && data.availability.length > 0;
  const submit = async (event) => {
    event.preventDefault();
    const selected = data?.availability?.find((a) => a.membershipId === form.membershipId);
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const requestedStart = new Date(form.requestedStart);
      if (Number.isNaN(requestedStart.getTime())) {
        setError('Enter a valid date and time.');
        return;
      }
      const response = await studentConsultationApi.request({ ...form, agentServiceId: serviceId, marketplacePostId: marketplacePostId || undefined, requestedStart: requestedStart.toISOString(), timezone: selected.timezone });
      navigate(`/consultations/${response.data.consultation.id}`);
    } catch (e) {
      const payload = e.response?.data || {};
      setError(payload.error || payload.message || 'Consultation request failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`mx-auto max-w-2xl px-4 py-10 min-w-0 overflow-x-hidden ${ui.page}`}>
      <h1 className={ui.h1}>Request consultation</h1>
      <p className={`mt-2 ${ui.muted}`}>Times are stored as UTC instants while preserving the Agent’s IANA timezone.</p>
      {error ? <p className={`mt-4 ${ui.error}`} role="alert">{error}</p> : null}
      {data ? (
        <form onSubmit={submit} className={`mt-6 space-y-4 ${ui.card} p-6 min-w-0`}>
          {hasAvailability ? (
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
          ) : (
            <p className={`${ui.muted} break-words-safe`} role="status">
              No consultation availability is currently published for this service.
            </p>
          )}
          <label className="block text-sm">Requested start
            <input
              type="datetime-local"
              required={hasAvailability}
              disabled={!hasAvailability}
              value={form.requestedStart}
              onChange={(e) => setForm({ ...form, requestedStart: e.target.value })}
              className={`${ui.input} mt-1`}
            />
          </label>
          <label className="block text-sm">Purpose
            <input
              required={hasAvailability}
              disabled={!hasAvailability}
              maxLength={300}
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              className={`${ui.input} mt-1`}
            />
          </label>
          <label className="block text-sm">Note
            <textarea
              disabled={!hasAvailability}
              maxLength={2000}
              value={form.studentNote}
              onChange={(e) => setForm({ ...form, studentNote: e.target.value })}
              className={`${ui.input} mt-1`}
            />
          </label>
          <p className={ui.warning}>Payment status: {data.paymentState.replaceAll('_', ' ')}. Strideto does not collect or settle consultation payments in this release.</p>
          <button
            type="submit"
            disabled={busy || !hasAvailability}
            className={ui.primaryBtn}
            aria-disabled={busy || !hasAvailability}
          >
            {busy ? 'Requesting…' : 'Request consultation'}
          </button>
          {!hasAvailability ? (
            <p className={`text-xs ${ui.muted}`}>
              Request is disabled until the provider publishes bookable availability for this service.
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
