import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useEmployerAuth } from '../context/EmployerAuthContext';

/**
 * Tour target anchors for Driver.js — kept in the DOM without consuming navbar width.
 * Visible “More” / drawer links carry the same destinations for users.
 * When these nodes are not highlightable, the tour falls back to centered cards.
 */
export function TourAnchors() {
  const { isAuthenticated } = useAuth();
  const { isAuthenticated: isEmployer } = useEmployerAuth();

  return (
    <div
      className="pointer-events-none absolute w-px h-px overflow-hidden opacity-0"
      aria-hidden="true"
      data-tour-anchors="true"
    >
      <Link to={ROUTES.RESUME_BUILDER} data-tour="resume-builder" tabIndex={-1}>
        Resume
      </Link>
      <Link to={ROUTES.CAREER_GUIDANCE} data-tour="career-guidance" tabIndex={-1}>
        Career
      </Link>
      {isAuthenticated ? (
        <Link to={ROUTES.DASHBOARD} data-tour="dashboard" tabIndex={-1}>
          Dashboard
        </Link>
      ) : null}
      {isEmployer ? (
        <Link to={ROUTES.EMPLOYER_DASHBOARD} data-tour="employer-dashboard" tabIndex={-1}>
          Employer
        </Link>
      ) : null}
    </div>
  );
}
