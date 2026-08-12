import { ROUTES } from '../../constants';
import { institutionAuthApi } from '../../services/institutionPortalService';
import { RealmResetPassword } from '../../components/auth/RealmPasswordRecovery';

export default function InstitutionResetPassword() {
  return (
    <RealmResetPassword
      realmLabel="Institution"
      loginRoute={ROUTES.INSTITUTION_LOGIN}
      forgotRoute={ROUTES.INSTITUTION_FORGOT_PASSWORD}
      resetApi={(data) => institutionAuthApi.resetPassword(data)}
      seoTitle="Set new institution password"
    />
  );
}
