import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminLocaleSelect } from '../../components/admin/AdminCmsFields';
import { AdminBlockEditor, getPageValidationSummary } from '../../components/pageBuilder/AdminBlockEditor';
import { ResolvedBlockListRenderer } from '../../components/pageBuilder/ResolvedBlockListRenderer';
import { PageBuilderDiagnosticsPanel } from '../../components/pageBuilder/PageBuilderDiagnosticsPanel';
import { usePageBuilderDraft } from '../../hooks/usePageBuilderDraft';
import { usePageBuilderAutosave } from '../../hooks/usePageBuilderAutosave';
import { usePageBuilderRecovery } from '../../hooks/usePageBuilderRecovery';
import { useGlobalBlocksBatch } from '../../hooks/useGlobalBlocks';
import { collectGlobalBlockIds } from '@shared/pageBuilderGlobalBlocks.js';
import { layoutRequestKey } from '../../hooks/pageBuilderDraftUtils';
import { adminContentApi } from '../../services/adminContentApi';
import { ROUTES } from '../../constants';
import { reindexBlocks } from '@shared/blockSchema.js';
import { listPilotPageBuilderPages } from '@shared/pageBuilderConfig.js';
import { clearRecoveryDraft } from '@shared/pageBuilderRecovery.js';

const PILOT_PAGES = listPilotPageBuilderPages();
const DEFAULT_PAGE_KEY = PILOT_PAGES[0]?.pageKey || 'about';

const UNSAVED_MSG = 'You have unsaved changes. Leave without saving?';

function AutosaveStatus({ status, onRetry }) {
  if (status === 'idle') return null;
  const labels = {
    pending: 'Autosave pending…',
    saving: 'Saving…',
    saved: 'Saved',
    offline: 'Offline — draft stored locally',
    error: 'Autosave failed',
  };
  const tone = {
    pending: 'text-gray-500',
    saving: 'text-blue-600',
    saved: 'text-green-600',
    offline: 'text-amber-600',
    error: 'text-red-600',
  }[status] || 'text-gray-500';

  return (
    <p className={`text-xs mt-1 ${tone}`} role="status" aria-live="polite">
      {labels[status] || status}
      {status === 'error' || status === 'offline' ? (
        <button type="button" className="ml-2 underline" onClick={onRetry}>Retry</button>
      ) : null}
    </p>
  );
}

