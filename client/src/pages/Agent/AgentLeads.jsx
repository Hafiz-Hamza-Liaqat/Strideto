import { useEffect, useState } from 'react';
import { agentApi } from '../../services/agentService';

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'closed', 'declined'];
export default function AgentLeads() {
  const [leads, setLeads] = useState([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  const load = () => agentApi.getLeads().then(({ data }) => setLeads(data.leads));
  useEffect(() => { load().catch(() => setError('Unable to load leads.')).finally(() => setLoading(false)); }, []);
  const update = async (id, status) => { setBusy(id); setError(''); try { await agentApi.updateLeadStatus(id, status); await load(); } catch (err) { setError(err.response?.data?.error || 'Unable to update lead.'); } finally { setBusy(''); } };
  if (loading) return <p className="text-sm text-slate-500">Loading leads…</p>;
  return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Leads</h1><p className="mt-1 text-sm text-slate-500">Only relationships created by explicit user action appear here. This does not expose Student Profiles or Vault documents.</p></div>{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{leads.length === 0 ? <p className="rounded-xl border bg-white p-5 text-sm text-slate-500">No leads yet. Agents cannot browse or search arbitrary users.</p> : leads.map((lead) => <article key={lead._id} className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">Relationship {lead._id}</p><p className="text-xs text-slate-500">Source: {lead.source || 'user initiated'}</p></div><select disabled={busy === lead._id} value={lead.status} onChange={(event) => update(lead._id, event.target.value)} className="rounded-lg border p-2 text-sm">{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div>{lead.context && <p className="mt-3 text-sm text-slate-600">{lead.context}</p>}</article>)}</div>;
}
