import { ROUTES } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useEmployerAuth } from '../context/EmployerAuthContext';

/**
 * Decorative Driver.js highlight targets. These are not navigation controls —
 * visible navbar / drawer links remain the user-facing destinations.
 * Kept out of the accessibility tree (inert + aria-hidden) so they cannot
 * receive focus while aria-hidden.
 */
export function TourAnchors() {
  const { isAuthenticated } = useAuth();
  const { isAuthenticated: isEmployer } = useEmployerAuth();

  return (
    <div
      className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
      aria-hidden="true"
      inert=""
      data-tour-anchors="true"
    >
      <span data-tour="resume-builder" data-tour-href={ROUTES.RESUME_BUILDER} />
      <span data-tour="career-guidance" data-tour-href={ROUTES.CAREER_GUIDANCE} />
      {isAuthenticated ? <span data-tour="dashboard" data-tour-href={ROUTES.DASHBOARD} /> : null}
      {isEmployer ? (
        <span data-tour="employer-dashboard" data-tour-href={ROUTES.EMPLOYER_DASHBOARD} />
      ) : null}
    </div>
  );
}
