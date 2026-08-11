import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../constants';

export default function InstitutionHelp() {
  return <Navigate to={ROUTES.INSTITUTION_GUIDELINES} replace />;
}
