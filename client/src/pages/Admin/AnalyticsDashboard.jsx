import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { PERMISSIONS } from '../../config/rbac';
import { contentInsightsApi } from '../../services/contentInsightsApi';
import { AnalyticsDateRangeFilter } from '../../components/analytics/AnalyticsDateRangeFilter';
import {
  ChartPanel,
  MetricCard,
  SimpleBarChart,
  SimpleHorizontalChart,
  SimpleLineChart,
  SimplePieChart,
  TrendIndicator,
} from '../../components/analytics/InsightCharts';

/**
 * Platform Analytics & Content Insights dashboard (C.7.0.5).
 * Replaces the legacy thin analytics view with the full insights platform.
 */
export default function AnalyticsDashboard() {
  const { t } = useTranslation(['admin', 'common']);
  const [range, setRange] = useState('7d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { range };
    if (range === 'custom' && from && to) {
      params.from = from;
      params.to = to;
    }
    contentInsightsApi.dashboard(params)
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(e.response?.data?.error || t('admin:failedLoadAnalytics')))
      .finally(() => setLoading(false));
  }, [range, from, to, t]);

  useEffect(() => { load(); }, [load]);

  const downloadExport = async (format) => {
    try {
      const params = { range, format };
      if (range === 'custom' && from && to) {
        params.from = from;
        params.to = to;
      }
      const { data: blob } = await contentInsightsApi.export(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'xlsx' || format === 'excel'
        ? 'content-insights.xlsx'
        : format === 'pdf' || format === 'summary'
          ? 'content-insights-summary.txt'
          : 'content-insights.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed');
    }
  };

  const cards = data?.overview?.cards || {};
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'search', label: 'Search' },
    { id: 'content', label: 'Content' },
    { id: 'ads', label: 'Ads' },
    { id: 'forms', label: 'Forms' },
    { id: 'media', label: 'Media' },
    { id: 'blocks', label: 'Dynamic Blocks' },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.ANALYTICS_READ}>
      <>
        <SeoHead title={t('admin:analyticsDashboard')} description={t('admin:analyticsSeoDesc')} noindex />
        <div className="max-w-6xl min-w-0 w-full print:max-w-none">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6 print:mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Analytics & Content Insights
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
                Platform search, content, ads, forms, media, and dynamic block performance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <button type="button" onClick={() => downloadExport('csv')} className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">
                CSV
              </button>
              <button type="button" onClick={() => downloadExport('xlsx')} className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">
                Excel
              </button>
              <button type="button" onClick={() => downloadExport('summary')} className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">
                Summary
              </button>
              <button type="button" onClick={() => window.print()} className="text-xs px-3 py-1.5 rounded border border-primary text-primary hover:bg-primary/5">
                Print
              </button>
            </div>
          </div>

          <div className="mb-6 print:hidden">
            <AnalyticsDateRangeFilter
              range={range}
              from={from}
              to={to}
              onChange={({ range: r, from: f, to: tVal }) => {
                setRange(r);
                setFrom(f || '');
                setTo(tVal || '');
              }}
            />
          </div>

          {loading ? (
            <div className="animate-pulse space-y-4" role="status" aria-label="Loading analytics">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                ))}
              </div>
            </div>
          ) : null}

          {error ? <p className="text-red-600 dark:text-red-400 mb-4" role="alert">{error}</p> : null}

          {!loading && data ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                <MetricCard
                  title="Today's Views"
                  value={cards.viewsToday}
                  trend={<TrendIndicator current={cards.viewsToday} previous={Math.round((cards.views7d || 0) / 7)} label="views" />}
                />
                <MetricCard title="7 Day Views" value={cards.views7d} />
                <MetricCard title="30 Day Views" value={cards.views30d} />
                <MetricCard title="Searches" value={cards.searches} hint={`${data.search?.averageResponseTimeMs ?? 0}ms avg`} />
                <MetricCard title="Form Submissions" value={cards.formSubmissions} />
                <MetricCard title="Ad CTR" value={`${cards.adCtr ?? 0}%`} hint={`${cards.adClicks ?? 0} clicks`} />
              </div>

              <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 print:hidden" role="tablist">
                {tabs.map((tb) => (
                  <button
                    key={tb.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === tb.id}
                    onClick={() => setTab(tb.id)}
                    className={`text-sm px-3 py-2 border-b-2 -mb-px transition-colors ${
                      tab === tb.id
                        ? 'border-primary text-primary font-medium'
                        : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>

              {tab === 'overview' ? (
                <div className="grid lg:grid-cols-2 gap-4">
                  <ChartPanel title="Traffic (daily views)">
                    <SimpleLineChart data={data.content?.daily || []} area />
                  </ChartPanel>
                  <ChartPanel title="Top Pages">
                    <SimpleHorizontalChart data={data.content?.topPages || []} />
                  </ChartPanel>
                  <ChartPanel title="Top Searches">
                    <SimpleHorizontalChart data={data.search?.topSearches || []} />
                  </ChartPanel>
                  <ChartPanel title="Top Ads (by clicks)">
                    <SimpleHorizontalChart
                      data={(data.ads?.topAds || []).map((a) => ({ label: a.label, value: a.clicks }))}
                    />
                  </ChartPanel>
                  <ChartPanel title="Top Dynamic Blocks">
                    <SimplePieChart data={data.dynamic?.topBlockTypes || []} />
                  </ChartPanel>
                  <ChartPanel title="Search volume">
                    <SimpleBarChart data={data.search?.daily || []} />
                  </ChartPanel>
                </div>
              ) : null}

              {tab === 'search' ? (
                <div className="grid lg:grid-cols-2 gap-4">
                  <ChartPanel title="Top Searches">
                    <SimpleHorizontalChart data={data.search?.topSearches || []} />
                  </ChartPanel>
                  <ChartPanel title="Zero-result Searches">
                    <SimpleHorizontalChart data={data.search?.zeroResultSearches || []} emptyLabel="No zero-result queries" />
                  </ChartPanel>
                  <ChartPanel title="Daily search volume">
                    <SimpleLineChart data={data.search?.daily || []} area />
                  </ChartPanel>
                  <ChartPanel title="Search health">
                    <ul className="space-y-3 text-sm">
                      <li className="flex justify-between"><span>Total queries</span><strong>{data.search?.totalQueries ?? 0}</strong></li>
                      <li className="flex justify-between"><span>Click-through rate</span><strong>{data.search?.clickThroughRate ?? 0}%</strong></li>
                      <li className="flex justify-between"><span>Avg response time</span><strong>{data.search?.averageResponseTimeMs ?? 0} ms</strong></li>
                    </ul>
                  </ChartPanel>
                </div>
              ) : null}

              {tab === 'content' ? (
                <div className="grid lg:grid-cols-2 gap-4">
                  <ChartPanel title="Most viewed content">
                    <SimpleHorizontalChart data={data.content?.topContent || []} />
                  </ChartPanel>
                  <ChartPanel title="Search clicks">
                    <SimpleHorizontalChart data={data.content?.searchClicks || []} />
                  </ChartPanel>
                  <ChartPanel title="Views over time" className="lg:col-span-2">
                    <SimpleBarChart data={data.content?.daily || []} height={180} />
                  </ChartPanel>
                </div>
              ) : null}

              {tab === 'ads' ? (
                <div className="grid lg:grid-cols-2 gap-4">
                  <ChartPanel title="Ad performance">
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between"><span>Impressions</span><strong>{data.ads?.totals?.impressions ?? 0}</strong></li>
                      <li className="flex justify-between"><span>Clicks</span><strong>{data.ads?.totals?.clicks ?? 0}</strong></li>
                      <li className="flex justify-between"><span>CTR</span><strong>{data.ads?.totals?.ctr ?? 0}%</strong></li>
                      <li className="flex justify-between"><span>Active slots</span><strong>{data.ads?.totals?.slots ?? 0}</strong></li>
                    </ul>
                  </ChartPanel>
                  <ChartPanel title="Top placements">
                    <SimpleHorizontalChart
                      data={(data.ads?.topPlacements || []).map((p) => ({ label: p.label, value: p.impressions }))}
                    />
                  </ChartPanel>
                  <ChartPanel title="Top creatives" className="lg:col-span-2">
                    <div className="table-scroll">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
                            <th className="py-2 pr-2">Ad</th>
                            <th className="py-2 pr-2">Impr.</th>
                            <th className="py-2 pr-2">Clicks</th>
                            <th className="py-2 pr-2">CTR</th>
                            <th className="py-2">Remaining</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.ads?.topAds || []).map((a) => (
                            <tr key={a.id} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 pr-2">{a.label}</td>
                              <td className="py-2 pr-2">{a.impressions}</td>
                              <td className="py-2 pr-2">{a.clicks}</td>
                              <td className="py-2 pr-2">{a.ctr}%</td>
                              <td className="py-2 text-gray-500">
                                {a.remainingImpressions != null ? `${a.remainingImpressions} impr` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ChartPanel>
                </div>
              ) : null}

              {tab === 'forms' ? (
                <div className="grid lg:grid-cols-2 gap-4">
                  <ChartPanel title="Most submitted forms">
                    <SimpleHorizontalChart data={data.forms?.topForms || []} />
                  </ChartPanel>
                  <ChartPanel title="Daily submissions">
                    <SimpleLineChart data={data.forms?.daily || []} area />
                  </ChartPanel>
                  <ChartPanel title="Forms health">
                    <ul className="space-y-3 text-sm">
                      <li className="flex justify-between"><span>Published forms</span><strong>{data.forms?.publishedForms ?? 0}</strong></li>
                      <li className="flex justify-between"><span>Total submissions</span><strong>{data.forms?.totalSubmissions ?? 0}</strong></li>
                      <li className="flex justify-between"><span>Spam blocked</span><strong>{data.forms?.spamBlocked ?? 0}</strong></li>
                      <li className="flex justify-between"><span>File uploads</span><strong>{data.forms?.fileUploads ?? 0}</strong></li>
                    </ul>
                  </ChartPanel>
                  <ChartPanel title="Submission mix">
                    <SimplePieChart data={data.forms?.topForms || []} />
                  </ChartPanel>
                </div>
              ) : null}

              {tab === 'media' ? (
                <div className="grid lg:grid-cols-2 gap-4">
                  <ChartPanel title="Storage">
                    <ul className="space-y-3 text-sm">
                      <li className="flex justify-between"><span>Total assets</span><strong>{data.media?.totalAssets ?? 0}</strong></li>
                      <li className="flex justify-between"><span>Storage</span><strong>{data.media?.storageMb ?? 0} MB</strong></li>
                      <li className="flex justify-between"><span>Downloads / views</span><strong>{data.media?.downloadsAndViews ?? 0}</strong></li>
                      <li className="flex justify-between"><span>Sample unused</span><strong>{data.media?.sampleUnused ?? 0}</strong></li>
                    </ul>
                  </ChartPanel>
                  <ChartPanel title="Largest files">
                    <SimpleHorizontalChart
                      data={(data.media?.largest || []).map((f) => ({
                        label: f.label,
                        value: Math.round((f.value || 0) / 1024),
                      }))}
                      emptyLabel="No media assets"
                    />
                  </ChartPanel>
                  <ChartPanel title="Most used assets" className="lg:col-span-2">
                    <SimpleHorizontalChart data={data.media?.mostUsed || []} emptyLabel="No usage data in sample" />
                  </ChartPanel>
                </div>
              ) : null}

              {tab === 'blocks' ? (
                <div className="grid lg:grid-cols-2 gap-4">
                  <ChartPanel title="Block types">
                    <SimplePieChart data={data.dynamic?.topBlockTypes || []} />
                  </ChartPanel>
                  <ChartPanel title="Dynamic block metrics">
                    <ul className="space-y-3 text-sm">
                      <li className="flex justify-between"><span>Renders</span><strong>{data.dynamic?.renderCount ?? 0}</strong></li>
                      <li className="flex justify-between"><span>Clicks</span><strong>{data.dynamic?.clickCount ?? 0}</strong></li>
                      <li className="flex justify-between"><span>CTR</span><strong>{data.dynamic?.ctr ?? 0}%</strong></li>
                      <li className="flex justify-between"><span>Empty renders</span><strong>{data.dynamic?.emptyBlockFrequency ?? 0}</strong></li>
                      <li className="flex justify-between"><span>Cache entries</span><strong>{data.dynamic?.cache?.dynamic?.size ?? 0}</strong></li>
                    </ul>
                    <p className="text-xs text-gray-400 mt-4">{data.dynamic?.cache?.note}</p>
                  </ChartPanel>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </>
    </AdminRouteGuard>
  );
}
