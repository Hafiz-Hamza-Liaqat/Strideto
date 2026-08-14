import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { AdminConfirmDialog } from '../../components/admin/AdminConfirmDialog';
import { AdminStatusBadge, formatAdminDate } from '../../components/admin/adminTableUtils';
import { AdminTextarea } from '../../components/admin/AdminFormFields';
import { PERMISSIONS } from '../../config/rbac';
import { usePermissions } from '../../hooks/usePermissions';
import { gbsAdminApi } from '../../services/gbsAdminApi';
import { ROUTES } from '../../constants';

export default function AdminGbsCapabilityReview() {
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
      const { data } = await gbsAdminApi.getCapability(id);
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

  const cap = payload?.capability;
  const run = async (action) => {
    if (!cap) return;
    setBusy(true);
    setError('');
    try {
      await gbsAdminApi.reviewCapability(id, action, {
        expectedVersion: cap.recordVersion,
        subjectType: cap.subjectType,
        subjectId: cap.subjectId,
        reason,
      });
      setConfirm(null);
      setReason('');
      await load();
    } catch (err) {
      const code = err.response?.data?.error;
      setError(
        err.response?.status === 409
          ? t('gbsStaleConflict')
          : code || err.message || t('actionFailed')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminRouteGuard permission={PERMISSIONS.VERIFICATION_READ}>
      <div className="space-y-4 min-w-0">
        <Link to={`${ROUTES.ADMIN}/gbs/capabilities`} className="text-sm text-primary dark:text-mint underline">
          {t('gbsBackToCapabilityQueue')}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white break-words">{t('gbsCapabilityReview')}</h1>
        {loading ? <p className="text-sm text-gray-600 dark:text-gray-300" aria-busy="true">{t('loading')}</p> : null}
        {error ? <p className="rounded-lg border border-red-300 dark:border-red-700 p-3 text-red-800 dark:text-red-100" role="alert">{error}</p> : null}
        {cap ? (
          <>
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('gbsSubjectIdentity')}</h2>
              <p className="break-words">{cap.subjectLabel} ({cap.subjectKind})</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 break-words">
                {t('gbsSubjectType')}: {cap.subjectType} · {t('gbsSubjectId')}: {cap.subjectId}
              </p>
              <p className="break-words">{t('gbsColCapability')}: {cap.publicName} ({cap.capabilityId})</p>
              <p>
                <AdminStatusBadge value={cap.trustStatus} label={cap.trustStatus?.replace(/_/g, ' ')} />
                <span className="ml-2 text-sm">{t('gbsGrantStatus')}: {cap.status}</span>
              </p>
              <p className="break-words text-sm">{t('gbsColScope')}: {(cap.scope?.jurisdictionIds || []).join(', ') || '—'}</p>
              <p className="text-sm">{t('gbsRecordVersion')}: {cap.recordVersion}</p>
              <p className="text-sm">{t('gbsColUpdated')}: {formatAdminDate(cap.updatedAt)}</p>
            </section>
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">{t('gbsEvidenceMetadata')}</h2>
              {cap.evidence?.length ? (
                <ul className="space-y-2 text-sm">
                  {cap.evidence.map((row, i) => (
                    <li key={i} className="break-words">
                      {row.evidenceType || 'evidence'} · {row.decision || 'pending'}
                      {row.jurisdictionId ? ` · ${row.jurisdictionId}` : ''}
                      {row.hasVaultRef ? ` · ${t('gbsVaultRefPresent')}` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('gbsNoEvidence')}</p>
              )}
            </section>
            {(payload.history || []).length ? (
              <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h2 className="font-semibold mb-2">{t('gbsReviewHistory')}</h2>
                <ul className="space-y-1 text-sm">
                  {payload.history.map((row, i) => (
                    <li key={i} className="break-words">{row.action} · {formatAdminDate(row.createdAt)}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <h2 className="font-semibold">{t('gbsStaffActions')}</h2>
              <AdminTextarea id="gbs-cap-reason" label={t('gbsReviewReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {can(PERMISSIONS.VERIFICATION_REVIEW) ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => run('mark-evidence-backed')} className="min-h-[44px] px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary">
                      {t('gbsMarkEvidenceBacked')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => run('needs-information')} className="min-h-[44px] px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary">
                      {t('gbsNeedsInformation')}
                    </button>
                  </>
                ) : null}
                {can(PERMISSIONS.VERIFICATION_APPROVE) ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => run('verify')} className="min-h-[44px] px-3 rounded-lg bg-primary text-white focus:outline-none focus:ring-2 focus:ring-primary">
                      {t('gbsVerify')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => setConfirm('reject')} className="min-h-[44px] px-3 rounded-lg border border-red-600 text-red-700 dark:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-600">
                      {t('gbsReject')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => setConfirm('suspend')} className="min-h-[44px] px-3 rounded-lg border border-red-600 text-red-700 dark:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-600">
                      {t('gbsSuspend')}
                    </button>
                  </>
                ) : null}
                {can(PERMISSIONS.VERIFICATION_REVOKE) ? (
                  <button type="button" disabled={busy} onClick={() => setConfirm('revoke')} className="min-h-[44px] px-3 rounded-lg bg-red-600 text-white focus:outline-none focus:ring-2 focus:ring-red-600">
                    {t('gbsRevoke')}
                  </button>
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
