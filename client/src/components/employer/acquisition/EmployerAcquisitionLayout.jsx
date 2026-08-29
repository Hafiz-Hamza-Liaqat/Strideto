/**
 * MKT-P1 employer acquisition page layout — premium B2B conversion surface.
 * Truthful copy only; preserves SEO schema patterns from PersonaAcquisitionPage.
 */
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SeoHead } from '../../seo';
import { breadcrumbSchema, combineSchemas, webPageSchema } from '../../../seo/schemas';
import { ROUTES } from '../../../constants';
import { EmployerHeroVisual } from './EmployerHeroVisual';
import { EmployerConversionCta, TrackedLink } from './EmployerConversionCta';
import { trackEmployerAcquisitionEvent, EMPLOYER_CTA_ACTIONS } from './employerAcquisitionAnalytics';

function StatusBadge({ available }) {
  return (
    <span
      className={
        available
          ? 'inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300'
          : 'inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200'
      }
    >
      {available ? 'Available Now' : 'Coming Soon'}
    </span>
  );
}

function BenefitCard({ title, body }) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/50">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{body}</p>
    </article>
  );
}

function FaqItem({ question, answer }) {
  return (
    <details className="group rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          {question}
          <span className="shrink-0 text-primary dark:text-mint" aria-hidden="true">
            +
          </span>
        </span>
      </summary>
      <p className="border-t border-gray-100 px-4 pb-4 pt-2 text-sm leading-relaxed text-gray-600 dark:border-gray-700 dark:text-gray-300 sm:px-5">
        {answer}
      </p>
    </details>
  );
}

