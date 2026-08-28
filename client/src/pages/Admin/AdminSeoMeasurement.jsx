import { useCallback, useEffect, useState } from 'react';
import { SeoHead } from '../../components/seo';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../../config/rbac';
import { seoMeasurementApi } from '../../services/seoMeasurementApi';
import { MetricCard, TrendIndicator } from '../../components/analytics/InsightCharts';

function StateBadge({ state }) {
  const labels = {
    not_configured: 'Not configured',
    connected: 'Connected',
    manual_import_required: 'Manual import',
    no_data_available: 'No data',
    report_not_available: 'Report unavailable',
    not_available_to_property: 'Not available to property',
    stale: 'Stale',
    error: 'Error',
    valid_data: 'Data available',
    healthy: 'Healthy',
  };
  return (
    <span className="inline-flex text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
      {labels[state] || state || 'Unknown'}
    </span>
  );
}

function MetricValue({ value, state }) {
  if (state && !['valid_data', 'zero', 'healthy', 'connected'].includes(state)) {
    return <span className="text-sm text-gray-500 dark:text-gray-400">—</span>;
  }
  if (value === null || value === undefined) {
    return <span className="text-sm text-gray-500 dark:text-gray-400">—</span>;
  }
  return <span className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</span>;
}

function truncateUrl(url) {
  if (!url) return '';
  return url.length > 48 ? `${url.slice(0, 45)}…` : url;
}

