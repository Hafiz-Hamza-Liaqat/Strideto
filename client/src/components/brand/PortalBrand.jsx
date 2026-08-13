import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { Logo } from './Logo';

const ROLE_SUBTITLE = {
  employer: 'Employer Portal',
  agent: 'Agent Portal',
  institution: 'Institution Portal',
};

/**
 * Shared Employer / Agent / Institution portal wordmark.
 * Logo always navigates to public home without logging the user out.
 */
export function PortalBrand({
  role,
  subtitle,
  className = '',
  height = 28,
}) {
  const label = subtitle || ROLE_SUBTITLE[role] || 'Portal';
  return (
    <div className={`min-w-0 ${className}`}>
      <Link
        to={ROUTES.HOME}
        className="inline-flex items-center gap-2 min-w-0 text-gray-900 dark:text-white"
        aria-label="Strideto home"
      >
        <Logo variant="full" height={height} className="shrink-0" />
      </Link>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}

export default PortalBrand;
