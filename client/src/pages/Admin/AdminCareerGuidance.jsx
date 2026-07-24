import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminImageUrlField, adminFieldClass, linesToText, textToLines } from '../../components/admin/AdminImageUrlField';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { AdminSlugField } from '../../components/admin/AdminSlugField';
import { adminContentApi } from '../../services/adminContentApi';
import { ROUTES } from '../../constants';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const EMPTY = {
  title: '',
  excerpt: '',
  content: '',
  category: '',
  tags: '',
  imageUrl: '',
  status: 'draft',
  scheduledAt: '',
  isFeatured: false,
  slug: '',
  seoTitle: '',
  metaDescription: '',
};

export default function AdminCareerGuidance() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_CAREER);

  const { data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch } = useAdminList('/admin/career-articles');
  const [selectedIds, setSelectedIds] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setFormOpen(true); };

  const openEdit = async (id) => {
    try {
      const res = await adminContentApi.careerArticles.get(id);
      const item = res.data;
      setForm({
        ...EMPTY,
        ...item,
        tags: linesToText(item.tags),
        scheduledAt: item.scheduledAt ? item.scheduledAt.slice(0, 16) : '',
      });
      setEditingId(id);
      setFormOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
    }
  };

  const save = async () => {
    if (!form.title?.trim()) {
      toast.error(t('admin:titleRequired'));
      return;
    }
    setSaving(true);
    const payload = { ...form, tags: textToLines(form.tags) };
    try {
      if (editingId) await adminContentApi.careerArticles.update(editingId, payload);
      else await adminContentApi.careerArticles.create(payload);
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
      if (action === 'delete') await adminContentApi.careerArticles.remove(id);
      else if (action === 'duplicate') await adminContentApi.careerArticles.duplicate(id);
      else if (action === 'publish') await adminContentApi.careerArticles.update(id, { status: 'published' });
      else if (action === 'archive') await adminContentApi.careerArticles.update(id, { status: 'archived' });
      else if (action === 'draft') await adminContentApi.careerArticles.update(id, { status: 'draft' });
      toast.success(t('admin:actionDone'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
    setConfirm(null);
  };

  const columns = [
    { key: 'title', label: t('admin:colTitle'), sortable: true },
    { key: 'category', label: t('admin:fieldCategory') },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {canEdit && <button type="button" onClick={() => openEdit(row._id)} className="text-xs text-primary underline">{t('common:edit')}</button>}
          {row.slug && (
            <a href={`${ROUTES.CAREER_GUIDANCE}/${row.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs underline">{t('admin:viewPublic')}</a>
          )}
          {canEdit && (
            <>
              <button type="button" onClick={() => runAction('duplicate', row._id)} className="text-xs">{t('admin:duplicate')}</button>
              {row.status !== 'published' && <button type="button" onClick={() => runAction('publish', row._id)} className="text-xs">{t('admin:published')}</button>}
              <button type="button" onClick={() => setConfirm({ id: row._id })} className="text-xs text-red-600">{t('common:delete')}</button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_CAREER}>
      <div>
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:manageCareerArticles')}</h2>
          {canEdit && (
            <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">{t('admin:addCareerArticle')}</button>
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
          filterFields={['search', 'status', 'category', 'from', 'to', 'featured']}
          selectable={canEdit}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          bulkActions={canEdit ? [
            { id: 'publish', label: t('admin:bulkPublish') },
            { id: 'archive', label: t('admin:bulkArchive') },
            { id: 'feature', label: t('admin:bulkFeature') },
            { id: 'delete', label: t('admin:bulkDelete'), danger: true },
          ] : []}
          onBulkAction={(action, ids) => adminContentApi.careerArticles.bulk(action, ids).then(() => { toast.success(t('admin:bulkDone')); setSelectedIds([]); refetch(); }).catch(() => toast.error(t('admin:actionFailed')))}
          exportResource={can(PERMISSIONS.EXPORT_DATA) ? 'career-articles' : undefined}
          onExport={(r, f) => adminContentApi.exportData(r, f)}
        />

        {formOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setFormOpen(false)} />
            <div className="max-w-2xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">{editingId ? t('admin:editCareerArticle') : t('admin:addCareerArticle')}</h3>
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto">
                <input className={adminFieldClass} placeholder={t('admin:fieldTitle')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldCategory')} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                <textarea rows={2} className={adminFieldClass} placeholder={t('admin:fieldSummary')} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
                <textarea rows={6} className={adminFieldClass} placeholder={t('admin:fieldContent')} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldTags')} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                <AdminImageUrlField label={t('admin:fieldFeaturedImage')} value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} />
                <input type="datetime-local" className={adminFieldClass} placeholder={t('admin:fieldScheduledAt')} value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
                <AdminSelectBare  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </AdminSelectBare>
                <AdminSlugField
                  resourceType="career-article"
                  value={form.slug}
                  onChange={(slug) => setForm({ ...form, slug })}
                  sourceText={form.title}
                  status={form.status}
                  excludeId={editingId}
                />
                <input className={adminFieldClass} placeholder={t('admin:fieldSeoTitle')} value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
                <textarea rows={2} className={adminFieldClass} placeholder={t('admin:fieldMetaDescription')} value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} /> {t('admin:fieldFeatured')}</label>
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
