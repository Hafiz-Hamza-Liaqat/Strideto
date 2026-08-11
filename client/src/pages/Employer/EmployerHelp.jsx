import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';

export default function EmployerHelp() {
  const { t } = useTranslation(['employer']);
  return (
    <>
      <SeoHead title={t('employer:helpSeoTitle')} description={t('employer:helpSeoDesc')} noindex />
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
        {t('employer:navHelp')}
      </h1>
      <p className="text-sm text-slate-600 dark:text-gray-400 mb-6 max-w-2xl">{t('employer:helpIntro')}</p>
      <ul className="space-y-2 text-sm">
        <li><Link className="text-primary hover:underline" to={ROUTES.EMPLOYER_GUIDELINES}>{t('employer:navGuidelines')}</Link></li>
        <li><Link className="text-primary hover:underline" to={ROUTES.EMPLOYER_VERIFICATION}>{t('employer:navVerification')}</Link></li>
        <li><Link className="text-primary hover:underline" to={ROUTES.EMPLOYER_PLANS_USAGE}>{t('employer:navPlansUsage')}</Link></li>
        <li><Link className="text-primary hover:underline" to={ROUTES.EMPLOYER_TEAM}>{t('employer:navTeam')}</Link></li>
        <li><Link className="text-primary hover:underline" to={ROUTES.SUPPORT}>{t('employer:contactSupport')}</Link></li>
      </ul>
    </>
  );
}
