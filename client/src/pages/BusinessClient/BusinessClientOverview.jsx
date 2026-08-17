import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { gbsBuyerApi } from '../../services/gbsBuyerApi';
import { formatTimestamp, serviceRequestStatusLabel } from './businessClientFormat';
import { SeoHead } from '../../components/seo';

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
  const caseCounts = data?.caseCounts || {};
  const recent = data?.recent || [];

  return (
    <div className="space-y-6 min-w-0">
      <SeoHead title="Business Overview" noindex />
      <section className={`${ui.card} p-5`} aria-labelledby="business-next-action-heading">
        <h2 id="business-next-action-heading" className="text-lg font-semibold">Your next actions</h2>
        {(data?.attention?.pendingQuotes || []).length > 0 ? <ul className="mt-3 space-y-2">{data.attention.pendingQuotes.map((quote) => <li key={quote.publicQuoteRef}><Link to={`${ROUTES.BUSINESS}/quotes/${quote.publicQuoteRef}`} className="block rounded-lg border border-amber-300 bg-amber-50 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-amber-700 dark:bg-amber-950/30"><span className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-300">Quote awaiting your decision</span><span className="block font-semibold">{quote.titleSnapshot || quote.publicQuoteRef}</span><span className={`${ui.link} inline-flex min-h-[44px] items-center`}>Review Quote</span></Link></li>)}</ul> : null}
        {(data?.attention?.customerCases || []).length > 0 ? <ul className="mt-3 space-y-2">{data.attention.customerCases.map((item) => <li key={item.publicCaseRef}><Link to={`${ROUTES.BUSINESS}/cases/${item.publicCaseRef}`} className="block rounded-lg border border-gray-200 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-gray-700"><span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Information required</span><span className="block font-semibold">{item.titleSnapshot || item.publicCaseRef}</span><span className={ui.link}>Open Case</span></Link></li>)}</ul> : null}
        {(data?.attention?.pendingQuotes || []).length === 0 && (data?.attention?.customerCases || []).length === 0 ? <p className={`mt-3 ${ui.muted}`}>You are up to date. No current quote or Case decision needs attention.</p> : null}
        <p className={`mt-3 text-xs ${ui.muted}`}>Secure Business document exchange and filing authorization remain unavailable in this private beta. Use contextual Messages for communication.</p>
        <Link to={`${ROUTES.BUSINESS}/messages`} className={`${ui.link} mt-2 inline-flex min-h-[44px] items-center`}>Open contextual messages</Link>
      </section>
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
      <section aria-labelledby="business-case-heading">
        <h2 id="business-case-heading" className="text-lg font-semibold">Service Cases</h2>
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            ['active', 'Active Cases'],
            ['awaiting_client', 'Awaiting your action'],
            ['ready_for_submission', 'Ready for submission'],
          ].map(([key, label]) => (
            <li key={key} className={`${ui.card} p-4`}>
              <p className={ui.muted}>{label}</p>
              <p className="mt-1 text-2xl font-semibold">{caseCounts[key] ?? 0}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3">
          <Link to={`${ROUTES.BUSINESS}/cases`} className={ui.link}>View Cases</Link>
        </p>
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