export default function AdminSeoMeasurement() {
  const [range, setRange] = useState('28d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    seoMeasurementApi.dashboard({ range })
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load SEO measurement'))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'search', label: 'Search' },
    { id: 'ai', label: 'AI Visibility' },
    { id: 'referrals', label: 'Referrals' },
    { id: 'content', label: 'Content' },
    { id: 'technical', label: 'Technical health' },
  ];

  const gsc = data?.googleSearch;
  const genAi = data?.googleGenerativeAi;
  const bing = data?.bingSearch;
  const bingAi = data?.bingAi;
  const chatgpt = data?.chatgptReferrals;
  const connections = data?.connections;

  return (
    <AdminRouteGuard permission={PERMISSIONS.ANALYTICS_READ}>
      <>
        <SeoHead title="SEO & Discovery" description="Search measurement, AI visibility, and referral attribution" noindex />
        <div className="max-w-6xl min-w-0 w-full">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SEO &amp; Discovery</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
                Search Console, AI visibility, ChatGPT referrals, and technical SEO health. Unknown data is never shown as zero.
              </p>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
              {['7d', '28d', '90d'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`text-xs px-3 py-1.5 rounded border ${range === r ? 'bg-primary text-white border-primary' : 'border-gray-300 dark:border-gray-600'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-600 text-sm mb-4" role="alert">{error}</p>}
          {loading && <p className="text-sm text-gray-500">Loading…</p>}

          {!loading && data && (
            <>
              <nav className="flex flex-wrap gap-2 mb-6" aria-label="SEO dashboard sections">
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`text-sm px-3 py-1.5 rounded-lg ${tab === item.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              {tab === 'overview' && (
                <section aria-labelledby="seo-overview-heading">
                  <h2 id="seo-overview-heading" className="sr-only">Overview</h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <MetricCard title="Google Search Console" subtitle={<StateBadge state={connections?.googleSearchConsole?.state} />}>
                      <MetricValue value={gsc?.metrics?.clicks} state={gsc?.state} />
                      <p className="text-xs text-gray-500 mt-1">Clicks (traditional search)</p>
                    </MetricCard>
                    <MetricCard title="Google Generative AI" subtitle={<StateBadge state={genAi?.state} />}>
                      <MetricValue value={genAi?.metrics?.impressions} state={genAi?.state} />
                      <p className="text-xs text-gray-500 mt-1">AI impressions (manual import)</p>
                    </MetricCard>
                    <MetricCard title="ChatGPT referrals" subtitle={<StateBadge state={chatgpt?.state} />}>
                      <MetricValue value={chatgpt?.sessions} state={chatgpt?.state} />
                      <p className="text-xs text-gray-500 mt-1">Attributed sessions (utm_source=chatgpt.com)</p>
                    </MetricCard>
                  </div>
                  {data.opportunities?.length > 0 && (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Advisory opportunities</h3>
                      <ul className="space-y-2 text-sm">
                        {data.opportunities.map((o) => (
                          <li key={o.type}>
                            <span className="font-medium">{o.priority}</span>
                            {' — '}
                            {o.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {tab === 'search' && (
                <section aria-labelledby="seo-search-heading">
                  <h2 id="seo-search-heading" className="text-lg font-semibold mb-4">Traditional search</h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <MetricCard title="Impressions"><MetricValue value={gsc?.metrics?.impressions} state={gsc?.state} /></MetricCard>
                    <MetricCard title="Clicks"><MetricValue value={gsc?.metrics?.clicks} state={gsc?.state} /></MetricCard>
                    <MetricCard title="CTR">
                      <MetricValue
                        value={gsc?.metrics?.ctr != null ? `${(gsc.metrics.ctr * 100).toFixed(2)}%` : null}
                        state={gsc?.state}
                      />
                    </MetricCard>
                    <MetricCard title="Avg. position">
                      <MetricValue
                        value={gsc?.metrics?.averagePosition != null ? gsc.metrics.averagePosition.toFixed(1) : null}
                        state={gsc?.state}
                      />
                      {gsc?.trend && <TrendIndicator trend={gsc.trend.direction} value={gsc.trend.percentChange} />}
                    </MetricCard>
                  </div>
                  {connections?.googleSearchConsole?.state === 'not_configured' && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">Google Search Console not configured.</p>
                  )}
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 mt-4">
                    <h3 className="font-medium mb-2">Bing search</h3>
                    <StateBadge state={bing?.state} />
                    <div className="grid sm:grid-cols-2 gap-4 mt-3">
                      <MetricCard title="Impressions"><MetricValue value={bing?.metrics?.impressions} state={bing?.state} /></MetricCard>
                      <MetricCard title="Clicks"><MetricValue value={bing?.metrics?.clicks} state={bing?.state} /></MetricCard>
                    </div>
                  </div>
                </section>
              )}

              {tab === 'ai' && (
                <section aria-labelledby="seo-ai-heading">
                  <h2 id="seo-ai-heading" className="text-lg font-semibold mb-4">AI visibility</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Google AI impressions, Bing AI citations, and ChatGPT referrals are separate units and are not summed.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-lg border p-4">
                      <h3 className="font-medium">Google Generative AI (AI Overviews / AI Mode)</h3>
                      <StateBadge state={genAi?.state} />
                      <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                        No official Search Analytics API for this report. Export from Search Console and import via API when needed.
                        Exported <code>0</code> values from <code>~</code>/<code>-</code> UI cells are ambiguous unless confirmed with <code>metricStates</code>.
                      </p>
                      <dl className="mt-3 text-sm grid grid-cols-2 gap-2">
                        <dt>Impressions</dt>
                        <dd><MetricValue value={genAi?.metrics?.impressions} state={genAi?.state} /></dd>
                        <dt>AI-visible pages</dt>
                        <dd><MetricValue value={genAi?.metrics?.visiblePages} state={genAi?.state} /></dd>
                      </dl>
                    </div>
                    <div className="rounded-lg border p-4">
                      <h3 className="font-medium">Bing AI Performance</h3>
                      <StateBadge state={bingAi?.state} />
                      <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                        Citations are not clicks or visits. Manual CSV/Excel export workflow applies until REST API ships.
                      </p>
                      <dl className="mt-3 text-sm grid grid-cols-2 gap-2">
                        <dt>Total citations</dt>
                        <dd><MetricValue value={bingAi?.metrics?.totalCitations} state={bingAi?.state} /></dd>
                        <dt>Avg. cited pages</dt>
                        <dd><MetricValue value={bingAi?.metrics?.averageCitedPages} state={bingAi?.state} /></dd>
                      </dl>
                    </div>
                  </div>
                </section>
              )}

              {tab === 'referrals' && (
                <section aria-labelledby="seo-referrals-heading">
                  <h2 id="seo-referrals-heading" className="text-lg font-semibold mb-4">ChatGPT referral attribution</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Primary signal: {chatgpt?.attributionRule}. No prompt, citation count, or ranking claims.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4 mb-6">
                    <MetricCard title="Sessions"><MetricValue value={chatgpt?.sessions} state={chatgpt?.state} /></MetricCard>
                    <MetricCard title="Application clicks"><MetricValue value={chatgpt?.applicationClicks} state={chatgpt?.state} /></MetricCard>
                    <MetricCard title="Trend">
                      {chatgpt?.trend && (
                        <TrendIndicator trend={chatgpt.trend.direction} value={chatgpt.trend.percentChange} />
                      )}
                    </MetricCard>
                  </div>
                  {chatgpt?.landingPages?.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <caption className="sr-only">Top ChatGPT landing pages</caption>
                        <thead>
                          <tr className="text-left border-b">
                            <th scope="col" className="py-2 pr-4">Landing page</th>
                            <th scope="col" className="py-2 pr-4">Page group</th>
                            <th scope="col" className="py-2">Events</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chatgpt.landingPages.map((row) => (
                            <tr key={row.page} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 pr-4 max-w-[12rem] truncate" title={row.page}>{truncateUrl(row.page)}</td>
                              <td className="py-2 pr-4">{row.pageGroup}</td>
                              <td className="py-2">{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {tab === 'content' && (
                <section aria-labelledby="seo-content-heading">
                  <h2 id="seo-content-heading" className="text-lg font-semibold mb-4">Content performance by page group</h2>
                  <StateBadge state={data.contentPerformance?.state} />
                  {data.contentPerformance?.groups?.length > 0 ? (
                    <table className="min-w-full text-sm mt-4">
                      <caption className="sr-only">Page group views</caption>
                      <thead>
                        <tr className="text-left border-b">
                          <th scope="col" className="py-2">Page group</th>
                          <th scope="col" className="py-2">Views</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.contentPerformance.groups.map((g) => (
                          <tr key={g.pageGroup} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2">{g.pageGroup}</td>
                            <td className="py-2">{g.views}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-gray-500 mt-2">No first-party page-group data for this period.</p>
                  )}
                </section>
              )}

              {tab === 'technical' && (
                <section aria-labelledby="seo-technical-heading">
                  <h2 id="seo-technical-heading" className="text-lg font-semibold mb-4">Technical SEO health</h2>
                  <ul className="space-y-2 text-sm">
                    {Object.entries(data.technicalHealth || {}).map(([key, val]) => (
                      <li key={key} className="flex flex-wrap items-center gap-2">
                        <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <StateBadge state={val.state} />
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-4">Worker remains stopped by policy. External provider failures do not affect public pages.</p>
                </section>
              )}
            </>
          )}
        </div>
      </>
    </AdminRouteGuard>
  );
}
