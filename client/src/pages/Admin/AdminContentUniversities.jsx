import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminImageUrlField, adminFieldClass } from '../../components/admin/AdminImageUrlField';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { AdminSlugField } from '../../components/admin/AdminSlugField';
import { TranslationToolbar } from '../../components/admin/TranslationToolbar';
import { adminContentApi } from '../../services/adminContentApi';
import { ROUTES } from '../../constants';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const EMPTY = {
  name: '',
  country: 'Pakistan',
  city: '',
  province: '',
  website: '',
  description: '',
  logoUrl: '',
  bannerUrl: '',
  ranking: '',
  establishedYear: '',
  contact: '',
  type: 'public',
  status: 'active',
  isFeatured: false,
  slug: '',
  seoTitle: '',
  metaDescription: '',
};

export default function AdminContentUniversities() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_UNIVERSITIES);

  const { data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch } = useAdminList('/admin/universities');
  const [selectedIds, setSelectedIds] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setFormOpen(true); };

  const openEdit = async (id) => {
    try {
      const res = await adminContentApi.getUniversity(id);
      const u = res.data;
      setForm({
        ...EMPTY,
        ...u,
        ranking: u.ranking ?? '',
        establishedYear: u.establishedYear ?? '',
      });
      setEditingId(id);
      setFormOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
    }
  };

  const save = async () => {
    if (!form.name?.trim()) { toast.error(t('admin:titleRequired')); return; }
    setSaving(true);
    const payload = {
      ...form,
      ranking: form.ranking ? Number(form.ranking) : undefined,
      establishedYear: form.establishedYear ? Number(form.establishedYear) : undefined,
    };
    try {
      if (editingId) await adminContentApi.updateUniversity(editingId, payload);
      else await adminContentApi.createUniversity(payload);
      toast.success(t('admin:saved'));
      setFormOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action, id) => {
    try {
      if (action === 'delete') await adminContentApi.deleteUniversity(id);
      else if (action === 'duplicate') await adminContentApi.duplicateUniversity(id);
      toast.success(t('admin:actionDone'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
    setConfirm(null);
  };

  const columns = [
    { key: 'name', label: t('admin:colName'), sortable: true },
    { key: 'country', label: t('admin:colCountry') },
    { key: 'city', label: t('admin:fieldCity') },
    { key: 'province', label: t('admin:colProvince') },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {canEdit && <button type="button" onClick={() => openEdit(row._id)} className="text-xs text-primary underline">{t('common:edit')}</button>}
          {row.slug && (
            <a href={`${ROUTES.UNIVERSITY}/${row.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs underline">
              {t('admin:viewPublic')}
            </a>
          )}
          {canEdit && (
            <>
              <button type="button" onClick={() => runAction('duplicate', row._id)} className="text-xs">{t('admin:duplicate')}</button>
              <button type="button" onClick={() => setConfirm({ id: row._id })} className="text-xs text-red-600">{t('common:delete')}</button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_UNIVERSITIES}>
      <div>
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:manageUniversities', { defaultValue: 'Manage Universities' })}</h2>
          {canEdit && (
            <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">
              {t('admin:addUniversity', { defaultValue: 'Add university' })}
            </button>
          )}
        </div>

        <AdminDataTable
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          emptyMessage={t('admin:noData')}
          pagination={pagination}
          onPageChange={setPage}
          sort={sort}
          onSort={setSort}
          filters={filters}
          onFiltersChange={(f) => { setFilters(f); setPage(1); }}
          filterFields={['search', 'status', 'featured']}
          selectable={canEdit}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          bulkActions={canEdit ? [
            { id: 'publish', label: t('admin:bulkPublish') },
            { id: 'archive', label: t('admin:bulkArchive') },
            { id: 'feature', label: t('admin:bulkFeature') },
            { id: 'delete', label: t('admin:bulkDelete'), danger: true },
          ] : []}
          onBulkAction={(action, ids) => adminContentApi.bulkUniversities(action, ids).then(() => {
            toast.success(t('admin:bulkDone'));
            setSelectedIds([]);
            refetch();
          }).catch(() => toast.error(t('admin:actionFailed')))}
          exportResource={can(PERMISSIONS.EXPORT_DATA) ? 'universities' : undefined}
          onExport={(r, f) => adminContentApi.exportData(r, f).catch(() => toast.error(t('admin:exportFailed')))}
        />

        {formOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setFormOpen(false)} />
            <div className="max-w-2xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">{editingId ? t('admin:editUniversity', { defaultValue: 'Edit university' }) : t('admin:addUniversity', { defaultValue: 'Add university' })}</h3>
              {editingId ? (
                <TranslationToolbar
                  entityType="university"
                  entityId={editingId}
                  currentLocale={form.locale || 'en'}
                  onOpenTranslation={(doc) => openEdit(doc._id)}
                />
              ) : null}
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto mt-3">
                <input className={adminFieldClass} placeholder={t('admin:colName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:colCountry')} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldCity')} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:colProvince')} value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
                <input className={adminFieldClass} placeholder="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                <textarea rows={4} className={adminFieldClass} placeholder={t('admin:fieldDescription')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <AdminImageUrlField label={t('admin:fieldLogoUrl')} value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} />
                <AdminImageUrlField label="Banner URL" value={form.bannerUrl} onChange={(v) => setForm({ ...form, bannerUrl: v })} />
                <input className={adminFieldClass} type="number" placeholder="Ranking" value={form.ranking} onChange={(e) => setForm({ ...form, ranking: e.target.value })} />
                <input className={adminFieldClass} type="number" placeholder="Established year" value={form.establishedYear} onChange={(e) => setForm({ ...form, establishedYear: e.target.value })} />
                <input className={adminFieldClass} placeholder="Contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                <AdminSelectBare  value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="semi-government">Semi-government</option>
                  <option value="other">Other</option>
                </AdminSelectBare>
                <AdminSelectBare  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">{t('admin:statusDraft')}</option>
                  <option value="active">{t('admin:statusActive')}</option>
                </AdminSelectBare>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
                  {t('admin:fieldFeatured')}
                </label>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">SEO</p>
                <AdminSlugField
                  resourceType="university"
                  value={form.slug}
                  onChange={(slug) => setForm({ ...form, slug })}
                  sourceText={form.name}
                  status={form.status}
                  excludeId={editingId}
                />
                <input className={adminFieldClass} placeholder={t('admin:fieldSeoTitle')} value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
                <textarea rows={2} className={adminFieldClass} placeholder={t('admin:fieldMetaDescription')} value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 border rounded-lg text-sm">{t('common:cancel')}</button>
                <button type="button" onClick={save} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">{saving ? t('admin:saving') : t('admin:save')}</button>
              </div>
            </div>
          </div>
        )}

        {confirm && <AdminConfirmDialog open title={t('admin:bulkDeleteConfirm')} onConfirm={() => runAction('delete', confirm.id)} onCancel={() => setConfirm(null)} />}
      </div>
    </AdminRouteGuard>
  );
}
