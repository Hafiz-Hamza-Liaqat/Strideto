import { useAuth } from '../../context/AuthContext';
import { useAgentAuth } from '../../context/AgentAuthContext';
import { useEmployerAuth } from '../../context/EmployerAuthContext';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';

/**
 * Fail-closed overlay when this tab's expected identity no longer matches
 * the shared origin cookie (another tab signed in as a different account).
 */
export function SessionChangeScreen({ conflict, onContinue, onSignInAgain }) {
  const realmLabel = conflict?.realm === 'agent'
    ? 'provider'
    : conflict?.realm === 'employer'
      ? 'employer'
      : conflict?.realm === 'institution'
        ? 'institution'
        : 'account';

  return (
    <div className="min-h-screen bg-bg-main dark:bg-secondary flex items-center justify-center px-4 py-12">
      <section
        className="w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-change-title"
        aria-describedby="session-change-body"
      >
        <h1 id="session-change-title" className="text-xl font-semibold text-gray-900 dark:text-white">
          Your browser session changed in another tab
        </h1>
        <p id="session-change-body" className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          This tab was signed in as a different {realmLabel}. The shared browser
          session now belongs to another account in the same auth realm. This tab
          will not show the previous account&apos;s data.
        </p>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          Ordinary same-profile tabs share one cookie session. To use two accounts
          at once, open a separate browser profile or an InPrivate/Incognito window.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onContinue}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-primary text-white font-medium"
          >
            Continue with the current session
          </button>
          <button
            type="button"
            onClick={onSignInAgain}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200"
          >
            Sign in again
          </button>
        </div>
      </section>
    </div>
  );
}

export function TabSessionGuard({ children }) {
  const userAuth = useAuth();
  const agentAuth = useAgentAuth();
  const employerAuth = useEmployerAuth();
  const institutionAuth = useInstitutionAuth();

  const conflict =
    userAuth.identityConflict
    || agentAuth.identityConflict
    || employerAuth.identityConflict
    || institutionAuth.identityConflict;

  if (!conflict) return children;

  const owner = conflict.realm === 'agent'
    ? agentAuth
    : conflict.realm === 'employer'
      ? employerAuth
      : conflict.realm === 'institution'
        ? institutionAuth
        : userAuth;

  return (
    <SessionChangeScreen
      conflict={conflict}
      onContinue={() => owner.continueAsCurrentSession?.()}
      onSignInAgain={() => owner.signInAgainFromConflict?.()}
    />
  );
}
