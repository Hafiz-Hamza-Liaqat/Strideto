const PATHS = {
  settings: '/institution/settings',
  profile: '/institution/profile',
  verification: '/institution/verification',
  claim: '/institution/claim',
  programs: '/institution/programs',
  guidelines: '/institution/guidelines',
};

const PROFILE_READY_THRESHOLD = 85;

export function isInstitutionProfileIncomplete(profileCompleteness) {
  return (profileCompleteness ?? 0) < PROFILE_READY_THRESHOLD;
}

/**
 * Honest first-use journey. Organization verification and canonical claim
 * are separate. Account creation never verifies the institution.
 */
export function buildInstitutionGettingStartedSteps({
  emailVerified = false,
  profileCompleteness = 0,
  verificationStatus = 'draft',
  claimState = 'not_started',
} = {}) {
  const profileIncomplete = isInstitutionProfileIncomplete(profileCompleteness);
  const verificationApproved = verificationStatus === 'approved';
  const verificationStarted = verificationStatus && verificationStatus !== 'draft';
  const claimApproved = claimState === 'approved';
  const claimStarted = claimState && claimState !== 'not_started' && claimState !== 'draft';

  return [
    {
      key: 'email',
      title: 'Verify your account email',
      explanation: 'Restricted workspace access continues until the representative email is verified. This is not organization verification.',
      status: emailVerified ? 'complete' : 'current',
      ctaLabel: emailVerified ? 'Email verified' : 'Open account settings',
      to: PATHS.settings,
      enabled: !emailVerified,
    },
    {
      key: 'profile',
      title: 'Complete Organization Profile',
      explanation: 'Official name, website, and location. Completeness is not a verified badge.',
      status: profileIncomplete ? (emailVerified ? 'current' : 'upcoming') : 'complete',
      ctaLabel: profileIncomplete ? 'Complete profile' : 'View profile',
      to: PATHS.profile,
      enabled: true,
    },
    {
      key: 'verification',
      title: 'Submit Organization Verification',
      explanation: 'Identity and registration evidence for the organization. Approval does not grant canonical publishing authority.',
      status: verificationApproved
        ? 'complete'
        : verificationStarted
          ? 'current'
          : (profileIncomplete ? 'upcoming' : 'current'),
      ctaLabel: verificationApproved
        ? 'Verification approved'
        : verificationStarted
          ? 'Continue verification'
          : 'Start verification',
      to: PATHS.verification,
      enabled: true,
    },
    {
      key: 'claim',
      title: 'Submit Canonical Institution Claim',
      explanation: 'A separate review that links your organization to the canonical Institution record. Required before official Program publishing.',
      status: claimApproved
        ? 'complete'
        : claimStarted
          ? 'current'
          : (verificationApproved ? 'current' : 'upcoming'),
      ctaLabel: claimApproved ? 'Claim approved' : claimStarted ? 'Track claim' : 'Open canonical claim',
      to: PATHS.claim,
      enabled: true,
    },
    {
      key: 'programs',
      title: 'Prepare Programs / Intakes',
      explanation: 'You may draft Programs at any time. Publishing waits for both organization verification and an approved canonical claim.',
      status: verificationApproved && claimApproved ? 'current' : 'upcoming',
      ctaLabel: 'Manage programs',
      to: PATHS.programs,
      enabled: true,
    },
    {
      key: 'publish',
      title: 'Publish only when required authority is approved',
      explanation: 'Both gates must be approved. Creating an account or completing a profile never publishes on your behalf.',
      status: verificationApproved && claimApproved ? 'complete' : 'upcoming',
      ctaLabel: 'Read guidelines',
      to: PATHS.guidelines,
      enabled: true,
    },
  ];
}

export function shouldShowInstitutionGettingStarted({
  emailVerified,
  profileCompleteness,
  verificationStatus,
  claimState,
} = {}) {
  if (!emailVerified) return true;
  if (isInstitutionProfileIncomplete(profileCompleteness)) return true;
  if (verificationStatus !== 'approved') return true;
  if (claimState !== 'approved') return true;
  return false;
}
