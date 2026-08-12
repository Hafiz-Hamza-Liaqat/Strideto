import { ROUTES } from '../../constants';
import { employerAuthApi } from '../../services/employerService';
import { RealmForgotPassword } from '../../components/auth/RealmPasswordRecovery';

export default function EmployerForgotPassword() {
  return (
    <RealmForgotPassword
      realmLabel="Employer"
      loginRoute={ROUTES.EMPLOYER_LOGIN}
      forgotApi={(email) => employerAuthApi.forgotPassword(email)}
      seoTitle="Employer password reset"
      seoDescription="Request a password reset link for your Strideto employer account."
    />
  );
}
