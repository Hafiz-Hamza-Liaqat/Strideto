import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listActions, createAction, updateActionStatus, deleteAction } from '../../services/actionEngineService';

const STATUS_OPTS = ['todo', 'in_progress', 'completed', 'dismissed'];
const TYPE_OPTS = ['profile_completion', 'test', 'document', 'application', 'deadline', 'program', 'scholarship', 'general'];

function ActionRow({ action, onStatusChange, onDelete }) {
  const { t } = useTranslation('common');
  return (
    <li className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{action.title}</p>
        {action.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{action.description}</p>}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{action.actionType}</span>
          {action.dueAt && <span className="text-xs text-gray-400">{t('journey.due', 'Due')}: {new Date(action.dueAt).toLocaleDateString()}</span>}
          <span className="text-xs text-gray-400">{action.source === 'system' ? '(system)' : '(you)'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <select
          value={action.status}
          onChange={(e) => onStatusChange(action._id, e.target.value)}
          className="text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1 py-0.5"
        >
          {STATUS_OPTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <button
          onClick={() => onDelete(action._id)}
          className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          aria-label={t('delete')}
        >
          ✕
        </button>
      </div>
    </li>
  );
}

export default function TasksPage() {
  const { t } = useTranslation('common');
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', actionType: 'general', dueAt: '' });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    const params = {};
    if (filterStatus) params.status = filterStatus;
    listActions(params)
      .then((r) => setActions(r.items || []))
      .catch(() => setError(t('journey.loadError', 'Could not load tasks.')))
      .finally(() => setLoading(false));
  }

  useEffect(load, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStatusChange(id, status) {
    try {
      const updated = await updateActionStatus(id, status);
      setActions((prev) => prev.map((a) => (a._id === id ? updated : a)));
    } catch {
      // silent
    }
  }

  async function handleDelete(id) {
    try {
      await deleteAction(id);
      setActions((prev) => prev.filter((a) => a._id !== id));
    } catch {
      // silent
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await createAction({ ...form, dueAt: form.dueAt || undefined });
      setActions((prev) => [created, ...prev]);
      setForm({ title: '', description: '', actionType: 'general', dueAt: '' });
      setShowForm(false);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('journey.tasks', 'Tasks')}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          {showForm ? t('cancel', 'Cancel') : t('journey.addTask', '+ Add Task')}
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
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('description', 'Description')}</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('journey.type', 'Type')}</label>
              <select value={form.actionType} onChange={(e) => setForm((f) => ({ ...f, actionType: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              >
                {TYPE_OPTS.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('journey.dueDate', 'Due date')}</label>
              <input type="date" value={form.dueAt} onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t('saving', 'Saving…') : t('journey.saveTask', 'Save Task')}
          </button>
        </form>
      )}

      <div className="mb-4 flex gap-2 flex-wrap">
        {['', ...STATUS_OPTS].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1 rounded-full border ${filterStatus === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      {loading && <div className="animate-pulse text-gray-400 text-sm">{t('loading')}</div>}
      {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

      {!loading && !error && actions.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="font-medium">{t('journey.noTasks', 'No tasks yet')}</p>
          <p className="text-sm mt-1">{t('journey.noTasksHint', 'Add a task to track your progress.')}</p>
        </div>
      )}

      {!loading && !error && (
        <ul className="space-y-2">
          {actions.map((a) => (
            <ActionRow key={a._id} action={a} onStatusChange={handleStatusChange} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </div>
  );
}
