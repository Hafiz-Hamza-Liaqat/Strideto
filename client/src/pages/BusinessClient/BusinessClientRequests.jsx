import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../../components/ui/Pagination';
import { ROUTES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { gbsBuyerApi } from '../../services/gbsBuyerApi';
import { formatTimestamp, providerKindLabel, serviceRequestStatusLabel } from './businessClientFormat';

export default function BusinessClientRequests() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    gbsBuyerApi
      .list({ page, limit: 20 })
      .then(({ data }) => {
        if (cancelled) return;
        setItems(data.items || []);
        setTotalPages(data.totalPages || 1);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load requests.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  if (loading) return <div className={`${ui.card} p-6 ${ui.muted}`} aria-busy="true">Loading requests…</div>;
  if (error) return <div className={ui.error} role="alert">{error}</div>;

  return (
    <div className="space-y-4 min-w-0">
      <h2 className="text-lg font-semibold">My Service Requests</h2>
      {items.length === 0 ? (
        <div className={ui.empty}>
          No service requests yet.{' '}
          <Link to={ROUTES.BUSINESS_SERVICES} className={ui.link}>Find a listing</Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3 lg:hidden">
            {items.map((row) => (
              <li key={row.publicRequestRef} className={`${ui.card} p-4`}>
                <p className="font-medium break-words-safe">{row.title}</p>
                <p className={`${ui.muted} break-words-safe`}>
                  {row.providerDisplayName} ({providerKindLabel(row.providerKind)}) · {row.jurisdictionName}
                </p>
                <p className={ui.muted}>{serviceRequestStatusLabel(row.status)} · {formatTimestamp(row.updatedAt)}</p>
                <Link to={`${ROUTES.BUSINESS}/requests/${row.publicRequestRef}`} className={`${ui.link} inline-flex min-h-[44px] items-center`}>
                  View request
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 pr-3">Service</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Jurisdiction</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Updated</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.publicRequestRef} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-3 pr-3 break-words-safe">{row.title}</td>
                    <td className="py-3 pr-3 break-words-safe">{row.providerDisplayName} ({providerKindLabel(row.providerKind)})</td>
                    <td className="py-3 pr-3 break-words-safe">{row.jurisdictionName}</td>
                    <td className="py-3 pr-3">{formatTimestamp(row.createdAt)}</td>
                    <td className="py-3 pr-3">{serviceRequestStatusLabel(row.status)}</td>
                    <td className="py-3 pr-3">{formatTimestamp(row.updatedAt)}</td>
                    <td className="py-3">
                      <Link to={`${ROUTES.BUSINESS}/requests/${row.publicRequestRef}`} className={ui.link}>View request</Link>
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
