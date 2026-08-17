import AgentTeam from '../AgentTeam';
import { PROVIDER_DOMAIN_IDS } from '@shared/provider/providerDomains.js';

export default function GbsTeam() {
  return <AgentTeam focusDomainId={PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES} />;
}
