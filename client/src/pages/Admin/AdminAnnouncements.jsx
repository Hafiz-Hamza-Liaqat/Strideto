import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminStatusBadge, formatAdminDate } from '../../components/admin/adminTableUtils';
import { adminFieldClass } from '../../components/admin/AdminFormFields';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import axiosInstance from '../../services/axiosBase';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const EMPTY = {
  title: '',
  body: '',
  type: 'info',
  audiences: ['all'],
  status: 'draft',
  priority: 'normal',
  link: '',
  scheduledAt: '',
  expiresAt: '',
  surveyOptions: [{ label: '', value: '' }, { label: '', value: '' }],
};

const TYPES = ['info', 'policy', 'maintenance', 'action_required', 'survey'];
const AUDIENCES = ['student', 'employer', 'agent', 'institution', 'staff', 'all'];
const STATUSES = ['draft', 'scheduled', 'published', 'expired'];

function toggleAudience(list, value) {
  if (value === 'all') return ['all'];
  const withoutAll = list.filter((a) => a !== 'all');
  return withoutAll.includes(value)
    ? (withoutAll.length === 1 ? ['all'] : withoutAll.filter((a) => a !== value))
    : [...withoutAll, value];
}

export default function AdminAnnouncements() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.NOTIFICATIONS_SEND);

  const { data, pagination, filters, setFilters, loading, error, setPage, refetch } = useAdminList('/admin/announcements');
  const [form, setForm] = useState(EMPTY);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setEditOpen(true);
  };

  const openEdit = async (id) => {
    try {
      const { data: doc } = await axiosInstance.get(`/admin/announcements/${id}`);
      setEditingId(id);
      setForm({
        ...EMPTY,
        ...doc,
        audiences: doc.audiences || ['all'],
        scheduledAt: doc.scheduledAt ? doc.scheduledAt.slice(0, 16) : '',
        expiresAt: doc.expiresAt ? doc.expiresAt.slice(0, 16) : '',
        surveyOptions: doc.surveyOptions?.length ? doc.surveyOptions : EMPTY.surveyOptions,
      });
      setEditOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
    }
  };

  const save = async () => {
    if (!form.title?.trim() || !form.body?.trim()) {
      toast.error(t('admin:titleRequired'));
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      surveyOptions: form.type === 'survey'
        ? form.surveyOptions.filter((o) => o.label?.trim() && o.value?.trim())
        : undefined,
    };
    try {
      if (editingId) {
        await axiosInstance.put(`/admin/announcements/${editingId}`, payload);
        toast.success(t('admin:saved'));
      } else {
        await axiosInstance.post('/admin/announcements', payload);
        toast.success(t('admin:created'));
      }
      setEditOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const publish = async (id) => {
    try {
      await axiosInstance.post(`/admin/announcements/${id}/publish`);
      toast.success(t('admin:announcementPublished', { defaultValue: 'Announcement published' }));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    }
  };

  const expire = async (id) => {
    try {
      await axiosInstance.post(`/admin/announcements/${id}/expire`);
      toast.success(t('admin:announcementExpired', { defaultValue: 'Announcement expired' }));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    }
  };

  const remove = async (id) => {
    try {
      await axiosInstance.delete(`/admin/announcements/${id}`);
      toast.success(t('admin:deleted'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:deleteFailed'));
    }
  };

  const fieldClass = adminFieldClass;

  const columns = [
    { key: 'title', label: t('admin:fieldTitle'), sortable: true },
    { key: 'type', label: 'Type', render: (row) => <AdminStatusBadge value={row.type} /> },
    { key: 'audiences', label: 'Audiences', render: (row) => (row.audiences || []).join(', ') },
    { key: 'status', label: t('admin:fieldStatus'), render: (row) => <AdminStatusBadge value={row.status} /> },
    { key: 'publishedAt', label: 'Published', render: (row) => formatAdminDate(row.publishedAt) },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {canEdit ? <button type="button" onClick={() => openEdit(row._id)} className="text-xs underline">{t('common:edit')}</button> : null}
          {canEdit && row.status !== 'published' ? (
            <button type="button" onClick={() => publish(row._id)} className="text-xs">{t('admin:publish', { defaultValue: 'Publish' })}</button>
          ) : null}
          {canEdit && row.status === 'published' ? (
            <button type="button" onClick={() => expire(row._id)} className="text-xs">{t('admin:expire', { defaultValue: 'Expire' })}</button>
          ) : null}
          {canEdit ? (
            <button type="button" onClick={() => setConfirm({ id: row._id, title: row.title })} className="text-xs text-red-600">{t('common:delete')}</button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.NOTIFICATIONS_SEND}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('admin:announcementsTitle', { defaultValue: 'Announcements' })}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('admin:announcementsIntro', { defaultValue: 'Role-targeted announcements with read/ack tracking. Publish requires Admin.' })}
            </p>
          </div>
          {canEdit ? (
            <button type="button" onClick={openCreate} className="min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium">
              {t('admin:createAnnouncement', { defaultValue: 'New announcement' })}
            </button>
          ) : null}
        </div>

        <AdminDataTable
          columns={columns}
          data={data}
          loading={loading}
          error={error}
          emptyMessage={t('admin:noData')}
          pagination={pagination}
          onPageChange={setPage}
          filters={filters}
          onFiltersChange={(f) => { setFilters(f); setPage(1); }}
          filterFields={['search', 'status']}
        />

        {editOpen && (
          <EscapeWhen active onEscape={() => setEditOpen(false)}>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5">
                <h3 className="text-lg font-bold mb-4">{editingId ? t('admin:editAnnouncement', { defaultValue: 'Edit announcement' }) : t('admin:createAnnouncement', { defaultValue: 'New announcement' })}</h3>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs text-gray-500">{t('admin:fieldTitle')} *</span>
                    <input className={fieldClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-500">Body *</span>
                    <textarea rows={4} className={fieldClass} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label>
                      <span className="text-xs text-gray-500">Type</span>
                      <AdminSelectBare className={fieldClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                        {TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                      </AdminSelectBare>
                    </label>
                    <label>
                      <span className="text-xs text-gray-500">Priority</span>
                      <AdminSelectBare className={fieldClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                        <option value="normal">normal</option>
                        <option value="high">high</option>
                      </AdminSelectBare>
                    </label>
                  </div>
                  <fieldset>
                    <legend className="text-xs text-gray-500 mb-2">Audiences</legend>
                    <div className="flex flex-wrap gap-2">
                      {AUDIENCES.map((a) => (
                        <label key={a} className="inline-flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={form.audiences.includes(a)}
                            onChange={() => setForm({ ...form, audiences: toggleAudience(form.audiences, a) })}
                          />
                          {a}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="block">
                    <span className="text-xs text-gray-500">Link (optional)</span>
                    <input className={fieldClass} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label>
                      <span className="text-xs text-gray-500">Scheduled at</span>
                      <input type="datetime-local" className={fieldClass} value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value, status: e.target.value ? 'scheduled' : form.status })} />
                    </label>
                    <label>
                      <span className="text-xs text-gray-500">Expires at</span>
                      <input type="datetime-local" className={fieldClass} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
                    </label>
                  </div>
                  {form.type === 'survey' ? (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Survey options (one vote per user)</p>
                      {form.surveyOptions.map((opt, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-2">
                          <input className={fieldClass} placeholder="Label" value={opt.label} onChange={(e) => {
                            const next = [...form.surveyOptions];
                            next[idx] = { ...next[idx], label: e.target.value };
                            setForm({ ...form, surveyOptions: next });
                          }} />
                          <input className={fieldClass} placeholder="value_key" value={opt.value} onChange={(e) => {
                            const next = [...form.surveyOptions];
                            next[idx] = { ...next[idx], value: e.target.value };
                            setForm({ ...form, surveyOptions: next });
                          }} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" className="min-h-[44px] px-4 py-2 rounded-lg border" onClick={() => setEditOpen(false)}>{t('common:cancel')}</button>
                  <button type="button" disabled={saving} className="min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50" onClick={save}>{saving ? '…' : t('common:save')}</button>
                </div>
              </div>
            </div>
          </EscapeWhen>
        )}

        <AdminConfirmDialog
          open={Boolean(confirm)}
          title={t('admin:confirmDelete')}
          message={confirm?.title}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { remove(confirm.id); setConfirm(null); }}
        />
      </div>
    </AdminRouteGuard>
  );
}
