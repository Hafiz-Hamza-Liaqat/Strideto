import { useState } from 'react';
import { AdminSelectBare } from '../../components/admin/AdminFormFields';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { adminContentApi } from '../../services/adminContentApi';
import { EscapeWhen } from '../../a11y/EscapeWhen';

const STATUSES = ['new', 'in_progress', 'resolved', 'closed'];

export default function AdminContactMessages() {
  const { t } = useTranslation(['admin', 'common']);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.USERS_MANAGE);

  const { data, pagination, filters, setFilters, loading, error, setPage, refetch } = useAdminList('/admin/contact-messages');
  const [detail, setDetail] = useState(null);

  const openDetail = async (id) => {
    try {
      const res = await adminContentApi.contactMessages.get(id);
      setDetail(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:loadFailed'));
    }
  };

  const updateStatus = async (status) => {
    try {
      await adminContentApi.contactMessages.update(detail._id, { status });
      toast.success(t('admin:saved'));
      setDetail({ ...detail, status });
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || t('admin:saveFailed'));
    }
  };

  const exportCsv = async () => {
    try {
      const res = await adminContentApi.contactMessages.exportCsv();
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contact-messages.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('admin:exportFailed'));
    }
  };

  const columns = [
    { key: 'name', label: t('admin:colName'), sortable: true },
    { key: 'email', label: t('admin:colEmail') },
    { key: 'subject', label: t('admin:colSubject') },
    { key: 'status', label: t('status'), type: 'status' },
    { key: 'createdAt', label: t('admin:colCreated'), type: 'date' },
    {
      key: 'actions', label: t('admin:actions'), render: (row) => (
        <button type="button" className="text-primary text-sm" onClick={() => openDetail(row._id)}>{t('admin:view')}</button>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.USERS_READ}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 justify-between items-center">
          <h2 className="text-xl font-semibold">{t('admin:contactMessages')}</h2>
          <button type="button" onClick={exportCsv} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600">{t('admin:exportCsv')}</button>
        </div>
        <AdminSelectBare value={filters.status || ''} onChange={(e) => setFilters({ status: e.target.value || undefined })} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
          <option value="">{t('admin:allStatuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </AdminSelectBare>
        <AdminDataTable columns={columns} data={data} loading={loading} error={error} pagination={pagination} onPageChange={setPage} />
        {detail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetail(null)}>
            <EscapeWhen active onEscape={() => setDetail(null)} />
            <div className="max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold text-lg mb-2 break-words">{detail.subject}</h3>
              <p className="text-sm text-gray-500 mb-4">{detail.name} &lt;{detail.email}&gt;</p>
              <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 mb-4">{detail.message}</p>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button key={s} type="button" onClick={() => updateStatus(s)} className={`px-3 py-1 rounded-lg text-sm ${detail.status === s ? 'bg-primary text-white' : 'border border-gray-300'}`}>{s}</button>
                  ))}
                </div>
              )}
              <button type="button" className="mt-4 text-sm text-gray-500" onClick={() => setDetail(null)}>{t('common:close')}</button>
            </div>
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
}