export function EmployerAcquisitionLayout({
  title,
  description,
  canonical,
  heading,
  intro,
  workspaceAvailable,
  steps = [],
  benefits = [],
  applicationMethods = [],
  trustItems = [],
  accountBenefits = [],
  faqs = [],
}) {
  const applicationMethodsRef = useRef(null);
  const applicationMethodsTracked = useRef(false);
  const location = useLocation();

  useEffect(() => {
    trackEmployerAcquisitionEvent(EMPLOYER_CTA_ACTIONS.PAGE_VIEW, {
      path: canonical,
      navigationKey: location.key,
    });
  }, [canonical, location.key]);

  useEffect(() => {
    if (!applicationMethods.length || !applicationMethodsRef.current) return undefined;

    const node = applicationMethodsRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !applicationMethodsTracked.current) {
          applicationMethodsTracked.current = true;
          trackEmployerAcquisitionEvent(EMPLOYER_CTA_ACTIONS.APPLICATION_METHOD_INFO, {
            section: 'application-methods',
          });
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [applicationMethods.length]);

  const showWorkspaceBadge = workspaceAvailable !== null && workspaceAvailable !== undefined;

  return (
    <>
      <SeoHead
        title={title}
        description={description}
        canonical={canonical}
        jsonLd={combineSchemas(
          breadcrumbSchema(
            [
              { name: 'Home', url: ROUTES.HOME },
              { name: 'Employers', url: canonical },
            ],
            canonical
          ),
          webPageSchema({ name: heading, description, url: canonical })
        )}
      />

      <header className="border-b border-gray-200 bg-gradient-to-br from-slate-50 via-white to-primary/5 dark:border-gray-800 dark:from-gray-950 dark:via-gray-900 dark:to-primary/10">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            <Link to={ROUTES.HOME} className="hover:text-primary dark:hover:text-mint">
              Home
            </Link>
            <span className="mx-2" aria-hidden="true">
              /
            </span>
            <span className="text-gray-700 dark:text-gray-300">Employers</span>
          </nav>

          <div className="grid min-w-0 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-12">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
                  {heading}
                </h1>
                {showWorkspaceBadge ? <StatusBadge available={workspaceAvailable} /> : null}
              </div>

              <p className="mt-4 max-w-xl text-lg leading-relaxed text-gray-600 dark:text-gray-300">{intro}</p>

              {workspaceAvailable ? (
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <TrackedLink
                    to={ROUTES.EMPLOYER_REGISTER}
                    variant="primary"
                    analyticsAction={EMPLOYER_CTA_ACTIONS.SIGNUP_INTENT}
                    ctaId="employer-hero-register"
                    onNavigate="employer-hero"
                  >
                    Create Employer Account
                  </TrackedLink>
                  <TrackedLink
                    to={ROUTES.EMPLOYER_POST_JOB}
                    variant="secondary"
                    analyticsAction={EMPLOYER_CTA_ACTIONS.POST_JOB_INTENT}
                    ctaId="employer-hero-post-job"
                    onNavigate="employer-hero"
                  >
                    Post a Job
                  </TrackedLink>
                  <TrackedLink
                    to={ROUTES.EMPLOYER_LOGIN}
                    variant="tertiary"
                    analyticsAction={EMPLOYER_CTA_ACTIONS.LOGIN_INTENT}
                    ctaId="employer-hero-login"
                    onNavigate="employer-hero"
                  >
                    Employer Sign In
                  </TrackedLink>
                </div>
              ) : null}

              {workspaceAvailable ? (
                <p className="mt-4 text-sm">
                  <TrackedLink
                    to={ROUTES.JOBS}
                    variant="tertiary"
                    analyticsAction={EMPLOYER_CTA_ACTIONS.BROWSE_JOBS_INTENT}
                    ctaId="employer-hero-browse-jobs"
                    onNavigate="employer-hero-supporting"
                    className="!px-0 !py-0 text-primary dark:text-mint"
                  >
                    Browse jobs as candidates see them
                  </TrackedLink>
                </p>
              ) : null}
            </div>

            <div className="min-w-0 lg:justify-self-end">
              <EmployerHeroVisual />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        {benefits.length ? (
          <section className="mb-12" aria-labelledby="employer-benefits-heading">
            <h2 id="employer-benefits-heading" className="text-2xl font-semibold text-gray-900 dark:text-white">
              What you can do with STRIDETO
            </h2>
            <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">
              Publish opportunities, control how candidates apply, and manage supported hiring activity from one
              employer workspace.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map((item) => (
                <BenefitCard key={item.title} title={item.title} body={item.body} />
              ))}
            </div>
          </section>
        ) : null}

        {steps.length ? (
          <section className="mb-12" aria-labelledby="employer-steps-heading">
            <h2 id="employer-steps-heading" className="text-2xl font-semibold text-gray-900 dark:text-white">
              How it works
            </h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary dark:text-mint"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{step.title}</h3>
                    {step.body ? (
                      <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{step.body}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {applicationMethods.length ? (
          <section
            ref={applicationMethodsRef}
            className="mb-12"
            aria-labelledby="employer-application-methods-heading"
          >
            <h2 id="employer-application-methods-heading" className="text-2xl font-semibold text-gray-900 dark:text-white">
              How candidates apply
            </h2>
            <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">
              You choose the application path for each opportunity. STRIDETO supports in-platform applications and
              external destinations — with different review capabilities for each.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {applicationMethods.map((method) => (
                <article
                  key={method.title}
                  className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{method.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{method.body}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {accountBenefits.length ? (
          <section className="mb-12" aria-labelledby="employer-account-benefits-heading">
            <h2 id="employer-account-benefits-heading" className="text-2xl font-semibold text-gray-900 dark:text-white">
              Why create an employer account
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {accountBenefits.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300"
                >
                  <span className="mt-0.5 shrink-0 text-primary dark:text-mint" aria-hidden="true">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {trustItems.length ? (
          <section className="mb-12" aria-labelledby="employer-trust-heading">
            <h2 id="employer-trust-heading" className="text-2xl font-semibold text-gray-900 dark:text-white">
              Built for professional hiring teams
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {trustItems.map((item) => (
                <li
                  key={item.label}
                  className="rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300"
                >
                  {item.href ? (
                    <Link to={item.href} className="font-medium text-primary hover:underline dark:text-mint">
                      {item.label}
                    </Link>
                  ) : (
                    item.label
                  )}
                  {item.note ? (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {faqs.length ? (
          <section className="mb-12" aria-labelledby="employer-faq-heading">
            <h2 id="employer-faq-heading" className="text-2xl font-semibold text-gray-900 dark:text-white">
              Employer FAQ
            </h2>
            <div className="mt-4 space-y-3">
              {faqs.map((faq) => (
                <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </section>
        ) : null}

        {workspaceAvailable ? (
          <EmployerConversionCta placement="employer-page-footer" />
        ) : null}
      </main>
    </>
  );
}
