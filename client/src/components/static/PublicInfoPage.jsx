/**
 * Unified layout for public help, support, contact, sitemap, and legal pages.
 * Truthful copy only — no invented phone numbers or SLAs.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../seo';
import { breadcrumbSchema, combineSchemas, webPageSchema } from '../../seo/schemas';
import { ROUTES } from '../../constants';

export function PublicInfoPage({
  titleKey,
  descriptionKey,
  headingKey,
  breadcrumbKey,
  canonical,
  children,
  ns = 'static',
  seoNs = 'seo',
  noindex = false,
  wide = false,
  showSupportTruth = false,
  relatedLinks = [],
}) {
  const { t } = useTranslation([ns, seoNs, 'common']);
  const title = t(`${seoNs}:${titleKey}`);
  const description = t(`${seoNs}:${descriptionKey}`);
  const heading = t(`${ns}:${headingKey}`);
  const breadcrumbLabel = t(`${ns}:${breadcrumbKey}`);
  const maxWidth = wide ? 'max-w-5xl' : 'max-w-3xl';

  return (
    <>
      <SeoHead
        title={title}
        description={description}
        canonical={canonical}
        noindex={noindex}
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('seo:breadcrumbHome'), url: ROUTES.HOME },
            { name: breadcrumbLabel, url: canonical },
          ]),
          webPageSchema({ name: heading, description, url: canonical })
        )}
      />
      <div className={`${maxWidth} mx-auto px-4 py-10`}>
        <nav aria-label="Breadcrumb" className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          <Link to={ROUTES.HOME} className="hover:text-primary dark:hover:text-mint">
            {t('seo:breadcrumbHome')}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700 dark:text-gray-300">{breadcrumbLabel}</span>
        </nav>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{heading}</h1>
        {t(`${ns}:lastUpdated`, { defaultValue: '' }) ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t(`${ns}:lastUpdated`)}</p>
        ) : null}

        {showSupportTruth ? (
          <p className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
            Support is handled through this site&apos;s contact form and help articles. We do not publish a phone hotline or guaranteed response-time SLA unless one is explicitly listed on an active product page.
          </p>
        ) : null}

        <div className="prose prose-invert max-w-none space-y-6 text-gray-600 dark:text-gray-300">
          {children}
        </div>

        {relatedLinks.length ? (
          <aside className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
              Related
            </h2>
            <ul className="space-y-2 text-sm">
              {relatedLinks.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-primary dark:text-mint hover:underline min-h-[44px] inline-flex items-center">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </>
  );
}

export function PublicInfoSection({ title, children }) {
  return (
    <section>
      {title ? <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{title}</h2> : null}
      {children}
    </section>
  );
}
