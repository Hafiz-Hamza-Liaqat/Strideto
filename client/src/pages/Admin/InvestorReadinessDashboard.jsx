import { useEffect, useState } from 'react';
import { SeoHead } from '../../components/seo';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { adminApi } from '../../services/listingsService';
import { PERMISSIONS } from '../../config/rbac';

const TABS = ['Overview', 'Traction', 'Business Readiness', 'Fundraising Readiness'];

const DISPLAY_LABELS = Object.freeze({
  monetizationModel: 'Monetization Model',
  pricingValidation: 'Pricing Validation',
  paidValidation: 'Paid Validation',
  employerValidation: 'Employer Validation',
  marketplaceValidation: 'Marketplace Validation',
  repeatBehavior: 'Repeat Behavior',
  revenueReadiness: 'Revenue Readiness',
  cac: 'CAC',
  ltv: 'LTV',
  dataQuality: 'Data Quality',
});

function displayLabel(key) {
  return DISPLAY_LABELS[key] || key.replaceAll(/([A-Z])/g, ' $1').trim();
}

function displayStatus(value) {
  if (value == null) return 'NOT YET MEASURED';
  if (typeof value === 'string') return value.replaceAll('_', ' ');
  if (Array.isArray(value)) return value.length ? value.join(' • ') : 'NOT YET MEASURED';
  if (typeof value !== 'object') return String(value);
  const status = value.state || value.status || 'NOT YET MEASURED';
  const detail = value.detail || value.message || value.reason || '';
  return [status.replaceAll('_', ' '), detail].filter(Boolean).join(' — ');
}

function formatMetricValue(key, metric) {
  if (!metric || metric.value == null) return 'NOT YET MEASURED';
  if ((key === 'zeroResultRate' || key === 'coverageRate') && typeof metric.value === 'number') {
    return `${(metric.value * 100).toFixed(1).replace(/\.0$/, '')}%`;
  }
  if (typeof metric.value === 'number') return metric.value.toLocaleString();
  if (Array.isArray(metric.value)) return metric.value.length ? `${metric.value.length} currencies` : 'NOT YET MEASURED';
  return displayStatus(metric.value);
}

function MetricCard({ label, metric, definition, metricKey }) {
  return (
    <article className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 break-words text-xl font-bold text-gray-900 dark:text-white">{formatMetricValue(metricKey, metric)}</p>
      {metric?.state && <p className="mt-1 text-[11px] font-semibold text-primary dark:text-mint">{displayStatus(metric.state)}</p>}
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
            <p className="break-words text-sm font-medium text-gray-800 dark:text-gray-200">{displayLabel(key)}</p>
            <p className="mt-1 break-words text-xs font-semibold text-gray-500 dark:text-gray-400">{displayStatus(value)}</p>
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
            <MetricCard metricKey="registeredUsers" label="Registered Users" metric={cards.registeredUsers} definition="Eligible non-staff accounts in the selected period." />
            <MetricCard metricKey="verifiedUsers" label="Verified Users" metric={cards.verifiedUsers} definition="Eligible accounts with verified email status." />
            <MetricCard metricKey="activatedUsers" label="Activated Users" metric={cards.activatedUsers} definition="No numeric value is shown until activation history is proven." />
            <MetricCard metricKey="wau" label="WAU" metric={cards.wau} definition="Unique eligible users with qualifying activity; historical coverage is partial." />
            <MetricCard metricKey="mau" label="MAU" metric={cards.mau} definition="Unique eligible users with qualifying activity; historical coverage is partial." />
            <MetricCard metricKey="verifiedEmployers" label="Verified Employers" metric={cards.verifiedEmployers} />
            <MetricCard metricKey="publishedJobs" label="Published Jobs" metric={cards.publishedJobs} />
            <MetricCard metricKey="internalApplications" label="Internal Applications" metric={cards.internalApplications} definition="Application records created inside STRIDETO." />
            <MetricCard metricKey="externalApplyClicks" label="External Apply Clicks" metric={cards.externalApplyClicks} definition="Tracked outbound actions, not completed applications." />
            <MetricCard metricKey="searchVolume" label="Search Volume" metric={cards.searchVolume} />
            <MetricCard metricKey="zeroResultRate" label="Zero-result Rate" metric={cards.zeroResultRate} />
            <MetricCard metricKey="readinessScore" label="Investor Readiness Score" metric={{ value: null, state: 'NOT_YET_MEASURED' }} definition="Scoring is withheld until all weighted evidence is auditable." />
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
        {tab === 'Traction' && <div className="space-y-4">
          <StatusList title="Traction coverage" values={{ registrations: 'available', activeUsers: data?.traction?.activeUsers?.wau?.state || 'partial_coverage', retention: 'not_yet_measured', acquisition: data?.traction?.acquisition?.state || 'not_yet_measured' }} />
          <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Acquisition conversions</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Server-recorded production conversions only. Historical events are not backfilled.</p>
            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Attributed Registrations', 'attributedRegistrations', 'Registrations with approved first-touch attribution.'],
                ['Attribution Coverage', 'coverageRate', 'Attributed registrations divided by canonical registrations.'],
                ['Verified Registrations', 'verifiedRegistrations', 'Canonical account-verification transitions.'],
                ['Activated Users', 'activatedUsers', 'Verified users reaching a canonical activation milestone.'],
                ['Employer Registrations', 'employerRegistrations', 'Canonical employer account creations.'],
                ['Employer Activations', 'employerActivations', 'Verified employers reaching their first published Job.'],
                ['First Published Jobs', 'firstPublishedJobs', 'Canonical publication transitions recorded by the server.'],
                ['Primary Candidate Conversions', 'primaryCandidateConversions', 'Internal Application records created inside STRIDETO.'],
              ].map(([label, key, definition]) => <MetricCard key={key} label={label} metricKey={key} metric={{ value: data?.traction?.acquisition?.[key], state: data?.traction?.acquisition?.state || 'NOT_YET_MEASURED' }} definition={definition} />)}
            </div>
            <StatusList title="Registrations by source" values={data?.traction?.acquisition?.bySource} />
            <StatusList title="Registrations by medium" values={data?.traction?.acquisition?.byMedium} />
            <StatusList title="Registrations by campaign" values={data?.traction?.acquisition?.byCampaign} />
          </section>
          <StatusList title="Coverage warnings" values={data?.coverage} />
        </div>}
        {tab === 'Business Readiness' && <StatusList title="Business readiness" values={data?.businessReadiness} />}
        {tab === 'Fundraising Readiness' && <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Fundraising evidence</h2><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Use approved fundraising materials outside this metrics view until persistence is authorized.</p><div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">{(data?.fundraisingReadiness?.items || []).map((item) => <div key={item.label} className="min-w-0 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40"><p className="break-words text-sm font-medium text-gray-800 dark:text-gray-200">{item.label}</p><p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{displayStatus(item.state)}</p></div>)}</div></section>}
      </div>
    </AdminRouteGuard>
  );
}
