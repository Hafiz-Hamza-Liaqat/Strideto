import { ROUTES } from '../../constants';
import { institutionAuthApi } from '../../services/institutionPortalService';
import { RealmForgotPassword } from '../../components/auth/RealmPasswordRecovery';

export default function InstitutionForgotPassword() {
  return (
    <RealmForgotPassword
      realmLabel="Institution"
      loginRoute={ROUTES.INSTITUTION_LOGIN}
      forgotApi={(email) => institutionAuthApi.forgotPassword(email)}
      seoTitle="Institution password reset"
      seoDescription="Request a password reset link for your Strideto institution account."
    />
  );
}
