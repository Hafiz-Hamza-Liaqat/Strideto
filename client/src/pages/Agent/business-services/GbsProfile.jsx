import AgentProfile from '../AgentProfile';
import GbsVerification from './GbsVerification';

export default function GbsProfile() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Business Services Profile</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
          Shared organization identity is the same provider record used across professional workspaces.
          Business professional representation comes from current capabilities, jurisdictions, listings, and eligibility — not Education specialties.
        </p>
      </header>
      <AgentProfile variant="section" />
      <section aria-labelledby="business-professional-profile-heading" className="space-y-3">
        <h2 id="business-professional-profile-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
          Business professional profile
        </h2>
        <GbsVerification />
      </section>
    </div>
  );
}
