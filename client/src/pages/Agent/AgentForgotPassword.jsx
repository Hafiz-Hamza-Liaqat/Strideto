import { ROUTES } from '../../constants';
import { agentAuthApi } from '../../services/agentService';
import { RealmForgotPassword } from '../../components/auth/RealmPasswordRecovery';

export default function AgentForgotPassword() {
  return (
    <RealmForgotPassword
      realmLabel="Agent"
      loginRoute={ROUTES.AGENT_LOGIN}
      forgotApi={(email) => agentAuthApi.forgotPassword(email)}
      seoTitle="Agent password reset"
      seoDescription="Request a password reset link for your Strideto agent account."
    />
  );
}
