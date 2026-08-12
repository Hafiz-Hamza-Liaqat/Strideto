import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
import { Panel, primaryButton, secondaryButton } from './InstitutionUi';

const SECTIONS = [
  {
    id: 'identity',
    title: 'Account vs verification',
    body: 'An Institution account is a login. Verification is a separate Admin review. Completing a profile never means verified.',
    cta: { label: 'Organization profile', to: ROUTES.INSTITUTION_PROFILE },
  },
  {
    id: 'verification',
    title: 'Organization verification',
    body: 'The dossier covers identity, registration/accreditation, representative authority, location, and official source URLs. Maps/Business URLs are supporting evidence only. You cannot self-approve, set status, or create a trust badge.',
    cta: { label: 'Verification workspace', to: ROUTES.INSTITUTION_VERIFICATION },
  },
  {
    id: 'claim',
    title: 'Canonical claim',
    body: 'A claim answers which canonical Institution record this verified organization represents. It does not establish legitimacy by itself. Competing approved claims go to manual review. No silent overwrite.',
    cta: { label: 'Canonical claim', to: ROUTES.INSTITUTION_CLAIM },
  },
  {
    id: 'representative',
    title: 'Representative authority',
    body: 'Named representative, role, and authority evidence are explicit. Domain ownership alone is not authorized control of all Institution data.',
    cta: { label: 'Edit representative fields', to: ROUTES.INSTITUTION_PROFILE },
  },
  {
    id: 'programs',
    title: 'Programs and official facts',
    body: 'You may manage Programs you own through an approved claim. Tuition uses integer minor units. High-impact published facts conflict rather than overwrite stronger authority.',
    cta: { label: 'Programs', to: ROUTES.INSTITUTION_PROGRAMS },
  },
  {
    id: 'tests',
    title: 'Test Acceptance',
    body: 'Institution and Program scope only. Country-wide policy cannot be changed here. History is kept by supersession.',
    cta: { label: 'Test Acceptance', to: ROUTES.INSTITUTION_TEST_ACCEPTANCE },
  },
  {
    id: 'intakes',
    title: 'Intakes',
    body: 'Dates are calendar dates (YYYY-MM-DD) with no guessed timezone. Enable internal Strideto applications, an official external URL, or both.',
    cta: { label: 'Intakes', to: ROUTES.INSTITUTION_INTAKES },
  },
  {
    id: 'applications',
    title: 'Internal vs external applications',
    body: 'Internal: Student consents to a purpose-scoped snapshot. External: application happens on the Institution website; Strideto does not invent application state.',
    cta: { label: 'Admissions inbox', to: ROUTES.INSTITUTION_APPLICATIONS },
  },
  {
    id: 'privacy',
    title: 'Student data privacy / Vault',
    body: 'Institution membership never grants whole Student profiles, Vault, Copilot, Budget, unrelated applications, or Agent cases. Document access requires an exact Vault grant.',
  },
  {
    id: 'scholarships',
    title: 'Scholarships',
    body: 'You may manage your own institutional scholarships after verification and claim approval. Listing a government award does not make you its authority. No guarantee wording.',
    cta: { label: 'Scholarships', to: ROUTES.INSTITUTION_SCHOLARSHIPS },
  },
  {
    id: 'freshness',
    title: 'Source / provenance / freshness',
    body: 'Official Institution facts carry institution_official provenance. Viewing a page does not mark facts fresh. Reconfirm only through the explicit audit workflow.',
    cta: { label: 'Data quality', to: ROUTES.INSTITUTION_DATA_QUALITY },
  },
  {
    id: 'conflicts',
    title: 'Conflict review',
    body: 'Conflicts show existing vs proposed values, source, and review status. Admin Data Quality integrates through accepted contracts.',
    cta: { label: 'Open conflicts', to: ROUTES.INSTITUTION_DATA_QUALITY },
  },
  {
    id: 'team',
    title: 'Team roles',
    body: 'Owner, Admin, Admissions/Program Manager (editor), Viewer. Invites expire. Last owner cannot be removed. Cross-Institution membership is denied.',
    cta: { label: 'Team management', to: ROUTES.INSTITUTION_TEAM },
  },
  {
    id: 'notifications',
    title: 'Notifications',
    body: 'In-app only. No real email. Verification, claim, admissions, team, and data-quality events appear in the inbox with deep links. Internal reviewer notes are never shown.',
    cta: { label: 'Notifications inbox', to: ROUTES.INSTITUTION_NOTIFICATIONS },
  },
  {
    id: 'pricing',
    title: 'Launch pricing',
    body: 'Registration, verification submission, profile, and canonical Program management are free. Future paid products display Not configured until pricing exists.',
    cta: { label: 'Billing / usage', to: ROUTES.INSTITUTION_BILLING },
  },
  {
    id: 'support',
    title: 'Support & security',
    body: 'Use Settings for password and session security. Contact platform support for account issues. Normal use should not require reading legal Terms.',
    cta: { label: 'Settings / security', to: ROUTES.INSTITUTION_SETTINGS },
  },
];

export default function InstitutionGuidelines() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-sm font-semibold text-primary">Operating handbook</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Institution guidelines</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Practical rules for official-data use. This is not a substitute for Terms & Conditions.</p>
      </div>

      <Panel title="Quick start">
        <div className="flex flex-wrap gap-2">
          <Link className={primaryButton} to={ROUTES.INSTITUTION_PROFILE}>Complete profile</Link>
          <Link className={secondaryButton} to={ROUTES.INSTITUTION_VERIFICATION}>Verification</Link>
          <Link className={secondaryButton} to={ROUTES.INSTITUTION_CLAIM}>Canonical claim</Link>
          <Link className={secondaryButton} to={ROUTES.INSTITUTION_GUIDELINES}>Refresh this page</Link>
        </div>
      </Panel>

      <nav aria-label="Guideline sections" className="flex flex-wrap gap-2 text-sm">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="rounded-full border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
            {section.title}
          </a>
        ))}
      </nav>

      {SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 scroll-mt-24">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{section.title}</h2>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{section.body}</p>
          {section.cta ? (
            <Link className={`${secondaryButton} mt-4 inline-flex`} to={section.cta.to}>{section.cta.label}</Link>
          ) : null}
        </section>
      ))}
    </div>
  );
}
