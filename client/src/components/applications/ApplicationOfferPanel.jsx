import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  trackApplicationOfferEvent,
  APPLICATION_OFFER_ACTIONS,
} from '../employer/applicant/applicationOfferAnalytics';

function formatDate(value, locale, { time = false } = {}) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(time ? { hour: 'numeric', minute: '2-digit' } : {}),
    });
  } catch {
    return d.toLocaleString();
  }
}

function OfferTerms({ offer, t, i18n, companyName }) {
  if (!offer) return null;
  const statusKey = offer.effectiveStatus || offer.status;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 p-4 text-sm space-y-2">
      {companyName ? (
        <p className="font-medium text-gray-900 dark:text-white break-words-safe">{companyName}</p>
      ) : null}
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {t(`employer:offerStatus_${statusKey}`, { defaultValue: statusKey })}
      </p>
      {offer.startDate ? (
        <p className="text-gray-700 dark:text-gray-300">
          <span className="text-slate-500">{t('employer:offerStartDate')}: </span>
          {formatDate(offer.startDate, i18n.language)}
        </p>
      ) : null}
      {offer.compensationText ? (
        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words-safe">
          <span className="text-slate-500">{t('employer:offerCompensation')}: </span>
          {offer.compensationText}
        </p>
      ) : null}
      {offer.employmentType ? (
        <p className="text-gray-700 dark:text-gray-300">
          <span className="text-slate-500">{t('employer:offerEmploymentType')}: </span>
          {t(`employer:offerEmploymentType_${offer.employmentType}`, { defaultValue: offer.employmentType })}
        </p>
      ) : null}
      {offer.workMode ? (
        <p className="text-gray-700 dark:text-gray-300">
          <span className="text-slate-500">{t('employer:offerWorkMode')}: </span>
          {t(`employer:offerWorkMode_${offer.workMode}`, { defaultValue: offer.workMode })}
        </p>
      ) : null}
      {offer.expiresAt ? (
        <p className="text-gray-700 dark:text-gray-300">
          <span className="text-slate-500">{t('employer:offerExpiresAt')}: </span>
          {formatDate(offer.expiresAt, i18n.language, { time: true })}
        </p>
      ) : null}
      {offer.offerNote ? (
        <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words-safe">{offer.offerNote}</p>
      ) : null}
    </div>
  );
}

