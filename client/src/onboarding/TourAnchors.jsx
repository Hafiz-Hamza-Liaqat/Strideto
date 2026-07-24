import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useEmployerAuth } from '../context/EmployerAuthContext';

/**
 * Compact header anchors for Driver.js tour highlights.
 * Hidden on small screens to avoid crowding the sticky navbar;
 * tour steps still find them on ≥lg where they are visible.
 */
export function TourAnchors() {
  const { t } = useTranslation(['navbar', 'common']);
  const { isAuthenticated } = useAuth();
  const { isAuthenticated: isEmployer } = useEmployerAuth();

  const linkClass =
    'px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-mint rounded-lg link-hover whitespace-nowrap min-h-[44px] inline-flex items-center';

  return (
    <div className="hidden lg:flex items-center gap-0.5 shrink-0">
      <Link to={ROUTES.RESUME_BUILDER} data-tour="resume-builder" className={linkClass} aria-label={t('navbar:resumeBuilder')}>
        {t('navbar:resume')}
      </Link>
      <Link to={ROUTES.CAREER_GUIDANCE} data-tour="career-guidance" className={linkClass} aria-label={t('navbar:careerGuidance')}>
        {t('navbar:careerGuidance')}
      </Link>
      {isAuthenticated && (
        <Link to={ROUTES.DASHBOARD} data-tour="dashboard" className={linkClass} aria-label={t('navbar:dashboard')}>
          {t('navbar:dashboard')}
        </Link>
      )}
      {isEmployer && (
        <Link to={ROUTES.EMPLOYER_DASHBOARD} data-tour="employer-dashboard" className={linkClass} aria-label="Employer Dashboard">
          Employer
        </Link>
      )}
    </div>
  );
}
