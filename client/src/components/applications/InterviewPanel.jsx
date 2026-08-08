import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const MODES = ['video', 'phone', 'in_person', 'other'];

function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// PF-EMP-INT-B4: render an Employer-owned appointment in its own stored zone so the
// candidate sees the wall clock the Employer intended, not the viewer's own. Mirrors
// the Employer summary helper; falls back to the viewer's zone only when the stored
// zone is absent (pre-B3B appointments) or unknown to this browser.
function formatAppointment(value, timeZone) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const opts = {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  };
  try {
    if (timeZone) return d.toLocaleString(undefined, { ...opts, timeZone });
  } catch {
    /* stored zone unknown to this browser — fall through to the viewer's own */
  }
  try {
    return d.toLocaleString(undefined, opts);
  } catch {
    return d.toLocaleString();
  }
}

function deriveStatus(interview) {
  if (interview?.outcome) return 'completed';
  if (interview?.scheduledAt) return 'scheduled';
  return 'none';
}

/**
 * PF-EMP-INT-B4: an interview attached to an employer-linked application is owned and
 * written solely by the Employer scheduling workflow. The candidate can read it here
 * but cannot edit it — the server rejects any candidate write to it — so this view is
 * strictly read-only, presenting status / date-time / timezone / method / link /
 * location / outcome without a misleading Save control.
 */
function ReadOnlyAppointment({ interview }) {
  const { t } = useTranslation(['applications']);
  const status = deriveStatus(interview);

  if (status === 'none') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('applications:tracker.interviewNoneScheduled')}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{t('applications:tracker.interviewEmployerManaged')}</p>
      </div>
    );
  }

  const rows = [
    { key: 'status', label: t('applications:tracker.interviewStatusLabel'), value: t(`applications:interviewStatuses.${status}`) },
    interview.scheduledAt
      ? { key: 'at', label: t('applications:tracker.interviewAt'), value: formatAppointment(interview.scheduledAt, interview.timeZone) }
      : null,
    interview.timeZone
      ? { key: 'tz', label: t('applications:tracker.interviewTimezone'), value: interview.timeZone }
      : null,
    interview.mode
      ? { key: 'mode', label: t('applications:tracker.interviewMode'), value: t(`applications:interviewModes.${interview.mode}`, { defaultValue: interview.mode }) }
      : null,
    interview.location
      ? { key: 'loc', label: t('applications:tracker.interviewLocation'), value: interview.location }
      : null,
    interview.outcome
      ? { key: 'outcome', label: t('applications:tracker.interviewOutcome'), value: interview.outcome }
      : null,
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <dl className="grid sm:grid-cols-2 gap-3 text-sm">
        {rows.map((row) => (
          <div key={row.key}>
            <dt className="text-gray-500 dark:text-gray-400">{row.label}</dt>
            <dd className="font-medium text-gray-900 dark:text-white mt-0.5 break-words">{row.value}</dd>
          </div>
        ))}
        {interview.meetingUrl ? (
          <div className="sm:col-span-2">
            <dt className="text-gray-500 dark:text-gray-400">{t('applications:tracker.meetingUrl')}</dt>
            <dd className="mt-0.5">
              <a href={interview.meetingUrl} target="_blank" rel="noopener noreferrer"
                className="text-primary dark:text-mint hover:underline break-all min-h-[44px] inline-flex items-center">
                {t('applications:tracker.joinMeeting')}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="text-xs text-gray-400 dark:text-gray-500">{t('applications:tracker.interviewEmployerManaged')}</p>
    </div>
  );
}

export function InterviewPanel({ interview = {}, onSave, disabled, employerOwned = false }) {
  const { t } = useTranslation(['applications']);
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(interview.scheduledAt));
  const [mode, setMode] = useState(interview.mode || 'video');
  const [location, setLocation] = useState(interview.location || '');
  const [meetingUrl, setMeetingUrl] = useState(interview.meetingUrl || '');
  const [notes, setNotes] = useState(interview.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setScheduledAt(toLocalInput(interview.scheduledAt));
    setMode(interview.mode || 'video');
    setLocation(interview.location || '');
    setMeetingUrl(interview.meetingUrl || '');
    setNotes(interview.notes || '');
  }, [interview]);

  // PF-EMP-INT-B4: Employer-owned appointments are read-only for the candidate.
  if (employerOwned) {
    return <ReadOnlyAppointment interview={interview} />;
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await onSave({
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        mode,
        location,
        meetingUrl,
        notes,
      });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || t('applications:tracker.interviewError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
      <div>
        <label htmlFor="interview-at" className="block text-sm font-medium mb-1">{t('applications:tracker.interviewAt')}</label>
        <input id="interview-at" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
          disabled={disabled || busy} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[44px]" />
      </div>
      <div>
        <label htmlFor="interview-mode" className="block text-sm font-medium mb-1">{t('applications:tracker.interviewMode')}</label>
        <select id="interview-mode" value={mode} onChange={(e) => setMode(e.target.value)} disabled={disabled || busy}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[44px]">
          {MODES.map((m) => <option key={m} value={m}>{t(`applications:interviewModes.${m}`)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="interview-location" className="block text-sm font-medium mb-1">{t('applications:tracker.interviewLocation')}</label>
        <input id="interview-location" value={location} onChange={(e) => setLocation(e.target.value)} disabled={disabled || busy}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[44px]" />
      </div>
      <div>
        <label htmlFor="interview-url" className="block text-sm font-medium mb-1">{t('applications:tracker.meetingUrl')}</label>
        <input id="interview-url" type="url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} disabled={disabled || busy}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[44px]" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="interview-notes" className="block text-sm font-medium mb-1">{t('applications:tracker.interviewNotes')}</label>
        <textarea id="interview-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={disabled || busy}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
      </div>
      {error ? <p className="sm:col-span-2 text-sm text-red-600" role="alert">{error}</p> : null}
      {saved ? <p className="sm:col-span-2 text-sm text-emerald-600" role="status">{t('applications:tracker.interviewSaved')}</p> : null}
      <div className="sm:col-span-2">
        <button type="submit" disabled={disabled || busy}
          className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium min-h-[44px] disabled:opacity-50">
          {t('applications:tracker.saveInterview')}
        </button>
      </div>
    </form>
  );
}
