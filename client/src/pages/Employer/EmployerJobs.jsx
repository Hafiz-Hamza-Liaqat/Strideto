import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { employerApi } from '../../services/employerService';
import { ROUTES } from '../../constants';
import { EmptyState } from '../../components/common/EmptyState';
import { formatOpeningsCount } from '@shared/employer/openingsCount.js';

const STATUS_FILTERS = ['', 'draft', 'active', 'closed'];
const REVIEW_FILTERS = ['pending'];

/** A draft that is not on the complimentary first-job plan needs a paid plan. */
function isPaidDraft(j) {
  return j?.status === 'draft' && j?.planType !== 'free';
}

function isExternalJob(j) {
  return j?.applyType === 'external' || j?.applicationsTracked === false;
}

/** Presentation-only 3-way split for copy — does not affect tracking/filter logic. */
function applyMethodKind(j) {
  if (!isExternalJob(j)) return 'internal';
  if (j?.applicationLink) return 'external_url';
  if (j?.applyEmail) return 'external_email';
  return 'external_url';
}

function formatApplicationCount(j, t) {
  if (isExternalJob(j)) return t('employer:applicationsNotTracked');
  const n = j.submittedApplicationsCount ?? j.applicationsCount ?? 0;
  return String(n);
}

export default function EmployerJobs() {
  const { t } = useTranslation(['employer', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(() => searchParams.get('status') || '');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionJobId, setActionJobId] = useState('');
  // Paid-activation plan/checkout flow state.
  const [planJob, setPlanJob] = useState(null);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const loadJobs = useCallback(() => {
    setLoading(true);
    setError('');
    return employerApi
      .getJobs({ status: status || undefined, q: q || undefined })
      .then(({ data }) => setJobs(data.data || []))
      .catch(() => {
        setJobs([]);
        setError(t('employer:jobsLoadFailed'));
      })
      .finally(() => setLoading(false));
  }, [status, q, t]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Surface the outcome of a returning Stripe checkout redirect truthfully.
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (!payment) return;
    if (payment === 'success') setNotice(t('employer:activationPaymentSuccess'));
    else if (payment === 'cancelled') setNotice(t('employer:activationPaymentCancelled'));
    const next = new URLSearchParams(searchParams);
    next.delete('payment');
    next.delete('jobId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, t]);

  const editPath = (id) => `/employer/jobs/${id}/edit`;

  const openPlanModal = useCallback(async (job) => {
    setPlanJob(job);
    setCheckoutError('');
    setPlansLoading(true);
    try {
      const { data } = await employerApi.plans();
      // Free plans are not part of the paid-activation path; a paid draft needs
      // a priced plan.
      setPlans((data.data || []).filter((p) => (p.price ?? 0) > 0));
    } catch {
      setCheckoutError(t('employer:plansLoadFailed'));
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, [t]);

  const closePlanModal = () => {
    if (checkoutBusy) return;
    setPlanJob(null);
    setPlans([]);
    setCheckoutError('');
  };

  const startCheckout = async (planId) => {
    if (!planJob || checkoutBusy) return;
    setCheckoutBusy(true);
    setCheckoutError('');
    try {
      const { data } = await employerApi.createCheckout(planJob._id, { planId });
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      setCheckoutError(t('employer:checkoutUnavailable'));
    } catch (err) {
      setCheckoutError(err.response?.data?.error || t('employer:checkoutUnavailable'));
    } finally {
      setCheckoutBusy(false);
    }
  };

  const runJobAction = async (id, action) => {
    if (actionJobId) return;
    setActionJobId(id);
    try {
      if (action === 'close') await employerApi.closeJob(id);
      else if (action === 'reopen') await employerApi.reopenJob(id);
      else if (action === 'activate') await employerApi.activateJob(id, {});
      await loadJobs();
    } catch (err) {
      setError(err.response?.data?.error || t('employer:jobActionFailed'));
    } finally {
      setActionJobId('');
    }
  };

  // Free drafts activate directly; paid drafts route into the plan/checkout
  // workflow instead of dead-ending on the server's "planId is required" error.
  const handleActivate = (job) => {
    if (isPaidDraft(job)) openPlanModal(job);
    else runJobAction(job._id, 'activate');
  };

  const JobActions = ({ j }) => (
    <div className="flex flex-wrap gap-2">
      {j.status !== 'closed' ? (
        <Link to={editPath(j._id)} className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center">
          {t('employer:editJob')}
        </Link>
      ) : (
        <button
          type="button"
          disabled={actionJobId === j._id}
          onClick={() => runJobAction(j._id, 'reopen')}
          className="text-sm text-primary hover:underline min-h-[44px]"
        >
          {t('employer:reopenJob')}
        </button>
      )}
      {j.status === 'draft' ? (
        <button
          type="button"
          disabled={actionJobId === j._id}
          onClick={() => handleActivate(j)}
          className="text-sm text-slate-700 dark:text-gray-300 hover:underline min-h-[44px]"
        >
          {isPaidDraft(j) ? t('employer:activatePaidJob') : t('employer:activateJob')}
        </button>
      ) : null}
      {j.status !== 'closed' ? (
        <button
          type="button"
          disabled={actionJobId === j._id}
          onClick={() => {
            if (window.confirm(t('employer:confirmCloseJob'))) runJobAction(j._id, 'close');
          }}
          className="text-sm text-red-600 hover:underline min-h-[44px]"
        >
          {t('employer:closeJob')}
        </button>
      ) : null}
    </div>
  );

  const statusLabel = (s) => {
    if (!s) return t('common:all');
    const key = s === 'active' ? 'active' : s === 'draft' ? 'draft' : s === 'closed' ? 'closed' : s;
    return t(`common:${key}`, { defaultValue: s });
  };

  return (
    <>
      <SeoHead title={t('employer:myJobsSeoTitle')} description={t('employer:myJobsSeoDesc')} noindex />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {t('employer:myJobPosts')}
        </h1>
        <Link
          to={ROUTES.EMPLOYER_POST_JOB}
          className="px-4 py-2.5 bg-primary hover:opacity-90 text-white text-sm font-medium rounded-lg min-h-[44px] inline-flex items-center shrink-0"
        >
          {t('employer:postNewJob')}
        </Link>
      </div>
      <div className="mb-4">
        <label htmlFor="employer-jobs-search" className="sr-only">{t('common:search')}</label>
        <input
          id="employer-jobs-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('employer:searchJobs')}
          className="w-full max-w-md min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 mb-3"
        />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {[...STATUS_FILTERS, ...REVIEW_FILTERS].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={`px-3 py-2 text-sm rounded-lg min-h-[44px] ${
              status === s
                ? 'bg-primary text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-slate-600 dark:text-gray-300'
            }`}
          >
            {statusLabel(s)}
          </button>
        ))}
      </div>
      {notice ? (
        <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-200 text-sm" role="status">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">
          {error}
        </div>
      ) : null}
      {planJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t('common:close')}
            className="absolute inset-0 bg-black/40"
            onClick={closePlanModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('employer:choosePlanTitle')}
            className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('employer:choosePlanTitle')}</h2>
              <p className="text-sm text-slate-600 dark:text-gray-300 mt-1 break-words-safe">
                {t('employer:choosePlanForJob', { title: planJob.title })}
              </p>
            </div>
            {checkoutError ? (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm" role="alert">
                {checkoutError}
              </div>
            ) : null}
            {plansLoading ? (
              <p className="text-sm text-slate-600 dark:text-gray-300">{t('common:loading')}</p>
            ) : plans.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-gray-300">{t('employer:noPaidPlansAvailable')}</p>
            ) : (
              <ul className="space-y-2">
                {plans.map((p) => (
                  <li key={p._id}>
                    <button
                      type="button"
                      disabled={checkoutBusy}
                      onClick={() => startCheckout(p._id)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-primary disabled:opacity-50 min-h-[44px]"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{p.name || p.slug}</span>
                      <span className="block text-sm text-slate-600 dark:text-gray-300">
                        {p.currency || 'USD'} {p.price}
                        {p.durationDays ? ` · ${t('employer:planDurationDays', { count: p.durationDays })}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={checkoutBusy}
                onClick={closePlanModal}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 min-h-[44px] disabled:opacity-50"
              >
                {t('common:cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-0">
        {loading ? (
          <div className="p-8 text-center text-slate-600 dark:text-gray-300">{t('common:loading')}</div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon="🏢"
            title={t('employer:postFirstJob')}
            description={t('employer:noJobsYet')}
            actionLabel={t('employer:postAJob')}
            actionTo={ROUTES.EMPLOYER_POST_JOB}
          />
        ) : (
          <>
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {jobs.map((j) => (
                <div key={j._id} className="p-4 space-y-2 min-w-0">
                  <Link
                    to={`/jobs/${j.slug}`}
                    className="font-medium text-gray-900 dark:text-white hover:text-primary break-words-safe block"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {j.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-gray-300">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded ${
                        j.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : j.status === 'draft'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {statusLabel(j.status)}
                    </span>
                    {j.approvalStatus && j.approvalStatus !== 'approved' ? (
                      <span className="inline-block px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-700">
                        {t(`employer:approval_${j.approvalStatus}`, { defaultValue: j.approvalStatus })}
                      </span>
                    ) : null}
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded ${
                        isExternalJob(j) ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {isExternalJob(j) ? t('employer:applyMethodExternal') : t('employer:applyMethodInternal')}
                    </span>
                    <span>
                      {t('employer:openingsCountLabel')}: {formatOpeningsCount(j.openingsCount)}
                    </span>
                    <span>
                      {t('common:views')}: {j.views ?? 0}
                    </span>
                    <span>
                      {t('common:applications')}: {formatApplicationCount(j, t)}
                    </span>
                  </div>
                  {isExternalJob(j) ? (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500 dark:text-gray-400">
                        {applyMethodKind(j) === 'external_email'
                          ? t('employer:jobPostsExternalEmailNotTracked')
                          : t('employer:jobPostsExternalUrlNotTracked')}
                      </p>
                      {j.applicationLink ? (
                        <a
                          href={j.applicationLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center"
                        >
                          {t('employer:openApplicationDestination')}
                        </a>
                      ) : j.applyEmail ? (
                        <a
                          href={`mailto:${j.applyEmail}`}
                          className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center"
                        >
                          {t('employer:openApplicationEmail')}
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500 dark:text-gray-400">{t('employer:jobPostsInternalTracked')}</p>
                      <Link
                        to={`${ROUTES.EMPLOYER_APPLICATIONS}?jobId=${j._id}`}
                        className="text-sm text-primary hover:underline inline-flex min-h-[44px] items-center"
                      >
                        {t('employer:viewApplications')}
                      </Link>
                    </div>
                  )}
                  <JobActions j={j} />
                </div>
              ))}
            </div>
            <div className="hidden md:block table-scroll">
              <table className="w-full min-w-0">
                <thead className="bg-slate-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">{t('common:title')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">{t('common:status')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">{t('employer:applyMethod')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">{t('employer:openingsCountLabel')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">{t('common:views')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">{t('common:applications')}</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">{t('common:actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {jobs.map((j) => (
                    <tr key={j._id}>
                      <td className="py-3 px-4 min-w-0">
                        <Link
                          to={`/jobs/${j.slug}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-primary break-words-safe"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {j.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs rounded ${
                            j.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : j.status === 'draft'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {statusLabel(j.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 dark:text-gray-300">
                        {isExternalJob(j) ? t('employer:applyMethodExternal') : t('employer:applyMethodInternal')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-gray-300">{formatOpeningsCount(j.openingsCount)}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-gray-300">{j.views ?? 0}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-gray-300">{formatApplicationCount(j, t)}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {isExternalJob(j) ? (
                            j.applicationLink ? (
                              <a
                                href={j.applicationLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline"
                              >
                                {t('employer:openApplicationDestination')}
                              </a>
                            ) : j.applyEmail ? (
                              <a href={`mailto:${j.applyEmail}`} className="text-sm text-primary hover:underline">
                                {t('employer:openApplicationEmail')}
                              </a>
                            ) : (
                              <span className="text-sm text-slate-500">
                                {applyMethodKind(j) === 'external_email'
                                  ? t('employer:jobPostsExternalEmailNotTracked')
                                  : t('employer:jobPostsExternalUrlNotTracked')}
                              </span>
                            )
                          ) : (
                            <Link
                              to={`${ROUTES.EMPLOYER_APPLICATIONS}?jobId=${j._id}`}
                              className="text-sm text-primary hover:underline"
                            >
                              {t('employer:viewApplications')}
                            </Link>
                          )}
                          <JobActions j={j} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
