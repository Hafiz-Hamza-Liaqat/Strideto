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
import { adminContentApi } from '../../services/adminContentApi';
import { ROUTES } from '../../constants';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const EMPTY = {
  country: '',
  program: '',
  level: 'Other',
  institution: '',
  description: '',
  visaInfo: '',
  costOfLiving: '',
  studentLife: '',
  deadline: '',
  link: '',
  imageUrl: '',
  status: 'draft',
  slug: '',
};

export default function AdminForeignStudies() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_FOREIGN);

  const { data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch } = useAdminList('/admin/foreign-studies');
  const [selectedIds, setSelectedIds] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setFormOpen(true); };

  const openEdit = async (id) => {
    try {
      const res = await adminContentApi.foreignStudies.get(id);
      const item = res.data;
      setForm({
        ...EMPTY,
        ...item,
        deadline: item.deadline ? item.deadline.slice(0, 10) : '',
      });
      setEditingId(id);
      setFormOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
    }
  };

  const save = async () => {
    if (!form.country?.trim()) {
      toast.error(t('admin:countryRequired'));
      return;
    }
    setSaving(true);
    try {
      if (editingId) await adminContentApi.foreignStudies.update(editingId, form);
      else await adminContentApi.foreignStudies.create(form);
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
      if (action === 'delete') await adminContentApi.foreignStudies.remove(id);
      else if (action === 'duplicate') await adminContentApi.foreignStudies.duplicate(id);
      else if (action === 'publish') await adminContentApi.foreignStudies.update(id, { status: 'active' });
      else if (action === 'archive') await adminContentApi.foreignStudies.update(id, { status: 'closed' });
      else if (action === 'draft') await adminContentApi.foreignStudies.update(id, { status: 'draft' });
      toast.success(t('admin:actionDone'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
    setConfirm(null);
  };

  const columns = [
    { key: 'country', label: t('admin:colCountry'), sortable: true },
    { key: 'program', label: t('admin:colProgram') },
    { key: 'institution', label: t('admin:colUniversity') },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {canEdit && <button type="button" onClick={() => openEdit(row._id)} className="text-xs text-primary underline">{t('common:edit')}</button>}
          {(row.slug || row._id) && (
            <a href={`${ROUTES.FOREIGN_STUDIES}/${row.slug || row._id}`} target="_blank" rel="noopener noreferrer" className="text-xs underline">{t('admin:viewPublic')}</a>
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
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_FOREIGN}>
      <div>
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:manageForeignStudies')}</h1>
          {canEdit && (
            <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">{t('admin:addForeignStudy')}</button>
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
          filterFields={['search', 'status', 'country', 'from', 'to']}
          selectable={canEdit}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          bulkActions={canEdit ? [
            { id: 'publish', label: t('admin:bulkPublish') },
            { id: 'archive', label: t('admin:bulkArchive') },
            { id: 'delete', label: t('admin:bulkDelete'), danger: true },
          ] : []}
          onBulkAction={(action, ids) => adminContentApi.foreignStudies.bulk(action, ids).then(() => { toast.success(t('admin:bulkDone')); setSelectedIds([]); refetch(); }).catch(() => toast.error(t('admin:actionFailed')))}
          exportResource={can(PERMISSIONS.EXPORT_DATA) ? 'foreign-studies' : undefined}
          onExport={(r, f) => adminContentApi.exportData(r, f)}
        />

        {formOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setFormOpen(false)} />
            <div className="max-w-2xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">{editingId ? t('admin:editForeignStudy') : t('admin:addForeignStudy')}</h3>
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto">
                <input className={adminFieldClass} placeholder={t('admin:countryPlaceholder')} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:colProgram')} value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} />
                <AdminSelectBare  value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                  <option value="Undergraduate">Undergraduate</option>
                  <option value="Graduate">Graduate</option>
                  <option value="PhD">PhD</option>
                  <option value="Short Course">Short Course</option>
                  <option value="Other">Other</option>
                </AdminSelectBare>
                <input className={adminFieldClass} placeholder={t('admin:institutionPlaceholder')} value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
                <textarea rows={4} className={adminFieldClass} placeholder={t('admin:fieldDescription')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <textarea rows={3} className={adminFieldClass} placeholder={t('admin:fieldVisaInfo')} value={form.visaInfo} onChange={(e) => setForm({ ...form, visaInfo: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:fieldCostOfLiving')} value={form.costOfLiving} onChange={(e) => setForm({ ...form, costOfLiving: e.target.value })} />
                <textarea rows={3} className={adminFieldClass} placeholder={t('admin:fieldStudentLife')} value={form.studentLife} onChange={(e) => setForm({ ...form, studentLife: e.target.value })} />
                <input type="date" className={adminFieldClass} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                <input className={adminFieldClass} placeholder={t('admin:applyLinkPlaceholder')} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
                <AdminImageUrlField label={t('admin:fieldFeaturedImage')} value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} />
                <AdminSelectBare  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                </AdminSelectBare>
                <AdminSlugField
                  resourceType="foreign-study"
                  value={form.slug}
                  onChange={(slug) => setForm({ ...form, slug })}
                  sourceText={`${form.country} ${form.program || ''}`.trim()}
                  status={form.status}
                  excludeId={editingId}
                />
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
