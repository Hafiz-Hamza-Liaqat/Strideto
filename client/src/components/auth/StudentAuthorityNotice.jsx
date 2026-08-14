import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { loginLocationState } from '../../utils/loginReturn.js';
import { useLocation } from 'react-router-dom';

/**
 * Shown when a B2B workspace is active and the visitor tries a Student-only
 * write (apply, save-as-student, tracker). Does not mint a User session.
 */
export function StudentAuthorityNotice({ className = '' }) {
  const location = useLocation();
  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 ${className}`}
      role="status"
    >
      <p>A Student account is required for this action.</p>
      <Link
        to={ROUTES.LOGIN}
        state={loginLocationState(location)}
        className="mt-2 inline-flex min-h-[44px] items-center font-medium text-primary underline-offset-2 hover:underline dark:text-mint"
      >
        Sign in as Student
      </Link>
    </div>
  );
}
