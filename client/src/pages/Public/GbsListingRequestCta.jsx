import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES, STAFF_ROLES } from '../../constants';
import { ui } from '../../design-system/surfaceClasses';
import { loginLocationState } from '../../utils/loginReturn';

export function GbsListingRequestCta({ listingSlug }) {
  const { isAuthenticated, user } = useAuth();
  const requestPath = `${ROUTES.BUSINESS}/requests/new?listingSlug=${encodeURIComponent(listingSlug)}`;
  const staff = STAFF_ROLES.includes(user?.role);

  if (staff) return null;

  if (!isAuthenticated) {
    return (
      <Link
        to={ROUTES.LOGIN}
        state={loginLocationState({ pathname: `${ROUTES.BUSINESS}/requests/new`, search: `?listingSlug=${encodeURIComponent(listingSlug)}` })}
        className={ui.primaryBtn}
      >
        Request Service
      </Link>
    );
  }

  return (
    <Link to={requestPath} className={ui.primaryBtn}>
      Request Service
    </Link>
  );
}
