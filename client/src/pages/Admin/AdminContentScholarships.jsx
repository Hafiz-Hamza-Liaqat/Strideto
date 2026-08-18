import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminImageUrlField } from '../../components/admin/AdminImageUrlField';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { AdminSlugField } from '../../components/admin/AdminSlugField';
import { TranslationToolbar } from '../../components/admin/TranslationToolbar';
import { adminContentApi } from '../../services/adminContentApi';
import { ROUTES } from '../../constants';
import axiosInstance from '../../services/axiosBase';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const EMPTY = {
  title: '',
  provider: '',
  country: '',
  university: '',
  level: 'Other',
  amount: '',
  fundingType: 'Other',
  description: '',
  eligibility: '',
  link: '',
  deadline: '',
  status: 'draft',
  logoUrl: '',
  tags: '',
  slug: '',
  seoTitle: '',
  metaDescription: '',
  isFeatured: false,
};

function linesToText(arr) {
  return Array.isArray(arr) ? arr.join('\n') : '';
}

function textToLines(text) {
  return String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

export default function AdminContentScholarships() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_SCHOLARSHIPS);

  const { data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch } = useAdminList('/admin/scholarships');
  const [selectedIds, setSelectedIds] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const openEdit = async (id) => {
    const res = await axiosInstance.get(`/admin/scholarships/${id}`);
    const s = res.data;
    setForm({
      ...EMPTY,
      ...s,
      eligibility: linesToText(s.eligibility),
      tags: linesToText(s.tags),
      deadline: s.deadline ? s.deadline.slice(0, 10) : '',
    });
    setEditingId(id);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.title?.trim() || !form.provider?.trim()) {
      toast.error(t('admin:providerRequired'));
      return;
    }
    setSaving(true);
    const payload = { ...form, eligibility: textToLines(form.eligibility), tags: textToLines(form.tags) };
    try {
      if (editingId) await axiosInstance.put(`/admin/scholarships/${editingId}`, payload);
      else await axiosInstance.post('/admin/scholarships', payload);
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
      if (action === 'delete') await axiosInstance.delete(`/admin/scholarships/${id}`);
      else if (action === 'duplicate') await axiosInstance.post(`/admin/scholarships/${id}/duplicate`);
      else if (action === 'publish') await axiosInstance.put(`/admin/scholarships/${id}`, { status: 'active' });
      else if (action === 'archive') await axiosInstance.put(`/admin/scholarships/${id}`, { status: 'closed' });
      toast.success(t('admin:actionDone'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
    setConfirm(null);
  };

  const fieldClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm';

  const columns = [
    { key: 'title', label: t('admin:colTitle'), sortable: true },
    { key: 'provider', label: t('admin:colProvider') },
    { key: 'country', label: t('admin:colCountry') },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {canEdit && <button type="button" onClick={() => openEdit(row._id)} className="text-xs text-primary underline">{t('common:edit')}</button>}
          {row.slug && <a href={`${ROUTES.SCHOLARSHIPS}/${row.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs underline">{t('admin:viewPublic')}</a>}
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
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_SCHOLARSHIPS}>
      <div>
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:manageScholarships')}</h1>
          {canEdit && (
            <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); setFormOpen(true); }} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">
              {t('admin:addScholarship')}
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
          filterFields={['search', 'status', 'from', 'to', 'featured']}
          selectable={canEdit}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          bulkActions={canEdit ? [
            { id: 'publish', label: t('admin:bulkPublish') },
            { id: 'archive', label: t('admin:bulkArchive') },
            { id: 'feature', label: t('admin:bulkFeature') },
            { id: 'delete', label: t('admin:bulkDelete'), danger: true },
          ] : []}
          onBulkAction={(action, ids) => adminContentApi.bulkScholarships(action, ids).then(() => { toast.success(t('admin:bulkDone')); setSelectedIds([]); refetch(); }).catch(() => toast.error(t('admin:actionFailed')))}
          exportResource={can(PERMISSIONS.EXPORT_DATA) ? 'scholarships' : undefined}
          onExport={(r, f) => adminContentApi.exportData(r, f)}
        />

        {formOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setFormOpen(false)} />
            <div className="max-w-2xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">{editingId ? t('admin:editScholarship') : t('admin:addScholarship')}</h3>
              {editingId ? (
                <TranslationToolbar
                  entityType="scholarship"
                  entityId={editingId}
                  currentLocale={form.locale || 'en'}
                  onOpenTranslation={(doc) => openEdit(doc._id)}
                />
              ) : null}
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto mt-3">
                <input className={fieldClass} placeholder={t('admin:fieldTitle')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <input className={fieldClass} placeholder={t('admin:organizationPlaceholder')} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
                <input className={fieldClass} placeholder={t('admin:countryPlaceholder')} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                <input className={fieldClass} placeholder={t('admin:fieldUniversity')} value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} />
                <input className={fieldClass} placeholder={t('admin:fieldFunding')} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                <input type="date" className={fieldClass} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                <input className={fieldClass} placeholder={t('admin:applyLinkPlaceholder')} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
                <textarea rows={4} className={fieldClass} placeholder={t('admin:fieldDescription')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <textarea rows={3} className={fieldClass} placeholder={t('admin:fieldEligibility')} value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} />
                <AdminSelectBare className={fieldClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                </AdminSelectBare>
                <AdminImageUrlField label={t('admin:fieldLogoUrl')} value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} />
                <AdminSlugField
                  resourceType="scholarship"
                  value={form.slug}
                  onChange={(slug) => setForm({ ...form, slug })}
                  sourceText={`${form.title} ${form.country || ''}`.trim()}
                  status={form.status}
                  excludeId={editingId}
                />
                <input className={fieldClass} placeholder={t('admin:fieldSeoTitle')} value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
                <textarea rows={2} className={fieldClass} placeholder={t('admin:fieldMetaDescription')} value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} /> {t('admin:fieldFeatured')}</label>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 border rounded-lg text-sm">{t('common:cancel')}</button>
                <button type="button" onClick={save} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">{saving ? t('admin:saving') : t('admin:save')}</button>
              </div>
            </div>
          </div>
        )}

        <AdminConfirmDialog open={!!confirm} title={t('common:delete')} message={t('admin:deleteScholarshipConfirm')} danger onConfirm={() => runAction('delete', confirm.id)} onCancel={() => setConfirm(null)} />
      </div>
    </AdminRouteGuard>
  );
}
