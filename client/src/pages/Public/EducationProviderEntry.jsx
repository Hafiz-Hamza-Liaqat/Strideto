import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { PROVIDER_DOMAIN_IDS } from '@shared/provider/providerDomains.js';

/**
 * Public product entry for Education & Mobility Providers.
 * Does not present Business Formation as a subcategory of one Provider Portal.
 */
export default function EducationProviderEntry() {
  const registerTo = `${ROUTES.AGENT_REGISTER}?domain=${PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY}`;
  const loginTo = `${ROUTES.AGENT_LOGIN}?portal=education`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-sm font-medium text-primary">Strideto</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Education &amp; Mobility Providers
      </h1>
      <p className="mt-3 text-base text-slate-600 dark:text-gray-300">
        A dedicated professional portal for education consultants and mobility advisors.
        Business Formation services use a separate professional portal.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to={registerTo}
          className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          Register as Education Provider
        </Link>
        <Link
          to={loginTo}
          className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Sign in
        </Link>
      </div>
      <p className="mt-6 text-sm text-slate-500 dark:text-gray-400">
        Looking for Business Formation &amp; Corporate Services?{' '}
        <Link to={ROUTES.PROVIDERS_BUSINESS_FORMATION} className="text-primary hover:underline">
          Open the Business Formation Provider entry
        </Link>
        .
      </p>
    </main>
  );
}
