import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { useAdminList } from '../../hooks/useAdminList';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminStatusBadge, formatAdminDate } from '../../components/admin/adminTableUtils';
import { adminContentApi } from '../../services/adminContentApi';

export default function AdminPayments() {
  const { t } = useTranslation('admin');
  const { can } = usePermissions();
  const [summary, setSummary] = useState({ revenue: 0, pending: 0, failed: 0, refunded: 0, completed: 0 });

  const { data, pagination, filters, setFilters, sort, setSort, loading, error, setPage } = useAdminList('/admin/payments');

  useEffect(() => {
    adminContentApi.listPayments({ page: 1, limit: 1 }).then((res) => {
      if (res.data?.summary) setSummary(res.data.summary);
    }).catch(() => {});
  }, [data]);

  const columns = [
    {
      key: 'employerId',
      label: t('admin:colEmployer'),
      render: (row) => row.employerId?.companyName || row.employerId?.email || '—',
    },
    {
      key: 'jobId',
      label: t('admin:colJob'),
      render: (row) => row.jobId?.title || '—',
    },
    {
      key: 'amount',
      label: t('admin:colAmount'),
      render: (row) => {
        const currency = typeof row.currency === 'string' && row.currency.length === 3 ? row.currency.toUpperCase() : '';
        if (!currency) return `${row.amount ?? '—'} (currency unknown)`;
        return `${row.amount} ${currency}`;
      },
    },
    {
      key: 'status',
      label: t('status'),
      render: (row) => <AdminStatusBadge value={row.status} />,
    },
    { key: 'provider', label: t('admin:colGateway') },
    {
      key: 'createdAt',
      label: t('admin:colCreated'),
      render: (row) => formatAdminDate(row.createdAt),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.PAYMENTS_READ}>
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Legacy Payments</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Historical Payment records only. This is not the live Commerce ledger and does not prove collected revenue.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: `${t('revenue')} (legacy sum)`, value: summary.revenue ?? 0 },
            { label: t('pendingPayments'), value: summary.pending },
            { label: t('statusFailed'), value: summary.failed },
            { label: t('statusRefunded'), value: summary.refunded },
          ].map((card) => (
            <div key={card.label} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            </div>
          ))}
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
          filterFields={['status', 'provider', 'from', 'to']}
          exportResource={can(PERMISSIONS.EXPORT_DATA) ? 'payments' : undefined}
          onExport={(r, f) => adminContentApi.exportData(r, f)}
        />
      </div>
    </AdminRouteGuard>
  );
}
