import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { useActiveWorkspace } from '../../context/ActiveWorkspaceContext';
import { loginLocationState } from '../../utils/loginReturn.js';
import { trackApplicationClick } from '../../utils/applicationClickTracking.js';

/** Public application boundary: viewing is public, leaving to apply is auth-gated. */
export function ProtectedExternalApplicationLink({
  destination,
  entityType,
  entityId,
  destinationType = 'external_url',
  children,
  className,
  target,
  rel,
}) {
  const location = useLocation();
  const { isAuthenticated } = useActiveWorkspace();
  const returnState = loginLocationState(location);

  if (!isAuthenticated) {
    return <Link to={ROUTES.LOGIN} state={returnState} className={className}>{children}</Link>;
  }

  const isEmail = destinationType === 'email';
  return (
    <a
      href={destination}
      className={className}
      target={isEmail ? undefined : target}
      rel={isEmail ? undefined : rel}
      onClick={() => trackApplicationClick({ entityType, entityId, destinationType })}
    >
      {children}
    </a>
  );
}
