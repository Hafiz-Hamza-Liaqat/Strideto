import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agentApi } from '../../services/agentService';
import { cardClass, inputClass, labelClass, muted } from './agentUi';

export default function AgentCases() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const load = (query) => {
    const params = {};
    if (query?.q) params.q = query.q;
    if (query?.lifecycle) params.lifecycle = query.lifecycle;
    agentApi.getCases(params).then((r) => setItems(r.data.cases || [])).catch((e) => setError(e.response?.data?.error || 'Unable to load cases.'));
  };
  useEffect(() => { load({}); }, []);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Professional cases</h1>
        <p className={muted}>Assigned cases only. Student consent and approval gates remain authoritative. Case transfer does not transfer Vault grants.</p>
      </div>
      <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); load({ q, lifecycle }); }}>
        <label className={labelClass}>Search<input value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="Title" /></label>
        <label className={labelClass}>Lifecycle
          <select value={lifecycle} onChange={(e) => setLifecycle(e.target.value)} className={inputClass}>
            <option value="">All</option>
            {['proposed', 'awaiting_student_acceptance', 'active', 'closed', 'transferred'].map((v) => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <button type="submit" className="self-end min-h-[44px] rounded-lg border px-4 text-sm">Apply</button>
        <button type="button" className="self-end min-h-[44px] rounded-lg border px-4 text-sm" onClick={() => { setQ(''); setLifecycle(''); load({}); }}>Reset</button>
      </form>
      {error ? <p className="rounded bg-red-50 p-3 text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</p> : null}
      <div className="space-y-3">
        {items.length === 0 ? <p className={`${cardClass} text-center ${muted}`}>No assigned cases.</p> : items.map((c) => (
          <Link key={c.id} to={`/agent/cases/${c.id}`} className={`block ${cardClass} hover:border-primary`}>
            <b className="text-gray-900 dark:text-white">{c.title}</b>
            <p className={muted}>{c.lifecycle.replaceAll('_', ' ')} · {c.currentStage.replaceAll('_', ' ')}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
