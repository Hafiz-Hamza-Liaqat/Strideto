import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../constants';

/** Legacy /saved-jobs compatibility wrapper. Canonical saved inventory is /journey/saved. */
export default function SavedJobs() {
  return <Navigate to={ROUTES.JOURNEY_SAVED} replace />;
}
