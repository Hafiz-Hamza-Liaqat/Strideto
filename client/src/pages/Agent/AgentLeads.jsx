import { useEffect, useState } from 'react';
import { agentApi } from '../../services/agentService';

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'closed', 'declined'];
export default function AgentLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const load = (query = q, st = status) => agentApi.getLeads({ params: { q: query, status: st || undefined } }).then(({ data }) => setLeads(data.leads));
  useEffect(() => { load().catch(() => setError('Unable to load leads.')).finally(() => setLoading(false)); }, []);
  const update = async (id, next) => { setBusy(id); setError(''); try { await agentApi.updateLeadStatus(id, next); await load(); } catch (err) { setError(err.response?.data?.error || 'Unable to update lead.'); } finally { setBusy(''); } };
  if (loading) return <p className="text-sm text-slate-500 dark:text-gray-400">Loading leads…</p>;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Leads</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">Only relationships created by explicit user action appear here. This does not expose Student Profiles or Vault documents.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); load(q, status).catch(() => {}); }} className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search context" className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 px-3 py-2" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="rounded-lg bg-primary text-white px-3 min-h-[44px]">Search</button>
        <button type="button" onClick={() => { setQ(''); setStatus(''); load('', ''); }} className="rounded-lg border px-3 min-h-[44px]">Reset</button>
      </form>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {leads.length === 0 ? <p className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-sm text-slate-500">No leads yet. Agents cannot browse or search arbitrary users.</p> : leads.map((lead) => (
        <article key={lead._id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Relationship {lead._id}</p>
              <p className="text-xs text-slate-500">Source: {lead.source || 'user initiated'}</p>
            </div>
            <select disabled={busy === lead._id} value={lead.status} onChange={(event) => update(lead._id, event.target.value)} className="rounded-lg border p-2 text-sm">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          {lead.context && <p className="mt-3 text-sm text-slate-600 dark:text-gray-300 break-words-safe">{lead.context}</p>}
        </article>
      ))}
    </div>
  );
}
