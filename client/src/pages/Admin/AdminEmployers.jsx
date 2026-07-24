import { useState } from 'react';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminStatusBadge } from '../../components/admin/adminTableUtils';
import { adminContentApi } from '../../services/adminContentApi';
import { EscapeWhen } from '../../a11y/EscapeWhen';

export default function AdminEmployers() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can, canAny } = usePermissions();
  const canManage = canAny([PERMISSIONS.USERS_MANAGE, PERMISSIONS.MODERATE_EMPLOYERS, PERMISSIONS.MODERATE_SUSPEND]);
  const canBulkVerify = can(PERMISSIONS.MODERATE_EMPLOYERS);
  const canBulkSuspend = can(PERMISSIONS.MODERATE_SUSPEND);

  const { data, pagination, filters, setFilters, sort, setSort, loading, error, setPage, refetch } = useAdminList('/admin/employers', {
    initialFilters: { search: '', verified: '', accountStatus: '' },
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [jobsModal, setJobsModal] = useState(null);
  const [jobsLoading, setJobsLoading] = useState(false);

  const updateFilters = (patch) => {
    setFilters({ ...filters, ...patch });
    setPage(1);
  };

  const viewJobs = async (employer) => {
    setJobsModal({ employer, jobs: [], pagination: null });
    setJobsLoading(true);
    try {
      const res = await adminContentApi.getEmployerJobs(employer._id, { limit: 50 });
      setJobsModal({
        employer,
        jobs: res.data?.data || [],
        pagination: res.data?.pagination,
      });
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
      setJobsModal(null);
    } finally {
      setJobsLoading(false);
    }
  };

  const verifyEmployer = async (id) => {
    try {
      await adminContentApi.updateEmployer(id, { verified: true, verificationLevel: 'verified' });
      toast.success(t('admin:actionDone'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
  };

  const toggleSuspend = async (row) => {
    const next = row.accountStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await adminContentApi.updateEmployer(row._id, { accountStatus: next });
      toast.success(t('admin:actionDone'));
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
  };

  const columns = [
    { key: 'companyName', label: t('admin:colCompany'), sortable: true },
    { key: 'email', label: t('admin:colEmail') },
    {
      key: 'verified',
      label: t('admin:verify'),
      render: (row) => (
        <AdminStatusBadge value={row.verified ? 'approved' : 'pending'} label={row.verified ? t('admin:approved') : t('admin:filterPending')} />
      ),
    },
    {
      key: 'accountStatus',
      label: t('status'),
      render: (row) => <AdminStatusBadge value={row.accountStatus || 'active'} />,
    },
    { key: 'totalJobsPosted', label: t('admin:totalJobsPosted', { defaultValue: 'Jobs posted' }) },
    {
      key: 'actions',
      label: t('admin:colActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => viewJobs(row)} className="text-xs underline">{t('admin:viewJobs', { defaultValue: 'View jobs' })}</button>
          {canManage && !row.verified && (
            <button type="button" onClick={() => verifyEmployer(row._id)} className="text-xs">{t('admin:verify')}</button>
          )}
          {canManage && (
            <button type="button" onClick={() => toggleSuspend(row)} className="text-xs">
              {row.accountStatus === 'suspended' ? t('admin:activate') : t('admin:suspend')}
            </button>
          )}
        </div>
      ),
    },
  ];

  const bulkActions = [];
  if (canBulkVerify) bulkActions.push({ id: 'verify', label: t('admin:bulkVerify', { defaultValue: 'Bulk verify' }) });
  if (canBulkSuspend) bulkActions.push({ id: 'suspend', label: t('admin:bulkSuspend', { defaultValue: 'Bulk suspend' }), danger: true });

  const handleBulkAction = async (action, ids) => {
    try {
      if (action === 'verify') await adminContentApi.bulkVerifyEmployers(ids);
      else if (action === 'suspend') await adminContentApi.bulkSuspendEmployers(ids);
      toast.success(t('admin:bulkDone'));
      setSelectedIds([]);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:actionFailed'));
    }
  };

  return (
    <AdminRouteGuard anyPermission={[PERMISSIONS.USERS_READ]}>
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('admin:manageEmployers', { defaultValue: 'Manage Employers' })}</h2>

        <div className="flex flex-wrap gap-3 mb-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <input
            type="search"
            placeholder={t('admin:filterSearch')}
            value={filters.search || ''}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="w-full sm:flex-1 sm:min-w-[160px] min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          />
          <AdminSelectBare
            value={filters.verified || ''}
            onChange={(e) => updateFilters({ verified: e.target.value })}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          >
            <option value="">{t('admin:filterAllVerified', { defaultValue: 'All verification' })}</option>
            <option value="true">{t('admin:verifiedOnly', { defaultValue: 'Verified' })}</option>
            <option value="false">{t('admin:unverifiedOnly', { defaultValue: 'Unverified' })}</option>
          </AdminSelectBare>
          <AdminSelectBare
            value={filters.accountStatus || ''}
            onChange={(e) => updateFilters({ accountStatus: e.target.value })}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          >
            <option value="">{t('admin:filterAll')}</option>
            <option value="active">{t('admin:statusActive')}</option>
            <option value="suspended">{t('admin:statusSuspended')}</option>
          </AdminSelectBare>
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
          selectable={canManage}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          bulkActions={bulkActions}
          onBulkAction={handleBulkAction}
          exportResource={can(PERMISSIONS.EXPORT_DATA) ? 'employers' : undefined}
          onExport={(r, f) => adminContentApi.exportData(r, f).catch(() => toast.error(t('admin:exportFailed')))}
        />

        {jobsModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
            <EscapeWhen active onEscape={() => setJobsModal(null)} />
            <div className="max-w-2xl mx-auto my-4 rounded-xl bg-white dark:bg-gray-900 p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start gap-2 mb-4">
                <h3 className="text-lg font-bold">{jobsModal.employer.companyName} — {t('admin:jobs', { defaultValue: 'Jobs' })}</h3>
                <button type="button" onClick={() => setJobsModal(null)} className="text-sm underline">{t('common:close', { defaultValue: 'Close' })}</button>
              </div>
              {jobsLoading ? (
                <p className="text-sm text-gray-500">{t('admin:loading')}</p>
              ) : jobsModal.jobs.length === 0 ? (
                <p className="text-sm text-gray-500">{t('admin:noJobsFound')}</p>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[60vh] overflow-y-auto">
                  {jobsModal.jobs.map((job) => (
                    <li key={job._id} className="py-2 text-sm flex justify-between gap-2">
                      <span>{job.title}</span>
                      <AdminStatusBadge value={job.status || job.approvalStatus || 'active'} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
}
