import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { agentApi } from '../../services/agentService';
import { btnSecondary, cardClass, inputClass, labelClass, muted } from './agentUi';

export default function AgentConsultations() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = (next = {}) => {
    setLoading(true);
    const params = {};
    if (next.status) params.status = next.status;
    if (next.q) params.q = next.q;
    agentApi.getConsultations(params)
      .then((r) => setItems(r.data.consultations || []))
      .catch((e) => setError(e.response?.data?.error || 'Unable to load consultations.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load({ status }); }, [status]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Consultations</h1>
          <p className={`mt-1 ${muted}`}>Incoming requests, confirmed appointments, and history. Times use the consultation IANA timezone.</p>
        </div>
        <Link to={ROUTES.AGENT_AVAILABILITY} className={btnSecondary}>Manage availability</Link>
      </div>
      <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); load({ status, q }); }}>
        <label className={labelClass}>Search<input value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="Purpose" /></label>
        <label htmlFor="agent-consultation-status" className={labelClass}>Status
          <select id="agent-consultation-status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="">All statuses</option>
            {['requested', 'confirmed', 'reschedule_requested', 'completed', 'cancelled', 'declined', 'no_show'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <button type="submit" className="self-end min-h-[44px] rounded-lg border px-4 text-sm">Apply</button>
        <button type="button" className="self-end min-h-[44px] rounded-lg border px-4 text-sm" onClick={() => { setQ(''); setStatus(''); load({}); }}>Reset</button>
      </form>
      {error ? <p className="rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</p> : null}
      {loading ? <p className={muted} role="status">Loading…</p> : items.length === 0 ? (
        <div className={`${cardClass} text-center ${muted}`}>No consultations in this view.</div>
      ) : (
        <div className="space-y-3">{items.map((item) => (
          <Link key={item.id} to={`/agent/consultations/${item.id}`} className={`block ${cardClass} hover:border-primary`}>
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{item.purpose}</p>
                <p className={`mt-1 ${muted}`}>{new Date(item.requestedWindow.start).toLocaleString([], { timeZone: item.timezone })} · {item.timezone}</p>
                <p className={muted}>{item.paymentState?.replaceAll('_', ' ')}</p>
              </div>
              <span className="h-fit rounded-full bg-slate-100 dark:bg-gray-900 px-3 py-1 text-xs text-gray-800 dark:text-gray-200">{item.status.replaceAll('_', ' ')}</span>
            </div>
            {item.restricted ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Organization verification currently restricts accepting or progressing this consultation.</p> : null}
          </Link>
        ))}</div>
      )}
    </div>
  );
}
