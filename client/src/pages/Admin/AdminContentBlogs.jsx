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
import { AdminViewPublicLink } from '../../components/admin/AdminViewPublicLink';
import { TranslationToolbar } from '../../components/admin/TranslationToolbar';
import { adminContentApi } from '../../services/adminContentApi';
import { ROUTES } from '../../constants';
import { EscapeWhen } from '../../a11y/EscapeWhen';
import { listBlogCategoryOptions } from '@shared/blog/taxonomy.js';
import { formatBlogPublicationStatus } from '@shared/cms/publicReadiness.js';

const BLOG_CATEGORIES = listBlogCategoryOptions();

const EMPTY = {
  title: '', excerpt: '', content: '', category: '', authorName: '', tags: '',
  imageUrl: '', gallery: '', readingTime: '', status: 'draft', publishedAt: '',
  isFeatured: false, slug: '', seoTitle: '', metaDescription: '', canonicalUrl: '', ogImageUrl: '',
};

export default function AdminContentBlogs() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_BLOGS);

  const { data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch } = useAdminList('/admin/blogs');
  const [selectedIds, setSelectedIds] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setFormOpen(true); };

  const openEdit = async (id) => {
    try {
      const res = await adminContentApi.blogs.get(id);
      const b = res.data;
      setForm({
        ...EMPTY, ...b,
        authorName: b.authorName || (typeof b.author === 'object' && b.author?.name) || '',
        tags: linesToText(b.tags), gallery: linesToText(b.gallery),
        publishedAt: b.publishedAt ? b.publishedAt.slice(0, 16) : '',
      });
      setEditingId(id);
      setFormOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
    }
  };

  const save = async () => {
    if (!form.title?.trim()) { toast.error(t('admin:titleRequired')); return; }
    setSaving(true);
    const payload = {
      ...form,
      authorName: form.authorName,
      tags: textToLines(form.tags),
      gallery: textToLines(form.gallery),
      readingTime: form.readingTime ? Number(form.readingTime) : undefined,
      publishedAt: form.publishedAt || undefined,
      imageUrl: form.imageUrl || undefined,
      canonicalUrl: form.canonicalUrl || undefined,
      ogImageUrl: form.ogImageUrl || undefined,
    };
    delete payload.author;
    try {
      if (editingId) await adminContentApi.blogs.update(editingId, payload);
      else await adminContentApi.blogs.create(payload);
      toast.success(t('admin:saved'));
      setFormOpen(false);
      refetch();
    } catch (err) {
      const details = err.response?.data?.details;
      const detailMsg = details && typeof details === 'object'
        ? Object.entries(details).map(([k, v]) => `${k}: ${v}`).join('; ')
        : '';
      toast.error(detailMsg || err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action, id) => {
    try {
      if (action === 'delete') await adminContentApi.blogs.remove(id);
      else if (action === 'duplicate') await adminContentApi.blogs.duplicate(id);
      else if (action === 'publish') await adminContentApi.blogs.update(id, { status: 'published' });
      else if (action === 'archive') await adminContentApi.blogs.update(id, { status: 'archived' });
      else if (action === 'draft') await adminContentApi.blogs.update(id, { status: 'draft' });
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
    { key: 'status', label: t('status'), render: (row) => formatBlogPublicationStatus(row) },
    {
      key: 'actions', label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {canEdit && <button type="button" onClick={() => openEdit(row._id)} className="text-xs text-primary underline">{t('common:edit')}</button>}
          <AdminViewPublicLink type="blog" record={row} href={row.slug ? `${ROUTES.BLOG}/${row.slug}` : ''} label={t('admin:viewPublic')} />
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
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_BLOGS}>
      <div>
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:manageBlogs')}</h1>
          {canEdit && (
            <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">{t('admin:addBlog')}</button>
          )}
        </div>

        <AdminDataTable
          columns={columns} data={data} loading={loading} error={error} emptyMessage={t('admin:noData')}
          pagination={pagination} onPageChange={setPage} sort={sort} onSort={setSort}
          filters={filters} onFiltersChange={(f) => { setFilters(f); setPage(1); }}
          filterFields={['search', 'status', 'from', 'to', 'featured']}
          selectable={canEdit} selectedIds={selectedIds} onSelectionChange={setSelectedIds}
          bulkActions={canEdit ? [
            { id: 'publish', label: t('admin:bulkPublish') },
            { id: 'archive', label: t('admin:bulkArchive') },
            { id: 'feature', label: t('admin:bulkFeature') },
            { id: 'delete', label: t('admin:bulkDelete'), danger: true },
          ] : []}
          onBulkAction={(action, ids) => adminContentApi.blogs.bulk(action, ids).then(() => { toast.success(t('admin:bulkDone')); setSelectedIds([]); refetch(); }).catch(() => toast.error(t('admin:actionFailed')))}
          exportResource={can(PERMISSIONS.EXPORT_DATA) ? 'blogs' : undefined}
          onExport={(r, f) => adminContentApi.exportData(r, f)}
        />

        {formOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setFormOpen(false)} />
            <div className="max-w-2xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">{editingId ? t('admin:editBlog') : t('admin:addBlog')}</h3>
              {editingId ? (
                <TranslationToolbar
                  entityType="blog"
                  entityId={editingId}
                  currentLocale={form.locale || 'en'}
                  onOpenTranslation={(doc) => openEdit(doc._id)}
                />
              ) : null}
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto mt-3">
                <input className={adminFieldClass} placeholder={t('admin:fieldTitle')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <AdminSelectBare value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">{t('admin:selectCategory', { defaultValue: 'Select category' })}</option>
                  {BLOG_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.label}>{c.label}</option>
                  ))}
                </AdminSelectBare>
                <input className={adminFieldClass} placeholder={t('admin:fieldAuthor')} value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} />
                <textarea rows={2} className={adminFieldClass} placeholder={t('admin:fieldSummary')} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
                <textarea rows={6} className={adminFieldClass} placeholder={t('admin:fieldContent')} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
                <AdminImageUrlField label={t('admin:fieldFeaturedImage')} value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} />
                <textarea rows={2} className={adminFieldClass} placeholder={t('admin:fieldGallery')} value={form.gallery} onChange={(e) => setForm({ ...form, gallery: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldReadingTime')} value={form.readingTime} onChange={(e) => setForm({ ...form, readingTime: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldTags')} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                <input type="datetime-local" className={adminFieldClass} aria-label={t('admin:fieldPublishedAt', { defaultValue: 'Published at' })} value={form.publishedAt} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })} />
                <AdminSelectBare  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </AdminSelectBare>
                <AdminSlugField
                  resourceType="blog"
                  value={form.slug}
                  onChange={(slug) => setForm({ ...form, slug })}
                  sourceText={form.title}
                  status={form.status}
                  excludeId={editingId}
                  publicPreviewReady={form.status === 'published'}
                />
                <input className={adminFieldClass} placeholder={t('admin:fieldSeoTitle')} value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
                <textarea rows={2} className={adminFieldClass} placeholder={t('admin:fieldMetaDescription')} value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldCanonicalUrl')} value={form.canonicalUrl} onChange={(e) => setForm({ ...form, canonicalUrl: e.target.value })} />
                <AdminImageUrlField label={t('admin:fieldOgImage')} value={form.ogImageUrl} onChange={(v) => setForm({ ...form, ogImageUrl: v })} />
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
