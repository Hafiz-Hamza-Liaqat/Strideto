import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { adminFieldClass, linesToText, textToLines } from '../../components/admin/AdminImageUrlField';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { AdminSlugField } from '../../components/admin/AdminSlugField';
import { adminContentApi } from '../../services/adminContentApi';
import { ROUTES } from '../../constants';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const EMPTY = {
  title: '',
  organization: '',
  internshipType: '',
  isPaid: false,
  duration: '',
  province: '',
  city: '',
  description: '',
  eligibility: '',
  skillset: '',
  deadline: '',
  applicationLink: '',
  status: 'draft',
  isFeatured: false,
  slug: '',
  seoTitle: '',
  metaDescription: '',
};

export default function AdminContentInternships() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_JOBS);

  const { data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch } = useAdminList('/admin/internships');
  const [selectedIds, setSelectedIds] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setFormOpen(true); };

  const openEdit = async (id) => {
    try {
      const res = await adminContentApi.internships.get(id);
      const item = res.data;
      setForm({
        ...EMPTY,
        ...item,
        eligibility: linesToText(item.eligibility),
        skillset: linesToText(item.skillset),
        deadline: item.deadline ? item.deadline.slice(0, 10) : '',
      });
      setEditingId(id);
      setFormOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
    }
  };

  const save = async () => {
    if (!form.title?.trim() || !form.organization?.trim()) {
      toast.error(t('admin:providerRequired'));
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      eligibility: textToLines(form.eligibility),
      skillset: textToLines(form.skillset),
    };
    try {
      if (editingId) await adminContentApi.internships.update(editingId, payload);
      else await adminContentApi.internships.create(payload);
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
      if (action === 'delete') await adminContentApi.internships.remove(id);
      else if (action === 'duplicate') await adminContentApi.internships.duplicate(id);
      else if (action === 'publish') await adminContentApi.internships.update(id, { status: 'active' });
      else if (action === 'archive') await adminContentApi.internships.update(id, { status: 'closed' });
      else if (action === 'draft') await adminContentApi.internships.update(id, { status: 'draft' });
      toast.success(t('admin:actionDone'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
    setConfirm(null);
  };

  const columns = [
    { key: 'title', label: t('admin:colTitle'), sortable: true },
    { key: 'organization', label: t('admin:organizationPlaceholder') },
    { key: 'province', label: t('admin:colProvince') },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {canEdit && <button type="button" onClick={() => openEdit(row._id)} className="text-xs text-primary underline">{t('common:edit')}</button>}
          {(row.slug || row._id) && (
            <a href={`${ROUTES.INTERNSHIPS}/${row.slug || row._id}`} target="_blank" rel="noopener noreferrer" className="text-xs underline">{t('admin:viewPublic')}</a>
          )}
          {canEdit && (
            <>
              <button type="button" onClick={() => runAction('duplicate', row._id)} className="text-xs">{t('admin:duplicate')}</button>
              {row.status !== 'active' && <button type="button" onClick={() => runAction('publish', row._id)} className="text-xs">{t('admin:published')}</button>}
              <button type="button" onClick={() => setConfirm({ id: row._id })} className="text-xs text-red-600">{t('common:delete')}</button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_JOBS}>
      <div>
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:manageInternships')}</h2>
          {canEdit && (
            <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">{t('admin:addInternship')}</button>
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
          filterFields={['search', 'status', 'province', 'from', 'to', 'featured']}
          selectable={canEdit}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          bulkActions={canEdit ? [
            { id: 'publish', label: t('admin:bulkPublish') },
            { id: 'archive', label: t('admin:bulkArchive') },
            { id: 'feature', label: t('admin:bulkFeature') },
            { id: 'delete', label: t('admin:bulkDelete'), danger: true },
          ] : []}
          onBulkAction={(action, ids) => adminContentApi.internships.bulk(action, ids).then(() => { toast.success(t('admin:bulkDone')); setSelectedIds([]); refetch(); }).catch(() => toast.error(t('admin:actionFailed')))}
          exportResource={can(PERMISSIONS.EXPORT_DATA) ? 'internships' : undefined}
          onExport={(r, f) => adminContentApi.exportData(r, f)}
        />

        {formOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setFormOpen(false)} />
            <div className="max-w-2xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">{editingId ? t('admin:editInternship') : t('admin:addInternship')}</h3>
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto">
                <input className={adminFieldClass} placeholder={t('admin:fieldTitle')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:organizationPlaceholder')} value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldInternshipType')} value={form.internshipType} onChange={(e) => setForm({ ...form, internshipType: e.target.value })} />
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPaid} onChange={(e) => setForm({ ...form, isPaid: e.target.checked })} /> {t('admin:fieldIsPaid')}</label>
                <input className={adminFieldClass} placeholder={t('admin:fieldDuration')} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:provincePlaceholder')} value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldCity')} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <textarea rows={4} className={adminFieldClass} placeholder={t('admin:fieldDescription')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <textarea rows={3} className={adminFieldClass} placeholder={t('admin:fieldEligibility')} value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} />
                <textarea rows={3} className={adminFieldClass} placeholder={t('admin:fieldSkillset')} value={form.skillset} onChange={(e) => setForm({ ...form, skillset: e.target.value })} />
                <input type="date" className={adminFieldClass} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:applyLinkPlaceholder')} value={form.applicationLink} onChange={(e) => setForm({ ...form, applicationLink: e.target.value })} />
                <AdminSelectBare  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                </AdminSelectBare>
                <AdminSlugField
                  resourceType="internship"
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
