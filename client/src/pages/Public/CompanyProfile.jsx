import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, combineSchemas } from '../../seo/schemas';
import { publicProfilesApi } from '../../services/publicProfilesService';
import { ROUTES } from '../../constants';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { Alert } from '../../components/ui/Alerts';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { formatLocationDisplay } from '@shared/international/location.js';
import { safeSchemaUrl } from '@shared/seo/schemaSafety.js';
import { buildCanonicalUrl } from '../../seo/config';

export default function CompanyProfile() {
  const { slug } = useParams();
  const { t } = useTranslation(['profiles', 'common', 'jobs']);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    publicProfilesApi.company(slug)
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(err.response?.data?.error || t('common:failedToLoad')))
      .finally(() => setLoading(false));
  }, [slug, t]);

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-8"><ListingCardSkeleton /></div>;
  if (error || !data?.company) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Alert variant="error">{error || t('profiles:companyNotFound')}</Alert>
        <Link to={ROUTES.JOBS} className="text-primary dark:text-mint mt-4 inline-block">{t('jobs:backToJobs')}</Link>
      </div>
    );
  }

  const { company, stats, activeJobs, employer } = data;
  const canonical = `${ROUTES.COMPANY}/${company.slug}`;

  return (
    <>
      <SeoHead
        title={t('profiles:companySeoTitle', { name: company.name })}
        description={company.description || t('profiles:companySeoDescription', { name: company.name })}
        canonical={canonical}
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('profiles:breadcrumbHome'), url: ROUTES.HOME },
            { name: t('profiles:breadcrumbCompanies'), url: ROUTES.JOBS },
            { name: company.name, url: canonical },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: company.name,
            url: safeSchemaUrl(company.website) || buildCanonicalUrl(canonical),
            description: company.description,
          }
        )}
      />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex flex-wrap items-center gap-2">
            {company.name}
            <VerificationBadge level={company.verificationLevel || employer?.verificationLevel} verified={company.verified || employer?.verified} size="lg" />
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {[company.industry, formatLocationDisplay(company) || company.location].filter(Boolean).join(' · ')}
          </p>
          {company.website && (
            <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary dark:text-mint hover:underline mt-2 inline-block">
              {t('profiles:visitWebsite')}
            </a>
          )}
          {employer?.slug && (
            <Link to={`${ROUTES.EMPLOYER_PUBLIC}/${employer.slug}`} className="text-sm text-primary dark:text-mint hover:underline mt-2 ml-4 inline-block">
              {t('profiles:viewEmployerProfile')}
            </Link>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalJobs}</p>
            <p className="text-xs text-gray-500">{t('profiles:totalJobs')}</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activeJobs}</p>
            <p className="text-xs text-gray-500">{t('profiles:openPositions')}</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{company.companySize || '—'}</p>
            <p className="text-xs text-gray-500">{t('profiles:companySize')}</p>
          </div>
        </div>

        {company.benefits?.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('profiles:benefits')}</h2>
            <ul className="flex flex-wrap gap-2">
              {company.benefits.map((b) => (
                <li key={b} className="text-sm px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{b}</li>
              ))}
            </ul>
          </section>
        )}

        {company.officeLocations?.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('profiles:officeLocations')}</h2>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              {company.officeLocations.map((loc, i) => (
                <li key={i}>{formatLocationDisplay({ ...loc, country: company.country }) || [loc.city, loc.province, loc.address].filter(Boolean).join(', ')}</li>
              ))}
            </ul>
          </section>
        )}

        {company.gallery?.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('profiles:gallery')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {company.gallery.map((url) => (
                <img key={url} src={url} alt="" className="rounded-lg object-cover h-32 w-full" loading="lazy" />
              ))}
            </div>
          </section>
        )}

        {company.description && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('profiles:overview')}</h2>
            <p className="text-gray-600 dark:text-gray-300">{company.description}</p>
          </section>
        )}

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('profiles:jobsAtCompany', { name: company.name })}</h2>
          {activeJobs?.length ? (
            <ul className="space-y-3">
              {activeJobs.map((job) => (
                <li key={job._id}>
                  <Link to={`${ROUTES.JOBS}/${job.slug}`} className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary transition-colors">
                    <span className="font-medium text-gray-900 dark:text-white">{job.title}</span>
                    <span className="text-sm text-gray-500 block">{job.location}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">{t('profiles:noOpenJobs')}</p>
          )}
        </section>
      </div>
    </>
  );
}
