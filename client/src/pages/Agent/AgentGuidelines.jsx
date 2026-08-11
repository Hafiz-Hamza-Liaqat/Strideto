const TOPICS = [
  ['Profile vs verification', 'Completing a profile is self-declared information. Verification is a separate human review. 100% completeness never means verified.'],
  ['Registration and license evidence', 'A registration or license number is a claim, not proof. Submit official registry or regulator URLs so a reviewer can open the source. Numbers alone are not sufficient.'],
  ['Jurisdiction-aware credentials', 'Credential policy is required, optional, or not applicable by country and professional/agency type. Do not force a company registration number where it does not apply.'],
  ['Maps / Business limitation', 'Google Maps or Google Business URLs are supporting location evidence only. They can never alone result in VERIFIED. Strideto does not scrape Maps.'],
  ['Review process', 'After you submit, Admin reviews the dossier. States include pending, under review, needs information, enhanced review, approved, rejected, suspended, revoked, and expired.'],
  ['Needs information / resubmit', 'If reviewers need more information, you will see the applicant-facing reason and can resubmit. Internal reviewer notes are never shown.'],
  ['Service publishing', 'Drafts may be created before approval. Activation and public publishing require approved verification. Guaranteed visa, admission, scholarship, or job claims are blocked.'],
  ['Marketplace rules', 'Separate Agent statement, official fact, and Strideto recommendation. Posting something does not make it an official fact. Approved-only public projection.'],
  ['Consultations', 'Bookings use the IANA timezone you configure. No silent Pakistan/Karachi default. Double booking is rejected. Payment state is provider-authoritative.'],
  ['Cases and Student approval', 'You cannot self-approve Student decisions. Case transfer does not transfer Vault grants. Private Agent notes stay private.'],
  ['Vault grants', 'A client, consultation, or case relationship grants zero Vault access. Only an exact active grant, with scope and expiry, allows access. Revoked and expired grants deny access.'],
  ['Reviews and reports', 'You cannot remove negative reviews. Reporter identity is hidden. Professional dispute is not a financial dispute and does not create a refund.'],
  ['Payments, KYC, payouts', 'You cannot mark paid, refunded, or payout paid. KYC incomplete fails closed. Commission is shown only if configured; otherwise “Commission not configured”.'],
  ['Privacy and support', 'Do not request unnecessary Student data. Use Settings for security and Support for account issues. Normal use should not require reading Terms.'],
];

export default function AgentGuidelines() {
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Agent guidelines</h1>
      <p className="text-sm text-slate-600 dark:text-gray-400">Practical rules for professional use. This is not a substitute for Terms & Conditions.</p>
      {TOPICS.map(([title, body]) => (
        <section key={title} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-gray-300">{body}</p>
        </section>
      ))}
    </div>
  );
}
