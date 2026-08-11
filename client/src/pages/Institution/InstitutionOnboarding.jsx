import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../constants';

/** Onboarding is not a duplicate portal — Verification owns the dossier. */
export default function InstitutionOnboarding() {
  return <Navigate to={ROUTES.INSTITUTION_VERIFICATION} replace />;
}
