import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { adminApi } from '../../services/listingsService';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/rbac';
import { AdminRouteGuard } from '../../components/admin/AdminRouteGuard';
import { VerificationBadge } from '../../components/common/VerificationBadge';

function PostingAccess({ access }) {
  if (!access) return null;
  if (access.type === 'paid') {
    return (
      <div className="mt-1 text-[11px] leading-tight text-emerald-700 dark:text-emerald-300">
        <div className="font-semibold">{access.label || 'Paid Job Posting'}</div>
        <div>Entitlement: {access.entitlement || 'configured'}</div>
      </div>
    );
  }
  const free = access.freeBeta;
  if (!free) return null;
  return (
    <div className="mt-1 text-[11px] leading-tight text-amber-700 dark:text-amber-300">
      <div className="font-semibold">{access.label || 'Free Beta'}</div>
      <div>Active now: {free.active}/{free.limit} · Pending: {free.pending}</div>
      {free.canApprove ? (
        <div>If approved: {free.activeAfterApproval}/{free.limit} active · {free.remainingAfterApproval} remaining</div>
      ) : (
        <div>Approval impact: blocked · no Free Beta capacity</div>
      )}
    </div>
  );
}

export default function ModerationQueue() {
  const { t } = useTranslation(['admin', 'common']);
  const { can, role } = usePermissions();
  const [queues, setQueues] = useState(null);
  const [selectedJobs, setSelectedJobs] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const abortRef = useRef(null);

  const hasAccess = can(PERMISSIONS.MODERATE_JOBS) || can(PERMISSIONS.MODERATE_EMPLOYERS);

  const load = () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    adminApi.moderationQueues({ signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setQueues(data);
      })
      .catch((e) => {
        if (controller.signal.aborted || e.code === 'ERR_CANCELED') return;
        setError(e.response?.data?.error || t('common:failedToLoad'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  };

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false);
      return undefined;
    }
    load();
    return () => abortRef.current?.abort();
  }, [hasAccess, role, t]);

  const toggleJob = (id) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkApprove = async () => {
    if (!selectedJobs.size) return;
    setActionLoading(true);
    try {
      await adminApi.bulkApproveJobs([...selectedJobs]);
      setSelectedJobs(new Set());
      load();
    } catch (e) {
      window.alert(e.response?.data?.error || t('admin:actionFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const bulkReject = async () => {
    if (!selectedJobs.size) return;
    setActionLoading(true);
    try {
      await adminApi.bulkRejectJobs([...selectedJobs]);
      setSelectedJobs(new Set());
      load();
    } catch (e) {
      window.alert(e.response?.data?.error || t('admin:actionFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const verifyEmployer = async (id, level) => {
    setActionLoading(true);
    try {
      await adminApi.verifyEmployer(id, level);
      load();
    } catch (e) {
      window.alert(e.response?.data?.error || t('admin:actionFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <AdminRouteGuard anyPermission={[PERMISSIONS.MODERATE_JOBS, PERMISSIONS.MODERATE_EMPLOYERS, PERMISSIONS.MODERATE_REPORTS, PERMISSIONS.MODERATE_ADS]}>
        <div />
      </AdminRouteGuard>
    );
  }

  if (loading) return <div className="animate-pulse h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />;
  if (error) return <p className="text-red-600">{error}</p>;

  const counts = queues?.counts || {};

  return (
    <AdminRouteGuard anyPermission={[PERMISSIONS.MODERATE_JOBS, PERMISSIONS.MODERATE_EMPLOYERS, PERMISSIONS.MODERATE_REPORTS, PERMISSIONS.MODERATE_ADS]}>
    <>
      <SeoHead title={t('admin:moderation')} noindex />
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('admin:moderation')}</h1>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: t('admin:pendingJobs'), value: counts.pendingJobs },
            { label: t('admin:pendingEmployers'), value: counts.pendingEmployers },
            { label: t('admin:reportedContent'), value: counts.reportedContent },
            { label: t('admin:advertisements'), value: counts.advertisements },
            { label: t('admin:verificationRequests'), value: counts.verificationRequests },
          ].map((c) => (
            <div key={c.label} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
              <p className="text-lg font-bold">{c.value ?? 0}</p>
              <p className="text-xs text-gray-500">{c.label}</p>
            </div>
          ))}
        </div>

        {can(PERMISSIONS.MODERATE_JOBS) && (
          <section className="mb-8 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('admin:pendingJobs')}</h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!selectedJobs.size || actionLoading} onClick={bulkApprove} className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-50">
                  {t('admin:bulkApprove')}
                </button>
                <button type="button" disabled={!selectedJobs.size || actionLoading} onClick={bulkReject} className="text-sm px-3 py-1.5 rounded-lg bg-red-600 text-white disabled:opacity-50">
                  {t('admin:bulkReject')}
                </button>
              </div>
            </div>
            {queues?.pendingJobs?.length ? (
              <ul className="space-y-2">
                {queues.pendingJobs.map((job) => (
                  <li key={job._id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                    <input type="checkbox" checked={selectedJobs.has(job._id)} onChange={() => toggleJob(job._id)} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{job.title}</p>
                      <p className="text-xs text-gray-500">{job.company || job.organization}</p>
                      {job.submittedAt ? <p className="text-[11px] text-gray-400">Submitted {new Date(job.submittedAt).toLocaleString()}</p> : null}
                      <PostingAccess access={job.publishingAccess} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">{t('admin:noPendingJobs')}</p>
            )}
          </section>
        )}

        {can(PERMISSIONS.MODERATE_EMPLOYERS) && (
          <section className="mb-8 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">{t('admin:pendingEmployers')}</h2>
            {queues?.pendingEmployers?.length ? (
              <ul className="space-y-2">
                {queues.pendingEmployers.map((emp) => (
                  <li key={emp._id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="font-medium">{emp.companyName}</p>
                      <VerificationBadge level={emp.verificationLevel} verified={emp.verified} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={actionLoading} onClick={() => verifyEmployer(emp._id, 'verified')} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white">
                        {t('admin:verify')}
                      </button>
                      <button type="button" disabled={actionLoading} onClick={() => verifyEmployer(emp._id, 'trusted')} className="text-xs px-2 py-1 rounded bg-blue-600 text-white">
                        {t('admin:trust')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">{t('admin:noPendingEmployers')}</p>
            )}
          </section>
        )}

        {can(PERMISSIONS.MODERATE_REPORTS) && queues?.reportedContent?.length > 0 && (
          <section className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 mb-8">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">{t('admin:reportedContent')}</h2>
            <ul className="space-y-2 text-sm">
              {queues.reportedContent.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="font-medium">{r.contentType} · {r.reason}</p>
                    <p className="text-gray-500">{r.details}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={actionLoading} onClick={async () => { setActionLoading(true); try { await adminApi.reviewReport(r._id, 'reviewed'); load(); } catch (e) { window.alert(e.response?.data?.error || t('admin:actionFailed')); } finally { setActionLoading(false); } }} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white">{t('admin:resolve')}</button>
                    <button type="button" disabled={actionLoading} onClick={async () => { setActionLoading(true); try { await adminApi.reviewReport(r._id, 'spam'); load(); } catch (e) { window.alert(e.response?.data?.error || t('admin:actionFailed')); } finally { setActionLoading(false); } }} className="text-xs px-2 py-1 rounded bg-amber-600 text-white">{t('admin:markSpam')}</button>
                    {r.contentType === 'job' && can(PERMISSIONS.MODERATE_SUSPEND) && (
                      <button type="button" disabled={actionLoading} onClick={async () => { setActionLoading(true); try { await adminApi.suspendListing('job', r.contentId); load(); } catch (e) { window.alert(e.response?.data?.error || t('admin:actionFailed')); } finally { setActionLoading(false); } }} className="text-xs px-2 py-1 rounded bg-red-600 text-white">{t('admin:suspend')}</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {can(PERMISSIONS.MODERATE_ADS) && queues?.advertisements?.length > 0 && (
          <section className="p-5 rounded-xl border border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">{t('admin:advertisements')}</h2>
            <ul className="space-y-2 text-sm">
              {queues.advertisements.map((ad) => (
                <li key={ad._id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="font-medium">{ad.name || ad.slotId}</p>
                    <p className="text-gray-500">{ad.placement} · {ad.status || (ad.active ? 'active' : 'inactive')}</p>
                  </div>
                  {!ad.active && (
                    <button type="button" disabled={actionLoading} onClick={async () => { setActionLoading(true); try { await adminApi.updateAdSlot(ad._id, { active: true, status: 'active' }); load(); } catch (e) { window.alert(e.response?.data?.error || t('admin:actionFailed')); } finally { setActionLoading(false); } }} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white">{t('admin:approve')}</button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
    </AdminRouteGuard>
  );
}
