import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  trackApplicationCommunicationEvent,
  APPLICATION_COMMUNICATION_ACTIONS,
} from '../employer/applicant/applicationCommunicationAnalytics';

function formatTimestamp(value, locale) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return d.toLocaleString();
  }
}

function formatAppointment(value, timeZone, locale) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const opts = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  };
  try {
    if (timeZone) return d.toLocaleString(locale, { ...opts, timeZone });
  } catch {
    /* fall through */
  }
  return d.toLocaleString(locale, opts);
}

function senderLabel(message, t) {
  if (message.senderRole === 'employer') return t('employer:communicationSenderEmployer');
  if (message.senderRole === 'candidate') return t('employer:communicationSenderCandidate');
  return t('employer:communicationSenderSystem');
}

function InterviewCard({ invitation, t, i18n }) {
  if (!invitation) return null;
  return (
    <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 p-3 text-sm space-y-1">
      <p className="font-medium text-gray-900 dark:text-white">
        {formatAppointment(invitation.scheduledAt, invitation.timeZone, i18n.language)}
      </p>
      {invitation.timeZone ? (
        <p className="text-xs text-slate-500">{invitation.timeZone}</p>
      ) : null}
      <p className="text-gray-700 dark:text-gray-300">
        {t(`employer:interviewMethod_${invitation.method}`, { defaultValue: invitation.method })}
      </p>
      {invitation.location ? (
        <p className="text-gray-700 dark:text-gray-300 break-words-safe">{invitation.location}</p>
      ) : null}
      {invitation.meetingUrl ? (
        <a
          href={invitation.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary dark:text-mint break-all hover:underline"
        >
          {t('employer:interviewJoinLink')}
        </a>
      ) : null}
      {invitation.employerNote ? (
        <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words-safe">{invitation.employerNote}</p>
      ) : null}
      <p className="text-xs text-slate-500">
        {t(`employer:interviewInvitationStatus_${invitation.status}`, { defaultValue: invitation.status })}
      </p>
    </div>
  );
}

function MessageHistory({ messages, t, i18n }) {
  if (!messages.length) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('employer:communicationEmptyEmployer')}
      </p>
    );
  }

  return (
    <ol className="space-y-4" aria-label={t('employer:communicationHistoryLabel')}>
      {messages.map((message) => (
        <li key={message._id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {senderLabel(message, t)}
            </span>
            <time className="text-xs text-slate-500" dateTime={message.createdAt}>
              {formatTimestamp(message.createdAt, i18n.language)}
            </time>
          </div>
          {message.messageType === 'message' ? (
            <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words-safe">
              {message.body}
            </p>
          ) : (
            <p className="text-sm text-gray-700 dark:text-gray-300">{message.body}</p>
          )}
          <InterviewCard invitation={message.interviewInvitation} t={t} i18n={i18n} />
        </li>
      ))}
    </ol>
  );
}

