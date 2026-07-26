import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useEmployerAuth } from '../context/EmployerAuthContext';

/**
 * Header anchors for Driver.js tour highlights.
 * Compact on small screens so tour targets stay visible and highlightable below lg.
 */
export function TourAnchors() {
  const { t } = useTranslation(['navbar', 'common']);
  const { isAuthenticated } = useAuth();
  const { isAuthenticated: isEmployer } = useEmployerAuth();

  const linkClass =
    'px-1.5 sm:px-2 py-1.5 text-[11px] sm:text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-mint rounded-lg link-hover whitespace-nowrap min-h-[44px] inline-flex items-center';

  return (
    <div className="flex items-center gap-0 shrink-0 max-w-[42vw] sm:max-w-none overflow-x-auto overscroll-x-contain">
      <Link to={ROUTES.RESUME_BUILDER} data-tour="resume-builder" className={linkClass} aria-label={t('navbar:resumeBuilder')}>
        {t('navbar:resume')}
      </Link>
      <Link to={ROUTES.CAREER_GUIDANCE} data-tour="career-guidance" className={`${linkClass} max-[360px]:hidden`} aria-label={t('navbar:careerGuidance')}>
        {t('navbar:careerGuidance')}
      </Link>
      {isAuthenticated && (
        <Link to={ROUTES.DASHBOARD} data-tour="dashboard" className={`${linkClass} max-sm:hidden`} aria-label={t('navbar:dashboard')}>
          {t('navbar:dashboard')}
        </Link>
      )}
      {isEmployer && (
        <Link to={ROUTES.EMPLOYER_DASHBOARD} data-tour="employer-dashboard" className={`${linkClass} max-sm:hidden`} aria-label="Employer Dashboard">
          Employer
        </Link>
      )}
    </div>
  );
}
