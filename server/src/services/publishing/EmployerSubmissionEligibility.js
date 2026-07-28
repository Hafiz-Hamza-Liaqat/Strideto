const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMPLOYER_ELIGIBILITY_CAPABILITY_VERSION =
  'free-beta-employer-eligibility-v1';

export const EMPLOYER_SUBMISSION_ELIGIBILITY_FIELDS = Object.freeze({
  required: Object.freeze([
    'companyName',
    'email',
    'companyDescription',
    'industry',
  ]),
  locationAlternatives: Object.freeze(['location', 'city', 'province']),
  verification: Object.freeze([
    'verified',
    'verificationLevel',
    'accountStatus',
  ]),
  advisory: Object.freeze(['website']),
  emailVerificationSupported: false,
});

const BLOCKER_MESSAGES = Object.freeze({
  EMPLOYER_NOT_FOUND: 'Employer account was not found.',
  EMPLOYER_NOT_VERIFIED:
    'Employer verification is required before submitting a job.',
  EMPLOYER_EMAIL_NOT_VERIFIED:
    'Employer email verification is required before submitting a job.',
  EMPLOYER_PROFILE_INCOMPLETE:
    'Complete the required employer profile fields before submitting.',
  ACCOUNT_SUSPENDED:
    'This employer account is suspended and cannot submit jobs.',
  ACCOUNT_DISABLED: 'This employer account is not enabled for job submission.',
});

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizedEmail(value) {
  return nonEmptyString(value) ? value.trim().toLowerCase() : '';
}

function validEmail(value) {
  return EMAIL_PATTERN.test(normalizedEmail(value));
}

function normalizedWebsiteDomain(value) {
  if (!nonEmptyString(value)) {
    return null;
  }

  try {
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
      return null;
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function blocker(code, fields) {
  const value = {
    code,
    message: BLOCKER_MESSAGES[code],
  };
  if (fields?.length) {
    value.fields = Object.freeze([...fields]);
  }
  return Object.freeze(value);
}

/**
 * Pure, fail-closed predicate over fields that exist on the current Employer.
 *
 * Legacy rules:
 * - missing/unknown accountStatus is disabled;
 * - missing verificationLevel is equivalent to basic and is ineligible;
 * - website is optional but must be a valid HTTP(S) URL when present;
 * - email verification is not inspected unless the explicit capability is on.
 */
export function evaluateEmployerSubmissionEligibility(
  employer,
  { employerEmailVerificationSupported = false } = {}
) {
  if (!employer || typeof employer !== 'object') {
    return Object.freeze({
      eligible: false,
      blockers: Object.freeze([blocker('EMPLOYER_NOT_FOUND')]),
    });
  }

  const blockers = [];

  if (employer.accountStatus === 'suspended') {
    blockers.push(blocker('ACCOUNT_SUSPENDED'));
  } else if (employer.accountStatus !== 'active') {
    blockers.push(blocker('ACCOUNT_DISABLED'));
  }

  if (
    employer.verified !== true ||
    !['verified', 'trusted'].includes(employer.verificationLevel)
  ) {
    blockers.push(blocker('EMPLOYER_NOT_VERIFIED'));
  }

  if (employerEmailVerificationSupported && employer.emailVerified !== true) {
    blockers.push(blocker('EMPLOYER_EMAIL_NOT_VERIFIED'));
  }

  const incompleteFields = [];
  if (!nonEmptyString(employer.companyName)) {
    incompleteFields.push('companyName');
  }
  if (!validEmail(employer.email)) {
    incompleteFields.push('email');
  }
  if (!nonEmptyString(employer.companyDescription)) {
    incompleteFields.push('companyDescription');
  }
  if (!nonEmptyString(employer.industry)) {
    incompleteFields.push('industry');
  }
  if (
    !EMPLOYER_SUBMISSION_ELIGIBILITY_FIELDS.locationAlternatives.some((field) =>
      nonEmptyString(employer[field])
    )
  ) {
    incompleteFields.push('location');
  }
  if (
    nonEmptyString(employer.website) &&
    !normalizedWebsiteDomain(employer.website)
  ) {
    incompleteFields.push('website');
  }

  if (incompleteFields.length > 0) {
    blockers.push(blocker('EMPLOYER_PROFILE_INCOMPLETE', incompleteFields));
  }

  return Object.freeze({
    eligible: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

export function buildEmployerVerificationSnapshot(employer, eligibility) {
  const email = normalizedEmail(employer?.email);
  const profileChecks = {
    companyName: nonEmptyString(employer?.companyName),
    email: validEmail(email),
    companyDescription: nonEmptyString(employer?.companyDescription),
    industry: nonEmptyString(employer?.industry),
    location:
      nonEmptyString(employer?.location) ||
      nonEmptyString(employer?.city) ||
      nonEmptyString(employer?.province),
    website:
      !nonEmptyString(employer?.website) ||
      Boolean(normalizedWebsiteDomain(employer.website)),
  };

  return Object.freeze({
    verified: employer?.verified === true,
    verificationLevel: employer?.verificationLevel || 'basic',
    accountStatus: employer?.accountStatus,
    normalizedCompanyName: nonEmptyString(employer?.companyName)
      ? employer.companyName.trim()
      : undefined,
    emailPresent: email.length > 0,
    emailValid: validEmail(email),
    emailDomain: validEmail(email) ? email.split('@')[1] : undefined,
    websiteDomain: normalizedWebsiteDomain(employer?.website) || undefined,
    requiredProfileChecks: Object.freeze(profileChecks),
    predicateCapabilityVersion: EMPLOYER_ELIGIBILITY_CAPABILITY_VERSION,
    eligibilityResultCodes: Object.freeze(
      (eligibility?.blockers || []).map(({ code }) => code)
    ),
  });
}
