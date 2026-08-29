import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants';
import { trackEmployerAcquisitionEvent, EMPLOYER_CTA_ACTIONS } from './employerAcquisitionAnalytics';

const VARIANT_STYLES = {
  primary:
    'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900',
  secondary:
    'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700/60 dark:focus-visible:ring-offset-gray-900',
  tertiary:
    'inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:text-gray-300 dark:hover:text-mint dark:focus-visible:ring-offset-gray-900',
};

function TrackedLink({ to, variant, children, analyticsAction, ctaId, onNavigate, className: classNameOverride }) {
  const className = classNameOverride || VARIANT_STYLES[variant] || VARIANT_STYLES.primary;

  return (
    <Link
      to={to}
      className={className}
      data-cta={ctaId}
      onClick={() => {
        if (analyticsAction) {
          trackEmployerAcquisitionEvent(analyticsAction, { ctaId, placement: onNavigate || 'employer-conversion' });
        }
      }}
    >
      {children}
    </Link>
  );
}

/**
 * Reusable employer conversion block — primary signup + secondary sign-in.
 */
export function EmployerConversionCta({
  heading = 'Ready to start hiring?',
  body = 'Create your employer workspace, publish an opportunity, and choose how candidates apply.',
  placement = 'employer-page-footer',
  showPostJob = false,
  className = '',
}) {
  return (
    <section
      className={`rounded-2xl border border-gray-200 bg-gradient-to-br from-primary/5 via-white to-primary/5 p-6 sm:p-8 dark:border-gray-700 dark:from-primary/10 dark:via-gray-900 dark:to-primary/5 ${className}`}
      aria-labelledby="employer-final-cta-heading"
    >
      <h2 id="employer-final-cta-heading" className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
        {heading}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
        {body}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <TrackedLink
          to={ROUTES.EMPLOYER_REGISTER}
          variant="primary"
          analyticsAction={EMPLOYER_CTA_ACTIONS.SIGNUP_INTENT}
          ctaId={`${placement}-register`}
          onNavigate={placement}
        >
          Create Employer Account
        </TrackedLink>
        {showPostJob ? (
          <TrackedLink
            to={ROUTES.EMPLOYER_POST_JOB}
            variant="secondary"
            analyticsAction={EMPLOYER_CTA_ACTIONS.POST_JOB_INTENT}
            ctaId={`${placement}-post-job`}
            onNavigate={placement}
          >
            Post a Job
          </TrackedLink>
        ) : null}
        <TrackedLink
          to={ROUTES.EMPLOYER_LOGIN}
          variant={showPostJob ? 'tertiary' : 'secondary'}
          analyticsAction={EMPLOYER_CTA_ACTIONS.LOGIN_INTENT}
          ctaId={`${placement}-login`}
          onNavigate={placement}
        >
          Employer Sign In
        </TrackedLink>
      </div>
    </section>
  );
}

export { TrackedLink, VARIANT_STYLES };
