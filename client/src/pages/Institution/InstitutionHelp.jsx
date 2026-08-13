import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { useInstitutionAuth } from '../../context/InstitutionAuthContext';
import { InstitutionGettingStartedGuide } from './InstitutionGettingStartedGuide';
import { useEffect, useState } from 'react';
import { institutionPortalApi } from '../../services/institutionPortalService';

const CARDS = [
  { title: 'What can I do?', body: 'Complete the organization profile, submit verification and a canonical claim, then author official programs and intakes.', to: ROUTES.INSTITUTION_GUIDELINES },
  { title: 'What must be verified?', body: 'Official writes require approved organization verification AND an approved canonical Institution claim. Neither one is enough alone.', to: ROUTES.INSTITUTION_VERIFICATION },
  { title: 'What is free at launch?', body: 'Basic Institution publishing capabilities are free. Wallets and live Stripe stay not configured.', to: ROUTES.INSTITUTION_BILLING },
  { title: 'Why is a feature unavailable?', body: 'Email, verification, or claim may still be pending. Completeness is not verification and a claim is not legitimacy.', to: ROUTES.INSTITUTION_DASHBOARD },
  { title: 'What should I do next?', body: 'Verify email, submit verification, complete the claim, create an official program, then configure intake/admission flow.', to: ROUTES.INSTITUTION_ONBOARDING },
  { title: 'How do I get support?', body: 'Guidelines are the handbook. Contact support for account issues.', to: ROUTES.SUPPORT },
];

export default function InstitutionHelp() {
  const { organizationId, account } = useInstitutionAuth();
  const [workspace, setWorkspace] = useState(null);

  useEffect(() => {
    if (!organizationId) return undefined;
    let active = true;
    institutionPortalApi.dashboard(organizationId)
      .then(({ data }) => { if (active) setWorkspace(data); })
      .catch(() => { if (active) setWorkspace(null); });
    return () => { active = false; };
  }, [organizationId]);

  return (
    <div className="space-y-4 max-w-6xl">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Help</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">Short answers for Institution staff. Guidelines remain the handbook.</p>
      {workspace ? (
        <InstitutionGettingStartedGuide
          emailVerified={Boolean(account?.emailVerified)}
          profileCompleteness={workspace.profileCompleteness}
          verificationStatus={workspace.verificationStatus}
          claimState={workspace.claimState}
        />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link key={card.title} to={card.to} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-primary">
            <h2 className="font-semibold text-gray-900 dark:text-white">{card.title}</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
