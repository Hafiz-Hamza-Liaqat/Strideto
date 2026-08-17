import { Link } from 'react-router-dom';
import { ROUTES } from '../../../constants';

const SECTIONS = [
  {
    heading: 'Business setup',
    cards: [
      { title: 'Business Profile', body: 'Shared organization identity plus Business professional summary from capabilities, jurisdictions, listings, and eligibility.', to: ROUTES.AGENT_BUSINESS_SERVICES_PROFILE },
      { title: 'Business Verification', body: 'Summary of capability and jurisdiction eligibility. Claims never self-verify. Public Business marketplace stays off.', to: ROUTES.AGENT_BUSINESS_SERVICES_VERIFICATION },
      { title: 'Capabilities', body: 'Claim and evidence Business capabilities. Education specialties are not used here.', to: ROUTES.AGENT_BUSINESS_SERVICES_CAPABILITIES },
      { title: 'Jurisdictions', body: 'Legal service scopes for Business work. Not Education study destinations.', to: ROUTES.AGENT_BUSINESS_SERVICES_JURISDICTIONS },
      { title: 'My Services', body: 'Internal Business listings / service setup. This is not a live public Business marketplace.', to: ROUTES.AGENT_BUSINESS_SERVICES_LISTINGS },
      { title: 'Business Team', body: 'Agency membership is shared. Business duties do not grant Education consultation access.', to: ROUTES.AGENT_BUSINESS_SERVICES_TEAM },
    ],
  },
  {
    heading: 'Business work',
    cards: [
      { title: 'Requests & Quotes', body: 'Business Client → Request → Quote. Quote acceptance is not filing authorization and is not government filing.', to: ROUTES.AGENT_BUSINESS_SERVICES_REQUESTS },
      { title: 'GBS Cases', body: 'Accepted quotes create GbsCase records. Education consultation cases are not shown in this workspace.', to: ROUTES.AGENT_BUSINESS_SERVICES_CASES },
      { title: 'Requirements', body: 'Case requirement packs stay on the GbsCase. Strideto does not file with a government on this page.', to: ROUTES.AGENT_BUSINESS_SERVICES_CASES },
    ],
  },
  {
    heading: 'Business communication',
    cards: [
      { title: 'Messages', body: 'Business request/quote/case inbox status for this workspace.', to: ROUTES.AGENT_BUSINESS_SERVICES_MESSAGES },
      { title: 'Notifications', body: 'Business operational events, plus account-security notices tagged system, payment, or support.', to: ROUTES.AGENT_BUSINESS_SERVICES_NOTIFICATIONS },
      { title: 'Account settings', body: 'Password and sessions only. Business operational shortcuts are not in Settings.', to: ROUTES.AGENT_BUSINESS_SERVICES_SETTINGS },
    ],
  },
];

export default function GbsHelp() {
  return (
    <div className="space-y-8 max-w-3xl min-w-0">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Business Services Help</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
          Covers implemented Business Services workflows only. Education student, availability, and marketplace workflows are documented in that workspace.
          The public Business marketplace is off. This workspace does not file with a government.
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
      <p className="text-xs text-slate-500 dark:text-gray-400">
        DOMAIN-SPECIFIC TERMS — FUTURE PRODUCT/LEGAL WORK. This page does not invent Business legal terms, filing authorization text, or marketplace-live claims.
      </p>
    </div>
  );
}
