const TOPICS = [
  ['Account vs verification', 'An Institution account is a login. Verification is a separate Admin review. Completing a profile never means verified.'],
  ['Organization verification', 'The dossier covers identity, registration/accreditation, representative authority, location, and official source URLs. Maps/Business URLs are supporting evidence only. You cannot self-approve, set status, or create a trust badge.'],
  ['Canonical claim', 'A claim answers which canonical Institution record this verified organization represents. It does not establish legitimacy by itself. Competing approved claims go to manual review. No silent overwrite.'],
  ['Representative authority', 'Named representative, role, and authority evidence are explicit. Domain ownership alone is not authorized control of all Institution data.'],
  ['Programs and official facts', 'You may manage Programs you own through an approved claim. Tuition uses integer minor units. High-impact published facts conflict rather than overwrite stronger authority.'],
  ['Test Acceptance', 'Institution and Program scope only. Country-wide policy cannot be changed here. History is kept by supersession.'],
  ['Intakes', 'Dates are calendar dates (YYYY-MM-DD) with no guessed timezone. Enable internal Strideto applications, an official external URL, or both.'],
  ['Internal vs external applications', 'Internal: Student consents to a purpose-scoped snapshot. External: application happens on the Institution website; Strideto does not invent application state.'],
  ['Student data privacy / Vault', 'Institution membership never grants whole Student profiles, Vault, Copilot, Budget, unrelated applications, or Agent cases. Document access requires an exact Vault grant.'],
  ['Scholarships', 'You may manage your own institutional scholarships after verification and claim approval. Listing a government award does not make you its authority. No guarantee wording.'],
  ['Source / provenance / freshness', 'Official Institution facts carry institution_official provenance. Viewing a page does not mark facts fresh. Reconfirm only through the explicit audit workflow.'],
  ['Conflict review', 'Conflicts show existing vs proposed values, source, and review status. Admin Data Quality integrates through accepted contracts.'],
  ['Team roles', 'Owner, Admin, Admissions/Program Manager (editor), Viewer. Invites expire. Last owner cannot be removed. Cross-Institution membership is denied.'],
  ['Notifications', 'In-app only. No real email. Verification, claim, admissions, team, and data-quality events appear in the inbox with deep links. Internal reviewer notes are never shown.'],
  ['Launch pricing', 'Registration, verification submission, profile, and canonical Program management are free. Future paid products display Not configured until pricing exists.'],
  ['Support', 'Use Settings for security. Contact platform support for account issues. Normal use should not require reading legal Terms.'],
];

export default function InstitutionGuidelines() {
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Institution guidelines</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">Practical rules for official-data use. This is not a substitute for Terms & Conditions.</p>
      {TOPICS.map(([title, body]) => (
        <section key={title} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{body}</p>
        </section>
      ))}
    </div>
  );
}
