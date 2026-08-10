import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../seo';
import { breadcrumbSchema, combineSchemas, webPageSchema } from '../../seo/schemas';
import { ROUTES } from '../../constants';
import { formatDate } from '../../utils/formatDate';
import { usePageView } from '../../hooks/usePageView';
import { ResolvedBlockListRenderer } from './ResolvedBlockListRenderer';
import {
  resolvePageBuilderSeo,
  dedupeStructuredData,
  validateBreadcrumbItems,
} from '@shared/pageBuilderSeo.js';
import { SITE_URL } from '../../seo/config';

/**
 * Published/draft Page Builder page shell with hardened SEO (C.6.4.9 + C.6.4.15).
 */
export function PageBuilderPageView({
  layout,
  canonical,
  preview = false,
  seoFallback = null,
}) {
  const { t } = useTranslation(['seo', 'static']);

  usePageView('page-builder');

  const seo = useMemo(() => resolvePageBuilderSeo({
    layout,
    blocks: layout?.blocks || [],
    canonical,
    seoFallback,
    siteUrl: SITE_URL,
    preview,
  }), [layout, canonical, seoFallback, preview]);

  const breadcrumbItems = useMemo(() => [
    { name: t('seo:breadcrumbHome'), url: ROUTES.HOME },
    { name: seo.title || layout?.pageKey, url: canonical },
  ], [t, seo.title, layout?.pageKey, canonical]);

  const jsonLd = useMemo(() => {
    const crumbs = breadcrumbSchema(breadcrumbItems);
    const page = webPageSchema({
      name: seo.title,
      description: seo.description,
      url: canonical,
    });
    const parts = dedupeStructuredData([
      crumbs,
      page,
      seo.faqSchema,
      ...(seo.dynamicSchemas || []),
    ].filter(Boolean));
    return combineSchemas(...parts);
  }, [breadcrumbItems, seo, canonical]);

  validateBreadcrumbItems(breadcrumbItems);

  return (
    <>
      <SeoHead
        title={seo.title}
        description={seo.description}
        canonical={preview ? undefined : canonical}
        ogImage={seo.ogImage}
        ogImageAlt={seo.ogImageAlt}
        twitterCard={seo.twitterCard}
        robots={seo.robots}
        noindex={preview}
        jsonLd={jsonLd}
      />
      {preview ? (
        <div
          className="bg-amber-100 dark:bg-amber-900/40 border-b border-amber-300 dark:border-amber-700 px-4 py-2 text-center text-sm font-medium text-amber-900 dark:text-amber-100"
          role="status"
        >
          Page Builder draft preview — not published
        </div>
      ) : null}
      <div className="page-builder-runtime" id="page-builder-main">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <nav aria-label="Breadcrumb" className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            <ol className="flex flex-wrap items-center gap-1 list-none p-0 m-0">
              <li>
                <Link to={ROUTES.HOME} className="hover:text-primary dark:hover:text-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                  {t('seo:breadcrumbHome')}
                </Link>
              </li>
              <li aria-hidden className="mx-1">/</li>
              <li aria-current="page" className="text-gray-700 dark:text-gray-300">{seo.title}</li>
            </ol>
          </nav>
          <h1 className="sr-only">{seo.title}</h1>
          {layout?.publishedAt && !preview ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {t('static:lastUpdated')}: {formatDate(layout.publishedAt)}
            </p>
          ) : null}
        </div>
        <ResolvedBlockListRenderer blocks={layout?.blocks || []} preview={preview} adminContext={preview} />
      </div>
    </>
  );
}
