import { useEffect, useState } from 'react';
import { agentApi } from '../../services/agentService';
import { TimezoneSelect } from '../../components/forms/TimezoneSelect';
import { inputControlClassName, selectControlClassName } from '../../components/forms/controlClasses';
import { DateInput, TimeInput } from '../../components/forms/NativeTemporalInput';
import {
  DEFAULT_WORK_WEEK_WINDOWS,
  WEEKDAY_NAMES,
  blankAvailabilityWindow,
  describeWindowOverlap,
  findOverlappingWindowPairs,
} from '../../utils/availabilityWindows';

export default function AgentAvailability() {
  const [form, setForm] = useState({
    timezone: '',
    windows: DEFAULT_WORK_WEEK_WINDOWS.map((w) => ({ ...w })),
    blockedDates: [],
    effectiveFrom: '',
    effectiveTo: '',
    minNoticeMinutes: 60,
    bookingHorizonDays: 90,
    bufferMinutes: 15,
    active: true,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [conflictIndexes, setConflictIndexes] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    agentApi.getAvailability()
      .then((response) => {
        const value = response.data.availability;
        if (value) {
          const windows = Array.isArray(value.windows) && value.windows.length
            ? value.windows
            : DEFAULT_WORK_WEEK_WINDOWS.map((w) => ({ ...w }));
          setForm({
            ...value,
            timezone: value.timezone || '',
            windows,
            blockedDates: value.blockedDates || [],
            effectiveFrom: value.effectiveFrom?.slice(0, 10) || '',
            effectiveTo: value.effectiveTo?.slice(0, 10) || '',
          });
        }
        // No saved record: keep Mon–Fri defaults (not a silent rewrite of user data).
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const updateWindow = (index, patch) => {
    setConflictIndexes(new Set());
    setForm({ ...form, windows: form.windows.map((window, i) => (i === index ? { ...window, ...patch } : window)) });
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.timezone?.trim()) {
      setError('A valid IANA timezone is required. No silent default is applied.');
      setConflictIndexes(new Set());
      return;
    }
    const overlaps = findOverlappingWindowPairs(form.windows);
    if (overlaps.length) {
      const first = overlaps[0];
      setError(describeWindowOverlap(first));
      setConflictIndexes(new Set(overlaps.flatMap((p) => [p.i, p.j])));
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    setConflictIndexes(new Set());
    try {
      const response = await agentApi.saveAvailability(form);
      const value = response.data.availability;
      setForm({
        ...value,
        timezone: value.timezone || '',
        windows: value.windows || [],
        effectiveFrom: value.effectiveFrom?.slice(0, 10) || '',
        effectiveTo: value.effectiveTo?.slice(0, 10) || '',
      });
      setMessage('Availability saved. No external calendar was connected.');
    } catch (e) {
      setError(e.response?.data?.error || 'Availability could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 min-w-0 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Availability</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
          Set bounded working windows in an explicit IANA timezone. There is no silent Asia/Karachi default. DST follows the named zone. Same-day split windows are allowed; overlapping intervals are rejected.
        </p>
      </div>
      {error ? <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
      {message ? <p className="rounded-lg bg-green-50 dark:bg-green-950/40 p-3 text-green-700 dark:text-green-200" role="status">{message}</p> : null}
      <form onSubmit={save} className="space-y-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 min-w-0">
        <label className="block text-sm font-medium text-gray-900 dark:text-white">
          IANA timezone
          <div className="mt-1">
            <TimezoneSelect required value={form.timezone} onChange={(timezone) => setForm({ ...form, timezone })} />
          </div>
        </label>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium text-gray-900 dark:text-white">Weekly windows</h2>
            <button
              type="button"
              onClick={() => setForm({ ...form, windows: [...form.windows, blankAvailabilityWindow()] })}
              className="text-sm text-primary hover:underline min-h-[44px]"
            >
              Add window
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
            {hydrated
              ? 'Multiple windows on one weekday are allowed when they do not overlap.'
              : 'Loading saved availability…'}
          </p>
          <div className="mt-3 space-y-3">
            {form.windows.map((window, index) => {
              const conflicting = conflictIndexes.has(index);
              const dayName = WEEKDAY_NAMES[Number(window.weekday)] || `Day ${window.weekday}`;
              return (
                <div
                  key={index}
                  className={`grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] ${
                    conflicting ? 'rounded-lg ring-2 ring-red-500 p-2' : ''
                  }`}
                  aria-invalid={conflicting || undefined}
                >
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 min-w-0">
                    Day
                    <select
                      aria-label={`Window ${index + 1} day`}
                      value={window.weekday}
                      onChange={(e) => updateWindow(index, { weekday: Number(e.target.value) })}
                      className={`${selectControlClassName()} mt-1`}
                    >
                      {WEEKDAY_NAMES.map((day, value) => (
                        <option key={day} value={value}>{day}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 min-w-0">
                    Start
                    <TimeInput
                      aria-label={`Window ${index + 1} start time`}
                      value={window.startLocal}
                      onChange={(e) => updateWindow(index, { startLocal: e.target.value })}
                      className={`${inputControlClassName()} mt-1`}
                    />
                  </label>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 min-w-0">
                    End
                    <TimeInput
                      aria-label={`Window ${index + 1} end time`}
                      value={window.endLocal}
                      onChange={(e) => updateWindow(index, { endLocal: e.target.value })}
                      className={`${inputControlClassName()} mt-1`}
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      aria-label={`Remove ${dayName} window ${index + 1}`}
                      onClick={() => {
                        setConflictIndexes(new Set());
                        setForm({ ...form, windows: form.windows.filter((_, i) => i !== index) });
                      }}
                      className="min-h-[44px] px-3 text-red-700 dark:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-900 dark:text-white">
          Unavailable dates (comma-separated YYYY-MM-DD)
          <input
            value={(form.blockedDates || []).join(', ')}
            onChange={(e) => setForm({ ...form, blockedDates: e.target.value.split(',').map((value) => value.trim()).filter(Boolean) })}
            className={`${inputControlClassName()} mt-1`}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            Effective from
            <DateInput value={form.effectiveFrom || ''} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className={`${inputControlClassName()} mt-1`} />
          </label>
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            Effective to
            <DateInput value={form.effectiveTo || ''} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className={`${inputControlClassName()} mt-1`} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            Minimum notice (minutes)
            <input type="number" min="0" max="10080" value={form.minNoticeMinutes} onChange={(e) => setForm({ ...form, minNoticeMinutes: Number(e.target.value) })} className={`${inputControlClassName()} mt-1`} />
          </label>
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            Booking horizon (days)
            <input type="number" min="1" max="365" value={form.bookingHorizonDays} onChange={(e) => setForm({ ...form, bookingHorizonDays: Number(e.target.value) })} className={`${inputControlClassName()} mt-1`} />
          </label>
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            Buffer (minutes)
            <input type="number" min="0" max="240" value={form.bufferMinutes} onChange={(e) => setForm({ ...form, bufferMinutes: Number(e.target.value) })} className={`${inputControlClassName()} mt-1`} />
          </label>
        </div>

        <label className="flex gap-2 text-sm text-gray-900 dark:text-white">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600" />
          Accept new booking requests
        </label>

        <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50 min-h-[44px]">{busy ? 'Saving…' : 'Save availability'}</button>
        <p className="text-xs text-slate-500 dark:text-gray-400">Calendar integrations and automated reminders are not enabled. This saves availability rules only.</p>
      </form>
    </div>
  );
}
