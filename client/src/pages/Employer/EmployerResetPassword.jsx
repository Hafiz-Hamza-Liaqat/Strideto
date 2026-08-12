import { ROUTES } from '../../constants';
import { employerAuthApi } from '../../services/employerService';
import { RealmResetPassword } from '../../components/auth/RealmPasswordRecovery';

export default function EmployerResetPassword() {
  return (
    <RealmResetPassword
      realmLabel="Employer"
      loginRoute={ROUTES.EMPLOYER_LOGIN}
      forgotRoute={ROUTES.EMPLOYER_FORGOT_PASSWORD}
      resetApi={(data) => employerAuthApi.resetPassword(data)}
      seoTitle="Set new employer password"
    />
  );
}
