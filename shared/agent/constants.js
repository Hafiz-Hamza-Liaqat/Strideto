/**
 * Agent / Agency shared constants (Mission 11).
 *
 * Client- and server-safe: pure JS.
 */

export const AGENT_TYPES = Object.freeze({
  AGENT: 'agent',
  AGENCY: 'agency',
});

export const AGENT_PROFILE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  EMAIL_VERIFIED: 'email_verified',
  VERIFICATION_PENDING: 'verification_pending',
  UNDER_REVIEW: 'under_review',
  NEEDS_INFORMATION: 'needs_information',
  ENHANCED_REVIEW: 'enhanced_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

/** Only approved profiles have public active presence. */
export const PUBLIC_ACTIVE_STATUSES = Object.freeze(new Set([
  AGENT_PROFILE_STATUSES.APPROVED,
]));

export const AGENT_ONBOARDING_STEPS = Object.freeze({
  ACCOUNT: 'account',
  IDENTITY: 'identity',
  SERVICES: 'services',
  MARKETS: 'markets',
  REPRESENTATIVE: 'representative',
  VERIFICATION: 'verification',
  REVIEW: 'review',
});

export const AGENT_SERVICE_CATEGORIES = Object.freeze({
  STUDY_ABROAD_GUIDANCE: 'study_abroad_guidance',
  UNIVERSITY_APPLICATION_SUPPORT: 'university_application_support',
  SCHOLARSHIP_GUIDANCE: 'scholarship_guidance',
  TEST_GUIDANCE: 'test_guidance',
  DOCUMENT_REVIEW: 'document_review',
  CAREER_GUIDANCE: 'career_guidance',
  WORK_MOBILITY_GUIDANCE: 'work_mobility_guidance',
  VISA_PROCESS_GUIDANCE_INFORMATIONAL: 'visa_process_guidance_informational',
  OTHER: 'other',
});

export const AGENT_SERVICE_PRICING_MODES = Object.freeze({
  FREE: 'free',
  PAID_FUTURE: 'paid_future',
  CONTACT_FOR_DETAILS: 'contact_for_details',
});

export const AGENT_SERVICE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

export const AGENT_SERVICE_DELIVERY_MODES = Object.freeze({
  ONLINE: 'online',
  IN_PERSON: 'in_person',
  HYBRID: 'hybrid',
});

export const AGENT_JOURNEY_TYPES = Object.freeze({
  STUDY_ABROAD: 'study_abroad',
  WORK_ABROAD: 'work_abroad',
  IMMIGRATION: 'immigration',
  SCHOLARSHIP: 'scholarship',
  OTHER: 'other',
});

export const AGENT_MEMBER_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
});

export const AGENT_LEAD_STATUSES = Object.freeze({
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  CONVERTED: 'converted',
  CLOSED: 'closed',
  DECLINED: 'declined',
});

/**
 * Forbidden guarantee phrases — service content must not contain any of these.
 * Checked at service layer; never stored without validation.
 */
export const GUARANTEE_FORBIDDEN_PHRASES = Object.freeze([
  'guaranteed visa',
  'guaranteed admission',
  'guaranteed scholarship',
  'guaranteed overseas job',
  'guarantee visa',
  'guarantee admission',
  'guarantee scholarship',
  'guarantee job',
  'visa guarantee',
  'admission guarantee',
  'scholarship guarantee',
  'job guarantee',
]);

/**
 * Profile completeness sections with their weights (must sum to 100).
 */
export const COMPLETENESS_SECTIONS = Object.freeze([
  { key: 'professionalName', weight: 5, label: 'Professional Name' },
  { key: 'professionalSummary', weight: 15, label: 'Professional Summary' },
  { key: 'countryCode', weight: 5, label: 'Country' },
  { key: 'serviceCountries', weight: 10, label: 'Service Countries' },
  { key: 'destinationCountries', weight: 10, label: 'Destination Countries' },
  { key: 'languages', weight: 10, label: 'Languages' },
  { key: 'specialties', weight: 10, label: 'Specialties' },
  { key: 'officialEmail', weight: 10, label: 'Official Email' },
  { key: 'website', weight: 5, label: 'Website' },
  { key: 'phone', weight: 5, label: 'Phone' },
  { key: 'officeLocation', weight: 5, label: 'Office Location' },
  { key: 'yearsOfExperience', weight: 5, label: 'Years of Experience' },
  { key: 'profileImageId', weight: 5, label: 'Profile Image / Logo' },
]);

/**
 * Granular trust badge keys — derived from Mission 2 accepted evidence only.
 * Never auto-promoted from self-declared fields.
 */
export const TRUST_BADGE_KEYS = Object.freeze({
  IDENTITY_VERIFIED: 'identity_verified',
  BUSINESS_VERIFIED: 'business_verified',
  OFFICIAL_DOMAIN_VERIFIED: 'official_domain_verified',
  PHYSICAL_LOCATION_VERIFIED: 'physical_location_verified',
  PROFESSIONAL_CREDENTIAL_VERIFIED: 'professional_credential_verified',
});