export function EmployerApplicationCommunication({
  applicationId,
  communicationApi,
  maxLength = 4000,
}) {
  const { t, i18n } = useTranslation(['employer']);
  const composerId = useId();
  const [messages, setMessages] = useState([]);
  const [activeInvitation, setActiveInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [sending, setSending] = useState(false);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [interviewBusy, setInterviewBusy] = useState(false);
  const [interviewError, setInterviewError] = useState('');
  const [interviewSuccess, setInterviewSuccess] = useState('');
  const clientMessageIdRef = useRef(null);

  const [interviewForm, setInterviewForm] = useState({
    scheduledAt: '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    method: 'video',
    meetingUrl: '',
    location: '',
    employerNote: '',
    durationMinutes: '',
  });

  const load = useCallback(() => {
    if (!applicationId) return Promise.resolve();
    setLoading(true);
    setError('');
    return communicationApi
      .list(applicationId)
      .then(({ data }) => {
        const payload = data.data || data;
        setMessages(payload.messages || []);
        setActiveInvitation(payload.activeInterviewInvitation || null);
      })
      .catch((err) => {
        setError(err.response?.data?.error || t('employer:communicationLoadFailed'));
        setMessages([]);
        setActiveInvitation(null);
      })
      .finally(() => setLoading(false));
  }, [applicationId, communicationApi, t]);

  useEffect(() => {
    load();
  }, [load]);

  const resetClientMessageId = () => {
    clientMessageIdRef.current =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    if (body.length > maxLength) {
      setSendError(t('employer:communicationMessageTooLong', { max: maxLength }));
      return;
    }
    if (!clientMessageIdRef.current) resetClientMessageId();
    setSending(true);
    setSendError('');
    setSendSuccess('');
    trackApplicationCommunicationEvent(APPLICATION_COMMUNICATION_ACTIONS.MESSAGE_INTENT, {
      surface: 'employer_application_detail',
      messageType: 'message',
      applicationMethod: 'internal',
    });
    try {
      const { data } = await communicationApi.sendMessage(applicationId, {
        body,
        clientMessageId: clientMessageIdRef.current,
      });
      if (data.duplicate) {
        setSendSuccess(t('employer:communicationAlreadySent'));
      } else {
        setSendSuccess(t('employer:communicationMessageSentInApp'));
        trackApplicationCommunicationEvent(APPLICATION_COMMUNICATION_ACTIONS.MESSAGE_SENT, {
          surface: 'employer_application_detail',
          messageType: 'message',
          applicationMethod: 'internal',
        });
      }
      if (data.sideEffects?.emailQueued) {
        setSendSuccess((prev) => `${prev} ${t('employer:communicationEmailQueued')}`.trim());
      }
      setDraft('');
      clientMessageIdRef.current = null;
      await load();
    } catch (err) {
      setSendError(err.response?.data?.error || t('employer:communicationSendFailed'));
    } finally {
      setSending(false);
    }
  };

  const handleInterviewSubmit = async (e) => {
    e.preventDefault();
    if (interviewBusy) return;
    setInterviewBusy(true);
    setInterviewError('');
    setInterviewSuccess('');
    trackApplicationCommunicationEvent(APPLICATION_COMMUNICATION_ACTIONS.INTERVIEW_INTENT, {
      surface: 'employer_application_detail',
      interviewMethod: interviewForm.method,
      applicationMethod: 'internal',
    });
    try {
      const payload = {
        scheduledAt: new Date(interviewForm.scheduledAt).toISOString(),
        timeZone: interviewForm.timeZone,
        method: interviewForm.method,
        meetingUrl: interviewForm.meetingUrl,
        location: interviewForm.location,
        employerNote: interviewForm.employerNote,
      };
      if (interviewForm.durationMinutes) {
        payload.durationMinutes = Number(interviewForm.durationMinutes);
      }
      const { data } = await communicationApi.createInterviewInvitation(applicationId, payload);
      const result = data?.data || data;
      setInterviewSuccess(t('employer:communicationInterviewCreated'));
      if (result?.emailQueued) {
        setInterviewSuccess((prev) => `${prev} ${t('employer:communicationEmailQueued')}`.trim());
      }
      trackApplicationCommunicationEvent(APPLICATION_COMMUNICATION_ACTIONS.INTERVIEW_CREATED, {
        surface: 'employer_application_detail',
        interviewMethod: interviewForm.method,
        applicationMethod: 'internal',
        hasInterview: true,
      });
      setShowInterviewForm(false);
      await load();
    } catch (err) {
      setInterviewError(err.response?.data?.error || t('employer:communicationInterviewFailed'));
    } finally {
      setInterviewBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">{t('employer:loading')}</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {activeInvitation ? (
        <div className="rounded-lg border border-primary/30 dark:border-mint/30 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            {t('employer:communicationActiveInterview')}
          </h3>
          <InterviewCard invitation={activeInvitation} t={t} i18n={i18n} />
        </div>
      ) : null}

      <MessageHistory messages={messages} t={t} i18n={i18n} />

      <div className="space-y-2">
        <label htmlFor={composerId} className="block text-sm font-medium text-gray-900 dark:text-white">
          {t('employer:communicationMessageLabel')}
        </label>
        <textarea
          id={composerId}
          rows={4}
          maxLength={maxLength}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={sending}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[44px]"
          placeholder={t('employer:communicationMessagePlaceholder')}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              resetClientMessageId();
              handleSend();
            }}
            disabled={sending || !draft.trim()}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-primary dark:bg-mint text-white dark:text-gray-900 text-sm font-medium min-h-[44px] disabled:opacity-50"
          >
            {sending ? t('employer:sending') : t('employer:communicationSendMessage')}
          </button>
          <button
            type="button"
            onClick={() => setShowInterviewForm((v) => !v)}
            className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium min-h-[44px]"
          >
            {showInterviewForm ? t('employer:communicationHideInterviewForm') : t('employer:communicationInviteInterview')}
          </button>
        </div>
        {sendSuccess ? (
          <p className="text-sm text-green-700 dark:text-green-300" role="status">
            {sendSuccess}
          </p>
        ) : null}
        {sendError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {sendError}
          </p>
        ) : null}
      </div>

      {showInterviewForm ? (
        <form onSubmit={handleInterviewSubmit} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('employer:communicationInviteInterview')}
          </h3>
          <div>
            <label htmlFor={`${composerId}-dt`} className="block text-xs font-medium text-slate-600 mb-1">
              {t('employer:communicationInterviewDateTime')}
            </label>
            <input
              id={`${composerId}-dt`}
              type="datetime-local"
              required
              value={interviewForm.scheduledAt}
              onChange={(e) => setInterviewForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor={`${composerId}-tz`} className="block text-xs font-medium text-slate-600 mb-1">
              {t('employer:communicationInterviewTimezone')}
            </label>
            <input
              id={`${composerId}-tz`}
              type="text"
              required
              value={interviewForm.timeZone}
              onChange={(e) => setInterviewForm((f) => ({ ...f, timeZone: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-[44px]"
            />
          </div>
          <div>
            <label htmlFor={`${composerId}-method`} className="block text-xs font-medium text-slate-600 mb-1">
              {t('employer:communicationInterviewMethod')}
            </label>
            <select
              id={`${composerId}-method`}
              value={interviewForm.method}
              onChange={(e) => setInterviewForm((f) => ({ ...f, method: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-[44px]"
            >
              <option value="video">{t('employer:interviewMethod_video')}</option>
              <option value="phone">{t('employer:interviewMethod_phone')}</option>
              <option value="in_person">{t('employer:interviewMethod_in_person')}</option>
            </select>
          </div>
          {interviewForm.method === 'video' ? (
            <div>
              <label htmlFor={`${composerId}-url`} className="block text-xs font-medium text-slate-600 mb-1">
                {t('employer:communicationInterviewMeetingUrl')}
              </label>
              <input
                id={`${composerId}-url`}
                type="url"
                required
                value={interviewForm.meetingUrl}
                onChange={(e) => setInterviewForm((f) => ({ ...f, meetingUrl: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-[44px]"
              />
            </div>
          ) : null}
          {interviewForm.method === 'in_person' ? (
            <div>
              <label htmlFor={`${composerId}-loc`} className="block text-xs font-medium text-slate-600 mb-1">
                {t('employer:communicationInterviewLocation')}
              </label>
              <input
                id={`${composerId}-loc`}
                type="text"
                required
                value={interviewForm.location}
                onChange={(e) => setInterviewForm((f) => ({ ...f, location: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-[44px]"
              />
            </div>
          ) : null}
          <div>
            <label htmlFor={`${composerId}-note`} className="block text-xs font-medium text-slate-600 mb-1">
              {t('employer:communicationInterviewNote')}
            </label>
            <textarea
              id={`${composerId}-note`}
              rows={3}
              value={interviewForm.employerNote}
              onChange={(e) => setInterviewForm((f) => ({ ...f, employerNote: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={interviewBusy}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-primary dark:bg-mint text-white dark:text-gray-900 text-sm font-medium min-h-[44px] disabled:opacity-50"
          >
            {interviewBusy ? t('employer:saving') : t('employer:communicationSendInterviewInvite')}
          </button>
          {interviewSuccess ? (
            <p className="text-sm text-green-700 dark:text-green-300" role="status">
              {interviewSuccess}
            </p>
          ) : null}
          {interviewError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {interviewError}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

export function CandidateApplicationCommunication({
  opportunityApplicationId,
  communicationApi,
  companyName,
  maxLength = 4000,
}) {
  const { t, i18n } = useTranslation(['applications', 'employer']);
  const composerId = useId();
  const [messages, setMessages] = useState([]);
  const [activeInvitation, setActiveInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [sending, setSending] = useState(false);
  const [responding, setResponding] = useState(false);
  const clientMessageIdRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    return communicationApi
      .list(opportunityApplicationId)
      .then(({ data }) => {
        const payload = data.data || data;
        setMessages(payload.messages || []);
        setActiveInvitation(payload.activeInterviewInvitation || null);
      })
      .catch((err) => {
        setError(err.response?.data?.error || t('applications:communicationLoadFailed'));
      })
      .finally(() => setLoading(false));
  }, [opportunityApplicationId, communicationApi, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeInvitation?.status === 'pending') {
      trackApplicationCommunicationEvent(APPLICATION_COMMUNICATION_ACTIONS.CANDIDATE_INTERVIEW_VIEW, {
        surface: 'candidate_application_detail',
        interviewMethod: activeInvitation.method,
        statusFrom: 'pending',
      });
    }
  }, [activeInvitation?._id, activeInvitation?.status, activeInvitation?.method]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    if (!clientMessageIdRef.current) {
      clientMessageIdRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    setSending(true);
    setSendError('');
    setSendSuccess('');
    trackApplicationCommunicationEvent(APPLICATION_COMMUNICATION_ACTIONS.CANDIDATE_REPLY_INTENT, {
      surface: 'candidate_application_detail',
      messageType: 'message',
    });
    try {
      await communicationApi.sendMessage(opportunityApplicationId, {
        body,
        clientMessageId: clientMessageIdRef.current,
      });
      setSendSuccess(t('applications:communicationMessageSent'));
      trackApplicationCommunicationEvent(APPLICATION_COMMUNICATION_ACTIONS.CANDIDATE_REPLY_SENT, {
        surface: 'candidate_application_detail',
        messageType: 'message',
      });
      setDraft('');
      clientMessageIdRef.current = null;
      await load();
    } catch (err) {
      setSendError(err.response?.data?.error || t('applications:communicationSendFailed'));
    } finally {
      setSending(false);
    }
  };

  const handleInterviewResponse = async (response) => {
    if (!activeInvitation || responding) return;
    setResponding(true);
    trackApplicationCommunicationEvent(APPLICATION_COMMUNICATION_ACTIONS.CANDIDATE_RESPONSE_INTENT, {
      surface: 'candidate_application_detail',
      interviewMethod: activeInvitation.method,
      statusFrom: activeInvitation.status,
      statusTo: response,
    });
    try {
      await communicationApi.respondInterviewInvitation(
        opportunityApplicationId,
        activeInvitation._id,
        { response }
      );
      trackApplicationCommunicationEvent(APPLICATION_COMMUNICATION_ACTIONS.CANDIDATE_RESPONSE_UPDATED, {
        surface: 'candidate_application_detail',
        interviewMethod: activeInvitation.method,
        statusFrom: 'pending',
        statusTo: response,
      });
      await load();
    } catch (err) {
      setSendError(err.response?.data?.error || t('applications:communicationInterviewResponseFailed'));
    } finally {
      setResponding(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">{t('applications:loading')}</p>;
  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {companyName ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('applications:communicationEmployerContext', { company: companyName })}
        </p>
      ) : null}

      {activeInvitation ? (
        <div className="rounded-lg border border-primary/30 dark:border-mint/30 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('applications:communicationInterviewHeading')}
          </h3>
          <InterviewCard invitation={activeInvitation} t={t} i18n={i18n} />
          {activeInvitation.status === 'pending' ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={responding}
                onClick={() => handleInterviewResponse('accepted')}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-primary dark:bg-mint text-white dark:text-gray-900 text-sm font-medium min-h-[44px] disabled:opacity-50"
              >
                {t('applications:communicationAcceptInterview')}
              </button>
              <button
                type="button"
                disabled={responding}
                onClick={() => handleInterviewResponse('declined')}
                className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium min-h-[44px] disabled:opacity-50"
              >
                {t('applications:communicationDeclineInterview')}
              </button>
            </div>
          ) : null}
          {activeInvitation.status === 'declined' ? (
            <p className="text-xs text-slate-500">{t('applications:communicationDeclineHint')}</p>
          ) : null}
        </div>
      ) : null}

      {!messages.length ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('applications:communicationEmptyCandidate')}</p>
      ) : (
        <MessageHistory messages={messages} t={t} i18n={i18n} />
      )}

      <div className="space-y-2">
        <label htmlFor={composerId} className="block text-sm font-medium text-gray-900 dark:text-white">
          {t('applications:communicationReplyLabel')}
        </label>
        <textarea
          id={composerId}
          rows={3}
          maxLength={maxLength}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={sending}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[44px]"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-primary dark:bg-mint text-white dark:text-gray-900 text-sm font-medium min-h-[44px] disabled:opacity-50"
        >
          {sending ? t('applications:tracker.saving') : t('applications:communicationSendReply')}
        </button>
        {sendSuccess ? (
          <p className="text-sm text-green-700 dark:text-green-300" role="status">
            {sendSuccess}
          </p>
        ) : null}
        {sendError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {sendError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
