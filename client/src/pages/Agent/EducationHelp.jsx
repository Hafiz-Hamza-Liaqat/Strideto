import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';

const SECTIONS = [
  {
    heading: 'Education setup',
    cards: [
      { title: 'Education Profile', body: 'Shared identity plus Education specialties and destination expertise. Not Business capabilities.', to: ROUTES.AGENT_EDUCATION_PROFILE },
      { title: 'Professional Verification', body: 'Education professional approval is domain-specific. Organization verified ≠ Education approved.', to: ROUTES.AGENT_EDUCATION_VERIFICATION },
      { title: 'Education Team', body: 'Agency membership is shared. Education duties do not grant Business capability access or professional verification.', to: ROUTES.AGENT_EDUCATION_TEAM },
    ],
  },
  {
    heading: 'Education work',
    cards: [
      { title: 'Services vs Marketplace', body: 'An active Education service does not create a Marketplace post. Promotions are separate and Admin-moderated.', to: ROUTES.AGENT_EDUCATION_SERVICES },
      { title: 'Marketplace & free promotion', body: 'After Education approval: one free 7-day promotion per Provider subject. Paid plans are not configured. No off-platform CTAs on free posts.', to: ROUTES.AGENT_EDUCATION_MARKETPLACE },
      { title: 'Availability', body: 'Education consultation windows. Not Business Services coverage.', to: ROUTES.AGENT_EDUCATION_AVAILABILITY },
      { title: 'Student Leads', body: 'Education Marketplace and directory leads for this provider subject.', to: ROUTES.AGENT_EDUCATION_LEADS },
      { title: 'Consultations & Cases', body: 'Completed consultation does not auto-create a Case. Student must accept agent_case consent. These are Education ProfessionalCase records only.', to: ROUTES.AGENT_EDUCATION_CONSULTATIONS },
      { title: 'Reviews', body: 'Education professional reviews. Business reviews are not configured.', to: ROUTES.AGENT_EDUCATION_REVIEWS },
    ],
  },
  {
    heading: 'Education communication',
    cards: [
      { title: 'Messages', body: 'Education consultation and ProfessionalCase threads only.', to: ROUTES.AGENT_EDUCATION_MESSAGES },
      { title: 'Notifications', body: 'Education operational events, plus account-security notices when they are tagged as system, payment, or support.', to: ROUTES.AGENT_EDUCATION_NOTIFICATIONS },
      { title: 'Account settings', body: 'Password and sessions only. Education operational shortcuts are not in Settings.', to: ROUTES.AGENT_EDUCATION_SETTINGS },
    ],
  },
];

export default function EducationHelp() {
  return (
    <div className="space-y-8 max-w-3xl min-w-0">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Education &amp; Mobility Help</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
          Covers implemented Education workflows only. Business Services workflows are documented in that workspace.
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
        DOMAIN-SPECIFIC TERMS — FUTURE PRODUCT/LEGAL WORK. This page does not invent Education legal terms or acceptance copy.
      </p>
    </div>
  );
}
