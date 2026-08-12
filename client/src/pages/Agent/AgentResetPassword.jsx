import { ROUTES } from '../../constants';
import { agentAuthApi } from '../../services/agentService';
import { RealmResetPassword } from '../../components/auth/RealmPasswordRecovery';

export default function AgentResetPassword() {
  return (
    <RealmResetPassword
      realmLabel="Agent"
      loginRoute={ROUTES.AGENT_LOGIN}
      forgotRoute={ROUTES.AGENT_FORGOT_PASSWORD}
      resetApi={(data) => agentAuthApi.resetPassword(data)}
      seoTitle="Set new agent password"
    />
  );
}
