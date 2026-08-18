import { useState } from 'react';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminStatusBadge, formatAdminDate } from '../../components/admin/adminTableUtils';
import { adminContentApi } from '../../services/adminContentApi';

const ROLES = ['User', 'Editor', 'Moderator', 'Admin', 'SuperAdmin'];

export default function AdminUsers() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.USERS_MANAGE);
  const canDelete = can(PERMISSIONS.USERS_DELETE);
  const canAssignRole = can(PERMISSIONS.ROLES_ASSIGN);

  const { data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch } = useAdminList('/admin/users');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkRole, setBulkRole] = useState('User');
  const [confirm, setConfirm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [activity, setActivity] = useState([]);

  const viewUser = async (id) => {
    try {
      const [userRes, actRes] = await Promise.all([
        adminContentApi.getUser(id),
        adminContentApi.getUserActivity(id, { limit: 10 }),
      ]);
      setDetail(userRes.data);
      setActivity(actRes.data?.data || []);
    } catch {
      toast.error(t('admin:loadFailed'));
    }
  };

  const updateStatus = async (id, accountStatus) => {
    try {
      await adminContentApi.updateUser(id, { accountStatus });
      toast.success(t('admin:saved'));
      refetch();
      if (detail?._id === id) setDetail({ ...detail, accountStatus });
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
  };

  const assignRole = async (id, role) => {
    try {
      await adminContentApi.assignRole(id, role);
      toast.success(t('admin:roleAssigned'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
  };

  const resetPassword = async (id) => {
    try {
      const res = await adminContentApi.resetUserPassword(id);
      const notice = res.data?.emailNotice;
      const msg = notice
        ? `${t('admin:passwordResetEmailed', { defaultValue: 'Temporary password emailed' })} — ${notice}`
        : t('admin:passwordResetEmailed', { defaultValue: 'Temporary password set and queued via email' });
      toast.success(msg);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
  };

  const deleteUser = async (id) => {
    try {
      await adminContentApi.deleteUser(id);
      toast.success(t('admin:deleted'));
      setDetail(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
    setConfirm(null);
  };

  const bulkRoleAssign = async () => {
    if (!selectedIds.length) return;
    try {
      await adminContentApi.bulkAssignRole(selectedIds, bulkRole);
      toast.success(t('admin:bulkDone'));
      setSelectedIds([]);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
  };

  const columns = [
    { key: 'email', label: t('admin:colEmail'), sortable: true },
    { key: 'name', label: t('admin:colName') },
    {
      key: 'role',
      label: t('admin:colRole'),
      render: (row) => <AdminStatusBadge value={row.role} label={row.role} />,
    },
    {
      key: 'accountStatus',
      label: t('status'),
      render: (row) => <AdminStatusBadge value={row.accountStatus || 'active'} />,
    },
    {
      key: 'createdAt',
      label: t('admin:colCreated'),
      render: (row) => formatAdminDate(row.createdAt),
    },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => viewUser(row._id)} className="text-xs underline">{t('admin:view')}</button>
          {canManage && row.accountStatus !== 'suspended' && (
            <button type="button" onClick={() => updateStatus(row._id, 'suspended')} className="text-xs text-amber-600">{t('admin:suspend')}</button>
          )}
          {canManage && row.accountStatus === 'suspended' && (
            <button type="button" onClick={() => updateStatus(row._id, 'active')} className="text-xs text-green-600">{t('admin:activate')}</button>
          )}
          {canManage && (
            <button type="button" onClick={() => resetPassword(row._id)} className="text-xs">{t('admin:resetPassword')}</button>
          )}
          {canDelete && row.role !== 'SuperAdmin' && (
            <button type="button" onClick={() => setConfirm({ id: row._id })} className="text-xs text-red-600">{t('common:delete')}</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.USERS_READ}>
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('admin:manageUsers')}</h1>

        {canAssignRole && selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <AdminSelectBare value={bulkRole} onChange={(e) => setBulkRole(e.target.value)} className="px-3 py-2 rounded-lg border text-sm dark:bg-gray-900">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </AdminSelectBare>
            <button type="button" onClick={bulkRoleAssign} className="px-3 py-2 bg-primary text-white rounded-lg text-sm">{t('admin:bulkAssignRole')}</button>
          </div>
        )}

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
          filterFields={['search', 'role', 'status', 'province', 'from', 'to']}
          selectable={canAssignRole}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          exportResource={can(PERMISSIONS.EXPORT_DATA) ? 'users' : undefined}
          onExport={(r, f) => adminContentApi.exportData(r, f)}
        />

        {detail && (
          <div className="mt-6 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold">{detail.email}</h3>
              <button type="button" onClick={() => setDetail(null)} className="text-sm text-gray-500">{t('common:close')}</button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{detail.name} · {detail.role} · {detail.accountStatus || 'active'}</p>
            {canAssignRole && (
              <div className="mt-3 flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button key={r} type="button" onClick={() => assignRole(detail._id, r)} className="px-2 py-1 text-xs rounded border">{r}</button>
                ))}
              </div>
            )}
            {activity.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">{t('admin:activityHistory')}</h4>
                <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                  {activity.map((a) => (
                    <li key={a._id}>{formatAdminDate(a.createdAt)} — {a.action} — {a.targetLabel}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <AdminConfirmDialog open={!!confirm} title={t('common:delete')} message={t('admin:deleteUserConfirm')} danger onConfirm={() => deleteUser(confirm.id)} onCancel={() => setConfirm(null)} />
      </div>
    </AdminRouteGuard>
  );
}
