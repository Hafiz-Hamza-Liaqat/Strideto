import { useState, useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, combineSchemas } from '../../seo/schemas';
import { publicProfilesApi } from '../../services/publicProfilesService';
import { ROUTES } from '../../constants';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { Alert } from '../../components/ui/Alerts';
import { VerificationBadge } from '../../components/common/VerificationBadge';

const RESERVED = ['jobs', 'settings', 'applications', 'analytics', 'login', 'register', 'new'];

export function EmployerPublicGate() {
  const { slug } = useParams();
  if (RESERVED.includes(slug)) {
    if (slug === 'new') return <Navigate to={`${ROUTES.EMPLOYER_DASHBOARD}/jobs/new`} replace />;
    return <Navigate to={`${ROUTES.EMPLOYER_DASHBOARD}/${slug}`} replace />;
  }
  return <EmployerPublicProfile />;
}

function companyOrgSchema(profile, canonical) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: profile.companyName,
    url: profile.website || canonical,
    description: profile.companyDescription,
    logo: profile.logoUrl || undefined,
    address: profile.location ? { '@type': 'PostalAddress', addressLocality: profile.city, addressRegion: profile.province, addressCountry: 'PK' } : undefined,
  };
}

function EmployerPublicProfile() {
  const { slug } = useParams();
  const { t } = useTranslation(['profiles', 'common', 'jobs']);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    publicProfilesApi.employer(slug)
      .then(({ data: d }) => setData(d))
      .catch((err) => setError(err.response?.data?.error || t('common:failedToLoad')))
      .finally(() => setLoading(false));
  }, [slug, t]);

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-8"><ListingCardSkeleton /></div>;
  if (error || !data?.profile) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Alert variant="error">{error || t('profiles:employerNotFound')}</Alert>
        <Link to={ROUTES.JOBS} className="text-primary dark:text-mint mt-4 inline-block">{t('jobs:backToJobs')}</Link>
      </div>
    );
  }

  const { profile, stats, activeJobs } = data;
  // Truthful terminology: these are the employer's prior openings (closed
  // roles), not confirmed hires. Prefer the new `pastPositions` field, falling
  // back to the legacy `hiringHistory` alias for older API responses.
  const pastPositions = data.pastPositions || data.hiringHistory;
  const canonical = `${ROUTES.EMPLOYER_PUBLIC}/${profile.slug}`;

  return (
    <>
      <SeoHead
        title={t('profiles:employerSeoTitle', { name: profile.companyName })}
        description={profile.companyDescription || t('profiles:employerSeoDescription', { name: profile.companyName })}
        canonical={canonical}
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('profiles:breadcrumbHome'), url: ROUTES.HOME },
            { name: t('profiles:breadcrumbEmployers'), url: ROUTES.JOBS },
            { name: profile.companyName, url: canonical },
          ]),
          companyOrgSchema(profile, canonical)
        )}
      />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
          <div className="h-32 md:h-40 bg-gradient-to-r from-primary/20 to-mint/20 dark:from-primary/30 dark:to-mint/20" />
          <div className="px-6 pb-6 -mt-10">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-20 h-20 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-2xl font-bold text-primary">
                {profile.companyName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex flex-wrap items-center gap-2">
                  {profile.companyName}
                  <VerificationBadge level={profile.verificationLevel} verified={profile.verified} size="lg" />
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                  {[profile.industry, profile.location].filter(Boolean).join(' · ')}
                </p>
              </div>
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary dark:text-mint hover:underline">
                  {t('profiles:visitWebsite')}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <StatCard label={t('profiles:totalJobs')} value={stats.totalJobs} />
          <StatCard label={t('profiles:activeJobs')} value={stats.activeJobs} />
          <StatCard label={t('profiles:companySize')} value={profile.companySize || '—'} />
        </div>

        {profile.companyDescription && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('profiles:overview')}</h2>
            <p className="text-gray-600 dark:text-gray-300">{profile.companyDescription}</p>
          </section>
        )}

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('profiles:openPositions')}</h2>
          {activeJobs?.length ? (
            <ul className="space-y-3">
              {activeJobs.map((job) => (
                <li key={job._id}>
                  <Link to={`${ROUTES.JOBS}/${job.slug}`} className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-mint transition-colors">
                    <span className="font-medium text-gray-900 dark:text-white">{job.title}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 block">{job.location || job.city}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">{t('profiles:noOpenJobs')}</p>
          )}
        </section>

        {pastPositions?.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('profiles:pastPositions')}</h2>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              {pastPositions.map((job) => (
                <li key={job._id}>{job.title}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 text-center">
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}

export default EmployerPublicGate;
