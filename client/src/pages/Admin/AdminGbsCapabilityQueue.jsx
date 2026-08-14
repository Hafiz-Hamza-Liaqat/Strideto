import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminSelect } from '../../components/admin/AdminFormFields';
import { AdminStatusBadge, formatAdminDate } from '../../components/admin/adminTableUtils';
import { AdminGbsPagination, AdminGbsQueueTable } from '../../components/admin/AdminGbsQueueTable';
import { useAdminList } from '../../hooks/useAdminList';
import { PERMISSIONS } from '../../config/rbac';
import { ROUTES } from '../../constants';

const TRUST_OPTIONS = [
  { value: '', labelKey: 'gbsFilterActionable' },
  { value: 'all', labelKey: 'gbsFilterAll' },
  { value: 'claimed', labelKey: 'gbsTrustClaimed' },
  { value: 'evidence_submitted', labelKey: 'gbsTrustEvidenceSubmitted' },
  { value: 'evidence_backed', labelKey: 'gbsTrustEvidenceBacked' },
  { value: 'verified', labelKey: 'gbsTrustVerified' },
  { value: 'suspended', labelKey: 'gbsTrustSuspended' },
  { value: 'revoked', labelKey: 'gbsTrustRevoked' },
];

export default function AdminGbsCapabilityQueue() {
  const { t } = useTranslation('admin');
  const { data, pagination, filters, setFilters, loading, error, setPage } = useAdminList(
    '/admin/gbs/capabilities/queue',
    { limit: 20 }
  );

  const columns = [
    {
      key: 'subject',
      label: t('gbsColSubject'),
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium break-words">{row.subjectLabel || row.subjectId}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {row.subjectKind} · {row.subjectType} · {row.subjectId}
          </p>
        </div>
      ),
    },
    {
      key: 'capability',
      label: t('gbsColCapability'),
      render: (row) => <span className="break-words">{row.publicName || row.capabilityId}</span>,
    },
    {
      key: 'trustStatus',
      label: t('gbsColTrust'),
      render: (row) => (
        <AdminStatusBadge
          value={row.trustStatus}
          label={t(`gbsTrust_${row.trustStatus}`, { defaultValue: row.trustStatus?.replace(/_/g, ' ') })}
        />
      ),
    },
    {
      key: 'scope',
      label: t('gbsColScope'),
      render: (row) => (
        <span className="break-words">
          {(row.scope?.jurisdictionIds || []).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      label: t('gbsColUpdated'),
      render: (row) => formatAdminDate(row.updatedAt),
    },
    {
      key: 'actions',
      label: t('actions'),
      render: (row) => (
        <Link
          to={`${ROUTES.ADMIN}/gbs/capabilities/${row.id}`}
          className="inline-flex min-h-[44px] items-center text-primary dark:text-mint underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
        >
          {t('gbsReviewAction')}
        </Link>
      ),
    },
  ];

  return (
    <AdminRouteGuard permission={PERMISSIONS.VERIFICATION_READ}>
      <div className="space-y-4 min-w-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('gbsCapabilityReviews')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t('gbsCapabilityQueueIntro')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <AdminSelect
            id="gbs-cap-trust"
            label={t('gbsFilterTrust')}
            value={filters.trustStatus || ''}
            onChange={(e) => setFilters({ ...filters, trustStatus: e.target.value || undefined })}
          >
            {TRUST_OPTIONS.map((opt) => (
              <option key={opt.value || 'actionable'} value={opt.value}>{t(opt.labelKey)}</option>
            ))}
          </AdminSelect>
          <AdminSelect
            id="gbs-cap-subject"
            label={t('gbsFilterSubjectType')}
            value={filters.subjectType || ''}
            onChange={(e) => setFilters({ ...filters, subjectType: e.target.value || undefined })}
          >
            <option value="">{t('gbsFilterAllSubjects')}</option>
            <option value="agent">{t('gbsIndependent')}</option>
            <option value="organization">{t('gbsAgency')}</option>
          </AdminSelect>
        </div>
        <AdminGbsQueueTable
          caption={t('gbsCapabilityReviews')}
          columns={columns}
          rows={data}
          loading={loading}
          error={error}
          emptyLabel={t('gbsCapabilityEmpty')}
        />
        <AdminGbsPagination pagination={pagination} onPageChange={setPage} label={t('gbsCapabilityReviews')} />
      </div>
    </AdminRouteGuard>
  );
}
