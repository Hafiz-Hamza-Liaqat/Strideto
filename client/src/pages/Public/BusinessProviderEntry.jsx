import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { PROVIDER_DOMAIN_IDS } from '@shared/provider/providerDomains.js';
import { SeoHead } from '../../components/seo';
import { isBusinessServicesWorkspaceLaunched } from '../../config/workspaceLaunchGates';

/**
 * Public product entry for Business Formation Providers.
 * Remains accessible and indexable even when the private workspace is launch-gated.
 * Does not present Education as a subcategory of one Provider Portal.
 */
export default function BusinessProviderEntry() {
  const workspaceOpen = isBusinessServicesWorkspaceLaunched();
  const registerTo = `${ROUTES.AGENT_REGISTER}?domain=${PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES}`;
  const loginTo = `${ROUTES.AGENT_LOGIN}?portal=business`;
  const description =
    'A dedicated professional portal for Business Formation & Corporate Services providers. Education & Mobility uses a separate professional portal.';

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <SeoHead
        title="Business Formation Providers | Strideto"
        description={description}
        canonical={ROUTES.PROVIDERS_BUSINESS_FORMATION}
      />
      <p className="text-sm font-medium text-primary">Strideto</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Business Formation Providers
        </h1>
        <span
          className={
            workspaceOpen
              ? 'inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300'
              : 'inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200'
          }
        >
          {workspaceOpen ? 'Available Now' : 'Coming Soon'}
        </span>
      </div>
      <p className="mt-3 text-base text-slate-600 dark:text-gray-300">
        A dedicated professional portal for Business Formation &amp; Corporate Services providers.
        Education &amp; Mobility uses a separate professional portal.
      </p>
      {workspaceOpen ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={registerTo}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Register as Business Provider
          </Link>
          <Link
            to={loginTo}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500 dark:text-gray-400">
          Provider registration and sign-in open when this workspace launches.
        </p>
      )}
      <p className="mt-6 text-sm text-slate-500 dark:text-gray-400">
        Looking for Education &amp; Mobility?{' '}
        <Link to={ROUTES.PROVIDERS_EDUCATION_MOBILITY} className="text-primary hover:underline">
          Open the Education Provider entry
        </Link>
        .
      </p>
    </main>
  );
}
