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
  program: '',
  institution: '',
  department: '',
  degree: '',
  province: '',
  city: '',
  fee: '',
  duration: '',
  session: '',
  description: '',
  eligibility: '',
  applyLink: '',
  deadline: '',
  status: 'draft',
  logoUrl: '',
  brochureUrl: '',
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

export default function AdminContentAdmissions() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_ADMISSIONS);

  const { data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch } = useAdminList('/admin/admissions');
  const [selectedIds, setSelectedIds] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const openEdit = async (id) => {
    const res = await axiosInstance.get(`/admin/admissions/${id}`);
    const a = res.data;
    setForm({
      ...EMPTY,
      ...a,
      institution: a.institution || a.university,
      applyLink: a.applyLink || a.link || '',
      eligibility: linesToText(a.eligibility),
      deadline: a.deadline ? a.deadline.slice(0, 10) : '',
    });
    setEditingId(id);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.program?.trim() || !form.institution?.trim()) {
      toast.error(t('admin:admissionFieldsRequired'));
      return;
    }
    setSaving(true);
    const payload = { ...form, university: form.institution, eligibility: textToLines(form.eligibility), link: form.applyLink };
    try {
      if (editingId) await axiosInstance.put(`/admin/admissions/${editingId}`, payload);
      else await axiosInstance.post('/admin/admissions', payload);
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
      if (action === 'delete') await axiosInstance.delete(`/admin/admissions/${id}`);
      else if (action === 'duplicate') await axiosInstance.post(`/admin/admissions/${id}/duplicate`);
      toast.success(t('admin:actionDone'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
    setConfirm(null);
  };

  const fieldClass = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm';

  const columns = [
    { key: 'program', label: t('admin:colProgram'), sortable: true },
    { key: 'institution', label: t('admin:colUniversity') },
    { key: 'province', label: t('admin:colProvince') },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {canEdit && <button type="button" onClick={() => openEdit(row._id)} className="text-xs text-primary underline">{t('common:edit')}</button>}
          {row.slug && <a href={`${ROUTES.ADMISSIONS}/${row.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs underline">{t('admin:viewPublic')}</a>}
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
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_ADMISSIONS}>
      <div>
        <div className="flex flex-wrap justify-between gap-2 mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:manageAdmissions')}</h2>
          {canEdit && (
            <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); setFormOpen(true); }} className="px-4 py-2 rounded-lg bg-primary text-white text-sm min-h-[44px]">
              {t('admin:addAdmission')}
            </button>
          )}
        </div>

        <AdminDataTable
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          pagination={pagination}
          onPageChange={setPage}
          sort={sort}
          onSort={setSort}
          filters={filters}
          onFiltersChange={(f) => { setFilters(f); setPage(1); }}
          filterFields={['search', 'status', 'province', 'city', 'from', 'to', 'featured']}
          selectable={canEdit}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          bulkActions={canEdit ? [
            { id: 'publish', label: t('admin:bulkPublish') },
            { id: 'archive', label: t('admin:bulkArchive') },
            { id: 'delete', label: t('admin:bulkDelete'), danger: true },
          ] : []}
          onBulkAction={(action, ids) => adminContentApi.bulkAdmissions(action, ids).then(() => { toast.success(t('admin:bulkDone')); setSelectedIds([]); refetch(); })}
          exportResource={can(PERMISSIONS.EXPORT_DATA) ? 'admissions' : undefined}
          onExport={(r, f) => adminContentApi.exportData(r, f)}
        />

        {formOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setFormOpen(false)} />
            <div className="max-w-2xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">{editingId ? t('admin:editAdmission') : t('admin:addAdmission')}</h3>
              {editingId ? (
                <TranslationToolbar
                  entityType="admission"
                  entityId={editingId}
                  currentLocale={form.locale || 'en'}
                  onOpenTranslation={(doc) => openEdit(doc._id)}
                />
              ) : null}
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto mt-3">
                <input className={fieldClass} placeholder={t('admin:programPlaceholder')} value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} />
                <input className={fieldClass} placeholder={t('admin:institutionPlaceholder')} value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
                <input className={fieldClass} placeholder={t('admin:fieldDegree')} value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} />
                <input className={fieldClass} placeholder={t('admin:fieldDepartment')} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                <input className={fieldClass} placeholder={t('admin:provincePlaceholder')} value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
                <input className={fieldClass} placeholder={t('admin:fieldCity')} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <input className={fieldClass} placeholder={t('admin:fieldFee')} value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
                <input className={fieldClass} placeholder={t('admin:fieldDuration')} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                <input type="date" className={fieldClass} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                <input className={fieldClass} placeholder={t('admin:applyLinkPlaceholder')} value={form.applyLink} onChange={(e) => setForm({ ...form, applyLink: e.target.value })} />
                <textarea rows={3} className={fieldClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <AdminImageUrlField label={t('admin:fieldLogoUrl')} value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} />
                <input className={fieldClass} placeholder={t('admin:fieldBrochureUrl')} value={form.brochureUrl} onChange={(e) => setForm({ ...form, brochureUrl: e.target.value })} />
                <AdminSelectBare className={fieldClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                </AdminSelectBare>
                <AdminSlugField
                  resourceType="admission"
                  value={form.slug}
                  onChange={(slug) => setForm({ ...form, slug })}
                  sourceText={`${form.program} ${form.institution || ''}`.trim()}
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

        <AdminConfirmDialog open={!!confirm} title={t('common:delete')} message={t('admin:deleteAdmissionConfirm')} danger onConfirm={() => runAction('delete', confirm.id)} onCancel={() => setConfirm(null)} />
      </div>
    </AdminRouteGuard>
  );
}
