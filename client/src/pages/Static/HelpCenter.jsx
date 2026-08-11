import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, combineSchemas, webPageSchema } from '../../seo/schemas';
import { ROUTES } from '../../constants';

export default function HelpCenter() {
  const { t } = useTranslation(['static', 'seo']);

  return (
    <>
      <SeoHead
        title={t('seo:helpTitle')}
        description={t('seo:helpDescription')}
        canonical={ROUTES.HELP_CENTER}
        jsonLd={combineSchemas(
          breadcrumbSchema([
            { name: t('seo:breadcrumbHome'), url: ROUTES.HOME },
            { name: t('static:breadcrumbHelp'), url: ROUTES.HELP_CENTER },
          ]),
          webPageSchema({ name: t('static:helpHeading'), description: t('seo:helpDescription'), url: ROUTES.HELP_CENTER })
        )}
      />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{t('static:helpHeading')}</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">{t('static:helpIntro')}</p>
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('static:helpGettingStartedTitle')}</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{t('static:helpGettingStartedBody')}</p>
        </section>
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('static:helpSearchTitle')}</h2>
          <p className="text-gray-600 dark:text-gray-300">{t('static:helpSearchBody')}</p>
        </section>
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('static:helpApplyTitle')}</h2>
          <p className="text-gray-600 dark:text-gray-300">{t('static:helpApplyBody')}</p>
        </section>
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Student guidance</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Signed-in Students can open contextual guidance for profile, applications, Vault, and privacy without reading legal pages.
          </p>
          <Link to={ROUTES.STUDENT_HELP} className="text-primary dark:text-mint hover:underline">Student guidance</Link>
        </section>
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('static:helpNeedMoreTitle')}</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {t('static:helpNeedMorePrefix')}{' '}
            <Link to={ROUTES.FAQ} className="text-primary dark:text-mint hover:underline">{t('static:breadcrumbFaq')}</Link>
            {' '}{t('static:helpNeedMoreOr')}{' '}
            <Link to={ROUTES.CONTACT} className="text-primary dark:text-mint hover:underline">{t('static:contactUs').toLowerCase()}</Link>
            {' '}{t('static:helpNeedMoreSuffix')}
          </p>
        </section>
      </div>
    </>
  );
}
