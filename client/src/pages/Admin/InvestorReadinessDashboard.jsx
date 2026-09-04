import { useEffect, useState } from 'react';
import { SeoHead } from '../../components/seo';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { adminApi } from '../../services/listingsService';
import { PERMISSIONS } from '../../config/rbac';

const TABS = ['Overview', 'Traction', 'Business Readiness', 'Fundraising Readiness'];

function displayValue(metric) {
  if (!metric || metric.value == null) return 'NOT YET MEASURED';
  if (typeof metric.value === 'number') return metric.value.toLocaleString();
  if (Array.isArray(metric.value)) return metric.value.length ? `${metric.value.length} currencies` : 'NOT YET MEASURED';
  return String(metric.value);
}

function MetricCard({ label, metric, definition }) {
  return (
    <article className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 break-words text-xl font-bold text-gray-900 dark:text-white">{displayValue(metric)}</p>
      {metric?.state && <p className="mt-1 text-[11px] font-semibold text-primary dark:text-mint">{metric.state.replaceAll('_', ' ')}</p>}
      {definition && <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">{definition}</p>}
    </article>
  );
}

function StatusList({ title, values = {} }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
        {Object.entries(values).map(([key, value]) => (
          <div key={key} className="min-w-0 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
            <p className="break-words text-sm font-medium text-gray-800 dark:text-gray-200">{key.replaceAll(/([A-Z])/g, ' $1')}</p>
            <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{typeof value === 'string' ? value.replaceAll('_', ' ') : String(value)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function InvestorReadinessDashboard() {
  const [tab, setTab] = useState('Overview');
  const [range, setRange] = useState(30);
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    adminApi.investorReadiness({ range })
      .then(({ data: next }) => { if (!cancelled) { setData(next); setState('ready'); } })
      .catch((err) => { if (!cancelled) { setError(err.response?.data?.error || 'Unable to load investor metrics.'); setState('error'); } });
    return () => { cancelled = true; };
  }, [range]);

  if (state === 'loading') return <div className="space-y-4" aria-busy="true"><div className="h-8 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" /><div className="h-32 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" /></div>;
  if (state === 'error') return <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>;

  const cards = data?.overview || {};
  return (
    <AdminRouteGuard permission={PERMISSIONS.INVESTOR_READ}>
      <SeoHead title="Investor Readiness" noindex />
      <div className="min-w-0 w-full space-y-5">
        <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h1 className="break-words text-2xl font-bold text-gray-900 dark:text-white">Investor Readiness</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Internal aggregate metrics. Missing evidence is shown explicitly.</p></div>
          <label className="text-sm text-gray-600 dark:text-gray-300">Range <select className="ml-2 rounded border border-gray-300 bg-white px-2 py-2 dark:border-gray-600 dark:bg-gray-800" value={range} onChange={(e) => setRange(Number(e.target.value))}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
        </header>
        <div role="tablist" aria-label="Investor readiness sections" className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          {TABS.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`min-h-[44px] rounded-lg px-3 py-2 text-left text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === item ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}>{item}</button>)}
        </div>

        {tab === 'Overview' && <>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Registered Users" metric={cards.registeredUsers} definition="Eligible non-staff accounts in the selected period." />
            <MetricCard label="Verified Users" metric={cards.verifiedUsers} definition="Eligible accounts with verified email status." />
            <MetricCard label="Activated Users" metric={cards.activatedUsers} definition="No numeric value is shown until activation history is proven." />
            <MetricCard label="WAU" metric={cards.wau} definition="Unique eligible users with qualifying activity; historical coverage is partial." />
            <MetricCard label="MAU" metric={cards.mau} definition="Unique eligible users with qualifying activity; historical coverage is partial." />
            <MetricCard label="Verified Employers" metric={cards.verifiedEmployers} />
            <MetricCard label="Published Jobs" metric={cards.publishedJobs} />
            <MetricCard label="Internal Applications" metric={cards.internalApplications} definition="Application records created inside STRIDETO." />
            <MetricCard label="External Apply Clicks" metric={cards.externalApplyClicks} definition="Tracked outbound actions, not completed applications." />
            <MetricCard label="Search Volume" metric={cards.searchVolume} />
            <MetricCard label="Zero-result Rate" metric={cards.zeroResultRate} />
            <MetricCard label="Investor Readiness Score" metric={{ value: null, state: 'NOT_YET_MEASURED' }} definition="Scoring is withheld until all weighted evidence is auditable." />
          </div>
          <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800" aria-labelledby="investor-revenue-heading">
            <h2 id="investor-revenue-heading" className="text-lg font-semibold text-gray-900 dark:text-white">Completed payments by currency</h2>
            {Array.isArray(cards.revenueByCurrency?.value) && cards.revenueByCurrency.value.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cards.revenueByCurrency.value.map((row) => <div key={`${row.currency}-${row.status}`} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40"><p className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.currency} · {row.status}</p><p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{row.amount.toLocaleString()}</p></div>)}
              </div>
            ) : <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">NOT YET MEASURED</p>}
          </section>
          <StatusList title="Data Quality" values={data?.dataQuality} />
        </>}
        {tab === 'Traction' && <div className="space-y-4"><StatusList title="Traction coverage" values={{ registrations: 'available', activeUsers: data?.traction?.activeUsers?.wau?.state || 'partial_coverage', retention: 'not_yet_measured', acquisition: data?.traction?.acquisition?.state || 'not_yet_measured' }} /><StatusList title="Coverage warnings" values={data?.coverage} /></div>}
        {tab === 'Business Readiness' && <StatusList title="Business readiness" values={data?.businessReadiness} />}
        {tab === 'Fundraising Readiness' && <StatusList title="Fundraising evidence" values={{ status: data?.fundraisingReadiness?.state || 'not_tracked', note: 'Use approved fundraising materials outside this metrics view until persistence is authorized.' }} />}
      </div>
    </AdminRouteGuard>
  );
}
