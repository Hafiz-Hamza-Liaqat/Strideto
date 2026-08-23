import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { ROUTES } from '../../constants';
import { Pagination } from '../../components/ui/Pagination';

export default function AgentClients() {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [page, setPage] = useState(1);
  const load = (nextPage, query) => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    agentApi.getClients({ params: { page: nextPage, limit: 20, q: query } })
      .then(({ data }) => { setState({ loading: false, data, error: '' }); if (nextPage > (data.totalPages || 1)) setPage(data.totalPages || 1); })
      .catch((err) => setState({ loading: false, data: null, error: err.response?.data?.error || 'Unable to load clients.' }));
  };
  useEffect(() => { load(page, appliedQ); }, [page, appliedQ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Clients</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Scoped relationships only. A client relationship grants zero Vault access.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); setAppliedQ(q); setPage(1); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search status or origin" className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 px-3 py-2" />
        <button className="rounded-lg bg-primary text-white px-3 min-h-[44px]">Search</button>
        <button type="button" onClick={() => { setQ(''); setAppliedQ(''); setPage(1); }} className="rounded-lg border px-3 min-h-[44px]">Reset</button>
      </form>
      {state.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{state.error}</p> : null}
      {state.loading ? <p className="text-sm text-slate-500 dark:text-gray-400" role="status">Loading clients...</p> : !state.data?.clients?.length ? (
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <p className="text-sm text-slate-600 dark:text-gray-300">{state.data?.note || 'No clients yet.'}</p>
        </section>
      ) : state.data.clients.map((client) => (
        <article key={client.userId} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <p className="font-medium text-gray-900 dark:text-white">{client.displayName}</p>
          <p className="text-sm text-slate-500">{client.origin} · {client.status} · next: {client.nextAction}</p>
          <p className="text-xs mt-2">Vault grants: {client.vaultGrantCount} · {client.vaultNote}</p>
          <div className="mt-2 flex gap-3 text-sm">
            <Link className="text-primary" to={ROUTES.AGENT_EDUCATION_CONSULTATIONS}>Consultations</Link>
            <Link className="text-primary" to={ROUTES.AGENT_EDUCATION_CASES}>Cases</Link>
          </div>
        </article>
      ))}
      {(state.data?.totalPages || 1) > 1 ? <Pagination currentPage={page} totalPages={state.data.totalPages} onPageChange={setPage} /> : null}
    </div>
  );
}
