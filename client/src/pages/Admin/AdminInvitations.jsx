import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminStatusBadge, formatAdminDate } from '../../components/admin/adminTableUtils';
import { AdminSelect, AdminInput, AdminTextarea, AdminSelectBare, adminFieldClass } from '../../components/admin/AdminFormFields';
import { adminContentApi } from '../../services/adminContentApi';

export default function AdminInvitations() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { role } = usePermissions();
  const { data, pagination, filters, setFilters, loading, error, setPage, refetch } = useAdminList('/admin/invitations');

  const [form, setForm] = useState({ email: '', role: 'Editor', message: '' });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const invitableRoles = role === 'SuperAdmin'
    ? ['Editor', 'Moderator', 'Admin']
    : ['Editor', 'Moderator'];

  const sendInvite = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) {
      toast.error(t('admin:emailRequired', { defaultValue: 'Email is required' }));
      return;
    }
    setSaving(true);
    try {
      const res = await adminContentApi.createInvitation(form);
      const notice = res.data?.emailNotice;
      toast.success(notice ? `${t('admin:invitationSent', { defaultValue: 'Invitation sent' })} — ${notice}` : t('admin:invitationSent', { defaultValue: 'Invitation sent' }));
      setForm({ email: '', role: invitableRoles[0], message: '' });
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    } finally {
      setSaving(false);
    }
  };

  const resend = async (id) => {
    try {
      const res = await adminContentApi.resendInvitation(id);
      const notice = res.data?.emailNotice;
      toast.success(notice ? `${t('admin:invitationResent', { defaultValue: 'Invitation resent' })} — ${notice}` : t('admin:invitationResent', { defaultValue: 'Invitation resent' }));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
  };

  const revoke = async (id) => {
    try {
      await adminContentApi.revokeInvitation(id);
      toast.success(t('admin:invitationRevoked', { defaultValue: 'Invitation revoked' }));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
  };

  return (
    <AdminRouteGuard permission={PERMISSIONS.USERS_MANAGE}>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('admin:staffInvitations', { defaultValue: 'Staff invitations' })}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
          {t('admin:staffInvitationsHelp', { defaultValue: 'Invite editors, moderators, or admins by email. Links expire in 72 hours.' })}
        </p>

        <form onSubmit={sendInvite} className="mb-8 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">{t('admin:inviteStaff', { defaultValue: 'Invite staff' })}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminInput
              name="invite-email"
              label={t('admin:fieldEmail', { defaultValue: 'Email' })}
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <AdminSelect
              name="invite-role"
              label={t('admin:fieldRole', { defaultValue: 'Role' })}
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              {invitableRoles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </AdminSelect>
          </div>
          <AdminTextarea
            name="invite-message"
            label={t('admin:optionalMessage', { defaultValue: 'Optional message' })}
            rows={2}
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          />
          <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm min-h-[44px] disabled:opacity-50">
            {saving ? t('common:sending', { defaultValue: 'Sending…' }) : t('admin:sendInvitation', { defaultValue: 'Send invitation' })}
          </button>
        </form>

        <div className="flex flex-wrap gap-3 mb-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <input
            type="search"
            name="invitation-search"
            id="invitation-search"
            aria-label={t('admin:filterSearch')}
            placeholder={t('admin:filterSearch')}
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className={`${adminFieldClass} w-full min-w-0 sm:flex-1 sm:min-w-[160px]`}
          />
          <AdminSelectBare
            name="invitation-status-filter"
            id="invitation-status-filter"
            aria-label={t('admin:filterStatus', { defaultValue: 'Status' })}
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">{t('admin:filterAll')}</option>
            <option value="pending">{t('admin:filterPending')}</option>
            <option value="accepted">{t('admin:filterAccepted', { defaultValue: 'Accepted' })}</option>
            <option value="expired">{t('admin:filterExpired', { defaultValue: 'Expired' })}</option>
            <option value="revoked">{t('admin:filterRevoked', { defaultValue: 'Revoked' })}</option>
          </AdminSelectBare>
        </div>

        {error && <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>}
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">{t('common:loading')}</p>
        ) : (
          <div className="table-scroll rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">{t('admin:fieldEmail', { defaultValue: 'Email' })}</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">{t('admin:fieldRole', { defaultValue: 'Role' })}</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">{t('admin:fieldStatus', { defaultValue: 'Status' })}</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">{t('admin:expires', { defaultValue: 'Expires' })}</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">{t('admin:invitedBy', { defaultValue: 'Invited by' })}</th>
                  <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{t('common:actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {data.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{t('admin:noInvitations', { defaultValue: 'No invitations yet' })}</td></tr>
                ) : data.map((row) => (
                  <tr key={row._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{row.email}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.role}</td>
                    <td className="px-4 py-3"><AdminStatusBadge value={row.status} /></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatAdminDate(row.expiresAt)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.invitedBy?.email || row.invitedByEmail || '—'}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {row.status === 'pending' && (
                        <>
                          <button type="button" onClick={() => resend(row._id)} className="text-xs text-primary dark:text-mint">{t('admin:resend', { defaultValue: 'Resend' })}</button>
                          <button type="button" onClick={() => setConfirm({ id: row._id, email: row.email })} className="text-xs text-red-600 dark:text-red-400">{t('admin:revoke', { defaultValue: 'Revoke' })}</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button type="button" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)} className="px-3 py-1 rounded border dark:border-gray-600 disabled:opacity-50">{t('common:previous', { defaultValue: 'Previous' })}</button>
            <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">{pagination.page} / {pagination.totalPages}</span>
            <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)} className="px-3 py-1 rounded border dark:border-gray-600 disabled:opacity-50">{t('common:next', { defaultValue: 'Next' })}</button>
          </div>
        )}

        <AdminConfirmDialog
          open={!!confirm}
          title={t('admin:revokeInvitation', { defaultValue: 'Revoke invitation?' })}
          message={confirm ? confirm.email : ''}
          onConfirm={() => { revoke(confirm.id); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      </div>
    </AdminRouteGuard>
  );
}
