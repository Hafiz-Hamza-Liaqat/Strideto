import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import {
  buildInstitutionGettingStartedSteps,
  shouldShowInstitutionGettingStarted,
} from './institutionGettingStarted.js';
import { primaryButton, secondaryButton } from './InstitutionUi';

const STATUS_STYLES = {
  complete: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200',
  current: 'bg-primary/10 text-primary dark:bg-mint/15 dark:text-mint',
  upcoming: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

export function InstitutionGettingStartedGuide({
  emailVerified,
  profileCompleteness,
  verificationStatus,
  claimState,
  dismissible = false,
  onDismiss,
  compact = false,
}) {
  const show = shouldShowInstitutionGettingStarted({
    emailVerified,
    profileCompleteness,
    verificationStatus,
    claimState,
  });
  const steps = buildInstitutionGettingStartedSteps({
    emailVerified,
    profileCompleteness,
    verificationStatus,
    claimState,
  });

  if (!show && compact) return null;

  return (
    <section
      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 sm:p-6"
      aria-labelledby="institution-getting-started-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="institution-getting-started-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Getting started
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            A setup guide, not a verification badge. Organization verification and the canonical claim are separate reviews.
          </p>
        </div>
        {dismissible && onDismiss ? (
          <button type="button" className={`${secondaryButton} shrink-0`} onClick={onDismiss}>
            Hide guide
          </button>
        ) : null}
      </div>
      <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 p-4 min-w-0"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                <span className="text-gray-400 me-2">{index + 1}.</span>
                {step.title}
              </p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[step.status]}`}>
                {step.status}
              </span>
            </div>
            <p className="mt-2 flex-1 text-sm text-gray-600 dark:text-gray-400">{step.explanation}</p>
            {step.enabled ? (
              <Link to={step.to} className={`${primaryButton} mt-4 inline-flex justify-center text-sm`}>
                {step.ctaLabel}
              </Link>
            ) : (
              <p className="mt-4 text-sm font-medium text-gray-500">{step.ctaLabel}</p>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Need this later? It stays on{' '}
        <Link className="underline" to={ROUTES.INSTITUTION_HELP}>Help</Link>.
      </p>
    </section>
  );
}

export default InstitutionGettingStartedGuide;
