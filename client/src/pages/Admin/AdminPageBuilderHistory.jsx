import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminLocaleSelect } from '../../components/admin/AdminCmsFields';
import { ResolvedBlockListRenderer } from '../../components/pageBuilder/ResolvedBlockListRenderer';
import { RevisionBadges, RevisionComparePanel } from '../../components/pageBuilder/RevisionComparePanel';
import { PERMISSIONS } from '../../config/rbac';
import { ROUTES } from '../../constants';
import { adminContentApi } from '../../services/adminContentApi';
import { useToast } from '../../context/ToastContext';
import { actionDisplayLabel } from '@shared/pageBuilderRevisionDiff.js';
import { listPilotPageBuilderPages } from '@shared/pageBuilderConfig.js';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const PILOT_PAGES = listPilotPageBuilderPages();
const DEFAULT_PAGE_KEY = PILOT_PAGES[0]?.pageKey || 'about';

export default function AdminPageBuilderHistory() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [pageKey, setPageKey] = useState(searchParams.get('pageKey') || DEFAULT_PAGE_KEY);
  const [locale, setLocale] = useState(searchParams.get('locale') || 'en');
  const [timeline, setTimeline] = useState(searchParams.get('timeline') || 'all');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  const [compareFrom, setCompareFrom] = useState(null);
  const [compareTo, setCompareTo] = useState(null);
  const [compareTimeline, setCompareTimeline] = useState('draft');
  const [compareResult, setCompareResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [showRawCompare, setShowRawCompare] = useState(false);

  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const trimmedPageKey = pageKey.trim();

  const load = useCallback(async () => {
    if (!trimmedPageKey) return;
    setLoading(true);
    try {
      const { data } = await adminContentApi.listPageLayoutRevisions(trimmedPageKey, locale, {
        timeline: timeline === 'all' ? undefined : timeline,
        page,
        limit: 15,
      });
      setItems(data?.data || []);
      setPagination(data?.pagination || { total: 0, totalPages: 1 });
    } catch {
      toast.error('Failed to load revision history');
    } finally {
      setLoading(false);
    }
  }, [trimmedPageKey, locale, timeline, page, toast]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('pageKey', pageKey);
    next.set('locale', locale);
    if (timeline !== 'all') next.set('timeline', timeline);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [pageKey, locale, timeline, page, setSearchParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!compareFrom || !compareTo || compareFrom === compareTo) {
      setCompareResult(null);
      return undefined;
    }

    let cancelled = false;
    setCompareLoading(true);
    adminContentApi
      .comparePageLayoutRevisions(compareFrom, compareTo, { timeline: compareTimeline })
      .then(({ data }) => {
        if (!cancelled) setCompareResult(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('Compare failed');
      })
      .finally(() => {
        if (!cancelled) setCompareLoading(false);
      });

    return () => { cancelled = true; };
  }, [compareFrom, compareTo, compareTimeline, toast]);

  const actionLabel = useCallback((action) => actionDisplayLabel(action), []);

  const restore = async (revision) => {
    const note = window.prompt(
      `Restore version ${revision.version} to draft?\n\nThis creates a new revision and does not delete history.\nOptional note:`,
      `Restored from version ${revision.version}`,
    );
    if (note === null) return;

    try {
      await adminContentApi.restorePageLayoutRevision(trimmedPageKey, locale, revision._id, { changeNote: note });
      toast.success(`Restored version ${revision.version} — new revision created`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Restore failed');
    }
  };

  const removeRevision = async (revision) => {
    if (!window.confirm(`Delete version ${revision.version}? This cannot be undone.`)) return;
    try {
      await adminContentApi.deletePageLayoutRevision(revision._id);
      toast.success('Revision deleted');
      if (compareFrom === revision._id) setCompareFrom(null);
      if (compareTo === revision._id) setCompareTo(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const openPreview = async (revision) => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const tl = revision.timeline === 'published' ? 'published' : 'draft';
      const { data } = await adminContentApi.previewPageLayoutRevision(revision._id, { timeline: tl });
      setPreviewData(data);
    } catch {
      toast.error('Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  const timelineTabs = useMemo(() => ([
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Draft timeline' },
    { id: 'published', label: 'Published timeline' },
  ]), []);

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_SITE}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Page Builder — History</h1>
            <p className="text-sm text-gray-500 mt-1">
              Revision timeline, compare any two versions, preview or restore without losing audit history.
            </p>
          </div>
          <Link
            to={`${ROUTES.ADMIN}/page-builder?pageKey=${encodeURIComponent(trimmedPageKey)}&locale=${locale}`}
            className="text-sm text-primary underline"
          >
            ← Page Builder
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-gray-700 dark:text-gray-300">Page key</span>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm [color-scheme:light] dark:[color-scheme:dark]"
              value={PILOT_PAGES.some((p) => p.pageKey === pageKey) ? pageKey : '__custom__'}
              onChange={(e) => {
                if (e.target.value !== '__custom__') {
                  setPageKey(e.target.value);
                  setPage(1);
                }
              }}
            >
              {PILOT_PAGES.map((p) => (
                <option key={p.pageKey} value={p.pageKey}>{p.displayName} ({p.pageKey})</option>
              ))}
              <option value="__custom__">Custom key…</option>
            </select>
          </label>
          <AdminLocaleSelect value={locale} onChange={(v) => { setLocale(v); setPage(1); }} />
        </div>

        <div className="flex flex-wrap gap-2">
          {timelineTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setTimeline(tab.id); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                timeline === tab.id
                  ? 'bg-primary text-white border-primary'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500">Loading history…</p>
        ) : (
          <div className="space-y-2">
            {items.map((rev) => (
              <div
                key={rev._id}
                className="flex flex-wrap items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-2 min-w-[4rem]">
                  <span className="font-mono font-bold text-lg">v{rev.version}</span>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-medium">{actionLabel(rev.action)}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(rev.createdAt).toLocaleString()}
                    {rev.createdByEmail ? ` · ${rev.createdByEmail}` : ''}
                  </p>
                  {rev.changeNote ? <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{rev.changeNote}</p> : null}
                  {rev.restoredFromVersion ? (
                    <p className="text-xs text-amber-600">Restored from v{rev.restoredFromVersion}</p>
                  ) : null}
                  <div className="mt-1">
                    <RevisionBadges revision={rev} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="text-xs flex items-center gap-1">
                    <input
                      type="radio"
                      name="compareFrom"
                      checked={compareFrom === rev._id}
                      onChange={() => setCompareFrom(rev._id)}
                    />
                    From
                  </label>
                  <label className="text-xs flex items-center gap-1">
                    <input
                      type="radio"
                      name="compareTo"
                      checked={compareTo === rev._id}
                      onChange={() => setCompareTo(rev._id)}
                    />
                    To
                  </label>
                  <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => openPreview(rev)}>
                    Preview
                  </button>
                  <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => restore(rev)}>
                    Restore
                  </button>
                  {!rev.isCurrentDraft && !rev.isCurrentPublished ? (
                    <button
                      type="button"
                      className="text-xs px-2 py-1 border border-red-300 text-red-600 rounded"
                      onClick={() => removeRevision(rev)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {!items.length ? (
              <p className="text-sm text-gray-500">No revisions yet. Save a draft from the Page Builder to create the first revision.</p>
            ) : null}
          </div>
        )}

        {pagination.totalPages > 1 ? (
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span>Page {page} of {pagination.totalPages} ({pagination.total} revisions)</span>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        ) : null}

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Version compare</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-1">
                Timeline
                <select
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-2 py-1 text-sm [color-scheme:light] dark:[color-scheme:dark]"
                  value={compareTimeline}
                  onChange={(e) => setCompareTimeline(e.target.value)}
                >
                  <option value="draft">Draft blocks</option>
                  <option value="published">Published blocks</option>
                </select>
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={showRawCompare} onChange={(e) => setShowRawCompare(e.target.checked)} />
                Raw JSON
              </label>
            </div>
          </div>
          <RevisionComparePanel compareResult={compareResult} loading={compareLoading} showRaw={showRawCompare} />
        </div>

        {previewLoading || previewData ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <EscapeWhen active onEscape={() => { setPreviewData(null); setPreviewLoading(false); }} />
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-900 border shadow-xl">
              <div className="sticky top-0 flex items-center justify-between gap-2 px-4 py-3 border-b bg-white dark:bg-gray-900">
                <h3 className="font-semibold">
                  Preview {previewData ? `v${previewData.version}` : ''}
                  {previewData?.timeline ? ` (${previewData.timeline})` : ''}
                </h3>
                <button
                  type="button"
                  className="px-3 py-1 text-sm border rounded"
                  onClick={() => { setPreviewData(null); setPreviewLoading(false); }}
                >
                  Close
                </button>
              </div>
              <div className="p-4">
                {previewLoading ? (
                  <p className="text-gray-500">Loading preview…</p>
                ) : (
                  <>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                      Read-only preview — does not change draft or public site.
                    </p>
                    <ResolvedBlockListRenderer blocks={previewData?.blocks || []} preview adminContext />
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminRouteGuard>
  );
}
