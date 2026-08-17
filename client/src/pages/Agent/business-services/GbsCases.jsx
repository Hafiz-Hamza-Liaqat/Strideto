import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../../../components/ui/Pagination';
import { ui } from '../../../design-system/surfaceClasses';
import { ROUTES } from '../../../constants';
import { gbsProviderApi } from '../../../services/gbsProviderApi';
import { useGbsProvider } from './GbsProviderContext';
import { StatusBadge, card, emptyBox, GbsRouteState, h1, muted } from './gbsUi';
import { caseStatusLabel, formatTimestamp } from '../../BusinessClient/businessClientFormat';

export default function GbsCases() {
  const { selected } = useGbsProvider();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [selected?.subjectId, selected?.subjectType, status]);

  useEffect(() => {
    if (!selected) {
      setLoading(false);
      setItems([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    gbsProviderApi
      .listCases(selected, { page, limit: 20, status: status || undefined })
      .then(({ data }) => {
        if (cancelled) return;
        setItems(data.items || []);
        setTotalPages(data.totalPages || 1);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.status === 403 ? 'You do not have access to these cases.' : 'Unable to load cases.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, page, status]);

  if (!selected) return <GbsRouteState title="Cases">Select an authorized provider subject first.</GbsRouteState>;
  if (loading) return <GbsRouteState title="Cases" busy>Loading cases…</GbsRouteState>;
  if (error) return <GbsRouteState title="Cases" error>{error}</GbsRouteState>;

  return (
    <div className="space-y-4 min-w-0">
      <h1 className={h1}>Cases</h1>
      <div>
        <label htmlFor="gbs-case-status" className="block text-sm font-medium mb-1">Status</label>
        <select id="gbs-case-status" className={ui.input} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="awaiting_client">Awaiting client</option>
          <option value="ready_for_submission">Ready for submission</option>
          <option value="cancelled">Cancelled</option>
          <option value="unable_to_proceed">Unable to proceed</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      {items.length === 0 ? (
        <div className={emptyBox}>No cases for this subject.</div>
      ) : (
        <>
          <ul className="space-y-3 lg:hidden">
            {items.map((row) => (
              <li key={row.publicCaseRef} className={card}>
                <p className="font-medium break-words-safe">{row.title}</p>
                <p className={muted}>{row.customerDisplayName}</p>
                <StatusBadge status={row.status} label={caseStatusLabel(row.status)} />
                <Link to={`${ROUTES.AGENT_BUSINESS_SERVICES_CASES}/${row.publicCaseRef}`} className={`${ui.link} inline-flex min-h-[44px] items-center`}>
                  View Case
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 pr-3">Case</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Service</th>
                  <th className="py-2 pr-3">Jurisdiction</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Stage</th>
                  <th className="py-2 pr-3">Updated</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.publicCaseRef} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-3 pr-3 break-all">{row.publicCaseRef}</td>
                    <td className="py-3 pr-3 break-words-safe">{row.customerDisplayName}</td>
                    <td className="py-3 pr-3 break-words-safe">{row.title}</td>
                    <td className="py-3 pr-3 break-words-safe">{row.jurisdictionName}</td>
                    <td className="py-3 pr-3">{caseStatusLabel(row.status)}</td>
                    <td className="py-3 pr-3">{String(row.currentMilestoneKey || '').replace(/_/g, ' ')}</td>
                    <td className="py-3 pr-3">{formatTimestamp(row.updatedAt)}</td>
                    <td className="py-3">
                      <Link to={`${ROUTES.AGENT_BUSINESS_SERVICES_CASES}/${row.publicCaseRef}`} className={ui.link}>View Case</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
