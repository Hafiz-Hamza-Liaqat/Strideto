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

function evidenceDecisionLabel(t, decision) {
  if (decision === 'accepted') return t('gbsEvidenceAccepted');
  if (decision === 'rejected') return t('gbsEvidenceRejected');
  if (decision === 'needs_information') return t('gbsEvidenceNeedsInformationStatus');
  if (decision === 'expired') return t('gbsEvidenceExpired');
  return t('gbsEvidencePendingReview');
}

function isReviewableEvidence(row) {
  return row?.decision === 'pending' || row?.decision === 'needs_information' || !row?.decision;
}

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
  const hasAcceptedEvidence = Boolean(cap?.evidence?.some((row) => row.decision === 'accepted'));
  const canMarkEvidenceBacked =
    hasAcceptedEvidence && cap?.trustStatus !== 'verified' && cap?.trustStatus !== 'revoked';
  const canVerify =
    hasAcceptedEvidence && (cap?.trustStatus === 'evidence_backed' || cap?.trustStatus === 'verified');

  const fail = (err) => {
    const code = err.response?.data?.error;
    setError(
      err.response?.status === 409
        ? t('gbsStaleConflict')
        : code || err.message || t('actionFailed')
    );
  };

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
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const runEvidence = async (evidenceIndex, action) => {
    if (!cap) return;
    setBusy(true);
    setError('');
    try {
      await gbsAdminApi.reviewCapabilityEvidence(id, evidenceIndex, action, {
        expectedVersion: cap.recordVersion,
        subjectType: cap.subjectType,
        subjectId: cap.subjectId,
        reason,
      });
      setConfirm(null);
      setReason('');
      await load();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const confirmEvidence = (evidenceIndex, action) => {
    if ((action === 'reject' || action === 'needs-information') && !reason.trim()) {
      setError(t('gbsEvidenceReviewReasonRequired'));
      return;
    }
    setConfirm({ kind: 'evidence', evidenceIndex, action });
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
              <p className="break-words text-sm">Countries: {(cap.scope?.countryCodes || []).join(', ') || '—'}</p>
              <p className="break-words text-sm">Entity types: {(cap.scope?.entityTypeIds || []).join(', ') || '—'}</p>
              <p className="break-words text-sm">Protected titles: {(cap.scope?.protectedTitleIds || []).join(', ') || '—'}</p>
              {(cap.jurisdictionReadiness || []).map((row) => (
                <p key={row.jurisdictionId} className="break-words text-sm">
                  {row.name || row.jurisdictionId}: {row.productionReady ? 'current reviewed / production ready' : `${row.state} / evidence review only; not live`}
                </p>
              ))}
              <p className="text-sm">{t('gbsRecordVersion')}: {cap.recordVersion}</p>
              <p className="text-sm">{t('gbsColUpdated')}: {formatAdminDate(cap.updatedAt)}</p>
            </section>
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">{t('gbsEvidenceMetadata')}</h2>
              {cap.evidenceRequired ? (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{t('gbsEvidenceRequiredHint')}</p>
              ) : null}
              {cap.evidence?.length ? (
                <ul className="space-y-3">
                  {cap.evidence.map((row) => (
                    <li
                      key={row.evidenceIndex}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2 min-w-0"
                    >
                      <p className="break-words text-sm font-medium text-gray-900 dark:text-white">
                        {row.evidenceType || 'evidence'}
                        {cap.evidenceRequired ? ` · ${t('gbsEvidenceRequired')}` : ''}
                      </p>
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span>{t('gbsEvidenceDecision')}</span>
                        <AdminStatusBadge
                          value={row.decision || 'pending'}
                          label={evidenceDecisionLabel(t, row.decision || 'pending')}
                        />
                      </p>
                      {row.jurisdictionId ? (
                        <p className="break-words text-sm text-gray-600 dark:text-gray-300">
                          {t('gbsEvidenceJurisdiction')}: {row.jurisdictionId}
                        </p>
                      ) : null}
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300">
                        {row.referenceNumber ? <div><dt className="font-medium">Reference number</dt><dd className="break-words">{row.referenceNumber}</dd></div> : null}
                        {row.issuingAuthorityId ? <div><dt className="font-medium">Issuing authority</dt><dd className="break-words">{row.issuingAuthorityId}</dd></div> : null}
                        {row.titleId ? <div><dt className="font-medium">Protected title</dt><dd className="break-words">{row.titleId}</dd></div> : null}
                        {row.effectiveFrom ? <div><dt className="font-medium">Effective from</dt><dd>{formatAdminDate(row.effectiveFrom)}</dd></div> : null}
                        {row.effectiveTo ? <div><dt className="font-medium">Effective to</dt><dd>{formatAdminDate(row.effectiveTo)}</dd></div> : null}
                      </dl>
                      {row.officialRegistryUrl ? (
                        <a href={row.officialRegistryUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-primary dark:text-mint underline break-all">
                          Open official evidence source
                        </a>
                      ) : null}
                      {row.notes ? <p className="text-sm text-gray-600 dark:text-gray-300 break-words"><span className="font-medium">Provider notes:</span> {row.notes}</p> : null}
                      {row.submittedAt || row.effectiveFrom ? (
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {t('gbsEvidenceSubmittedAt')}: {formatAdminDate(row.submittedAt || row.effectiveFrom)}
                        </p>
                      ) : null}
                      {row.hasVaultRef ? (
                        <p className="text-sm text-gray-600 dark:text-gray-300">{t('gbsVaultRefPresent')}</p>
                      ) : null}
                      {can(PERMISSIONS.VERIFICATION_REVIEW) && isReviewableEvidence(row) ? (
                        <div className="flex flex-wrap gap-2" role="group" aria-label={t('gbsEvidenceReviewControls')}>
                          <button
                            type="button"
                            disabled={busy}
                            aria-describedby="gbs-cap-reason"
                            onClick={() => runEvidence(row.evidenceIndex, 'accept')}
                            className="min-h-[44px] px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {t('gbsAcceptEvidence')}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            aria-describedby="gbs-cap-reason"
                            onClick={() => confirmEvidence(row.evidenceIndex, 'needs-information')}
                            className="min-h-[44px] px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {t('gbsEvidenceNeedsInformation')}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            aria-describedby="gbs-cap-reason"
                            onClick={() => confirmEvidence(row.evidenceIndex, 'reject')}
                            className="min-h-[44px] px-3 rounded-lg border border-red-600 text-red-700 dark:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-600"
                          >
                            {t('gbsRejectEvidence')}
                          </button>
                        </div>
                      ) : null}
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
              {!hasAcceptedEvidence ? (
                <p className="text-sm text-gray-600 dark:text-gray-300" role="status">{t('gbsVerifyBlocked')}</p>
              ) : !canVerify ? (
                <p className="text-sm text-gray-600 dark:text-gray-300" role="status">{t('gbsMarkEvidenceBackedFirst')}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {can(PERMISSIONS.VERIFICATION_REVIEW) ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || !canMarkEvidenceBacked}
                      title={!canMarkEvidenceBacked ? t('gbsMarkEvidenceBackedBlocked') : undefined}
                      onClick={() => run('mark-evidence-backed')}
                      className="min-h-[44px] px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('gbsMarkEvidenceBacked')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => run('needs-information')} className="min-h-[44px] px-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary">
                      {t('gbsNeedsInformation')}
                    </button>
                  </>
                ) : null}
                {can(PERMISSIONS.VERIFICATION_APPROVE) ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || !canVerify}
                      title={!canVerify ? t('gbsVerifyBlocked') : undefined}
                      onClick={() => run('verify')}
                      className="min-h-[44px] px-3 rounded-lg bg-primary text-white focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('gbsVerify')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => setConfirm({ kind: 'capability', action: 'reject' })} className="min-h-[44px] px-3 rounded-lg border border-red-600 text-red-700 dark:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-600">
                      {t('gbsReject')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => setConfirm({ kind: 'capability', action: 'suspend' })} className="min-h-[44px] px-3 rounded-lg border border-red-600 text-red-700 dark:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-600">
                      {t('gbsSuspend')}
                    </button>
                  </>
                ) : null}
                {can(PERMISSIONS.VERIFICATION_REVOKE) ? (
                  <button type="button" disabled={busy} onClick={() => setConfirm({ kind: 'capability', action: 'revoke' })} className="min-h-[44px] px-3 rounded-lg bg-red-600 text-white focus:outline-none focus:ring-2 focus:ring-red-600">
                    {t('gbsRevoke')}
                  </button>
                ) : null}
              </div>
            </section>
            <AdminConfirmDialog
              open={Boolean(confirm)}
              title={confirm?.kind === 'evidence' ? t('gbsConfirmEvidenceReviewTitle') : t('gbsConfirmReviewTitle')}
              message={
                confirm?.kind === 'evidence'
                  ? t('gbsConfirmEvidenceReviewBody', { action: confirm?.action || '' })
                  : t('gbsConfirmReviewBody', { action: confirm?.action || '' })
              }
              danger
              loading={busy}
              onCancel={() => setConfirm(null)}
              onConfirm={() => {
                if (confirm?.kind === 'evidence') runEvidence(confirm.evidenceIndex, confirm.action);
                else if (confirm?.action) run(confirm.action);
              }}
            />
          </>
        ) : null}
      </div>
    </AdminRouteGuard>
  );
}
