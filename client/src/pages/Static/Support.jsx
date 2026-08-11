import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StaticPageShell, StaticSection } from '../../components/static/StaticPageShell';
import { ROUTES } from '../../constants';

export default function Support() {
  const { t } = useTranslation('static');

  return (
    <StaticPageShell
      titleKey="supportTitle"
      descriptionKey="supportDescription"
      headingKey="supportHeading"
      breadcrumbKey="breadcrumbSupport"
      canonical={ROUTES.SUPPORT}
      ns="static"
      seoNs="static"
    >
      <StaticSection titleKey="supportIntroTitle" bodyKey="supportIntroBody" />
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{t('supportChannelsTitle')}</h2>
        <ul className="space-y-3">
          <li>
            <Link to={ROUTES.CONTACT} className="text-primary dark:text-mint hover:underline min-h-[44px] inline-flex items-center">
              {t('supportContactForm')}
            </Link>
          </li>
          <li>
            <Link to={ROUTES.HELP_CENTER} className="text-primary dark:text-mint hover:underline min-h-[44px] inline-flex items-center">
              {t('supportHelpCenter')}
            </Link>
          </li>
          <li>
            <Link to={ROUTES.FAQ} className="text-primary dark:text-mint hover:underline min-h-[44px] inline-flex items-center">
              {t('supportFaq')}
            </Link>
          </li>
          <li>
            <Link to={`${ROUTES.SUPPORT}/tickets`} className="text-primary dark:text-mint hover:underline min-h-[44px] inline-flex items-center">
              {t('supportTicketLink')}
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('supportTicketNote')}</p>
          </li>
        </ul>
      </section>
    </StaticPageShell>
  );
}
