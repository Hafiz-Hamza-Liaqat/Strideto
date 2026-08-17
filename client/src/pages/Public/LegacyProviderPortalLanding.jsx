import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';

/**
 * LEGACY COMPATIBILITY landing for historic /agent and generic Provider Portal links.
 * New public product entry is split; this page never silently chooses Education.
 */
export default function LegacyProviderPortalLanding() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-sm font-medium text-primary">Strideto</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
        Professional provider portals
      </h1>
      <p className="mt-3 text-base text-slate-600 dark:text-gray-300">
        Education &amp; Mobility and Business Formation are separate Strideto professional products.
        Choose the portal that matches your work. Existing accounts can still sign in with the shared provider login.
      </p>
      <ul className="mt-8 space-y-3">
        <li>
          <Link
            to={ROUTES.PROVIDERS_EDUCATION_MOBILITY}
            className="block rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-gray-900 dark:text-white hover:border-primary"
          >
            Education &amp; Mobility Providers
          </Link>
        </li>
        <li>
          <Link
            to={ROUTES.PROVIDERS_BUSINESS_FORMATION}
            className="block rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-gray-900 dark:text-white hover:border-primary"
          >
            Business Formation Providers
          </Link>
        </li>
      </ul>
      <p className="mt-8 text-sm text-slate-500 dark:text-gray-400">
        Already registered?{' '}
        <Link to={ROUTES.AGENT_LOGIN} className="text-primary hover:underline">
          Provider sign-in (legacy compatibility)
        </Link>
        {' · '}
        <Link to={ROUTES.AGENT_DASHBOARD} className="text-primary hover:underline">
          Provider Dashboard (legacy compatibility home)
        </Link>
      </p>
    </main>
  );
}
