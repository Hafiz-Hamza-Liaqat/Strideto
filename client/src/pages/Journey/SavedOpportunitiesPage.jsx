import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listSaved, unsaveOpportunity } from '../../services/actionEngineService';

const TYPE_LABELS = {
  program: 'Program',
  canonical_scholarship: 'Scholarship',
};

export default function SavedOpportunitiesPage() {
  const { t } = useTranslation('common');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  function load() {
    setLoading(true);
    const params = {};
    if (filter) params.entityType = filter;
    listSaved(params)
      .then((r) => setItems(r.items || []))
      .catch(() => setError(t('journey.loadError', 'Could not load saved opportunities.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { void load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUnsave(entityType, entityId) {
    try {
      await unsaveOpportunity(entityType, entityId);
      setItems((prev) => prev.filter((i) => !(String(i.entityId) === String(entityId) && i.entityType === entityType)));
    } catch {
      // silent
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('journey.savedOpportunities', 'Saved Opportunities')}</h1>
      </div>

      <div className="mb-4 flex gap-2">
        {['', 'program', 'canonical_scholarship'].map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`text-xs px-3 py-1 rounded-full border ${filter === type ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            {type ? TYPE_LABELS[type] || type : 'All'}
          </button>
        ))}
      </div>

      {loading && <div className="animate-pulse text-gray-400 text-sm">{t('loading')}</div>}
      {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="font-medium">{t('journey.nothingSaved', 'Nothing saved yet')}</p>
          <p className="text-sm mt-1">{t('journey.nothingSavedHint', 'Save programs and scholarships you are interested in to track them here.')}</p>
        </div>
      )}

      {!loading && !error && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item._id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
              <div>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 mr-2">
                  {TYPE_LABELS[item.entityType] || item.entityType}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300 font-mono text-xs">{item.entityId}</span>
                {item.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.notes}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{t('journey.savedOn', 'Saved')}: {new Date(item.createdAt).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => handleUnsave(item.entityType, item.entityId)}
                className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 shrink-0 ml-3"
              >
                {t('journey.unsave', 'Remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
