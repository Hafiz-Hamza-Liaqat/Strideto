import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listSaved, unsaveOpportunity } from '../../services/actionEngineService';
import { savedApi, internshipsApi, jobsApi, scholarshipsApi } from '../../services/listingsService';
import { useStudentProductEnabled } from '../../hooks/useStudentProductEnabled';
import { ROUTES } from '../../constants';

const TYPE_LABELS = {
  program: 'Program',
  canonical_scholarship: 'Scholarship',
  job: 'Job',
  internship: 'Internship',
  scholarship: 'Scholarship',
};

function hrefFor(item) {
  if (item.href) return item.href;
  if (item.entityType === 'program') return `${ROUTES.PROGRAM_EXPLORER}/${item.slug || item.entityId}`;
  if (item.entityType === 'job') return `${ROUTES.JOBS}/${item.slug || item.entityId}`;
  if (item.entityType === 'internship') return `${ROUTES.INTERNSHIPS}/${item.slug || item.entityId}`;
  if (item.entityType === 'scholarship' || item.entityType === 'canonical_scholarship') {
    return `${ROUTES.SCHOLARSHIPS}/${item.slug || item.entityId}`;
  }
  return null;
}

export default function SavedOpportunitiesPage() {
  const { t } = useTranslation('common');
  const { studentProductEnabled } = useStudentProductEnabled();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  function load() {
    if (!studentProductEnabled) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const journeyParams = {};
    if (filter === 'program' || filter === 'canonical_scholarship') journeyParams.entityType = filter;
    Promise.all([
      listSaved(journeyParams).catch(() => ({ items: [] })),
      savedApi.get().catch(() => ({ data: {} })),
    ])
      .then(([journey, listingRes]) => {
        const listing = listingRes.data || {};
        const listingItems = [
          ...(listing.savedJobs || []).map((j) => ({
            _id: `job-${j._id}`,
            entityType: 'job',
            entityId: j._id,
            title: j.title,
            slug: j.slug,
            createdAt: j.savedAt || j.createdAt,
            source: 'listings',
          })),
          ...(listing.savedInternships || []).map((j) => ({
            _id: `internship-${j._id}`,
            entityType: 'internship',
            entityId: j._id,
            title: j.title,
            slug: j.slug,
            createdAt: j.savedAt || j.createdAt,
            source: 'listings',
          })),
          ...(listing.savedScholarships || []).map((j) => ({
            _id: `scholarship-${j._id}`,
            entityType: 'scholarship',
            entityId: j._id,
            title: j.title,
            slug: j.slug,
            createdAt: j.savedAt || j.createdAt,
            source: 'listings',
          })),
        ];
        const journeyItems = (journey.items || []).map((item) => ({ ...item, title: item.title || item.entityId, source: 'journey' }));
        let merged = [...journeyItems, ...listingItems];
        if (filter === 'job') merged = merged.filter((i) => i.entityType === 'job');
        if (filter === 'internship') merged = merged.filter((i) => i.entityType === 'internship');
        if (filter === 'program') merged = merged.filter((i) => i.entityType === 'program');
        if (filter === 'canonical_scholarship') {
          merged = merged.filter((i) => i.entityType === 'canonical_scholarship' || i.entityType === 'scholarship');
        }
        setItems(merged);
      })
      .catch(() => setError(t('journey.loadError', 'Could not load saved opportunities.')))
      .finally(() => setLoading(false));
  }

  useEffect(() => { void load(); }, [filter, studentProductEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUnsave(item) {
    try {
      if (item.source === 'listings') {
        if (item.entityType === 'job') await jobsApi.unsave(item.entityId);
        else if (item.entityType === 'internship') await internshipsApi.unsave(item.entityId);
        else if (item.entityType === 'scholarship') await scholarshipsApi.unsave(item.entityId);
      } else {
        await unsaveOpportunity(item.entityType, item.entityId);
      }
      setItems((prev) => prev.filter((i) => i._id !== item._id));
    } catch {
      // silent
    }
  }

  const tabs = [
    { id: '', label: 'All' },
    { id: 'job', label: 'Jobs' },
    { id: 'internship', label: 'Internships' },
    { id: 'program', label: 'Programs' },
    { id: 'canonical_scholarship', label: 'Scholarships' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('journey.savedOpportunities', 'Saved Opportunities')}</h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`text-xs px-3 py-2 min-h-[44px] rounded-full border ${filter === tab.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div className="animate-pulse text-gray-400 text-sm">{t('loading')}</div>}
      {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="font-medium">{t('journey.nothingSaved', 'Nothing saved yet')}</p>
          <p className="text-sm mt-1">{t('journey.nothingSavedHint', 'Save jobs, internships, programs, and scholarships to track them here.')}</p>
        </div>
      )}

      {!loading && !error && (
        <ul className="space-y-2">
          {items.map((item) => {
            const href = hrefFor(item);
            return (
              <li key={item._id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                <div className="min-w-0">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 mr-2">
                    {TYPE_LABELS[item.entityType] || item.entityType}
                  </span>
                  {href ? (
                    <Link to={href} className="text-sm text-primary dark:text-mint hover:underline break-words">
                      {item.title || item.entityId}
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item.title || item.entityId}</span>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{t('journey.savedOn', 'Saved')}: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnsave(item)}
                  className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 shrink-0 ml-3 min-h-[44px]"
                >
                  {t('journey.unsave', 'Remove')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
