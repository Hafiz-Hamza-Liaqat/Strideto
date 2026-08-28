import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { scholarshipSchema, breadcrumbSchema, combineSchemas } from '../../seo/schemas';
import { buildCanonicalUrl } from '../../seo/config';
import { intlScholarshipsApi, savedApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';
import { SaveButton } from '../../components/listings/SaveButton';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/formatDate';
import { useContentView } from '../../hooks/usePageView';
import { RelatedResources } from '../../components/seo/RelatedResources';

function isObjectIdParam(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ''));
}

function intlDetailPath(item) {
  if (!item) return '';
  return item.slug ? `${ROUTES.INTL_SCHOLARSHIPS}/${item.slug}` : `${ROUTES.INTL_SCHOLARSHIPS}/${item._id}`;
}

export default function IntlScholarshipDetail() {
  const { t } = useTranslation(['scholarships', 'common', 'navbar']);
  const { id: slugOrId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useContentView('university', item?._id, 'university_view');

  useEffect(() => {
    intlScholarshipsApi.get(slugOrId)
      .then(({ data }) => setItem(data))
      .catch((e) => setError(e.response?.data?.error || t('scholarships:scholarshipNotFound')))
      .finally(() => setLoading(false));
  }, [slugOrId, t]);

  useEffect(() => {
    if (!item?.slug || !isObjectIdParam(slugOrId)) return;
    if (item.slug !== slugOrId) {
      navigate(`${ROUTES.INTL_SCHOLARSHIPS}/${item.slug}`, { replace: true });
    }
  }, [item, slugOrId, navigate]);

  useEffect(() => {
    if (!isAuthenticated || !item) return;
    savedApi.get().then(({ data: d }) => {
      const ids = (d.savedIntlScholarships || []).map((s) => s._id);
      setSaved(ids.includes(item._id));
    }).catch(() => {});
  }, [isAuthenticated, item]);

  const handleSaveToggle = async (scholarshipId, save) => {
    if (!scholarshipId) return;
    if (save) await intlScholarshipsApi.save(scholarshipId);
    else await intlScholarshipsApi.unsave(scholarshipId);
    setSaved(!!save);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-red-600 dark:text-red-400">{error || t('scholarships:scholarshipNotFound')}</p>
        <Link to={ROUTES.INTL_SCHOLARSHIPS} className="text-primary dark:text-mint hover:underline mt-2 inline-block">{t('scholarships:backToIntlScholarships')}</Link>
      </div>
    );
  }

  const canonicalPath = intlDetailPath(item);
  const description = item.deadline
    ? t('scholarships:intlDetailDescription', { title: item.title, country: item.country, deadline: formatDate(item.deadline) })
    : t('scholarships:intlDetailDescriptionTba', { title: item.title, country: item.country });
  const schema = scholarshipSchema({ ...item, slug: undefined });
  if (schema) schema.url = buildCanonicalUrl(canonicalPath);

  return (
    <>
      <SeoHead
        title={item.title}
        description={description}
        canonical={canonicalPath}
        jsonLd={combineSchemas(
          schema,
          breadcrumbSchema([
            { name: t('navbar:home'), url: ROUTES.HOME },
            { name: t('scholarships:intlBreadcrumb'), url: ROUTES.INTL_SCHOLARSHIPS },
            { name: item.title, url: canonicalPath },
          ]),
        )}
      />
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
        <Link to={ROUTES.INTL_SCHOLARSHIPS} className="text-sm text-primary dark:text-mint hover:underline mb-4 inline-block">{t('scholarships:backToIntlScholarships')}</Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{item.title}</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">{item.country}{item.university ? ` · ${item.university}` : ''}</p>
            {item.deadline && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('scholarships:deadlinePrefix')}: {formatDate(item.deadline)}
              </p>
            )}
          </div>
          {isAuthenticated && <SaveButton id={item._id} saved={saved} onToggle={(scholarshipId, save) => handleSaveToggle(scholarshipId, save)} />}
        </div>

        {item.description && (
          <div className="mt-6 prose dark:prose-invert max-w-none">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('scholarships:descriptionLabel')}</h2>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{item.description}</p>
          </div>
        )}

        {item.eligibility?.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('scholarships:eligibility')}</h2>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mt-2 space-y-1">
              {item.eligibility.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {item.visaRequirements && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('scholarships:visaRequirements')}</h2>
            <p className="text-gray-700 dark:text-gray-300 mt-2">{item.visaRequirements}</p>
          </div>
        )}

        {item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-block mt-6 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-hover btn-theme">
            {t('scholarships:applyOfficialSite')}
          </a>
        )}

        {(item.related || []).length > 0 && (
          <section className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {t('scholarships:relatedScholarships')}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {(item.related || []).map((r) => (
                <Link
                  key={r._id}
                  to={intlDetailPath(r)}
                  className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition min-w-0"
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white break-words-safe">{r.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{r.country}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {Array.isArray(item.relatedResources) && item.relatedResources.length > 0 && (
          <RelatedResources
            title={t('scholarships:exploreScholarshipResources', { defaultValue: 'Explore related resources' })}
            items={item.relatedResources}
            maxItems={4}
          />
        )}
      </div>
    </>
  );
}