export default function AdminPageBuilder() {
  const { t } = useTranslation(['admin', 'common']);
  const toast = useToast();
  const { can } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  const [pageKey, setPageKey] = useState(searchParams.get('pageKey') || DEFAULT_PAGE_KEY);
  const [locale, setLocale] = useState(searchParams.get('locale') || 'en');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(searchParams.get('preview') === '1');
  const [livePreview, setLivePreview] = useState(searchParams.get('live') !== '0');

  const saveInFlightRef = useRef(false);
  const publishInFlightRef = useRef(false);

  const handleLoadError = useCallback((message) => {
    toast.error(message);
  }, [toast]);

  const {
    title,
    setTitle,
    draftBlocks,
    setDraftBlocks,
    status,
    publishedAt,
    setPublishedAt,
    loading,
    synced,
    isDirty,
    applySavedLayout,
    baselineSnapshot,
  } = usePageBuilderDraft(pageKey, locale, { onLoadError: handleLoadError });

  const { autosaveStatus, bumpManualSave, retryAutosave } = usePageBuilderAutosave({
    pageKey,
    locale,
    title,
    draftBlocks,
    isDirty,
    synced,
    loading,
    saving,
    publishing,
    baselineSnapshot,
    applySavedLayout,
    enabled: true,
  });

  const handleRecoveryRestore = useCallback(({ title: recoveredTitle, draftBlocks: recoveredBlocks }) => {
    setTitle(recoveredTitle);
    setDraftBlocks(recoveredBlocks);
    toast.success('Recovered unsaved changes');
  }, [toast]);

  const {
    showRecoveryPrompt,
    recovery,
    restoreRecovery,
    discardRecovery,
  } = usePageBuilderRecovery({
    pageKey,
    locale,
    loading,
    baselineSnapshot,
    title,
    draftBlocks,
    onRestore: handleRecoveryRestore,
  });

  const confirmDiscard = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm(UNSAVED_MSG);
  }, [isDirty]);

  // Note: useBlocker requires createBrowserRouter; this app uses BrowserRouter.
  // Keep tab-close protection via beforeunload; in-app leave uses confirmDiscard on page-key changes.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const canPublish = can(PERMISSIONS.CONTENT_CMS_PUBLISH);
  const trimmedPageKey = pageKey.trim();
  const editorKey = layoutRequestKey(trimmedPageKey, locale);
  const globalIds = useMemo(() => collectGlobalBlockIds(draftBlocks), [draftBlocks]);
  const { globalMap } = useGlobalBlocksBatch(globalIds, { admin: true });
  const validationSummary = useMemo(
    () => getPageValidationSummary(draftBlocks, { globalMap }),
    [draftBlocks, globalMap],
  );

  const pilotCanonical = PILOT_PAGES.find((p) => p.pageKey === pageKey)?.canonicalPath;

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('pageKey', pageKey);
    next.set('locale', locale);
    if (showPreview) next.set('preview', '1');
    if (!livePreview) next.set('live', '0');
    setSearchParams(next, { replace: true });
  }, [pageKey, locale, showPreview, livePreview, setSearchParams]);

  const guardSave = () => {
    if (!trimmedPageKey) {
      toast.error('Page key is required.');
      return false;
    }
    if (loading) {
      toast.warning('Please wait for the page to finish loading before saving.');
      return false;
    }
    if (!synced) {
      toast.warning('Draft is out of sync with the selected page. Reloading the correct draft — try saving again.');
      return false;
    }
    if (saveInFlightRef.current || publishInFlightRef.current) {
      return false;
    }
    return true;
  };

  const saveDraft = async () => {
    if (!guardSave()) return;
    bumpManualSave();
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const { data } = await adminContentApi.savePageLayout({
        pageKey: trimmedPageKey,
        locale,
        title: title.trim() || trimmedPageKey,
        draftBlocks: reindexBlocks(draftBlocks),
      });
      if (!applySavedLayout(data)) {
        toast.warning('Save completed for a different page. Reloading the selected page.');
        return;
      }
      clearRecoveryDraft(trimmedPageKey, locale);
      toast.success('Draft saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save draft');
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!canPublish) return;
    if (!guardSave()) return;
    if (!validationSummary.canPublish) {
      toast.error('Fix invalid blocks before publishing.');
      return;
    }
    bumpManualSave();
    publishInFlightRef.current = true;
    setPublishing(true);
    try {
      const { data: saved } = await adminContentApi.savePageLayout({
        pageKey: trimmedPageKey,
        locale,
        title: title.trim() || trimmedPageKey,
        draftBlocks: reindexBlocks(draftBlocks),
      });
      if (!applySavedLayout(saved)) {
        toast.warning('Publish aborted — draft did not match the selected page.');
        return;
      }
      const { data } = await adminContentApi.publishPageLayout(trimmedPageKey, locale);
      setPublishedAt(data.publishedAt);
      applySavedLayout(data);
      clearRecoveryDraft(trimmedPageKey, locale);
      toast.success('Published');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to publish');
    } finally {
      publishInFlightRef.current = false;
      setPublishing(false);
    }
  };

  const busy = saving || publishing || loading;

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_SITE}>
      <div className="space-y-6">
        {showRecoveryPrompt ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4 flex flex-wrap items-center justify-between gap-3" role="alertdialog" aria-labelledby="recovery-title">
            <div>
              <p id="recovery-title" className="font-semibold text-amber-900 dark:text-amber-100">Recovered unsaved changes</p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Local draft from {recovery?.savedAt ? new Date(recovery.savedAt).toLocaleString() : 'earlier session'}.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="px-3 py-1.5 text-sm border rounded-lg" onClick={discardRecovery}>Discard</button>
              <button type="button" className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white" onClick={restoreRecovery}>Restore</button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:pageBuilder', 'Page Builder')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Drag blocks to reorder · Autosave every 15s when dirty · Diagnostics below editor.
            </p>
            <div className="flex flex-wrap gap-3 mt-2 text-sm">
              <Link to={`${ROUTES.ADMIN}/page-builder/templates`} className="text-primary underline">Templates</Link>
              <Link to={`${ROUTES.ADMIN}/page-builder/global-blocks`} className="text-primary underline">Global Blocks</Link>
              <Link
                to={`${ROUTES.ADMIN}/page-builder/history?pageKey=${encodeURIComponent(trimmedPageKey)}&locale=${locale}`}
                className="text-primary underline"
              >
                History
              </Link>
            </div>
            {isDirty && !loading ? (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 font-medium" role="status">
                ● Unsaved changes
              </p>
            ) : null}
            <AutosaveStatus status={autosaveStatus} onRetry={retryAutosave} />
          </div>
          <div className="flex flex-wrap gap-2">
            {!showPreview ? (
              <button
                type="button"
                onClick={() => setLivePreview((v) => !v)}
                disabled={busy}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                {livePreview ? 'Hide live preview' : 'Show live preview'}
              </button>
            ) : null}
            <button type="button" onClick={() => setShowPreview((v) => !v)} disabled={busy} className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50">
              {showPreview ? 'Edit' : 'Full preview'}
            </button>
            <button type="button" onClick={saveDraft} disabled={busy || !synced} className="px-4 py-2 text-sm rounded-lg bg-gray-900 dark:bg-white dark:text-gray-900 text-white disabled:opacity-50">
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            {canPublish ? (
              <button
                type="button"
                onClick={publish}
                disabled={busy || !synced || !validationSummary.canPublish}
                title={!validationSummary.canPublish ? 'Fix invalid blocks before publishing' : undefined}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-white disabled:opacity-50"
              >
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-gray-700 dark:text-gray-300">Page key</span>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              value={PILOT_PAGES.some((p) => p.pageKey === pageKey) ? pageKey : '__custom__'}
              onChange={(e) => {
                if (e.target.value === '__custom__') return;
                if (!confirmDiscard()) return;
                setPageKey(e.target.value);
              }}
            >
              {PILOT_PAGES.map((p) => (
                <option key={p.pageKey} value={p.pageKey}>{p.displayName} ({p.pageKey})</option>
              ))}
              <option value="__custom__">Custom key…</option>
            </select>
            {!PILOT_PAGES.some((p) => p.pageKey === pageKey) ? (
              <input
                className="mt-2 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                value={pageKey}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === pageKey) return;
                  if (!confirmDiscard()) return;
                  setPageKey(next);
                }}
                placeholder="custom-page-key"
              />
            ) : null}
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-gray-700 dark:text-gray-300">Title</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
          </label>
          <AdminLocaleSelect
            value={locale}
            onChange={(next) => {
              if (next === locale) return;
              if (!confirmDiscard()) return;
              setLocale(next);
            }}
          />
          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-end pb-2">
            Status: <span className="ml-1 font-medium text-gray-800 dark:text-gray-200">{status}</span>
            {publishedAt ? <span className="ml-2 text-xs">Published {new Date(publishedAt).toLocaleString()}</span> : null}
          </div>
        </div>

        {!loading ? (
          <PageBuilderDiagnosticsPanel
            blocks={draftBlocks}
            globalMap={globalMap}
            title={title}
            pageKey={trimmedPageKey}
            canonical={pilotCanonical}
          />
        ) : null}

        {loading ? (
          <p className="text-gray-500">{t('common:loading')}</p>
        ) : showPreview ? (
          <div key={editorKey} className="rounded-xl border border-primary/30 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-4 py-2 bg-primary/10 text-sm font-medium text-primary border-b border-primary/20">
              Draft preview — updates live as you edit (not published until you publish)
            </div>
            <ResolvedBlockListRenderer blocks={draftBlocks} preview adminContext />
          </div>
        ) : (
          <div key={editorKey} className={`grid gap-6 ${livePreview ? 'xl:grid-cols-2' : ''}`}>
            <div className="min-w-0">
              <AdminBlockEditor blocks={draftBlocks} onChange={setDraftBlocks} globalMap={globalMap} />
            </div>
            {livePreview ? (
              <div className="min-w-0 xl:sticky xl:top-4 xl:self-start rounded-xl border border-primary/30 bg-white dark:bg-gray-900 overflow-hidden max-h-[calc(100vh-8rem)] overflow-y-auto">
                <div className="px-4 py-2 bg-primary/10 text-sm font-medium text-primary border-b border-primary/20 sticky top-0 z-10">
                  Live preview
                </div>
                <ResolvedBlockListRenderer blocks={draftBlocks} preview adminContext />
              </div>
            ) : null}
          </div>
        )}

        <p className="text-xs text-gray-500">
          Public consumption uses published layouts only (pilot pages with <code className="text-xs">usePageBuilder: true</code>).
          {' '}
          Staff live-route preview: append <code className="text-xs">?pageBuilderPreview=1</code> to the public URL after saving draft.
          {' '}
          <Link to={`${ROUTES.ADMIN}/site-cms`} className="text-primary underline">Site CMS</Link>
          {' '}remains the fallback when no published layout exists.
        </p>
        {PILOT_PAGES.find((p) => p.pageKey === pageKey) ? (
          <p className="text-xs text-gray-500">
            Public URL:{' '}
            <Link
              to={`${PILOT_PAGES.find((p) => p.pageKey === pageKey).canonicalPath}?pageBuilderPreview=1`}
              className="text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {PILOT_PAGES.find((p) => p.pageKey === pageKey).canonicalPath}?pageBuilderPreview=1
            </Link>
          </p>
        ) : null}
      </div>
    </AdminRouteGuard>
  );
}
