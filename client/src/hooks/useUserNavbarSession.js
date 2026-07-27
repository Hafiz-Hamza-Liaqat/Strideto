import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { shouldEnableUserNavbarSession } from '../auth/authRealm';

/**
 * Whether normal-user navbar features (notifications, talent API) may run on the current route.
 */
export function useUserNavbarSession() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const enabled = shouldEnableUserNavbarSession(pathname, { isUserAuthenticated: isAuthenticated });
  return { enabled, pathname };
}
