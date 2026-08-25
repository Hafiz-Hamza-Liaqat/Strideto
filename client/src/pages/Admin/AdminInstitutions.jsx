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
import { isAdminSlugPreviewReady } from '../../components/admin/AdminViewPublicLink';
import { adminContentApi } from '../../services/adminContentApi';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const EMPTY = {
  name: '', type: 'school', description: '', city: '', province: '', address: '', phone: '', email: '', website: '',
  imageUrl: '', logoUrl: '', programs: '', facilities: '', accreditation: '', establishedYear: '', status: 'active',
  seoTitle: '', metaDescription: '', slug: '',
};

const TYPES = ['school', 'college', 'technical_institute', 'training_center'];

export default function AdminInstitutions() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_ADMISSIONS);

  const { data, pagination, loading, error, setPage, refetch } = useAdminList('/admin/institutions');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setFormOpen(true); };

  const openEdit = async (id) => {
    try {
      const res = await adminContentApi.institutions.get(id);
      const item = res.data;
      setForm({
        ...EMPTY, ...item,
        programs: (item.programs || []).join('\n'),
        facilities: (item.facilities || []).join('\n'),
      });
      setEditingId(id);
      setFormOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
    }
  };

  const save = async () => {
    if (!form.name?.trim()) { toast.error(t('admin:nameRequired')); return; }
    setSaving(true);
    const payload = {
      ...form,
      programs: form.programs ? form.programs.split('\n').map((s) => s.trim()).filter(Boolean) : [],
      facilities: form.facilities ? form.facilities.split('\n').map((s) => s.trim()).filter(Boolean) : [],
      establishedYear: form.establishedYear ? Number(form.establishedYear) : undefined,
    };
    try {
      if (editingId) await adminContentApi.institutions.update(editingId, payload);
      else await adminContentApi.institutions.create(payload);
      toast.success(t('admin:saved'));
      setFormOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'name', label: t('admin:colName'), sortable: true },
    { key: 'type', label: t('admin:colType') },
    { key: 'city', label: t('admin:colCity') },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'actions', label: t('admin:actions'), render: (row) => (
        <div className="flex gap-2">
          {canEdit && <button type="button" className="text-primary text-sm" onClick={() => openEdit(row._id)}>{t('admin:edit')}</button>}
          {canEdit && <button type="button" className="text-red-600 text-sm" onClick={() => setConfirm({ action: 'delete', id: row._id })}>{t('common:delete')}</button>}
        </div>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_ADMISSIONS}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">{t('admin:institutions')}</h1>
          {canEdit && <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">{t('admin:create')}</button>}
        </div>
        <AdminDataTable columns={columns} data={data} loading={loading} error={error} pagination={pagination} onPageChange={setPage} />
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <EscapeWhen active onEscape={() => setFormOpen(false)} />
          <div className="max-w-2xl mx-auto my-8 rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl space-y-3">
            <h3 className="font-semibold text-lg">{editingId ? t('admin:edit') : t('admin:create')}</h3>
            <input className={adminFieldClass} placeholder={t('admin:colName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <AdminSelectBare  value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
            </AdminSelectBare>
            <textarea className={adminFieldClass} rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid sm:grid-cols-2 gap-3">
              <input className={adminFieldClass} placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <input className={adminFieldClass} placeholder="Province" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
            </div>
            <AdminImageUrlField label="Logo URL" value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} />
            <AdminImageUrlField label="Image URL" value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} />
            <textarea className={adminFieldClass} rows={2} placeholder="Programs (one per line)" value={form.programs} onChange={(e) => setForm({ ...form, programs: e.target.value })} />
            <AdminSelectBare  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="closed">closed</option>
            </AdminSelectBare>
            <AdminSlugField
              resourceType="institution"
              value={form.slug}
              onChange={(slug) => setForm({ ...form, slug })}
              sourceText={form.name}
              status={form.status}
              excludeId={editingId}
              publicPreviewReady={isAdminSlugPreviewReady('institution', form, form.status)}
            />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white">{t('admin:save')}</button>
              <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-lg border">{t('common:cancel')}</button>
            </div>
          </div>
        </div>
      )}

      <AdminConfirmDialog
        open={!!confirm}
        title={t('admin:confirmDelete')}
        onConfirm={async () => {
          await adminContentApi.institutions.remove(confirm.id);
          toast.success(t('admin:actionDone'));
          refetch();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </AdminRouteGuard>
  );
}
