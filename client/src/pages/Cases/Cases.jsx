import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { studentCaseApi } from '../../services/agentService';
import { ui } from '../../design-system/surfaceClasses';
import { Pagination } from '../../components/ui/Pagination';
import { SeoHead } from '../../components/seo';

export default function Cases() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [attention, setAttention] = useState(null);
  useEffect(() => {
    setLoading(true);
    studentCaseApi.list({ page, limit: 20 })
      .then((r) => { const pages = r.data.totalPages || 1; setItems(r.data.cases || []); setAttention(r.data.attention || null); setTotalPages(pages); if (page > pages) setPage(pages); })
      .catch((e) => setError(e.response?.data?.error || 'Unable to load cases.'))
      .finally(() => setLoading(false));
  }, [page]);
  return (
    <div className={`mx-auto max-w-5xl px-4 py-10 ${ui.page}`}>
      <SeoHead title="My professional cases" noindex />
      <h1 className={ui.h1}>My professional cases</h1>
      <p className={`mt-2 ${ui.muted}`}>You control case consent, approvals, documents, and when to leave.</p>
      {attention ? <section className={`${ui.card} mt-6 p-5`} aria-labelledby="student-next-action-heading">
        <h2 id="student-next-action-heading" className="text-lg font-semibold">Your next actions</h2>
        {(() => {
          const rows = [
            ...(attention.proposals || []).map((item) => ({ ...item, kind: 'Case proposal' })),
            ...(attention.tasks || []).map((item) => ({ ...item, kind: 'Task' })),
            ...(attention.applications || []).map((item) => ({ ...item, kind: 'Application' })),
            ...(attention.documentRequests || []).map((item) => ({ ...item, kind: 'Document request' })),
            ...(attention.approvals || []).map((item) => ({ ...item, kind: 'Approval' })),
          ].slice(0, 8);
          return rows.length ? <ul className="mt-3 space-y-2">{rows.map((item) => <li key={`${item.kind}-${item.id}`}><Link to={`/cases/${item.caseId}`} className="block rounded-lg border border-gray-200 p-3 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-gray-700"><span className="text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">{item.kind}</span><span className="block font-medium">{item.title}</span><span className={ui.muted}>{item.status.replaceAll('_', ' ')}{item.dueAt ? ` · ${new Date(item.dueAt).toLocaleDateString()}` : ''}</span></Link></li>)}</ul> : <p className={`mt-3 ${ui.muted}`}>You are up to date. No current Case action needs attention.</p>;
        })()}
      </section> : null}
      {error ? <p className={`mt-4 ${ui.error}`} role="alert">{error}</p> : null}
      {loading ? (
        <p className={`mt-6 ${ui.muted}`} role="status">Loading cases…</p>
      ) : items.length === 0 ? (
        <div className={`mt-6 ${ui.empty}`}>No professional cases. A completed consultation may lead to a proposal, but only you can activate it.</div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {items.map((c) => (
            <Link key={c.id} to={`/cases/${c.id}`} className={`${ui.card} p-5 hover:border-blue-400 dark:hover:border-blue-500`}>
              <div className="flex justify-between gap-3">
                <h2 className="font-semibold break-words">{c.title}</h2>
                <span className={ui.badge}>{c.lifecycle.replaceAll('_', ' ')}</span>
              </div>
              <p className={`mt-2 ${ui.muted}`}>{c.caseType.replaceAll('_', ' ')} · {c.currentStage.replaceAll('_', ' ')}</p>
            </Link>
          ))}
        </div>
      )}
      {totalPages > 1 ? <div className="mt-6"><Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} /></div> : null}
    </div>
  );
}
