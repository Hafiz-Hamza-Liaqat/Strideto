import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';

const CARDS = [
  { title: 'What can I do?', body: 'Complete a professional profile, define services, set availability, and use marketplace or consultations only when eligible.', to: ROUTES.AGENT_GUIDELINES },
  { title: 'What must be verified?', body: 'Email ownership and organization/professional verification are required before marketplace publication or commerce actions.', to: ROUTES.AGENT_VERIFICATION },
  { title: 'What is free at launch?', body: 'Profile, services, and consultations can be prepared. Payouts and live Stripe stay not configured.', to: ROUTES.AGENT_USAGE_BILLING },
  { title: 'Why is a feature unavailable?', body: 'Verification, email, or provider configuration may still be pending. The dashboard cards show 0 or not configured honestly.', to: ROUTES.AGENT_DASHBOARD },
  { title: 'What should I do next?', body: 'Verify email, complete the dossier, define services, set availability, then use marketplace when approved.', to: ROUTES.AGENT_ONBOARDING },
  { title: 'How do I get support?', body: 'Guidelines are the handbook. Contact support for account issues. No live email is sent while delivery is stopped.', to: ROUTES.SUPPORT },
];

export default function AgentHelp() {
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Help</h1>
      <p className="text-sm text-slate-600 dark:text-gray-400">Short answers for everyday Agent use. Guidelines remain the handbook.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link key={card.title} to={card.to} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-primary">
            <h2 className="font-semibold text-gray-900 dark:text-white">{card.title}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
