import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ui } from '../../../design-system/surfaceClasses';
import { ROUTES } from '../../../constants';
import { gbsProviderApi } from '../../../services/gbsProviderApi';
import { useGbsProvider } from './GbsProviderContext';
import { StatusBadge, card, emptyBox, GbsRouteState, h1, muted, wrap } from './gbsUi';
import { Pagination } from '../../../components/ui/Pagination';
import { GBS_LISTING_MODERATION_STATUSES } from '@shared/gbs/constants.js';

export default function GbsListings() {
  const { selected } = useGbsProvider();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [moderationStatus, setModerationStatus] = useState('');

  useEffect(() => {
    if (!selected) {
      setLoading(false);
      setItems([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    gbsProviderApi
      .listListings(selected, { page, limit: 20, moderationStatus: moderationStatus || undefined })
      .then(({ data }) => {
        if (!cancelled) { const pages = data.totalPages || 1; setItems(data.items || []); setTotalPages(pages); if (page > pages) setPage(pages); }
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load listings.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, page, moderationStatus]);

  if (!selected) return <GbsRouteState title="My Services">Select an authorized provider subject first.</GbsRouteState>;
  if (loading) return <GbsRouteState title="My Services" busy>Loading listings…</GbsRouteState>;
  if (error) return <GbsRouteState title="My Services" error>{error}</GbsRouteState>;

  return (
    <div className="space-y-4">
      <h1 className={h1}>My Services</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`${muted} ${wrap}`}>Private drafts only. Approved does not mean public. Provider cannot publish.</p>
        <Link to={ROUTES.AGENT_BUSINESS_SERVICES_LISTING_NEW} className={ui.primaryBtn}>
          New listing
        </Link>
      </div>
      <label className="block max-w-xs text-sm text-gray-900 dark:text-white">Moderation status
        <select value={moderationStatus} onChange={(event) => { setModerationStatus(event.target.value); setPage(1); }} className="mt-1 min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 dark:border-gray-600 dark:bg-gray-900">
          <option value="">All statuses</option>
          {Object.values(GBS_LISTING_MODERATION_STATUSES).map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
        </select>
      </label>
      {items.length === 0 ? (
        <div className={emptyBox}>No service listings for this subject yet.</div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 lg:hidden">
            {items.map((row) => (
              <li key={row.id} className={card}>
                <h3 className={`font-semibold text-gray-900 dark:text-white ${wrap}`}>{row.title}</h3>
                <p className={`${muted} ${wrap}`}>{row.capabilityId} · {row.jurisdictionId}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={row.moderationStatus} />
                  <StatusBadge status={row.adminReviewStatus} label={`admin review: ${row.adminReviewStatus || 'pending'}`} />
                  <StatusBadge status={row.publicationStatus} label={`publication: ${row.publicationStatus}`} />
                </div>
                <Link
                  to={`${ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS}/${row.id}/edit`}
                  className={`${ui.secondaryBtn} mt-3`}
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-700 dark:text-gray-200">
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Capability</th>
                  <th className="py-2 pr-3">Jurisdiction</th>
                  <th className="py-2 pr-3">Moderation</th>
                  <th className="py-2 pr-3">Admin review</th>
                  <th className="py-2 pr-3">Publication</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-gray-200 dark:border-gray-700 align-top">
                    <td className={`py-3 pr-3 ${wrap}`}>{row.title}</td>
                    <td className={`py-3 pr-3 ${wrap}`}>{row.capabilityId}</td>
                    <td className={`py-3 pr-3 ${wrap}`}>{row.jurisdictionId}</td>
                    <td className="py-3 pr-3"><StatusBadge status={row.moderationStatus} /></td>
                    <td className="py-3 pr-3"><StatusBadge status={row.adminReviewStatus || 'pending'} /></td>
                    <td className="py-3 pr-3"><StatusBadge status={row.publicationStatus} /></td>
                    <td className="py-3">
                      <Link to={`${ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS}/${row.id}/edit`} className={ui.link}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {totalPages > 1 ? <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} /> : null}
    </div>
  );
}
