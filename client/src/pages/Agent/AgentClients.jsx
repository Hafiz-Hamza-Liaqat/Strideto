import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';

export default function AgentClients() {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [q, setQ] = useState('');
  const load = (query) => {
    agentApi.getClients({ params: { q: query } })
      .then(({ data }) => setState({ loading: false, data, error: '' }))
      .catch((err) => setState({ loading: false, data: null, error: err.response?.data?.error || 'Unable to load clients.' }));
  };
  useEffect(() => { load(''); }, []);
  if (state.loading) return <p className="text-sm text-slate-500 dark:text-gray-400">Loading clients…</p>;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Clients</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Scoped relationships only. A client relationship grants zero Vault access.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search status or origin" className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 px-3 py-2" />
        <button className="rounded-lg bg-primary text-white px-3 min-h-[44px]">Search</button>
        <button type="button" onClick={() => { setQ(''); load(''); }} className="rounded-lg border px-3 min-h-[44px]">Reset</button>
      </form>
      {state.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{state.error}</p> : null}
      {!state.data?.clients?.length ? (
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <p className="text-sm text-slate-600 dark:text-gray-300">{state.data?.note || 'No clients yet.'}</p>
        </section>
      ) : state.data.clients.map((client) => (
        <article key={client.userId} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <p className="font-medium text-gray-900 dark:text-white">{client.displayName}</p>
          <p className="text-sm text-slate-500">{client.origin} · {client.status} · next: {client.nextAction}</p>
          <p className="text-xs mt-2">Vault grants: {client.vaultGrantCount} · {client.vaultNote}</p>
          <div className="mt-2 flex gap-3 text-sm">
            <Link className="text-primary" to={ROUTES.AGENT_CONSULTATIONS}>Consultations</Link>
            <Link className="text-primary" to={ROUTES.AGENT_CASES}>Cases</Link>
          </div>
        </article>
      ))}
    </div>
  );
}
