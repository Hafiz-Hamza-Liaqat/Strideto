import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, collectionPageSchema, itemListSchema, combineSchemas } from '../../seo/schemas';
import { ROUTES } from '../../constants';
import { seoApi } from '../../services/listingsService';
import { HomeScholarshipCard } from '../../components/listings/HomeListingCard';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { useStudentProductEnabled } from '../../hooks/useStudentProductEnabled';
import { scholarshipsApi, savedApi } from '../../services/listingsService';

export default function SEOScholarshipsPage() {
  const { t } = useTranslation(['scholarships', 'navbar']);
  const { country } = useParams();
  const { studentProductEnabled } = useStudentProductEnabled();
  const [meta, setMeta] = useState(null);
  const [scholarships, setScholarships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());

  useEffect(() => {
    if (!country) return;
    seoApi.scholarshipsIn(country)
      .then(({ data }) => {
        setMeta(data.meta);
        setScholarships(data.data || []);
      })
      .catch(() => setMeta({ title: t('scholarships:seoTitle'), description: t('scholarships:subtitle') }))
      .finally(() => setLoading(false));
  }, [country, t]);

  useEffect(() => {
    if (!studentProductEnabled) return;
    savedApi.get().then(({ data }) => setSavedIds(new Set((data.savedScholarships || []).map((s) => s._id)))).catch(() => {});
  }, [studentProductEnabled]);

  const handleSave = async (id, save) => {
    if (save) await scholarshipsApi.save(id);
    else await scholarshipsApi.unsave(id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (save) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const canonical = meta?.canonical || `/scholarships-in-${country}`;
  const pageTitle = meta?.title?.split('|')[0]?.trim() || `${t('scholarships:title')} ${country}`;
  const description = meta?.description || t('scholarships:subtitle');

  return (
    <>
      <SeoHead
        title={meta?.title || pageTitle}
        description={description}
        canonical={canonical}
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('navbar:home'), url: ROUTES.HOME },
            { name: t('scholarships:title'), url: ROUTES.SCHOLARSHIPS },
            { name: pageTitle, url: canonical },
          ]),
          collectionPageSchema({ name: pageTitle, description, url: canonical }),
          scholarships.length > 0 && itemListSchema({
            name: pageTitle,
            description,
            items: scholarships,
            itemType: 'Scholarship',
          })
        )}
      />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            {pageTitle}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{description}</p>
          <Link to={ROUTES.SCHOLARSHIPS} className="text-primary dark:text-mint hover:underline text-sm mt-2 inline-block">{t('scholarships:allScholarships')}</Link>
        </div>
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <ListingCardSkeleton key={i} />)}
          </div>
        ) : scholarships.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scholarships.map((item) => (
              <HomeScholarshipCard key={item._id} item={item} saved={savedIds.has(item._id)} onSaveToggle={handleSave} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            {t('scholarships:noScholarshipsFound')}{' '}
            <Link to={ROUTES.SCHOLARSHIPS} className="text-primary dark:text-mint">{t('scholarships:browseAllScholarships')}</Link>
          </p>
        )}
      </div>
    </>
  );
}
