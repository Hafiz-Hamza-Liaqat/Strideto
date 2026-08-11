import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, collectionPageSchema, combineSchemas } from '../../seo/schemas';
import { scholarshipsApi, savedApi, recommendationsApi } from '../../services/listingsService';
import { trackSearchQuery } from '../../utils/platformAnalytics';
import { useListings } from '../../hooks/useListings';
import { ROUTES } from '../../constants';
import { SCHOLARSHIP_LEVELS, SCHOLARSHIP_COUNTRIES, SORT_OPTIONS } from '../../constants/listings';
import { SearchBar } from '../../components/ui/SearchBar';
import { Pagination } from '../../components/ui/Pagination';
import { SaveButton } from '../../components/listings/SaveButton';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { Alert } from '../../components/ui/Alerts';
import { formatDate } from '../../utils/formatDate';
import { useAuth } from '../../context/AuthContext';
import { AdHost } from '../../components/ads';
import { EmptyState } from '../../components/common/EmptyState';
import { OfficialScholarshipsRail } from '../../components/public/OfficialDiscoveryRail';
import { PublicTrustBadge } from '../../components/public/PublicTrustBadge';
import { NO_GUARANTEE_DISCLAIMER } from '@shared/publicDiscovery/publicTruth.js';

const PER_PAGE = 10;

const SCHOLARSHIP_SORT_KEYS = {
  newest: 'sortNewest',
  deadline: 'sortDeadline',
};

export default function Scholarships() {
  const { t } = useTranslation(['scholarships', 'common', 'navbar']);
  const { isAuthenticated } = useAuth();
  const [savedIds, setSavedIds] = useState(new Set());
  const [recommendedScholarships, setRecommendedScholarships] = useState([]);
  const { data, total, totalPages, loading, error, params, setPage, setFilters } = useListings(scholarshipsApi.list, { limit: PER_PAGE, sort: 'newest' });

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    Promise.all([
      savedApi.get(),
      recommendationsApi.get(),
    ])
      .then(([savedRes, recRes]) => {
        if (cancelled) return;
        setSavedIds(new Set((savedRes.data.savedScholarships || []).map((s) => s._id)));
        setRecommendedScholarships(recRes.data.scholarships || []);
      })
      .catch(() => {
        if (!cancelled) setRecommendedScholarships([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const handleSearch = (q) => {
    if (q && q.trim()) trackSearchQuery(q);
    setFilters({ search: q || undefined });
  };
  const handleSaveToggle = async (id, save) => {
    if (save) await scholarshipsApi.save(id);
    else await scholarshipsApi.unsave(id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (save) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const seoTitle = t('seoTitle', { ns: 'scholarships' });
  const seoDescription = t('seoDescription', { ns: 'scholarships' });

  return (
    <>
      <SeoHead
        title={seoTitle}
        description={seoDescription}
        canonical={ROUTES.SCHOLARSHIPS}
        keywords={t('seoKeywords', { ns: 'scholarships' })}
        ogType="website"
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('home', { ns: 'navbar' }), url: ROUTES.HOME },
            { name: t('scholarships', { ns: 'navbar' }), url: ROUTES.SCHOLARSHIPS },
          ]),
          collectionPageSchema({
            name: seoTitle,
            description: seoDescription,
            url: ROUTES.SCHOLARSHIPS,
          })
        )}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        <AdHost placementId="scholarships-header" className="mb-4" />
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('title', { ns: 'scholarships' })}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{t('subtitle', { ns: 'scholarships' })}</p>
        <OfficialScholarshipsRail />

        {isAuthenticated && recommendedScholarships.length > 0 && (
          <section className="mb-8 p-4 rounded-xl border border-primary/30 dark:border-mint/30 bg-mint/20 dark:bg-mint/10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('recommended', { ns: 'scholarships' })}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recommendedScholarships.slice(0, 3).map((item) => (
                <Link key={item._id} to={`${ROUTES.SCHOLARSHIPS}/${item.slug || item._id}`} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md">
                  <span className="font-medium text-gray-900 dark:text-white">{item.title}</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{item.provider}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 w-full min-w-0">
            <SearchBar placeholder={t('searchPlaceholder', { ns: 'scholarships' })} onSearch={handleSearch} className="w-full max-w-xl" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">{t('sortLabel', { ns: 'scholarships' })}:</label>
            <select value={params.sort || 'newest'} onChange={(e) => setFilters({ sort: e.target.value })} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm">
              {SORT_OPTIONS.scholarships.map((o) => <option key={o.value} value={o.value}>{t(SCHOLARSHIP_SORT_KEYS[o.value], { ns: 'scholarships' })}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <aside className="w-full md:w-56 flex-shrink-0 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('levelLabel', { ns: 'scholarships' })}</label>
              <select value={params.level || ''} onChange={(e) => setFilters({ level: e.target.value || undefined })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm">
                <option value="">{t('all', { ns: 'common' })}</option>
                {SCHOLARSHIP_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('countryLabel', { ns: 'scholarships' })}</label>
              <select value={params.country || ''} onChange={(e) => setFilters({ country: e.target.value || undefined })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm">
                <option value="">{t('all', { ns: 'common' })}</option>
                {SCHOLARSHIP_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('deadlineAfter', { ns: 'scholarships' })}</label>
              <input type="date" value={params.deadline || ''} onChange={(e) => setFilters({ deadline: e.target.value || undefined })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm" />
            </div>
            <AdHost placementId="scholarships-sidebar" variant="sidebar" />
          </aside>

          <div className="flex-1 min-w-0">
            {error && <Alert variant="error" className="mb-4">{error}</Alert>}
            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <ListingCardSkeleton key={i} />)}
              </div>
            ) : data.length === 0 ? (
              <EmptyState
                icon="🎓"
                title="Find scholarships"
                description="Discover scholarships that match your education and interests."
                actionLabel="Find Scholarships"
                actionTo={ROUTES.SCHOLARSHIPS}
              />
            ) : (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('scholarshipsFound', { count: total, ns: 'scholarships' })}</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {data.map((s) => (
                    <article key={s._id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow flex flex-col">
                      <Link to={`${ROUTES.SCHOLARSHIPS}/${s.slug || s._id}`} className="flex-1 block">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white break-words-safe">{s.title}</h2>
                        <p className="text-gray-600 dark:text-gray-400 break-words-safe">{s.provider}</p>
                        <div className="mt-1"><PublicTrustBadge kind={s.authorityKind} label={s.authorityLabel} /></div>
                        <p className="text-sm text-gray-500">{[s.level, s.country].filter(Boolean).join(' · ')}</p>
                        {s.amount && <p className="text-sm text-primary dark:text-mint mt-1">{s.amount}</p>}
                        {s.deadline && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t('deadline', { ns: 'common' })}: {formatDate(s.deadline)}</p>}
                      </Link>
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <SaveButton type="scholarship" id={s._id} saved={savedIds.has(s._id)} onToggle={handleSaveToggle} />
                      </div>
                    </article>
                  ))}
                </div>
                {totalPages > 1 && <Pagination currentPage={params.page} totalPages={totalPages} onPageChange={setPage} />}
              </>
            )}
          </div>
        </div>
        <p className="mt-8 text-xs text-gray-500 dark:text-gray-400">{NO_GUARANTEE_DISCLAIMER}</p>
      </div>
    </>
  );
}