export function EmployerApplicationOfferSection({ applicationId, offerApi }) {
  const { t, i18n } = useTranslation(['employer', 'common']);
  const formId = useId();
  const [offers, setOffers] = useState([]);
  const [activeOffer, setActiveOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [pendingWithdraw, setPendingWithdraw] = useState(false);
  const clientCommandIdRef = useRef(null);

  const [form, setForm] = useState({
    startDate: '',
    employmentType: '',
    workMode: '',
    compensationText: '',
    offerNote: '',
    expiresAt: '',
  });

  const load = useCallback(() => {
    if (!applicationId) return Promise.resolve();
    setLoading(true);
    setError('');
    return offerApi
      .list(applicationId)
      .then(({ data }) => {
        const payload = data.data || data;
        setOffers(payload.offers || []);
        setActiveOffer(payload.activeOffer || null);
      })
      .catch((err) => {
        setError(err.response?.data?.error || t('employer:offerLoadFailed'));
        setOffers([]);
        setActiveOffer(null);
      })
      .finally(() => setLoading(false));
  }, [applicationId, offerApi, t]);

  useEffect(() => {
    load();
  }, [load]);

  const canSend =
    !activeOffer ||
    ['withdrawn', 'declined', 'expired', 'accepted'].includes(
      activeOffer.effectiveStatus || activeOffer.status
    );
  const canWithdraw =
    activeOffer &&
    (activeOffer.effectiveStatus || activeOffer.status) === 'sent';

  const handleSend = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!clientCommandIdRef.current) {
      clientCommandIdRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    setBusy(true);
    setFormError('');
    setFormSuccess('');
    trackApplicationOfferEvent(APPLICATION_OFFER_ACTIONS.OFFER_INTENT, {
      surface: 'employer_application_detail',
      applicationMethod: 'internal',
      hasStartDate: Boolean(form.startDate),
      hasCompensation: Boolean(form.compensationText?.trim()),
    });
    try {
      const body = {
        clientCommandId: clientCommandIdRef.current,
        startDate: form.startDate || undefined,
        employmentType: form.employmentType || undefined,
        workMode: form.workMode || undefined,
        compensationText: form.compensationText || undefined,
        offerNote: form.offerNote || undefined,
        expiresAt: form.expiresAt || undefined,
      };
      const { data } = await offerApi.send(applicationId, body);
      const sideEffects = data.sideEffects || {};
      let success = t('employer:offerSentInApp');
      if (sideEffects.emailQueued) {
        success = `${success} ${t('employer:offerEmailQueued')}`;
      }
      setFormSuccess(success);
      trackApplicationOfferEvent(APPLICATION_OFFER_ACTIONS.OFFER_SENT, {
        surface: 'employer_application_detail',
        applicationMethod: 'internal',
        hasStartDate: Boolean(form.startDate),
        hasCompensation: Boolean(form.compensationText?.trim()),
      });
      clientCommandIdRef.current = null;
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.error || t('employer:offerSendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!activeOffer || busy) return;
    setBusy(true);
    setFormError('');
    trackApplicationOfferEvent(APPLICATION_OFFER_ACTIONS.WITHDRAW_INTENT, {
      surface: 'employer_application_detail',
      statusFrom: activeOffer.status,
    });
    try {
      await offerApi.withdraw(applicationId, activeOffer._id);
      setFormSuccess(t('employer:offerWithdrawnSuccess'));
      trackApplicationOfferEvent(APPLICATION_OFFER_ACTIONS.WITHDRAWN, {
        surface: 'employer_application_detail',
        statusFrom: 'sent',
        statusTo: 'withdrawn',
      });
      setPendingWithdraw(false);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.error || t('employer:offerWithdrawFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">{t('common:loading', { defaultValue: 'Loading…' })}</p>;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {activeOffer ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t('employer:offerCurrentTitle')}</h3>
          <OfferTerms offer={activeOffer} t={t} i18n={i18n} />
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('employer:offerNone')}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {canSend ? (
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setFormSuccess('');
              setFormError('');
            }}
            className="inline-flex items-center px-4 py-2 rounded-lg border border-primary text-primary dark:text-mint text-sm font-medium min-h-[44px]"
          >
            {activeOffer ? t('employer:offerSendReplacement') : t('employer:offerSendAction')}
          </button>
        ) : null}
        {canWithdraw ? (
          <button
            type="button"
            onClick={() => setPendingWithdraw(true)}
            className="inline-flex items-center px-4 py-2 rounded-lg border border-red-300 text-red-700 dark:border-red-700 dark:text-red-300 text-sm font-medium min-h-[44px]"
          >
            {t('employer:offerWithdrawAction')}
          </button>
        ) : null}
      </div>

      {showForm ? (
        <form onSubmit={handleSend} className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-xs text-slate-500">{t('employer:offerFormHint')}</p>
          <div>
            <label htmlFor={`${formId}-start`} className="block text-xs font-medium text-slate-600 mb-1">
              {t('employer:offerStartDate')}
            </label>
            <input
              id={`${formId}-start`}
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-comp`} className="block text-xs font-medium text-slate-600 mb-1">
              {t('employer:offerCompensation')}
            </label>
            <input
              id={`${formId}-comp`}
              type="text"
              value={form.compensationText}
              onChange={(e) => setForm((f) => ({ ...f, compensationText: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${formId}-etype`} className="block text-xs font-medium text-slate-600 mb-1">
                {t('employer:offerEmploymentType')}
              </label>
              <select
                id={`${formId}-etype`}
                value={form.employmentType}
                onChange={(e) => setForm((f) => ({ ...f, employmentType: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-[44px]"
              >
                <option value="">{t('employer:offerOptional')}</option>
                {['full_time', 'part_time', 'contract', 'internship', 'temporary'].map((v) => (
                  <option key={v} value={v}>
                    {t(`employer:offerEmploymentType_${v}`, { defaultValue: v })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${formId}-wmode`} className="block text-xs font-medium text-slate-600 mb-1">
                {t('employer:offerWorkMode')}
              </label>
              <select
                id={`${formId}-wmode`}
                value={form.workMode}
                onChange={(e) => setForm((f) => ({ ...f, workMode: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-[44px]"
              >
                <option value="">{t('employer:offerOptional')}</option>
                {['remote', 'hybrid', 'on_site'].map((v) => (
                  <option key={v} value={v}>
                    {t(`employer:offerWorkMode_${v}`, { defaultValue: v })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor={`${formId}-exp`} className="block text-xs font-medium text-slate-600 mb-1">
              {t('employer:offerExpiresAt')}
            </label>
            <input
              id={`${formId}-exp`}
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-note`} className="block text-xs font-medium text-slate-600 mb-1">
              {t('employer:offerNote')}
            </label>
            <textarea
              id={`${formId}-note`}
              rows={3}
              value={form.offerNote}
              onChange={(e) => setForm((f) => ({ ...f, offerNote: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-primary dark:bg-mint text-white dark:text-gray-900 text-sm font-medium min-h-[44px] disabled:opacity-50"
          >
            {busy ? t('employer:saving') : t('employer:offerSendAction')}
          </button>
        </form>
      ) : null}

      {formSuccess ? (
        <p className="text-sm text-green-700 dark:text-green-300" role="status">
          {formSuccess}
        </p>
      ) : null}
      {formError ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {formError}
        </p>
      ) : null}

      {offers.length > 1 ? (
        <div>
          <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">{t('employer:offerHistoryTitle')}</h3>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-gray-400" role="list">
            {offers.map((o) => (
              <li key={o._id}>
                {formatDate(o.createdAt, i18n.language, { time: true })} —{' '}
                {t(`employer:offerStatus_${o.effectiveStatus || o.status}`, { defaultValue: o.status })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pendingWithdraw ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-offer-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-md w-full p-6 space-y-4">
            <h2 id="withdraw-offer-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('employer:offerWithdrawConfirmTitle')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('employer:offerWithdrawConfirmBody')}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPendingWithdraw(false)}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
              >
                {t('employer:cancel')}
              </button>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={busy}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {t('employer:offerWithdrawAction')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CandidateApplicationOfferSection({
  opportunityApplicationId,
  activeOffer,
  companyName,
  offerApi,
  onResponded,
}) {
  const { t, i18n } = useTranslation(['applications', 'employer']);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingResponse, setPendingResponse] = useState(null);

  useEffect(() => {
    if (activeOffer?.status === 'sent' && activeOffer.effectiveStatus !== 'expired') {
      trackApplicationOfferEvent(APPLICATION_OFFER_ACTIONS.CANDIDATE_OFFER_VIEW, {
        surface: 'candidate_application_detail',
        statusFrom: activeOffer.status,
      });
    }
  }, [activeOffer?._id, activeOffer?.status, activeOffer?.effectiveStatus]);

  if (!activeOffer) return null;

  const canRespond =
    activeOffer.status === 'sent' && activeOffer.effectiveStatus !== 'expired';

  const submitResponse = async (response) => {
    if (!canRespond || responding) return;
    setResponding(true);
    setError('');
    setSuccess('');
    trackApplicationOfferEvent(APPLICATION_OFFER_ACTIONS.CANDIDATE_RESPONSE_INTENT, {
      surface: 'candidate_application_detail',
      statusFrom: activeOffer.status,
      statusTo: response,
    });
    try {
      await offerApi.respond(opportunityApplicationId, activeOffer._id, { response });
      const msg =
        response === 'accepted' ? t('applications:offerAccepted') : t('applications:offerDeclined');
      setSuccess(msg);
      trackApplicationOfferEvent(APPLICATION_OFFER_ACTIONS.CANDIDATE_RESPONSE_UPDATED, {
        surface: 'candidate_application_detail',
        statusFrom: activeOffer.status,
        statusTo: response,
      });
      setPendingResponse(null);
      onResponded?.();
    } catch (err) {
      setError(err.response?.data?.error || t('applications:offerResponseFailed'));
    } finally {
      setResponding(false);
    }
  };

  return (
    <div className="space-y-4">
      <OfferTerms offer={activeOffer} t={t} i18n={i18n} companyName={companyName} />
      <p className="text-xs text-slate-500">{t('applications:offerLegalHint')}</p>

      {canRespond ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => setPendingResponse('accepted')}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary dark:bg-mint text-white dark:text-gray-900 text-sm font-medium min-h-[44px]"
          >
            {t('applications:offerAcceptAction')}
          </button>
          <button
            type="button"
            onClick={() => setPendingResponse('declined')}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium min-h-[44px]"
          >
            {t('applications:offerDeclineAction')}
          </button>
        </div>
      ) : null}

      {success ? (
        <p className="text-sm text-green-700 dark:text-green-300" role="status">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {pendingResponse ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="offer-response-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-md w-full p-6 space-y-4">
            <h2 id="offer-response-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              {pendingResponse === 'accepted'
                ? t('applications:offerAcceptConfirmTitle')
                : t('applications:offerDeclineConfirmTitle')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {pendingResponse === 'accepted'
                ? t('applications:offerAcceptConfirmBody')
                : t('applications:offerDeclineConfirmBody')}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPendingResponse(null)}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm"
              >
                {t('applications:cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                type="button"
                onClick={() => submitResponse(pendingResponse)}
                disabled={responding}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-primary dark:bg-mint text-white dark:text-gray-900 text-sm font-medium disabled:opacity-50"
              >
                {pendingResponse === 'accepted'
                  ? t('applications:offerAcceptAction')
                  : t('applications:offerDeclineAction')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
