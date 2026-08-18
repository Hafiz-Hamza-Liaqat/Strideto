import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { PERMISSIONS } from '../../config/rbac';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminStatusBadge, formatAdminDate } from '../../components/admin/adminTableUtils';
import { AdminImageUrlField, adminFieldClass } from '../../components/admin/AdminImageUrlField';
import { AdminSelect, AdminSelectBare } from '../../components/admin/AdminFormFields';
import { AdminRoutePicker } from '../../components/admin/AdminRoutePicker';
import { adminContentApi } from '../../services/adminContentApi';
import { getAdCapablePages, getPageById } from '@shared/pageRegistry.js';
import {
  getPlacementById,
  getSelectableAdPlacementsForPage,
  getPlacementTypesForPage,
  resolvePlacementFromSlotId,
  resolveSlotFromPlacement,
} from '@shared/placementRegistry.js';
import { PLACEMENT_TYPE_LABELS } from '@shared/placementTypes.js';
import { calculateCtr, formatCtr } from '../../utils/adTracking';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const STATUSES = ['draft', 'active', 'paused', 'expired'];
const APP_BASE = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');

const EMPTY = {
  slotId: '',
  name: '',
  placement: 'sidebar',
  imageUrl: '',
  targetUrl: '',
  startDate: '',
  endDate: '',
  priority: '0',
  clickLimit: '',
  impressionLimit: '',
  status: 'active',
  active: true,
  registryPageId: '',
  registrySlotType: '',
  registryPlacementId: '',
  legacySlot: false,
};

