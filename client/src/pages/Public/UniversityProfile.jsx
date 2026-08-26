import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, combineSchemas, educationalOrganizationSchema } from '../../seo/schemas';
import { publicProfilesApi } from '../../services/publicProfilesService';
import { ROUTES } from '../../constants';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { Alert } from '../../components/ui/Alerts';
import { formatLocationDisplay } from '@shared/international/location.js';

export default function UniversityProfile() {
  const { slug } = useParams();
  const { t } = useTranslation(['profiles', 'common', 'admissions', 'scholarships']);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    publicProfilesApi.university(slug)
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(err.response?.data?.error || t('common:failedToLoad')))
      .finally(() => setLoading(false));
  }, [slug, t]);

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-8"><ListingCardSkeleton /></div>;
  if (error || !data?.university) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Alert variant="error">{error || t('profiles:universityNotFound')}</Alert>
        <Link to={ROUTES.ADMISSIONS} className="text-primary dark:text-mint mt-4 inline-block">{t('admissions:backToAdmissions')}</Link>
      </div>
    );
  }

  const { university, admissions, scholarships, foreignStudies } = data;
  const canonical = `${ROUTES.UNIVERSITY}/${university.slug}`;

  return (
    <>
      <SeoHead
        title={t('profiles:universitySeoTitle', { name: university.name })}
        description={university.description || t('profiles:universitySeoDescription', { name: university.name })}
        canonical={canonical}
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('profiles:breadcrumbHome'), url: ROUTES.HOME },
            { name: t('profiles:breadcrumbUniversities'), url: ROUTES.ADMISSIONS },
            { name: university.name, url: canonical },
          ]),
          educationalOrganizationSchema({
            name: university.name,
            description: university.description,
            url: university.website || canonical,
          })
        )}
      />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{university.name}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-1">
          {formatLocationDisplay(university) || [university.city, university.province, university.country].filter(Boolean).join(', ')}
        </p>
        {university.ranking && (
          <p className="text-sm text-primary dark:text-mint mb-4">{t('profiles:ranking', { rank: university.ranking })}</p>
        )}
        {university.website && (
          <a href={university.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary dark:text-mint hover:underline">
            {t('profiles:visitWebsite')}
          </a>
        )}

        {university.programs?.length > 0 && (
          <section className="mt-8 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('profiles:programs')}</h2>
            <ul className="space-y-2">
              {university.programs.map((p, i) => (
                <li key={i} className="text-sm text-gray-600 dark:text-gray-300">
                  {[p.name, p.degree, p.duration].filter(Boolean).join(' · ')}
                </li>
              ))}
            </ul>
          </section>
        )}

        {university.gallery?.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('profiles:gallery')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {university.gallery.map((url) => (
                <img key={url} src={url} alt="" className="rounded-lg object-cover h-32 w-full" loading="lazy" />
              ))}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('profiles:studentReviews')}</h2>
          <p className="text-gray-500 text-sm">{university.reviewSummary || t('profiles:reviewsPlaceholder')}</p>
        </section>

        {university.description && (
          <section className="mt-8 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('profiles:overview')}</h2>
            <p className="text-gray-600 dark:text-gray-300">{university.description}</p>
          </section>
        )}

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('profiles:admissions')}</h2>
          {admissions?.length ? (
            <ul className="space-y-3">
              {admissions.map((a) => (
                <li key={a._id}>
                  <Link to={`${ROUTES.ADMISSIONS}/${a.slug}`} className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary transition-colors">
                    <span className="font-medium text-gray-900 dark:text-white">{a.program}</span>
                    <span className="text-sm text-gray-500 block">{a.session}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">{t('profiles:noAdmissions')}</p>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('profiles:scholarships')}</h2>
          {scholarships?.length ? (
            <ul className="space-y-3">
              {scholarships.map((s) => (
                <li key={s._id}>
                  <Link to={`${ROUTES.SCHOLARSHIPS}/${s.slug}`} className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary transition-colors">
                    <span className="font-medium text-gray-900 dark:text-white">{s.title}</span>
                    <span className="text-sm text-gray-500 block">{s.provider}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">{t('profiles:noScholarships')}</p>
          )}
        </section>

        {foreignStudies?.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('profiles:foreignStudies')}</h2>
            <ul className="space-y-3">
              {foreignStudies.map((f) => (
                <li key={f._id}>
                  <Link to={ROUTES.FOREIGN_STUDIES} className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary transition-colors">
                    <span className="font-medium text-gray-900 dark:text-white">{f.program || f.country}</span>
                    <span className="text-sm text-gray-500 block">{f.country}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
