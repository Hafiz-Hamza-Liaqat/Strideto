import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { gbsBuyerApi } from '../../services/gbsBuyerApi';
import { formatTimestamp, serviceRequestStatusLabel } from './businessClientFormat';

export default function BusinessClientOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    gbsBuyerApi
      .overview()
      .then(({ data: next }) => {
        if (!cancelled) setData(next);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load overview.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className={`${ui.card} p-6 ${ui.muted}`} aria-busy="true">Loading overview…</div>;
  if (error) return <div className={ui.error} role="alert">{error}</div>;

  const counts = data?.counts || {};
  const recent = data?.recent || [];

  return (
    <div className="space-y-6 min-w-0">
      <section aria-labelledby="business-status-heading">
        <h2 id="business-status-heading" className="text-lg font-semibold">Request status</h2>
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            ['active', 'Active / pre-quote'],
            ['submitted', 'Submitted'],
            ['provider_reviewing', 'Provider reviewing'],
            ['ready_for_quote', 'Ready for quote'],
            ['declined', 'Declined'],
            ['cancelled', 'Cancelled'],
          ].map(([key, label]) => (
            <li key={key} className={`${ui.card} p-4`}>
              <p className={ui.muted}>{label}</p>
              <p className="mt-1 text-2xl font-semibold">{counts[key] ?? 0}</p>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="business-recent-heading">
        <h2 id="business-recent-heading" className="text-lg font-semibold">Recent requests</h2>
        {recent.length === 0 ? (
          <div className={`${ui.empty} mt-3`}>
            You have no service requests yet.{' '}
            <Link to={ROUTES.BUSINESS_SERVICES} className={ui.link}>Browse approved listings</Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {recent.map((row) => (
              <li key={row.publicRequestRef} className={`${ui.card} p-4 min-w-0`}>
                <p className="font-medium break-words-safe">{row.title}</p>
                <p className={`${ui.muted} break-words-safe`}>
                  {row.providerDisplayName} · {serviceRequestStatusLabel(row.status)} · {formatTimestamp(row.createdAt)}
                </p>
                <Link to={`${ROUTES.BUSINESS}/requests/${row.publicRequestRef}`} className={`${ui.link} inline-flex min-h-[44px] items-center`}>
                  View request
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
