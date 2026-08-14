import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminStatusBadge } from '../../components/admin/adminTableUtils';
import { AdminTextarea } from '../../components/admin/AdminFormFields';
import { PERMISSIONS } from '../../config/rbac';
import { usePermissions } from '../../hooks/usePermissions';
import { gbsAdminApi } from '../../services/gbsAdminApi';
import { ROUTES } from '../../constants';

export default function AdminGbsListingReview() {
  const { id } = useParams();
  const { t } = useTranslation('admin');
  const { can } = usePermissions();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await gbsAdminApi.getListing(id);
      setPayload(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || t('gbsLoadFailed'));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const listing = payload?.listing;
  const run = async (action) => {
    if (!listing) return;
    setBusy(true);
    setError('');
    try {
      await gbsAdminApi.reviewListing(id, action, {
        expectedVersion: listing.recordVersion,
        subjectType: listing.subjectType,
        subjectId: listing.subjectId,
        reason,
      });
      setConfirm(null);
      setReason('');
      await load();
    } catch (err) {
      setError(
        err.response?.status === 409
          ? t('gbsStaleConflict')
          : err.response?.data?.error || err.message || t('actionFailed')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminRouteGuard permission={PERMISSIONS.VERIFICATION_READ}>
      <div className="space-y-4 min-w-0">
        <Link to={`${ROUTES.ADMIN}/gbs/listings`} className="text-sm text-primary dark:text-mint underline">
          {t('gbsBackToListingQueue')}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white break-words">{t('gbsListingReview')}</h1>
        {loading ? <p className="text-sm text-gray-600 dark:text-gray-300" aria-busy="true">{t('loading')}</p> : null}
        {error ? <p className="rounded-lg border border-red-300 dark:border-red-700 p-3 text-red-800 dark:text-red-100" role="alert">{error}</p> : null}
        {listing ? (
          <>
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
              <h2 className="font-semibold break-words">{listing.title}</h2>
              <p className="text-sm break-words">{listing.shortDescription || listing.description}</p>
              <p className="break-words">
                {listing.subjectLabel} ({listing.subjectKind}) · {listing.subjectType} · {listing.subjectId}
              </p>
              <p className="break-words">{t('gbsColCapability')}: {listing.capabilityId}</p>
              <p className="break-words">{t('gbsColScope')}: {listing.jurisdictionId} · {(listing.entityTypeIds || []).join(', ')}</p>
              <p>{t('gbsPricing')}: {listing.pricingMode}</p>
              <div className="flex flex-wrap gap-2 items-center">
                <AdminStatusBadge value={listing.moderationStatus} label={`${t('gbsColSubmission')}: ${listing.moderationStatus?.replace(/_/g, ' ')}`} />
                <AdminStatusBadge value={listing.adminReviewStatus} label={`${t('gbsColAdminReview')}: ${listing.adminReviewStatus?.replace(/_/g, ' ')}`} />
                <AdminStatusBadge value={listing.publicationStatus} label={`${t('gbsColPublication')}: ${listing.publicationStatus}`} />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {listing.adminReviewStatus === 'approved' && listing.publicationStatus !== 'public'
                  ? t('gbsApprovedNotPublic')
                  : t('gbsPublicationPrivate')}
              </p>
              {listing.capability ? (
                <p className="text-sm">
                  {t('gbsLinkedCapability')}: {listing.capability.trustStatus} / {listing.capability.status}
                </p>
              ) : (
                <p className="text-sm text-red-700 dark:text-red-300">{t('gbsCapabilityMissing')}</p>
              )}
              <p className="text-sm">{t('gbsRecordVersion')}: {listing.recordVersion}</p>
            </section>
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <h2 className="font-semibold">{t('gbsStaffActions')}</h2>
              <AdminTextarea id="gbs-list-reason" label={t('gbsReviewReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {can(PERMISSIONS.VERIFICATION_REVIEW) ? (
                  <button type="button" disabled={busy} onClick={() => run('needs-information')} className="min-h-[44px] px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary">
                    {t('gbsNeedsInformation')}
                  </button>
                ) : null}
                {can(PERMISSIONS.VERIFICATION_APPROVE) ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => run('approve')} className="min-h-[44px] px-3 rounded-lg bg-primary text-white focus:outline-none focus:ring-2 focus:ring-primary">
                      {t('gbsApproveListing')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => setConfirm('reject')} className="min-h-[44px] px-3 rounded-lg border border-red-600 text-red-700 dark:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-600">
                      {t('gbsReject')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => setConfirm('suspend')} className="min-h-[44px] px-3 rounded-lg border border-red-600 text-red-700 dark:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-600">
                      {t('gbsSuspend')}
                    </button>
                  </>
                ) : null}
              </div>
            </section>
            <AdminConfirmDialog
              open={Boolean(confirm)}
              title={t('gbsConfirmReviewTitle')}
              message={t('gbsConfirmReviewBody', { action: confirm || '' })}
              danger
              loading={busy}
              onCancel={() => setConfirm(null)}
              onConfirm={() => run(confirm)}
            />
          </>
        ) : null}
      </div>
    </AdminRouteGuard>
  );
}
