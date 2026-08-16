import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';

const SECTIONS = [
  {
    heading: 'Provider account',
    cards: [
      { title: 'Provider Dashboard', body: 'One login. Choose Acting as (Independent / Agency), then Active Dashboard (Education or Business).', to: `${ROUTES.AGENT_DASHBOARD}?home=1` },
      { title: 'Account settings', body: 'Password, sessions, language, and shared preferences. Domain forms stay in their workspaces.', to: ROUTES.AGENT_SETTINGS },
      { title: 'Team (Agency)', body: 'Team membership does not professionally verify anyone and does not grant a missing domain.', to: ROUTES.AGENT_TEAM },
    ],
  },
  {
    heading: 'Education & Mobility',
    cards: [
      { title: 'Professional Verification', body: 'Education professional approval is domain-specific. Organization verified ≠ Education approved.', to: ROUTES.AGENT_VERIFICATION },
      { title: 'Services vs Marketplace', body: 'An active Education service does not create a Marketplace post. Promotions are separate and Admin-moderated.', to: ROUTES.AGENT_SERVICES },
      { title: 'Marketplace & free promotion', body: 'After Education approval: one free 7-day promotion per Provider subject. Paid plans are not configured. No off-platform CTAs on free posts.', to: ROUTES.AGENT_MARKETPLACE },
      { title: 'Consultations & Cases', body: 'Completed consultation does not auto-create a Case. Student must accept agent_case consent.', to: ROUTES.AGENT_CONSULTATIONS },
    ],
  },
  {
    heading: 'Business Services',
    cards: [
      { title: 'Business Verification', body: 'Summary of capability and jurisdiction eligibility. Claims never self-verify. Public Business marketplace stays off.', to: ROUTES.AGENT_BUSINESS_SERVICES_VERIFICATION },
      { title: 'Requests & Quotes', body: 'Business Client → Request → Quote. Quote acceptance is not filing authorization.', to: ROUTES.AGENT_BUSINESS_SERVICES_REQUESTS },
      { title: 'GBS Cases', body: 'Accepted quotes create GbsCase records. Not Education ProfessionalCase.', to: ROUTES.AGENT_BUSINESS_SERVICES_CASES },
    ],
  },
  {
    heading: 'Trust & support',
    cards: [
      { title: 'Trust Center', body: 'Shared summary for identity, organization, and domain status. Operational forms live elsewhere.', to: ROUTES.AGENT_TRUST },
      { title: 'Guidelines', body: 'Handbook for truthful professional conduct.', to: ROUTES.AGENT_GUIDELINES },
      { title: 'Support', body: 'Account issues. No live email is sent while delivery Worker is stopped.', to: ROUTES.SUPPORT },
    ],
  },
];

export default function AgentHelp() {
  return (
    <div className="space-y-8 max-w-3xl min-w-0">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Help</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
          Provider help covers account, Education &amp; Mobility, and Business Services. Paid subscription plans and referral rewards are not implemented.
        </p>
      </header>
      {SECTIONS.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{section.heading}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.cards.map((card) => (
              <Link key={card.title} to={card.to} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-primary min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white break-words">{card.title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-gray-400 break-words">{card.body}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
