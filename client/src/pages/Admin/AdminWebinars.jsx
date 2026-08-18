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
import { EscapeWhen } from '../../a11y/EscapeWhen';

const EMPTY = {
  title: '', description: '', scheduledAt: '', durationMinutes: 60, meetingUrl: '', recordingUrl: '',
  registrationUrl: '', status: 'draft', speakerName: '', speakerTitle: '', speakerBio: '', speakerImageUrl: '',
  bannerUrl: '', seoTitle: '', metaDescription: '', isSponsored: false, slug: '',
};

const STATUSES = ['draft', 'scheduled', 'live', 'recorded', 'cancelled'];

export default function AdminWebinars() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.CONTENT_BLOGS);

  const { data, pagination, loading, error, setPage, refetch } = useAdminList('/admin/webinars');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setFormOpen(true); };

  const openEdit = async (id) => {
    try {
      const res = await adminContentApi.webinars.get(id);
      const w = res.data;
      setForm({
        ...EMPTY, ...w,
        scheduledAt: w.scheduledAt ? w.scheduledAt.slice(0, 16) : '',
        isSponsored: !!w.isSponsored,
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
    try {
      if (editingId) await adminContentApi.webinars.update(editingId, form);
      else await adminContentApi.webinars.create(form);
      toast.success(t('admin:saved'));
      setFormOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, status) => {
    await adminContentApi.webinars.update(id, { status });
    toast.success(t('admin:actionDone'));
    refetch();
  };

  const columns = [
    { key: 'title', label: t('admin:colTitle'), sortable: true },
    { key: 'scheduledAt', label: t('admin:colScheduled'), type: 'date' },
    { key: 'status', label: t('status'), type: 'status' },
    {
      key: 'actions', label: t('admin:actions'), render: (row) => (
        <div className="flex flex-wrap gap-2">
          {canEdit && <button type="button" className="text-primary text-sm" onClick={() => openEdit(row._id)}>{t('admin:edit')}</button>}
          {canEdit && row.status === 'draft' && <button type="button" className="text-green-600 text-sm" onClick={() => setStatus(row._id, 'scheduled')}>{t('admin:publish')}</button>}
          {canEdit && row.status === 'scheduled' && <button type="button" className="text-amber-600 text-sm" onClick={() => setStatus(row._id, 'cancelled')}>{t('admin:cancel')}</button>}
          {canEdit && <button type="button" className="text-red-600 text-sm" onClick={() => setConfirm({ id: row._id })}>{t('common:delete')}</button>}
        </div>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.CONTENT_BLOGS}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">{t('admin:webinars')}</h1>
          {canEdit && <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">{t('admin:create')}</button>}
        </div>
        <AdminDataTable columns={columns} data={data} loading={loading} error={error} pagination={pagination} onPageChange={setPage} />
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <EscapeWhen active onEscape={() => setFormOpen(false)} />
          <div className="max-w-2xl mx-auto my-8 rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg">{editingId ? t('admin:edit') : t('admin:create')} Webinar</h3>
            <input className={adminFieldClass} placeholder={t('admin:colTitle')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <AdminSlugField
              resourceType="webinar"
              value={form.slug}
              onChange={(slug) => setForm({ ...form, slug })}
              sourceText={form.title}
              status={form.status}
              excludeId={editingId}
            />
            <textarea className={adminFieldClass} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />
            <input type="datetime-local" className={adminFieldClass} value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
            <input type="number" className={adminFieldClass} placeholder="Duration (min)" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            <AdminSelectBare  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </AdminSelectBare>
            <input className={adminFieldClass} placeholder="Meeting URL" value={form.meetingUrl} onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })} />
            <input className={adminFieldClass} placeholder="Registration URL" value={form.registrationUrl} onChange={(e) => setForm({ ...form, registrationUrl: e.target.value })} />
            <AdminImageUrlField label="Banner URL" value={form.bannerUrl} onChange={(v) => setForm({ ...form, bannerUrl: v })} />
            <input className={adminFieldClass} placeholder="Speaker name" value={form.speakerName} onChange={(e) => setForm({ ...form, speakerName: e.target.value })} />
            <input className={adminFieldClass} placeholder="Speaker title" value={form.speakerTitle} onChange={(e) => setForm({ ...form, speakerTitle: e.target.value })} />
            <textarea className={adminFieldClass} rows={2} placeholder="Speaker bio" value={form.speakerBio} onChange={(e) => setForm({ ...form, speakerBio: e.target.value })} />
            <input className={adminFieldClass} placeholder="SEO title" value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
            <textarea className={adminFieldClass} rows={2} placeholder="Meta description" value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white">{t('admin:save')}</button>
              <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-lg border">{t('common:cancel')}</button>
            </div>
          </div>
        </div>
      )}

      <AdminConfirmDialog open={!!confirm} title={t('admin:confirmDelete')} onConfirm={async () => {
        await adminContentApi.webinars.remove(confirm.id);
        toast.success(t('admin:actionDone'));
        refetch();
        setConfirm(null);
      }} onCancel={() => setConfirm(null)} />
    </AdminRouteGuard>
  );
}
