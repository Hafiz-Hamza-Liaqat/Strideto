import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, combineSchemas } from '../../seo/schemas';
import { institutionsApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { Alert } from '../../components/ui/Alerts';
import { formatLocationDisplay } from '@shared/international/location.js';

export default function InstitutionDetail() {
  const { slug } = useParams();
  const { t } = useTranslation(['static', 'common', 'navbar']);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    institutionsApi.get(slug)
      .then(({ data }) => setItem(data))
      .catch((err) => setError(err.response?.data?.error || t('common:failedToLoad')))
      .finally(() => setLoading(false));
  }, [slug, t]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><ListingCardSkeleton /></div>;
  if (error || !item) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert variant="error">{error || t('static:schoolsNotFound')}</Alert>
        <Link to={ROUTES.SCHOOLS_AND_COLLEGES} className="text-primary dark:text-mint mt-4 inline-block">{t('static:schoolsBack')}</Link>
      </div>
    );
  }

  const canonical = `${ROUTES.SCHOOLS_AND_COLLEGES}/${item.slug}`;

  return (
    <>
      <SeoHead
        title={item.seoTitle || item.name}
        description={item.metaDescription || item.description}
        canonical={canonical}
        jsonLd={combineSchemas(breadcrumbSchema([
          { name: t('navbar:home'), url: ROUTES.HOME },
          { name: t('static:schoolsHeading'), url: ROUTES.SCHOOLS_AND_COLLEGES },
          { name: item.name, url: canonical },
        ]))}
      />
      <article className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-4 items-start mb-6">
          {item.logoUrl && <img src={item.logoUrl} alt="" className="h-20 w-20 object-contain rounded-lg border border-gray-200 dark:border-gray-700" />}
          <div>
            <p className="text-sm uppercase text-gray-500">{item.type?.replace(/_/g, ' ')}</p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{item.name}</h1>
            {(item.city || item.province || item.country || item.address) && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {[item.address, formatLocationDisplay(item)].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {item.imageUrl && <img src={item.imageUrl} alt="" className="w-full max-h-72 object-cover rounded-xl mb-6" />}
        {item.description && <p className="text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-wrap">{item.description}</p>}

        {item.programs?.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-2">{t('static:schoolsPrograms')}</h2>
            <ul className="list-disc pl-5 space-y-1">{item.programs.map((p) => <li key={p}>{p}</li>)}</ul>
          </section>
        )}
        {item.facilities?.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-2">{t('static:schoolsFacilities')}</h2>
            <ul className="list-disc pl-5 space-y-1">{item.facilities.map((f) => <li key={f}>{f}</li>)}</ul>
          </section>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
          {item.phone && <span>{t('static:schoolsPhone')}: {item.phone}</span>}
          {item.email && <a href={`mailto:${item.email}`} className="text-primary dark:text-mint">{item.email}</a>}
          {item.website && <a href={item.website} target="_blank" rel="noopener noreferrer" className="text-primary dark:text-mint">{t('static:schoolsWebsite')}</a>}
        </div>

        {(item.related || []).length > 0 && (
          <section className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold mb-3">{t('static:schoolsRelated')}</h2>
            <ul className="space-y-2">
              {item.related.map((r) => (
                <li key={r._id}><Link to={`${ROUTES.SCHOOLS_AND_COLLEGES}/${r.slug}`} className="text-primary dark:text-mint hover:underline">{r.name}</Link></li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </>
  );
}
