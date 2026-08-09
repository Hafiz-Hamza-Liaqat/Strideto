import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listDeadlines, createDeadline, deleteDeadline } from '../../services/actionEngineService';

const URGENCY_STYLES = {
  overdue: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10',
  urgent: 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/10',
  soon: 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/10',
  upcoming: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10',
  unknown: 'border-gray-200 dark:border-gray-700',
  none: 'border-gray-200 dark:border-gray-700',
};

const URGENCY_BADGE = {
  overdue: 'text-red-700 dark:text-red-400',
  urgent: 'text-orange-700 dark:text-orange-400',
  soon: 'text-yellow-700 dark:text-yellow-400',
  upcoming: 'text-blue-700 dark:text-blue-400',
  unknown: 'text-gray-500',
  none: 'text-gray-400',
};

export default function CalendarPage() {
  const { t } = useTranslation('common');
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', deadlineAt: '', isDateOnly: true, notes: '' });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    listDeadlines({ limit: 50 })
      .then((r) => setDeadlines(r.items || []))
      .catch(() => setError(t('journey.loadError', 'Could not load deadlines.')))
      .finally(() => setLoading(false));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await createDeadline({
        ...form,
        deadlineAt: form.deadlineAt ? new Date(form.deadlineAt).toISOString() : null,
        isDateOnly: form.isDateOnly,
        sourceType: 'user_created',
      });
      setDeadlines((prev) => [{ ...created, urgency: 'unknown' }, ...prev]);
      setForm({ title: '', deadlineAt: '', isDateOnly: true, notes: '' });
      setShowForm(false);
      load();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteDeadline(id);
      setDeadlines((prev) => prev.filter((d) => d._id !== id));
    } catch {
      // silent
    }
  }

  const sorted = [...deadlines].sort((a, b) => {
    if (!a.deadlineAt) return 1;
    if (!b.deadlineAt) return -1;
    return new Date(a.deadlineAt) - new Date(b.deadlineAt);
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('journey.deadlines', 'Deadlines & Calendar')}</h1>
        <button onClick={() => setShowForm(!showForm)} className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          {showForm ? t('cancel', 'Cancel') : t('journey.addDeadline', '+ Add Deadline')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('title', 'Title')} *</label>
            <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('journey.date', 'Date')}</label>
              <input type="date" value={form.deadlineAt} onChange={(e) => setForm((f) => ({ ...f, deadlineAt: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                <input type="checkbox" checked={form.isDateOnly} onChange={(e) => setForm((f) => ({ ...f, isDateOnly: e.target.checked }))} />
                {t('journey.dateOnly', 'Date only (no specific time)')}
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('notes', 'Notes')}</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? t('saving', 'Saving…') : t('save', 'Save')}
          </button>
        </form>
      )}

      {loading && <div className="animate-pulse text-gray-400 text-sm">{t('loading')}</div>}
      {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

      {!loading && !error && sorted.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="font-medium">{t('journey.noDeadlines', 'No deadlines tracked')}</p>
          <p className="text-sm mt-1">{t('journey.noDeadlinesHint', 'Add a deadline to stay on track.')}</p>
        </div>
      )}

      {!loading && !error && (
        <ul className="space-y-2">
          {sorted.map((d) => (
            <li key={d._id} className={`rounded-lg border px-4 py-3 ${URGENCY_STYLES[d.urgency] || URGENCY_STYLES.none}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{d.title}</p>
                  {d.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{d.notes}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {d.deadlineAt ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(d.deadlineAt).toLocaleDateString()}
                        {d.isDateOnly && ' (date only — time unspecified)'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">{t('journey.deadlineUnknown', 'Deadline unknown')}</span>
                    )}
                    {d.urgency && d.urgency !== 'none' && (
                      <span className={`text-xs font-medium uppercase ${URGENCY_BADGE[d.urgency]}`}>{d.urgency}</span>
                    )}
                    {d.isUserCreated && <span className="text-xs text-gray-400">(you)</span>}
                    {d.freshnessWarning && (
                      <span className="text-xs text-yellow-600 dark:text-yellow-400" title={d.freshnessWarning}>⚠ Source may be outdated</span>
                    )}
                  </div>
                </div>
                {d.isUserCreated && (
                  <button onClick={() => handleDelete(d._id)} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 shrink-0">✕</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
