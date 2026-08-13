import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { Button } from '../../components/common/Button';

const STORAGE_KEY = 'edur_onboarding_done';

/**
 * L.2.6 — first-run career OS path: Talent Profile → Resume → Readiness → Dashboard.
 */
export function CareerOnboardingBanner({ profileLoaded, form }) {
  const { t } = useTranslation(['talent', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const forced = searchParams.get('onboarding') === '1';
  const done = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1';

  if (!forced && done) return null;
  if (!profileLoaded) return null;

  const displayName = form?.displayName || form?.personal?.firstName || '';
  const hasHeadline = Boolean(form?.headline?.trim());
  const hasEducation = Array.isArray(form?.education) && form.education.length > 0;
  const profileStarted = Boolean(displayName) && (hasHeadline || hasEducation);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    const next = new URLSearchParams(searchParams);
    next.delete('onboarding');
    setSearchParams(next, { replace: true });
  };

  const steps = [
    {
      id: 'profile',
      title: t('talent:onboarding.stepProfile', { defaultValue: 'Complete your Talent Profile' }),
      done: profileStarted,
      to: null,
    },
    {
      id: 'resume',
      title: t('talent:onboarding.stepResume', { defaultValue: 'Build or upload a resume' }),
      done: false,
      to: ROUTES.RESUME_BUILDER,
    },
    {
      id: 'readiness',
      title: t('talent:onboarding.stepReadiness', { defaultValue: 'Check career readiness' }),
      done: false,
      to: ROUTES.DASHBOARD,
    },
    {
      id: 'assess',
      title: t('talent:onboarding.stepPrep', { defaultValue: 'Explore Tests & Prep' }),
      done: false,
      to: ROUTES.TEST_HUB,
    },
  ];

  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('talent:onboarding.title', { defaultValue: 'Welcome — start your career setup' })}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('talent:onboarding.subtitle', {
              defaultValue: 'Profile → Resume → Readiness → Dashboard. You can skip anytime and return later.',
            })}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={dismiss}>
          {t('talent:onboarding.dismiss', { defaultValue: 'Skip for now' })}
        </Button>
      </div>
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              step.done ? 'bg-emerald-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`}
            >
              {index + 1}
            </span>
            <span className="text-gray-800 dark:text-gray-200 flex-1 min-w-0">{step.title}</span>
            {step.to ? (
              <Link to={step.to} className="text-primary dark:text-mint hover:underline font-medium">
                {t('common:continue', { defaultValue: 'Continue' })}
              </Link>
            ) : (
              <span className="text-xs text-gray-500">
                {step.done
                  ? t('talent:onboarding.done', { defaultValue: 'Started' })
                  : t('talent:onboarding.editBelow', { defaultValue: 'Edit below' })}
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={ROUTES.RESUME_BUILDER}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium"
        >
          {t('talent:onboarding.goResume', { defaultValue: 'Go to Resume Builder' })}
        </Link>
        <Link
          to={ROUTES.DASHBOARD}
          onClick={dismiss}
          className="inline-flex items-center px-4 py-2 rounded-lg border border-primary text-primary text-sm font-medium"
        >
          {t('talent:onboarding.goDashboard', { defaultValue: 'Open Career Dashboard' })}
        </Link>
      </div>
    </div>
  );
}
