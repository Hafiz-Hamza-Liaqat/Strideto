import { useEffect, useState } from 'react';
import { agentApi } from '../../services/agentService';
import { TimezoneSelect } from '../../components/forms/TimezoneSelect';
import { inputControlClassName, selectControlClassName } from '../../components/forms/controlClasses';
import { DateInput, TimeInput } from '../../components/forms/NativeTemporalInput';

const blankWindow = { weekday: 1, startLocal: '09:00', endLocal: '17:00' };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AgentAvailability() {
  const [form, setForm] = useState({
    timezone: '',
    windows: [blankWindow],
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    agentApi.getAvailability()
      .then((response) => {
        const value = response.data.availability;
        if (value) {
          setForm({
            ...value,
            timezone: value.timezone || '',
            blockedDates: value.blockedDates || [],
            effectiveFrom: value.effectiveFrom?.slice(0, 10) || '',
            effectiveTo: value.effectiveTo?.slice(0, 10) || '',
          });
        }
      })
      .catch(() => {});
  }, []);

  const updateWindow = (index, patch) =>
    setForm({ ...form, windows: form.windows.map((window, i) => (i === index ? { ...window, ...patch } : window)) });

  const save = async (event) => {
    event.preventDefault();
    if (!form.timezone?.trim()) {
      setError('A valid IANA timezone is required. No silent default is applied.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await agentApi.saveAvailability(form);
      const value = response.data.availability;
      setForm({
        ...value,
        timezone: value.timezone || '',
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Availability</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
          Set bounded working windows in an explicit IANA timezone. There is no silent Asia/Karachi default. DST follows the named zone. Double booking is rejected server-side.
        </p>
      </div>
      {error ? <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
      {message ? <p className="rounded-lg bg-green-50 dark:bg-green-950/40 p-3 text-green-700 dark:text-green-200">{message}</p> : null}
      <form onSubmit={save} className="space-y-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <label className="block text-sm font-medium text-gray-900 dark:text-white">
          IANA timezone
          <div className="mt-1">
            <TimezoneSelect required value={form.timezone} onChange={(timezone) => setForm({ ...form, timezone })} />
          </div>
        </label>

        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-900 dark:text-white">Weekly windows</h2>
            <button type="button" onClick={() => setForm({ ...form, windows: [...form.windows, { ...blankWindow }] })} className="text-sm text-primary hover:underline">
              Add window
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {form.windows.map((window, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <select value={window.weekday} onChange={(e) => updateWindow(index, { weekday: Number(e.target.value) })} className={selectControlClassName()}>
                  {WEEKDAYS.map((day, value) => (
                    <option key={day} value={value}>{day}</option>
                  ))}
                </select>
                <TimeInput value={window.startLocal} onChange={(e) => updateWindow(index, { startLocal: e.target.value })} className={inputControlClassName()} />
                <TimeInput value={window.endLocal} onChange={(e) => updateWindow(index, { endLocal: e.target.value })} className={inputControlClassName()} />
                <button type="button" onClick={() => setForm({ ...form, windows: form.windows.filter((_, i) => i !== index) })} className="px-2 text-red-700 dark:text-red-400">Remove</button>
              </div>
            ))}
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
