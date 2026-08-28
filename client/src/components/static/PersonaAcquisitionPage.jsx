/**
 * Shared layout for public persona/service acquisition pages (SEO-P1).
 * Truthful copy only — no invented stats, testimonials, or partner logos.
 */
import { Link } from 'react-router-dom';
import { SeoHead } from '../seo';
import { breadcrumbSchema, combineSchemas, webPageSchema } from '../../seo/schemas';
import { ROUTES } from '../../constants';

function StatusBadge({ available, availableLabel = 'Available Now', comingSoonLabel = 'Coming Soon' }) {
  return (
    <span
      className={
        available
          ? 'inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300'
          : 'inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200'
      }
    >
      {available ? availableLabel : comingSoonLabel}
    </span>
  );
}

function CtaButton({ to, variant = 'primary', children }) {
  const base =
    'inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900';
  const styles =
    variant === 'primary'
      ? `${base} bg-primary text-white hover:bg-primary/90`
      : `${base} border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60`;

  return (
    <Link to={to} className={styles}>
      {children}
    </Link>
  );
}

export function PersonaAcquisitionPage({
  title,
  description,
  canonical,
  breadcrumbLabel,
  heading,
  intro,
  workspaceAvailable = null,
  workspaceStatusNote = null,
  sections = [],
  primaryCtas = [],
  secondaryCtas = [],
  resourceLinks = [],
}) {
  const showWorkspaceBadge = workspaceAvailable !== null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <SeoHead
        title={title}
        description={description}
        canonical={canonical}
        jsonLd={combineSchemas(
          breadcrumbSchema(
            [
              { name: 'Home', url: ROUTES.HOME },
              { name: breadcrumbLabel, url: canonical },
            ],
            canonical
          ),
          webPageSchema({ name: heading, description, url: canonical })
        )}
      />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        <Link to={ROUTES.HOME} className="hover:text-primary dark:hover:text-mint">
          Home
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <span className="text-gray-700 dark:text-gray-300">{breadcrumbLabel}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{heading}</h1>
        {showWorkspaceBadge ? <StatusBadge available={workspaceAvailable} /> : null}
      </div>

      <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">{intro}</p>

      {workspaceStatusNote ? (
        <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {workspaceStatusNote}
        </p>
      ) : null}

      {sections.map((section) => (
        <section key={section.title} className="mt-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{section.title}</h2>
          {section.body ? (
            <p className="mt-2 text-gray-600 dark:text-gray-300">{section.body}</p>
          ) : null}
          {section.items?.length ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-600 dark:text-gray-300">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {section.subsections?.map((sub) => (
            <div key={sub.title} className="mt-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{sub.title}</h3>
              {sub.body ? <p className="mt-1 text-gray-600 dark:text-gray-300">{sub.body}</p> : null}
            </div>
          ))}
        </section>
      ))}

      {resourceLinks.length ? (
        <section className="mt-10" aria-labelledby="persona-resource-links-heading">
          <h2 id="persona-resource-links-heading" className="text-xl font-semibold text-gray-900 dark:text-white">
            Explore opportunities and resources
          </h2>
          <ul className="mt-4 space-y-2">
            {resourceLinks.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="inline-flex min-h-[44px] items-center text-primary dark:text-mint hover:underline"
                >
                  {link.label}
                </Link>
                {link.note ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{link.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(primaryCtas.length || secondaryCtas.length) ? (
        <section className="mt-10 border-t border-gray-200 pt-8 dark:border-gray-700" aria-labelledby="persona-cta-heading">
          <h2 id="persona-cta-heading" className="text-xl font-semibold text-gray-900 dark:text-white">
            Get started
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {primaryCtas.map((cta) => (
              <CtaButton key={cta.to} to={cta.to} variant="primary">
                {cta.label}
              </CtaButton>
            ))}
            {secondaryCtas.map((cta) => (
              <CtaButton key={cta.to} to={cta.to} variant="secondary">
                {cta.label}
              </CtaButton>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
