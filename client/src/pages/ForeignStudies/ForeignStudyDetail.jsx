import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema } from '../../seo/schemas';
import { foreignStudiesApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { ListingCardSkeleton } from '../../components/listings/ListingCardSkeleton';
import { Alert } from '../../components/ui/Alerts';
import { formatDate } from '../../utils/formatDate';
import { KeyFacts } from '../../components/public/KeyFacts';
import { PublicSourceSection } from '../../components/public/PublicSourceSection';
import { ProvenanceStrip } from '../../components/public/ProvenanceStrip';
import { publicHttpUrlOrNull } from '@shared/publicDiscovery/safePublicUrl.js';
import {
  resolveForeignStudyLink,
  sourceSectionTitle,
} from '@shared/seo/sourceAuthority.js';

function Section({ title, children }) {
  if (!children) return null;
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h2>
      <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{children}</div>
    </section>
  );
}

export default function ForeignStudyDetail() {
  const { slug } = useParams();
  const { t } = useTranslation(['static', 'common', 'navbar']);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    foreignStudiesApi.get(slug)
      .then(({ data }) => setItem(data))
      .catch((err) => setError(err.response?.data?.error || t('common:failedToLoad')))
      .finally(() => setLoading(false));
  }, [slug, t]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><ListingCardSkeleton /></div>;
  if (error || !item) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert variant="error">{error || t('static:foreignStudyNotFound')}</Alert>
        <Link to={ROUTES.FOREIGN_STUDIES} className="text-primary dark:text-mint mt-4 inline-block">{t('static:foreignStudiesBack')}</Link>
      </div>
    );
  }

  const canonical = `${ROUTES.FOREIGN_STUDIES}/${item.slug || item._id}`;
  const title = item.seoTitle || `${item.program || item.country} – ${item.country}`;
  const officialLink = publicHttpUrlOrNull(item.link);
  const foreignStudySource = resolveForeignStudyLink(item.link);
  const foreignStudyFacts = [
    { label: t('static:foreignStudiesDestination', { defaultValue: 'Destination' }), value: item.country },
    { label: t('static:foreignStudiesLevel', { defaultValue: 'Study level' }), value: item.level },
    { label: t('static:foreignStudiesInstitution', { defaultValue: 'Institution' }), value: item.institution },
    { label: t('static:foreignStudiesProgram', { defaultValue: 'Program' }), value: item.program },
    { label: t('static:foreignStudiesDeadline'), value: item.deadline ? formatDate(item.deadline) : null },
    {
      label: t('static:foreignStudiesIntakes'),
      value: item.intakes?.length ? item.intakes.join(' · ') : null,
    },
  ];

  return (
    <>
      <SeoHead title={title} description={item.metaDescription || item.description} canonical={canonical} jsonLd={breadcrumbSchema([
        { name: t('navbar:home'), url: ROUTES.HOME },
        { name: t('static:foreignStudiesHeading'), url: ROUTES.FOREIGN_STUDIES },
        { name: item.country, url: canonical },
      ])} />
      <article className="max-w-4xl mx-auto px-4 py-8">
        <Link to={ROUTES.FOREIGN_STUDIES} className="text-sm text-primary dark:text-mint hover:underline inline-flex items-center gap-1 mb-4">
          ← {t('static:foreignStudiesBack')}
        </Link>
        {item.imageUrl && <img src={item.imageUrl} alt="" className="w-full max-h-64 object-cover rounded-xl mb-6" />}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary dark:bg-mint/10 dark:text-mint">{item.country}</span>
          {item.level && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{item.level}</span>}
          {item.deadline && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
              {t('static:foreignStudiesDeadline')}: {formatDate(item.deadline)}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{item.program || item.institution}</h1>
        {item.institution && item.program && <p className="text-gray-600 dark:text-gray-400 mt-2">{item.institution}</p>}
        <div className="mt-4">
          <KeyFacts facts={foreignStudyFacts} headingId="foreign-study-key-facts" />
        </div>
        {officialLink && (
          <a href={officialLink} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 px-6 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover">
            {t('static:foreignStudiesApply')} ↗
          </a>
        )}

        <PublicSourceSection title={sourceSectionTitle(foreignStudySource?.level)}>
          <ProvenanceStrip sourceUrl={foreignStudySource?.url} linkLabel={foreignStudySource?.label} />
        </PublicSourceSection>

        <Section title={t('static:foreignStudiesOverview')} >{item.description}</Section>
        <Section title={t('static:foreignStudiesVisa')}>{item.visaInfo}</Section>
        <Section title={t('static:foreignStudiesRequirements')}>
          {item.requirements?.length ? (
            <ul className="list-disc pl-5 space-y-1">{item.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
          ) : null}
        </Section>
        <Section title={t('static:foreignStudiesScholarships')}>{item.scholarshipsInfo}</Section>
        <Section title={t('static:foreignStudiesLanguageTests')}>
          {item.languageTests?.length ? item.languageTests.join(', ') : null}
        </Section>
        <Section title={t('static:foreignStudiesCost')}>{item.costOfLiving}</Section>
        <Section title={t('static:foreignStudiesIntakes')}>
          {item.intakes?.length ? item.intakes.join(' · ') : null}
        </Section>
        <Section title={t('static:foreignStudiesStudentLife')}>{item.studentLife}</Section>

        {(item.related || []).length > 0 && (
          <section className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold mb-4">{t('static:foreignStudiesRelated')}</h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {item.related.map((r) => (
                <li key={r._id}>
                  <Link to={`${ROUTES.FOREIGN_STUDIES}/${r.slug || r._id}`} className="text-primary dark:text-mint hover:underline">{r.program || r.country}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </>
  );
}
