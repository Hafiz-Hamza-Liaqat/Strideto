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
import { adminContentApi } from '../../services/adminContentApi';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const EMPTY = {
  title: '',
  message: '',
  audience: 'all',
  channel: 'in_app',
  scheduledAt: '',
  link: '',
  status: 'draft',
};

const AUDIENCES = ['all', 'students', 'employers', 'editors', 'moderators'];
const CHANNELS = ['in_app', 'email', 'whatsapp', 'push'];

export default function AdminNotifications() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.NOTIFICATIONS_SEND);

  const { data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch } = useAdminList('/admin/notifications');
  const [composer, setComposer] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const sendComposer = async () => {
    if (!composer.title?.trim() || !composer.message?.trim()) {
      toast.error(t('admin:titleRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await adminContentApi.createNotification({
        ...composer,
        scheduledAt: composer.scheduledAt || undefined,
      });
      const notice = res.data?.emailNotice;
      toast.success(notice ? `${t('admin:created')} — ${notice}` : t('admin:created'));
      setComposer(EMPTY);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditForm({
      ...EMPTY,
      ...row,
      scheduledAt: row.scheduledAt ? row.scheduledAt.slice(0, 16) : '',
    });
    setEditingId(row._id);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.title?.trim() || !editForm.message?.trim()) {
      toast.error(t('admin:titleRequired'));
      return;
    }
    setSaving(true);
    try {
      await adminContentApi.updateNotification(editingId, {
        ...editForm,
        scheduledAt: editForm.scheduledAt || undefined,
      });
      toast.success(t('admin:saved'));
      setEditOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async (id) => {
    try {
      const res = await adminContentApi.updateNotification(id, { sendNow: true });
      const notice = res.data?.emailNotice;
      toast.success(notice ? `${t('admin:actionDone')} — ${notice}` : t('admin:actionDone'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
  };

  const deleteNotification = async (id) => {
    try {
      await adminContentApi.deleteNotification(id);
      toast.success(t('admin:deleted'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
    setConfirm(null);
  };

  const renderFormFields = (form, setForm) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <input className={`${adminFieldClass} sm:col-span-2`} placeholder={t('admin:fieldTitle')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea rows={3} className={`${adminFieldClass} sm:col-span-2`} placeholder="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      <AdminSelectBare  value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
        {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
      </AdminSelectBare>
      <AdminSelectBare  value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
        {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
      </AdminSelectBare>
      <input type="datetime-local" className={adminFieldClass} value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
      <AdminSelectBare  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
        <option value="draft">{t('admin:statusDraft')}</option>
        <option value="scheduled">Scheduled</option>
        <option value="sent">Sent</option>
      </AdminSelectBare>
      <input className={`${adminFieldClass} sm:col-span-2`} placeholder="Link (optional)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
    </div>
  );

  const columns = [
    { key: 'title', label: t('admin:colTitle'), sortable: true },
    { key: 'audience', label: 'Audience' },
    { key: 'channel', label: t('admin:channel') },
    {
      key: 'status',
      label: t('status'),
      render: (row) => <AdminStatusBadge value={row.status} />,
    },
    {
      key: 'scheduledAt',
      label: 'Scheduled',
      render: (row) => formatAdminDate(row.scheduledAt),
    },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {canEdit && <button type="button" onClick={() => openEdit(row)} className="text-xs underline">{t('common:edit')}</button>}
          {canEdit && row.status !== 'sent' && (
            <button type="button" onClick={() => sendNow(row._id)} className="text-xs">{t('admin:sendNow', { defaultValue: 'Send now' })}</button>
          )}
          {canEdit && (
            <button type="button" onClick={() => setConfirm({ id: row._id })} className="text-xs text-red-600">{t('common:delete')}</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.NOTIFICATIONS_SEND}>
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('admin:manageNotifications', { defaultValue: 'Notifications' })}</h2>

        {canEdit && (
          <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
            <h3 className="font-semibold mb-3">{t('admin:composeNotification', { defaultValue: 'Compose notification' })}</h3>
            {renderFormFields(composer, setComposer)}
            <div className="flex justify-end mt-3">
              <button type="button" onClick={sendComposer} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm min-h-[44px]">
                {saving ? t('admin:saving') : t('admin:create')}
              </button>
            </div>
          </section>
        )}

        <section>
          <h3 className="font-semibold mb-3">{t('admin:notificationHistory', { defaultValue: 'History' })}</h3>
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
            filterFields={['search', 'status']}
          />
        </section>

        {editOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setEditOpen(false)} />
            <div className="max-w-xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">{t('admin:editNotification', { defaultValue: 'Edit notification' })}</h3>
              {renderFormFields(editForm, setEditForm)}
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 border rounded-lg text-sm">{t('common:cancel')}</button>
                <button type="button" onClick={saveEdit} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">{saving ? t('admin:saving') : t('admin:save')}</button>
              </div>
            </div>
          </div>
        )}

        {confirm && (
          <AdminConfirmDialog
            open
            title={t('admin:bulkDeleteConfirm')}
            onConfirm={() => deleteNotification(confirm.id)}
            onCancel={() => setConfirm(null)}
          />
        )}
      </div>
    </AdminRouteGuard>
  );
}
