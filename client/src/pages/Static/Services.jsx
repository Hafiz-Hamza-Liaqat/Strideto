import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StaticPageShell } from '../../components/static/StaticPageShell';
import { ROUTES } from '../../constants';

export default function Services() {
  const { t } = useTranslation('static');

  const services = [
    { titleKey: 'serviceAgentsTitle', descKey: 'serviceAgentsDesc', to: ROUTES.AGENT_PUBLIC_DIRECTORY },
    { titleKey: 'serviceMarketplaceTitle', descKey: 'serviceMarketplaceDesc', to: ROUTES.AGENT_PUBLIC_MARKETPLACE },
    { titleKey: 'serviceCareerTitle', descKey: 'serviceCareerDesc', to: ROUTES.CAREER_GUIDANCE },
    { titleKey: 'serviceResumeTitle', descKey: 'serviceResumeDesc', to: ROUTES.RESUME_BUILDER },
    { titleKey: 'serviceHelpTitle', descKey: 'serviceHelpDesc', to: ROUTES.HELP_CENTER },
  ];

  return (
    <StaticPageShell
      titleKey="servicesTitle"
      descriptionKey="servicesDescription"
      headingKey="servicesHeading"
      breadcrumbKey="breadcrumbServices"
      canonical={ROUTES.SERVICES}
      ns="static"
      seoNs="static"
    >
      <p className="text-lg text-gray-600 dark:text-gray-300 -mt-2 mb-8">{t('servicesIntro')}</p>
      <div className="grid sm:grid-cols-2 gap-6 not-prose">
        {services.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="block p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50 dark:hover:border-mint/50 hover:shadow-md transition-all duration-200 min-h-[44px]"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t(s.titleKey)}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t(s.descKey)}</p>
          </Link>
        ))}
      </div>
    </StaticPageShell>
  );
}
