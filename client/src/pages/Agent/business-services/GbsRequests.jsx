import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../../../components/ui/Pagination';
import { ui } from '../../../design-system/surfaceClasses';
import { ROUTES } from '../../../constants';
import { gbsProviderApi } from '../../../services/gbsProviderApi';
import { useGbsProvider } from './GbsProviderContext';
import { StatusBadge, card, emptyBox, errorBox, muted, wrap } from './gbsUi';
import { serviceRequestStatusLabel } from '../../BusinessClient/businessClientFormat';

export default function GbsRequests() {
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
      .listRequests(selected, { page, limit: 20, status: status || undefined })
      .then(({ data }) => {
        if (cancelled) return;
        setItems(data.items || []);
        setTotalPages(data.totalPages || 1);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.status === 403 ? 'You do not have access to these requests.' : 'Unable to load requests.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, page, status]);

  if (!selected) return <div className={emptyBox}>Select an authorized provider subject first.</div>;
  if (loading) return <div className={`${card} ${muted}`} aria-busy="true">Loading service requests…</div>;
  if (error) return <div className={errorBox} role="alert">{error}</div>;

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="gbs-request-status" className="block text-sm font-medium mb-1">Status</label>
          <select
            id="gbs-request-status"
            className={ui.input}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="submitted">Submitted</option>
            <option value="provider_reviewing">Provider reviewing</option>
            <option value="ready_for_quote">Ready for quote</option>
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      {items.length === 0 ? (
        <div className={emptyBox}>No service requests for this subject.</div>
      ) : (
        <>
          <ul className="space-y-3 lg:hidden">
            {items.map((row) => (
              <li key={row.publicRequestRef} className={card}>
                <h3 className={`font-semibold ${wrap}`}>{row.title}</h3>
                <p className={`${muted} ${wrap}`}>{row.customerDisplayName} · {row.capabilityPublicName} · {row.jurisdictionName}</p>
                <div className="mt-2"><StatusBadge status={row.status} label={serviceRequestStatusLabel(row.status)} /></div>
                <Link
                  to={`${ROUTES.AGENT_BUSINESS_SERVICES_REQUESTS}/${row.publicRequestRef}`}
                  className={`${ui.link} mt-3 inline-flex min-h-[44px] items-center`}
                >
                  View request
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Service</th>
                  <th className="py-2 pr-3">Capability</th>
                  <th className="py-2 pr-3">Jurisdiction</th>
                  <th className="py-2 pr-3">Submitted</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.publicRequestRef} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-3 pr-3 break-all">{row.publicRequestRef}</td>
                    <td className="py-3 pr-3 break-words-safe">{row.customerDisplayName}</td>
                    <td className="py-3 pr-3 break-words-safe">{row.title}</td>
                    <td className="py-3 pr-3 break-words-safe">{row.capabilityPublicName}</td>
                    <td className="py-3 pr-3 break-words-safe">{row.jurisdictionName}</td>
                    <td className="py-3 pr-3">{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : ''}</td>
                    <td className="py-3 pr-3"><StatusBadge status={row.status} label={serviceRequestStatusLabel(row.status)} /></td>
                    <td className="py-3">
                      <Link to={`${ROUTES.AGENT_BUSINESS_SERVICES_REQUESTS}/${row.publicRequestRef}`} className={ui.link}>
                        View request
                      </Link>
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
