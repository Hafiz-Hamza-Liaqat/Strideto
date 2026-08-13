import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { ROUTES } from '../../constants';

const CARDS = [
  { title: 'What can I do?', body: 'Create draft jobs, submit them for Admin review, and review applicants. Free Beta allows up to 5 active jobs after approval.', to: ROUTES.EMPLOYER_GUIDELINES },
  { title: 'What must be verified?', body: 'Organization verification is required before job submission. Completeness is not verification. Connected accounts never grant Trust.', to: ROUTES.EMPLOYER_VERIFICATION },
  { title: 'What is free at launch?', body: 'Free Beta publishing is the launch entitlement. Paid publishing and checkout stay off until a real provider is configured.', to: ROUTES.EMPLOYER_PLANS_USAGE },
  { title: 'Why is a feature unavailable?', body: 'Email delivery, payments, scraping, and AI stay off unless configured. The UI should say not configured rather than implying success.', to: ROUTES.EMPLOYER_SETTINGS },
  { title: 'What should I do next?', body: 'Complete organization details, verify, create a draft, check Free Beta quota, submit for review, then review applicants.', to: ROUTES.EMPLOYER_DASHBOARD },
  { title: 'How do I get support?', body: 'Use Guidelines first, then contact support. Do not expect live email while delivery is stopped.', to: ROUTES.SUPPORT },
];

export default function EmployerHelp() {
  const { t } = useTranslation(['employer']);
  return (
    <>
      <SeoHead title={t('employer:helpSeoTitle')} description={t('employer:helpSeoDesc')} noindex />
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">{t('employer:navHelp')}</h1>
      <p className="text-sm text-slate-600 dark:text-gray-400 mb-6 max-w-2xl">{t('employer:helpIntro')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link key={card.title} to={card.to} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-primary">
            <h2 className="font-semibold text-gray-900 dark:text-white">{card.title}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">{card.body}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
