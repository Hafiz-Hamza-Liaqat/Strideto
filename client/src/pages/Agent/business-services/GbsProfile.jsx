import { GbsProfessionalProfileSection } from '../../../components/agent/GbsProfessionalProfileSection';
import GbsVerification from './GbsVerification';

export default function GbsProfile() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Business Formation Profile</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
          Business professional presentation is independent of Education &amp; Mobility.
          Capabilities, jurisdictions, and listings remain authoritative on their dedicated pages.
        </p>
      </header>
      <GbsProfessionalProfileSection />
      <section aria-labelledby="business-eligibility-summary-heading" className="space-y-3">
        <h2 id="business-eligibility-summary-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
          Capabilities &amp; eligibility summary
        </h2>
        <GbsVerification embedded />
      </section>
    </div>
  );
}
