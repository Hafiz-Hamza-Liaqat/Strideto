import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { breadcrumbSchema, combineSchemas, webPageSchema } from '../../seo/schemas';
import { ROUTES } from '../../constants';

export default function HelpCenter() {
  const { t } = useTranslation(['static', 'seo', 'footer']);

  const roleGuides = [
    {
      title: t('static:helpStudentTitle'),
      body: t('static:helpStudentBody'),
      to: ROUTES.STUDENT_HELP,
      cta: t('static:helpStudentCta'),
    },
    {
      title: t('static:helpEmployerTitle'),
      body: t('static:helpEmployerBody'),
      to: ROUTES.EMPLOYER_HELP,
      cta: t('static:helpEmployerCta'),
    },
    {
      title: t('static:helpAgentTitle'),
      body: t('static:helpAgentBody'),
      to: ROUTES.AGENT_GUIDELINES,
      cta: t('static:helpAgentCta'),
    },
    {
      title: t('static:helpInstitutionTitle'),
      body: t('static:helpInstitutionBody'),
      to: ROUTES.INSTITUTION_GUIDELINES,
      cta: t('static:helpInstitutionCta'),
    },
  ];

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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('static:helpRolesTitle')}</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{t('static:helpRolesIntro')}</p>
          <ul className="space-y-4">
            {roleGuides.map((item) => (
              <li key={item.to} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">{item.body}</p>
                <Link to={item.to} className="text-primary dark:text-mint hover:underline min-h-[44px] inline-flex items-center">
                  {item.cta}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('static:helpTopicsTitle')}</h2>
          <ul className="space-y-2 text-gray-600 dark:text-gray-300">
            <li><Link to={ROUTES.PRIVACY} className="text-primary dark:text-mint hover:underline">{t('static:helpTopicPrivacy')}</Link></li>
            <li><Link to={ROUTES.PRIVACY_POLICY} className="text-primary dark:text-mint hover:underline">{t('footer:privacyPolicy', { ns: 'footer' })}</Link></li>
            <li><Link to={ROUTES.REFUND_POLICY} className="text-primary dark:text-mint hover:underline">{t('footer:refundPolicy', { ns: 'footer' })}</Link></li>
            <li><Link to={ROUTES.SUPPORT} className="text-primary dark:text-mint hover:underline">{t('static:helpTopicSafety')}</Link></li>
          </ul>
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
