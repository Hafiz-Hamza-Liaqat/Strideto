import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listEduApplications,
  createEduApplication,
  updateEduApplicationStatus,
  deleteEduApplication,
} from '../../services/actionEngineService';

const STATUSES = [
  'interested', 'preparing', 'ready_to_apply', 'submitted',
  'under_review', 'interview_or_assessment', 'offer_or_admitted',
  'rejected', 'withdrawn', 'completed',
];

const TARGET_TYPES = ['program', 'canonical_scholarship', 'other'];

const STATUS_COLORS = {
  interested: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  preparing: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  ready_to_apply: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  submitted: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  under_review: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  interview_or_assessment: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  offer_or_admitted: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  rejected: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  withdrawn: 'bg-gray-100 dark:bg-gray-700 text-gray-500',
  completed: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
};

function ApplicationCard({ app, onStatusChange, onDelete }) {
  const { t } = useTranslation('common');
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{app.targetTitle || app.targetType}</p>
          {app.targetInstitution && <p className="text-xs text-gray-500 dark:text-gray-400">{app.targetInstitution}</p>}
          {app.targetCountry && <p className="text-xs text-gray-400">{app.targetCountry}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[app.status] || ''}`}>
            {app.status.replace(/_/g, ' ')}
          </span>
          <button onClick={() => onDelete(app._id)} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400">✕</button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-400">Mode: {app.mode}</span>
        {app.startedAt && <span className="text-xs text-gray-400">Started: {new Date(app.startedAt).toLocaleDateString()}</span>}
        {app.submittedAt && <span className="text-xs text-gray-400">Submitted: {new Date(app.submittedAt).toLocaleDateString()}</span>}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-600 dark:text-gray-400">{t('journey.updateStatus', 'Update status:')}</label>
        <select
          value={app.status}
          onChange={(e) => onStatusChange(app._id, e.target.value)}
          className="text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1 py-0.5"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {app.history && app.history.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            {showHistory ? t('journey.hideHistory', 'Hide history') : t('journey.showHistory', 'Show history')} ({app.history.length})
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1">
              {app.history.map((h, i) => (
                <li key={i} className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <span>{new Date(h.changedAt).toLocaleDateString()}</span>
                  <span>{h.fromStatus ? `${h.fromStatus.replace(/_/g, ' ')} →` : 'Started →'} {h.toStatus.replace(/_/g, ' ')}</span>
                  {h.note && <span className="italic">"{h.note}"</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 italic">
        {t('journey.selfManagedNote', 'Strideto tracks your application status. Submission is handled directly with the institution.')}
      </p>
    </div>
  );
}

export default function ApplicationsPage() {
  const { t } = useTranslation('common');
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ targetType: 'program', targetTitle: '', targetInstitution: '', targetCountry: '', notes: '' });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    listEduApplications({ limit: 50 })
      .then((r) => setApps(r.items || []))
      .catch(() => setError(t('journey.loadError', 'Could not load applications.')))
      .finally(() => setLoading(false));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await createEduApplication({ ...form, targetId: '000000000000000000000000' }); // placeholder ID — real flow links to entity
      setApps((prev) => [created, ...prev]);
      setForm({ targetType: 'program', targetTitle: '', targetInstitution: '', targetCountry: '', notes: '' });
      setShowForm(false);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id, status) {
    try {
      const updated = await updateEduApplicationStatus(id, status);
      setApps((prev) => prev.map((a) => (a._id === id ? updated : a)));
    } catch {
      // silent
    }
  }

  async function handleDelete(id) {
    try {
      await deleteEduApplication(id);
      setApps((prev) => prev.filter((a) => a._id !== id));
    } catch {
      // silent
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('journey.applications', 'My Applications')}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('journey.applicationsSubtitle', 'Track your education and scholarship applications.')}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          {showForm ? t('cancel', 'Cancel') : t('journey.trackApplication', '+ Track Application')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('journey.targetType', 'Type')} *</label>
              <select value={form.targetType} onChange={(e) => setForm((f) => ({ ...f, targetType: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              >
                {TARGET_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('journey.programName', 'Program / Scholarship name')} *</label>
              <input required value={form.targetTitle} onChange={(e) => setForm((f) => ({ ...f, targetTitle: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('journey.institution', 'Institution')}</label>
              <input value={form.targetInstitution} onChange={(e) => setForm((f) => ({ ...f, targetInstitution: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('journey.country', 'Country (ISO code)')}</label>
              <input maxLength={2} value={form.targetCountry} onChange={(e) => setForm((f) => ({ ...f, targetCountry: e.target.value.toUpperCase() }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('notes', 'Notes')}</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? t('saving', 'Saving…') : t('journey.startTracking', 'Start Tracking')}
          </button>
        </form>
      )}

      {loading && <div className="animate-pulse text-gray-400 text-sm">{t('loading')}</div>}
      {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

      {!loading && !error && apps.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="font-medium">{t('journey.noApplications', 'No applications tracked yet')}</p>
          <p className="text-sm mt-1">{t('journey.noApplicationsHint', 'Start tracking an application to monitor your progress.')}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {apps.map((app) => (
            <ApplicationCard key={app._id} app={app} onStatusChange={handleStatusChange} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
