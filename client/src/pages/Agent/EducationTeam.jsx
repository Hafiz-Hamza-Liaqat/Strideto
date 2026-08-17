import AgentTeam from './AgentTeam';
import { PROVIDER_DOMAIN_IDS } from '@shared/provider/providerDomains.js';

export default function EducationTeam() {
  return <AgentTeam focusDomainId={PROVIDER_DOMAIN_IDS.EDUCATION_MOBILITY} />;
}
