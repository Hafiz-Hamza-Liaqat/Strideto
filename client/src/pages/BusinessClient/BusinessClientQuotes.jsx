import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../../components/ui/Pagination';
import { ROUTES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { formatMoney } from '@shared/international/dateDisplay.js';
import { gbsBuyerApi } from '../../services/gbsBuyerApi';
import { formatTimestamp, providerKindLabel, quoteStatusLabel } from './businessClientFormat';

export default function BusinessClientQuotes() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    gbsBuyerApi
      .listQuotes({ page, limit: 20 })
      .then(({ data }) => {
        if (cancelled) return;
        setItems(data.items || []);
        setTotalPages(data.totalPages || 1);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load quotes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  if (loading) return <div className={`${ui.card} p-6 ${ui.muted}`} aria-busy="true">Loading quotes…</div>;
  if (error) return <div className={ui.error} role="alert">{error}</div>;

  return (
    <div className="space-y-4 min-w-0">
      <h2 className="text-lg font-semibold">Quotes</h2>
      {items.length === 0 ? (
        <div className={ui.empty}>No quotes yet. Quotes appear after a provider sends commercial terms.</div>
      ) : (
        <>
          <ul className="space-y-3 lg:hidden">
            {items.map((row) => (
              <li key={row.publicQuoteRef} className={`${ui.card} p-4`}>
                <p className="font-medium break-words-safe">{row.title}</p>
                <p className={`${ui.muted} break-words-safe`}>
                  {row.providerDisplayName} ({providerKindLabel(row.providerKind)})
                </p>
                <p className={ui.muted}>
                  {quoteStatusLabel(row.effectiveStatus || row.status)}
                  {row.subtotalProfessionalMinor != null && row.currency
                    ? ` · ${formatMoney({ amountMinor: row.subtotalProfessionalMinor, currency: row.currency })}`
                    : ''}
                </p>
                <Link to={`${ROUTES.BUSINESS}/quotes/${row.publicQuoteRef}`} className={`${ui.link} inline-flex min-h-[44px] items-center`}>
                  View Quote
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 pr-3">Quote</th>
                  <th className="py-2 pr-3">Service</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Professional fee</th>
                  <th className="py-2 pr-3">Official fees</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Sent</th>
                  <th className="py-2 pr-3">Expires</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.publicQuoteRef} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="py-3 pr-3 break-all">{row.publicQuoteRef}</td>
                    <td className="py-3 pr-3 break-words-safe">{row.title}</td>
                    <td className="py-3 pr-3 break-words-safe">{row.providerDisplayName} ({providerKindLabel(row.providerKind)})</td>
                    <td className="py-3 pr-3">
                      {row.subtotalProfessionalMinor != null && row.currency
                        ? formatMoney({ amountMinor: row.subtotalProfessionalMinor, currency: row.currency })
                        : '—'}
                    </td>
                    <td className="py-3 pr-3">
                      {(row.officialFeeGroups || []).length
                        ? row.officialFeeGroups.map((g) => formatMoney({ amountMinor: g.amountMinor, currency: g.currency })).join(', ')
                        : 'See detail'}
                    </td>
                    <td className="py-3 pr-3">{quoteStatusLabel(row.effectiveStatus || row.status)}</td>
                    <td className="py-3 pr-3">{formatTimestamp(row.sentAt)}</td>
                    <td className="py-3 pr-3">{formatTimestamp(row.expiresAt)}</td>
                    <td className="py-3">
                      <Link to={`${ROUTES.BUSINESS}/quotes/${row.publicQuoteRef}`} className={ui.link}>View Quote</Link>
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
