import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { agentApi } from '../../services/agentService';
import { cardClass, inputClass, labelClass, muted } from './agentUi';
import { Pagination } from '../../components/ui/Pagination';

export default function AgentCases() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [applied, setApplied] = useState({ q: '', lifecycle: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const load = (query, nextPage = page) => {
    const params = { page: nextPage, limit: 20 };
    if (query?.q) params.q = query.q;
    if (query?.lifecycle) params.lifecycle = query.lifecycle;
    agentApi.getCases(params).then((r) => { const pages = r.data.totalPages || 1; setItems(r.data.cases || []); setTotalPages(pages); if (nextPage > pages) setPage(pages); }).catch((e) => setError(e.response?.data?.error || 'Unable to load cases.'));
  };
  useEffect(() => { load(applied, page); }, [page, applied]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Professional cases</h1>
        <p className={muted}>Assigned cases only. Student consent and approval gates remain authoritative. Case transfer does not transfer Vault grants.</p>
      </div>
      <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); setApplied({ q, lifecycle }); setPage(1); }}>
        <label className={labelClass}>Search<input value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="Title" /></label>
        <label className={labelClass}>Lifecycle
          <select value={lifecycle} onChange={(e) => setLifecycle(e.target.value)} className={inputClass}>
            <option value="">All</option>
            {['proposed', 'awaiting_student_acceptance', 'active', 'paused', 'closing', 'completed', 'cancelled', 'transferred'].map((v) => <option key={v} value={v}>{v.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <button type="submit" className="self-end min-h-[44px] rounded-lg border px-4 text-sm">Apply</button>
        <button type="button" className="self-end min-h-[44px] rounded-lg border px-4 text-sm" onClick={() => { setQ(''); setLifecycle(''); setApplied({ q: '', lifecycle: '' }); setPage(1); }}>Reset</button>
      </form>
      {error ? <p className="rounded bg-red-50 p-3 text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{error}</p> : null}
      <div className="space-y-3">
        {items.length === 0 ? <p className={`${cardClass} text-center ${muted}`}>No assigned cases.</p> : items.map((c) => (
          <Link key={c.id} to={`${ROUTES.AGENT_EDUCATION_CASES}/${c.id}`} className={`block ${cardClass} hover:border-primary`}>
            <b className="text-gray-900 dark:text-white">{c.title}</b>
            <p className={muted}>{c.lifecycle.replaceAll('_', ' ')} · {c.currentStage.replaceAll('_', ' ')}</p>
          </Link>
        ))}
      </div>
      {totalPages > 1 ? <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} /> : null}
    </div>
  );
}
