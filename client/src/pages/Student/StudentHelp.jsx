import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';

const SECTIONS = [
  ['profile', ROUTES.TALENT_PROFILE],
  ['skills', ROUTES.TALENT_PROFILE],
  ['applications', ROUTES.APPLICATIONS],
  ['vault', ROUTES.VAULT],
  ['agents', ROUTES.CONSULTATIONS],
  ['notifications', ROUTES.NOTIFICATIONS],
  ['privacy', ROUTES.PRIVACY],
  ['export', ROUTES.PRIVACY],
  ['payments', ROUTES.COMMERCE_HISTORY],
];

export default function StudentHelp() {
  const { t } = useTranslation(['student']);
  return (
    <>
      <SeoHead title={t('student:help.title')} noindex />
      <div className="max-w-3xl mx-auto px-4 py-8 min-w-0 w-full space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('student:help.title')}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t('student:help.intro')}</p>
        </header>
        {SECTIONS.map(([key, to]) => (
          <section key={key} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">{key}</h2>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{t(`student:help.${key}`)}</p>
            <Link to={to} className="inline-flex min-h-[44px] items-center mt-2 text-sm text-primary dark:text-mint hover:underline">
              Open
            </Link>
          </section>
        ))}
      </div>
    </>
  );
}
