import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminSelect } from '../../components/admin/AdminFormFields';
import { AdminStatusBadge, formatAdminDate } from '../../components/admin/adminTableUtils';
import { AdminGbsPagination, AdminGbsQueueTable } from '../../components/admin/AdminGbsQueueTable';
import { useAdminList } from '../../hooks/useAdminList';
import { PERMISSIONS } from '../../config/rbac';
import { ROUTES } from '../../constants';

export default function AdminGbsListingQueue() {
  const { t } = useTranslation('admin');
  const { data, pagination, filters, setFilters, loading, error, setPage } = useAdminList(
    '/admin/gbs/listings/queue',
    { limit: 20 }
  );

  const columns = [
    {
      key: 'title',
      label: t('gbsColTitle'),
      render: (row) => <span className="font-medium break-words">{row.title}</span>,
    },
    {
      key: 'subject',
      label: t('gbsColSubject'),
      render: (row) => (
        <div className="min-w-0">
          <p className="break-words">{row.subjectLabel || row.subjectId}</p>
          <p className="text-xs text-gray-600 dark:text-gray-300">{row.subjectKind}</p>
        </div>
      ),
    },
    {
      key: 'capabilityId',
      label: t('gbsColCapability'),
      render: (row) => <span className="break-words">{row.capabilityId}</span>,
    },
    {
      key: 'moderationStatus',
      label: t('gbsColSubmission'),
      render: (row) => (
        <AdminStatusBadge value={row.moderationStatus} label={row.moderationStatus?.replace(/_/g, ' ')} />
      ),
    },
    {
      key: 'adminReviewStatus',
      label: t('gbsColAdminReview'),
      render: (row) => (
        <AdminStatusBadge value={row.adminReviewStatus} label={row.adminReviewStatus?.replace(/_/g, ' ')} />
      ),
    },
    {
      key: 'publicationStatus',
      label: t('gbsColPublication'),
      render: (row) => (
        <span>
          <AdminStatusBadge value={row.publicationStatus} label={row.publicationStatus} />
          {row.adminReviewStatus === 'approved' && row.publicationStatus !== 'public' ? (
            <span className="ml-2 text-xs text-gray-700 dark:text-gray-300">{t('gbsApprovedNotPublic')}</span>
          ) : null}
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
          to={`${ROUTES.ADMIN}/gbs/listings/${row.id}`}
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
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('gbsListingReviews')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t('gbsListingQueueIntro')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <AdminSelect
            id="gbs-list-moderation"
            label={t('gbsFilterSubmission')}
            value={filters.moderationStatus || ''}
            onChange={(e) => setFilters({ ...filters, moderationStatus: e.target.value || undefined })}
          >
            <option value="">{t('gbsFilterActionable')}</option>
            <option value="all">{t('gbsFilterAll')}</option>
            <option value="under_review">{t('gbsUnderReview')}</option>
            <option value="needs_information">{t('gbsNeedsInformation')}</option>
            <option value="approved">{t('gbsApproved')}</option>
            <option value="rejected">{t('gbsRejected')}</option>
            <option value="suspended">{t('gbsSuspended')}</option>
            <option value="draft">{t('gbsDraft')}</option>
          </AdminSelect>
          <AdminSelect
            id="gbs-list-admin"
            label={t('gbsFilterAdminReview')}
            value={filters.adminReviewStatus || ''}
            onChange={(e) => setFilters({ ...filters, adminReviewStatus: e.target.value || undefined })}
          >
            <option value="">{t('gbsFilterAnyAdminReview')}</option>
            <option value="pending">{t('gbsPending')}</option>
            <option value="approved">{t('gbsApproved')}</option>
            <option value="needs_information">{t('gbsNeedsInformation')}</option>
            <option value="rejected">{t('gbsRejected')}</option>
            <option value="suspended">{t('gbsSuspended')}</option>
          </AdminSelect>
          <AdminSelect
            id="gbs-list-subject"
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
          caption={t('gbsListingReviews')}
          columns={columns}
          rows={data}
          loading={loading}
          error={error}
          emptyLabel={t('gbsListingEmpty')}
        />
        <AdminGbsPagination pagination={pagination} onPageChange={setPage} label={t('gbsListingReviews')} />
      </div>
    </AdminRouteGuard>
  );
}
