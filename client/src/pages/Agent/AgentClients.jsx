import { useEffect, useState } from 'react';
import { agentApi } from '../../services/agentService';

export default function AgentClients() {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  useEffect(() => { agentApi.getClients().then(({ data }) => setState({ loading: false, data, error: '' })).catch((err) => setState({ loading: false, data: null, error: err.response?.data?.error || 'Unable to load clients.' })); }, []);
  if (state.loading) return <p className="text-sm text-slate-500">Loading clients…</p>;
  return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Clients</h1><p className="mt-1 text-sm text-slate-500">Client case management is not available in Mission 11.</p></div>{state.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : <section className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-600">{state.data?.note}</p><p className="mt-3 text-xs text-slate-500">A relationship grants no Student Profile, Journey, application, payment, or Vault authority.</p></section>}</div>;
}