export default function AdminAdvertisements() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [sort, setSort] = useState({ key: 'impressionCount', order: 'desc' });

  const adPages = useMemo(() => getAdCapablePages(), []);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminContentApi.listAdSlots();
      setData(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || t('admin:loadFailed'));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const placementTypeOptions = useMemo(() => {
    if (!form.registryPageId) return [];
    return getPlacementTypesForPage(form.registryPageId);
  }, [form.registryPageId]);

  const slotOptions = useMemo(() => {
    if (!form.registryPageId || !form.registrySlotType) return [];
    return getSelectableAdPlacementsForPage(form.registryPageId, form.registrySlotType);
  }, [form.registryPageId, form.registrySlotType]);

  const selectedPage = form.registryPageId ? getPageById(form.registryPageId) : null;
  const selectedPlacement = form.registryPlacementId ? getPlacementById(form.registryPlacementId) : null;

  const previewRoute = selectedPlacement?.previewRoute || selectedPage?.route || '';

  const sortedData = useMemo(() => {
    if (!sort?.key) return data;
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      if (sort.key === 'ctr') {
        const av = calculateCtr(a.clickCount, a.impressionCount) ?? -1;
        const bv = calculateCtr(b.clickCount, b.impressionCount) ?? -1;
        return (av - bv) * dir;
      }
      const av = a[sort.key] ?? '';
      const bv = b[sort.key] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [data, sort]);

  const remainingImpressions = (row) => {
    if (row.impressionLimit == null || row.impressionLimit === '') return '—';
    return Math.max(0, Number(row.impressionLimit) - (row.impressionCount ?? 0));
  };

  const remainingClicks = (row) => {
    if (row.clickLimit == null || row.clickLimit === '') return '—';
    return Math.max(0, Number(row.clickLimit) - (row.clickCount ?? 0));
  };

  const applyPlacementSelection = (placementId) => {
    const resolved = resolveSlotFromPlacement(placementId);
    if (!resolved) return;
    setForm((prev) => ({
      ...prev,
      registryPlacementId: placementId,
      slotId: resolved.slotId,
      placement: resolved.placement,
      name: prev.name?.trim() ? prev.name : resolved.displayName,
      legacySlot: false,
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    const resolved = resolvePlacementFromSlotId(row.slotId);
    setForm({
      ...EMPTY,
      ...row,
      startDate: row.startDate ? row.startDate.slice(0, 10) : '',
      endDate: row.endDate ? row.endDate.slice(0, 10) : '',
      priority: String(row.priority ?? 0),
      clickLimit: row.clickLimit ?? '',
      impressionLimit: row.impressionLimit ?? '',
      registryPageId: resolved?.pageId ?? '',
      registrySlotType: resolved?.slotType ?? '',
      registryPlacementId: resolved?.placementId ?? '',
      legacySlot: !resolved,
    });
    setEditingId(row._id);
    setFormOpen(true);
  };

  const onPageChange = (pageId) => {
    setForm((prev) => ({
      ...prev,
      registryPageId: pageId,
      registrySlotType: '',
      registryPlacementId: '',
      legacySlot: false,
    }));
  };

  const onSlotTypeChange = (slotType) => {
    setForm((prev) => ({
      ...prev,
      registrySlotType: slotType,
      registryPlacementId: '',
    }));
  };

  const save = async () => {
    if (!form.slotId?.trim() || !form.name?.trim()) {
      toast.error(t('admin:titleRequired'));
      return;
    }
    setSaving(true);
    const payload = {
      slotId: form.slotId.trim(),
      name: form.name.trim(),
      placement: form.placement,
      imageUrl: form.imageUrl,
      targetUrl: form.targetUrl,
      priority: Number(form.priority) || 0,
      clickLimit: form.clickLimit ? Number(form.clickLimit) : undefined,
      impressionLimit: form.impressionLimit ? Number(form.impressionLimit) : undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      status: form.status,
      active: form.active,
    };
    try {
      if (editingId) await adminContentApi.updateAdSlot(editingId, payload);
      else await adminContentApi.createAdSlot(payload);
      toast.success(t('admin:saved'));
      setFormOpen(false);
      loadSlots();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const removeSlot = async (id) => {
    try {
      await adminContentApi.deleteAdSlot(id);
      toast.success(t('admin:deleted'));
      loadSlots();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
    setConfirm(null);
  };

  const openPreview = (row) => {
    const resolved = resolvePlacementFromSlotId(row.slotId);
    if (!resolved?.placementId || !resolved.previewRoute) {
      toast.error(t('admin:adSlotPreviewUnavailable', { defaultValue: 'Preview unavailable for this slot.' }));
      return;
    }
    try {
      sessionStorage.setItem(`adPreviewSlot:${resolved.placementId}`, JSON.stringify(row));
    } catch { /* ignore */ }
    const url = `${APP_BASE}${resolved.previewRoute}?previewAd=${encodeURIComponent(resolved.placementId)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const columns = [
    { key: 'slotId', label: 'Slot ID', sortable: true },
    { key: 'name', label: t('admin:colName'), sortable: true },
    { key: 'placement', label: 'Placement', sortable: true },
    {
      key: 'impressionCount',
      label: t('admin:adImpressions', { defaultValue: 'Impressions' }),
      sortable: true,
      render: (row) => row.impressionCount ?? 0,
    },
    {
      key: 'clickCount',
      label: t('admin:adClicks', { defaultValue: 'Clicks' }),
      sortable: true,
      render: (row) => row.clickCount ?? 0,
    },
    {
      key: 'ctr',
      label: t('admin:adCtr', { defaultValue: 'CTR' }),
      sortable: true,
      render: (row) => formatCtr(row.clickCount, row.impressionCount),
    },
    {
      key: 'status',
      label: t('status'),
      render: (row) => <AdminStatusBadge value={row.status} />,
    },
    {
      key: 'active',
      label: 'Active',
      render: (row) => (row.active ? t('admin:statusActive') : '—'),
    },
    {
      key: 'startDate',
      label: 'Start',
      render: (row) => formatAdminDate(row.startDate),
    },
    {
      key: 'endDate',
      label: 'End',
      render: (row) => formatAdminDate(row.endDate),
    },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => openEdit(row)} className="text-xs underline">{t('common:edit')}</button>
          <button type="button" onClick={() => openPreview(row)} className="text-xs underline text-primary dark:text-mint">{t('admin:adSlotPreview', { defaultValue: 'Preview' })}</button>
          <button type="button" onClick={() => setConfirm({ id: row._id })} className="text-xs text-red-600">{t('common:delete')}</button>
        </div>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.MODERATE_ADS}>
      <div>
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:manageAdvertisements', { defaultValue: 'Advertisements' })}</h1>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadSlots} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm min-h-[44px]">
              {t('admin:refresh', { defaultValue: 'Refresh' })}
            </button>
            <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">
              {t('admin:addAdSlot', { defaultValue: 'Add ad slot' })}
            </button>
          </div>
        </div>

        <AdminDataTable
          columns={columns}
          data={sortedData}
          loading={loading}
          error={error}
          emptyMessage={t('admin:noData')}
          sort={sort}
          onSort={setSort}
        />

        {formOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setFormOpen(false)} />
            <div className="max-w-xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">{editingId ? t('admin:editAdSlot', { defaultValue: 'Edit ad slot' }) : t('admin:addAdSlot', { defaultValue: 'Add ad slot' })}</h3>
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('admin:adSlotLocation', { defaultValue: '1. Select page' })}</p>
                <AdminSelect
                  label={t('admin:adSlotPage', { defaultValue: 'Page' })}
                  value={form.registryPageId}
                  onChange={(e) => onPageChange(e.target.value)}
                  disabled={!!editingId && !form.legacySlot}
                >
                  <option value="">{t('admin:adSlotSelectPage', { defaultValue: 'Choose a page…' })}</option>
                  {[...new Set(adPages.map((p) => p.category))].sort().map((cat) => (
                    <optgroup key={cat} label={cat}>
                      {adPages.filter((p) => p.category === cat && !p.route.includes(':')).map((page) => (
                        <option key={page.id} value={page.id}>{page.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </AdminSelect>

                {form.registryPageId && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-1">{t('admin:adSlotPlacementType', { defaultValue: '2. Placement type' })}</p>
                    <AdminSelect
                      label={t('admin:adSlotPlacement', { defaultValue: 'Placement' })}
                      value={form.registrySlotType}
                      onChange={(e) => onSlotTypeChange(e.target.value)}
                      disabled={!!editingId && !form.legacySlot}
                    >
                      <option value="">{t('admin:adSlotSelectPlacement', { defaultValue: 'Choose placement…' })}</option>
                      {placementTypeOptions.map((pt) => (
                        <option key={pt} value={pt}>{PLACEMENT_TYPE_LABELS[pt] || pt}</option>
                      ))}
                    </AdminSelect>
                  </>
                )}

                {form.registryPageId && form.registrySlotType && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-1">{t('admin:adSlotSlot', { defaultValue: '3. Slot' })}</p>
                    <AdminSelect
                      label={t('admin:adSlotAvailable', { defaultValue: 'Available slot' })}
                      value={form.registryPlacementId}
                      onChange={(e) => applyPlacementSelection(e.target.value)}
                      disabled={!!editingId && !form.legacySlot}
                    >
                      <option value="">{t('admin:adSlotSelectSlot', { defaultValue: 'Choose slot…' })}</option>
                      {slotOptions.map((slot) => (
                        <option key={slot.id} value={slot.id}>{slot.displayName}</option>
                      ))}
                    </AdminSelect>
                  </>
                )}

                {(form.legacySlot || editingId) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {form.legacySlot
                      ? t('admin:adSlotLegacyHint', { defaultValue: 'This slot ID is not in the registry. Fields below are preserved for backward compatibility.' })
                      : t('admin:adSlotEditHint', { defaultValue: 'Slot ID cannot change when editing. Create a new slot to pick from the registry.' })}
                  </p>
                )}

                <input
                  className={adminFieldClass}
                  placeholder="Slot ID"
                  value={form.slotId}
                  onChange={(e) => setForm({ ...form, slotId: e.target.value, legacySlot: true })}
                  disabled={!!editingId}
                  readOnly={!form.legacySlot && !editingId && Boolean(form.registryPlacementId)}
                />
                <input className={adminFieldClass} placeholder={t('admin:colName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

                {editingId && (
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm space-y-1">
                    <p className="font-semibold text-gray-900 dark:text-white">{t('admin:adAnalytics', { defaultValue: 'Analytics' })}</p>
                    <p>{t('admin:adImpressions', { defaultValue: 'Impressions' })}: <strong>{form.impressionCount ?? 0}</strong></p>
                    <p>{t('admin:adClicks', { defaultValue: 'Clicks' })}: <strong>{form.clickCount ?? 0}</strong></p>
                    <p>{t('admin:adCtr', { defaultValue: 'CTR' })}: <strong>{formatCtr(form.clickCount, form.impressionCount)}</strong></p>
                    <p>{t('status')}: <strong>{form.status}</strong></p>
                    <p>{t('admin:adRemainingImpressions', { defaultValue: 'Remaining impression limit' })}: <strong>{remainingImpressions(form)}</strong></p>
                    <p>{t('admin:adRemainingClicks', { defaultValue: 'Remaining click limit' })}: <strong>{remainingClicks(form)}</strong></p>
                  </div>
                )}

                {(selectedPage || selectedPlacement) && (
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs space-y-1">
                    {selectedPage && (
                      <p><span className="font-medium">{t('admin:adSlotPage', { defaultValue: 'Page' })}:</span> {selectedPage.name}</p>
                    )}
                    {selectedPlacement && (
                      <>
                        <p><span className="font-medium">{t('admin:adSlotPlacement', { defaultValue: 'Placement' })}:</span> {selectedPlacement.displayName}</p>
                        <p className="text-gray-600 dark:text-gray-400">{selectedPlacement.description}</p>
                      </>
                    )}
                    {previewRoute && previewRoute !== '*' && (
                      <p>
                        <span className="font-medium">{t('admin:routePickerPreview', { defaultValue: 'Preview' })}:</span>{' '}
                        <code>{`${APP_BASE}${previewRoute}`}</code>
                      </p>
                    )}
                  </div>
                )}

                <AdminSelectBare value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>
                  {['banner_top', 'sidebar', 'in_feed', 'banner_bottom', 'header'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </AdminSelectBare>

                <AdminImageUrlField label="Image URL" value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} />
                <AdminRoutePicker
                  label={t('admin:adSlotTargetUrl', { defaultValue: 'Target URL' })}
                  value={form.targetUrl}
                  onChange={(v) => setForm({ ...form, targetUrl: v })}
                />
                <input type="date" className={adminFieldClass} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                <input type="date" className={adminFieldClass} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                <input className={adminFieldClass} type="number" placeholder="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
                <input className={adminFieldClass} type="number" placeholder="Click limit" value={form.clickLimit} onChange={(e) => setForm({ ...form, clickLimit: e.target.value })} />
                <input className={adminFieldClass} type="number" placeholder="Impression limit" value={form.impressionLimit} onChange={(e) => setForm({ ...form, impressionLimit: e.target.value })} />
                <AdminSelectBare value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </AdminSelectBare>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  Active
                </label>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 border rounded-lg text-sm">{t('common:cancel')}</button>
                <button type="button" onClick={save} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">{saving ? t('admin:saving') : t('admin:save')}</button>
              </div>
            </div>
          </div>
        )}

        {confirm && (
          <AdminConfirmDialog
            open
            title={t('admin:bulkDeleteConfirm')}
            onConfirm={() => removeSlot(confirm.id)}
            onCancel={() => setConfirm(null)}
          />
        )}
      </div>
    </AdminRouteGuard>
  );
}
