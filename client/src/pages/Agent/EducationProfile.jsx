import AgentProfile from './AgentProfile';
import { EducationProfessionalProfileSection } from '../../components/agent/EducationProfessionalProfileSection';

export default function EducationProfile() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Education &amp; Mobility Profile</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
          Shared provider identity is the same organization record used across professional workspaces.
          Education specialties and destination expertise stay on this Education page.
        </p>
      </header>
      <AgentProfile variant="section" />
      <EducationProfessionalProfileSection />
    </div>
  );
}
