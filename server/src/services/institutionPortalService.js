/**
 * institutionPortalService — core business logic for the Verified Institution Portal (Mission 18).
 *
 * Security invariants enforced here (server-authoritative):
 *   - Institution can only manage Programs belonging to its approved CanonicalInstitution claim.
 *   - No cross-institution mutation.
 *   - Canonical claim cannot be self-approved (Admin controls final linkage).
 *   - Country-level TestAcceptance is not mutable by institutions.
 *   - External scholarships cannot be overwritten.
 *   - High-impact changes create InstitutionChangeEvent records.
 *   - Conflicts detected and stored rather than silently overwritten.
 *   - Suspended/revoked/expired organizations lose privileged publishing authority.
 */
import { Organization as _Organization } from '../models/Organization.js';
import mongoose from 'mongoose';
import { OrganizationVerification } from '../models/OrganizationVerification.js';
import { CanonicalInstitution } from '../models/education/CanonicalInstitution.js';
import { Program } from '../models/education/Program.js';
import { ProgramRequirement as _ProgramRequirement } from '../models/education/ProgramRequirement.js';
import { TestAcceptance } from '../models/education/TestAcceptance.js';
import { CanonicalScholarship } from '../models/education/CanonicalScholarship.js';
import { CanonicalSource as _CanonicalSource } from '../models/trust/CanonicalSource.js';
import { InstitutionMembership } from '../models/institution/InstitutionMembership.js';
import { InstitutionClaim } from '../models/institution/InstitutionClaim.js';
import { InstitutionProfile } from '../models/institution/InstitutionProfile.js';
import { InstitutionDataConflict } from '../models/institution/InstitutionDataConflict.js';
import { InstitutionChangeEvent } from '../models/institution/InstitutionChangeEvent.js';
import { InstitutionNotificationEvent } from '../models/institution/InstitutionNotificationEvent.js';
import { logAudit } from './auditService.js';
import {
  INSTITUTION_ROLES as _INSTITUTION_ROLES,
  CLAIM_STATES,
  CHANGE_CATEGORIES,
  CONFLICT_STATES,
  INSTITUTION_NOTIFICATION_TYPES,
  INSTITUTION_SOURCE_TYPE,
  canSubmitOfficialChanges,
  canManageTeam as _canManageTeam,
  claimGrantsAuthority,
  isValidClaimTransition,
  isInstitutionOrgType as _isInstitutionOrgType,
  computeInstitutionCompleteness,
  splitAuthorityEvidence,
  isDateOnly,
  isValidApplicationMode,
  isValidIntakeStatus,
  APPLICATION_MODES,
  INTAKE_STATUSES,
  toDateOnlyUtc,
  INSTITUTION_LAUNCH_BILLING,
  boundedInstitutionQuery,
  escapeRegex,
} from '../../../shared/institution/institutionPortal.js';
import {
  canExercisePrivilegedCapability,
  isSuspendedOrRevoked,
  VERIFICATION_STATUSES,
} from '../../../shared/international/verification.js';
import { OVERRIDE_TYPES } from './capability/overrideService.js';
import {
  ACCEPTANCE_SCOPES,
  detectConflict,
  normalizeSectionMinimums,
  validateEffectivePeriod,
  validateResultValidityMonths,
  isValidAcceptanceStatus,
} from '../../../shared/education/acceptanceExplorer.js';
import { PUB_STATUSES } from '../../../shared/education/taxonomy.js';
import { withFixtureExclusion } from '../../../shared/publicDiscovery/fixtureExclusion.js';
import { canonicalizeStoredPhone } from '../../../shared/international/phone.js';
import { Test } from '../models/education/Test.js';

// ---------------------------------------------------------------------------
// Helper: resolve the active membership for an account in an organization
// ---------------------------------------------------------------------------

export async function resolveActiveMembership(institutionAccountId, organizationId) {
  const membership = await InstitutionMembership.findOne({
    institutionAccountId,
    organizationId,
    active: true,
  }).lean();
  return membership || null;
}

// ---------------------------------------------------------------------------
// Helper: assert that the account has an active membership with sufficient role
// ---------------------------------------------------------------------------

export async function assertActiveMember(institutionAccountId, organizationId) {
  const membership = await resolveActiveMembership(institutionAccountId, organizationId);
  if (!membership) {
    throw Object.assign(
      new Error('Active institution membership required'),
      { code: 'MEMBERSHIP_REQUIRED', status: 403 }
    );
  }
  return membership;
}

export async function assertCanSubmit(institutionAccountId, organizationId) {
  const m = await assertActiveMember(institutionAccountId, organizationId);
  if (!canSubmitOfficialChanges(m.role)) {
    throw Object.assign(
      new Error('Insufficient role to submit official changes'),
      { code: 'INSUFFICIENT_ROLE', status: 403 }
    );
  }
  return m;
}

// ---------------------------------------------------------------------------
// Helper: resolve approved verification for an organization
// ---------------------------------------------------------------------------

export async function resolveVerification(organizationId) {
  return OrganizationVerification.findOne({ organizationId }).lean();
}

export async function assertApprovedVerification(organizationId) {
  const v = await resolveVerification(organizationId);
  if (!v) throw Object.assign(new Error('Organization verification record not found'), { code: 'NOT_FOUND', status: 404 });
  // Absolute hard deny: suspended and revoked are terminal — no override type lifts them.
  if (isSuspendedOrRevoked(v.status)) {
    throw Object.assign(new Error('Organization is suspended or revoked'), { code: 'BLOCKED', status: 403 });
  }
  if (!canExercisePrivilegedCapability(v.status)) {
    // Active super-admin override may bypass the pre-approval gate.
    // For qa_test overrides: REJECTED is not a hard blocker (cross-role QA testing).
    // For manual_exception and other types: REJECTED is still a hard deny.
    const { getOverrideService } = await import('./capability/overrideRuntime.js');
    const override = await getOverrideService().getActiveOverride(String(organizationId));
    const isRejected = v.status === VERIFICATION_STATUSES.REJECTED;
    const isQaTestOverride = override?.overrideType === OVERRIDE_TYPES.QA_TEST;
    if (!override || (isRejected && !isQaTestOverride)) {
      throw Object.assign(
        new Error('Organization verification must be approved to exercise this capability'),
        { code: isRejected ? 'BLOCKED' : 'VERIFICATION_REQUIRED', status: 403 }
      );
    }
  }
  return v;
}

// ---------------------------------------------------------------------------
// Helper: resolve the approved canonical claim for an organization
// ---------------------------------------------------------------------------

export async function resolveApprovedClaim(organizationId) {
  return InstitutionClaim.findOne({
    organizationId,
    state: CLAIM_STATES.APPROVED,
  }).lean();
}

export async function assertApprovedClaim(organizationId) {
  const claim = await resolveApprovedClaim(organizationId);
  if (!claim || !claimGrantsAuthority(claim.state)) {
    throw Object.assign(
      new Error('Approved canonical institution claim required'),
      { code: 'CLAIM_REQUIRED', status: 403 }
    );
  }
  return claim;
}

/** Official institution writes require BOTH approved verification and approved claim. */
export async function assertOfficialInstitutionWrite(organizationId) {
  const verification = await assertApprovedVerification(organizationId);
  const claim = await assertApprovedClaim(organizationId);
  return { verification, claim };
}

// ---------------------------------------------------------------------------
// Helper: assert program belongs to the claimed canonical institution
// ---------------------------------------------------------------------------

export async function assertProgramOwnership(programId, canonicalInstitutionId) {
  const program = await Program.findById(programId).lean();
  if (!program) throw Object.assign(new Error('Program not found'), { code: 'NOT_FOUND', status: 404 });
  if (program.institutionId.toString() !== canonicalInstitutionId.toString()) {
    throw Object.assign(
      new Error('Program does not belong to this institution'),
      { code: 'FORBIDDEN', status: 403 }
    );
  }
  return program;
}

// ---------------------------------------------------------------------------
// Helper: record a change event for high-impact factual fields
// ---------------------------------------------------------------------------

export async function recordChangeEvent({
  organizationId,
  canonicalInstitutionId = null,
  programId = null,
  changeCategory,
  field,
  previousValue,
  newValue,
  changedByAccountId,
  changedByRole,
  sourceType = INSTITUTION_SOURCE_TYPE,
  sourceUrl = '',
  reconfirmationNote = '',
}) {
  await InstitutionChangeEvent.create({
    organizationId,
    canonicalInstitutionId,
    programId,
    changeCategory,
    field,
    previousValue,
    newValue,
    changedByAccountId,
    changedByRole,
    changedByRealm: 'institution',
    sourceType,
    sourceUrl,
    reconfirmationNote,
  });
}

// ---------------------------------------------------------------------------
// Helper: detect and store conflicts instead of silent overwrites
// ---------------------------------------------------------------------------

export async function detectAndStoreConflict({
  organizationId,
  canonicalInstitutionId = null,
  programId = null,
  recordType,
  fieldScope,
  existingValue,
  existingSourceId = null,
  existingSourceType = '',
  proposedValue,
  proposedSourceType = INSTITUTION_SOURCE_TYPE,
  proposedSourceUrl = '',
}) {
  const existing = await InstitutionDataConflict.findOne({
    organizationId,
    recordType,
    fieldScope,
    state: { $in: [CONFLICT_STATES.OPEN, CONFLICT_STATES.UNDER_REVIEW] },
  }).lean();
  if (existing) return existing; // conflict already recorded

  return InstitutionDataConflict.create({
    organizationId,
    canonicalInstitutionId,
    programId,
    recordType,
    fieldScope,
    existingValue,
    existingSourceId,
    existingSourceType,
    proposedValue,
    proposedSourceType,
    proposedSourceUrl,
    state: CONFLICT_STATES.OPEN,
  });
}

// ---------------------------------------------------------------------------
// Helper: prepare notification event (no delivery in Mission 18)
// ---------------------------------------------------------------------------

export async function prepareNotification({ organizationId, institutionAccountId = null, eventType, payload = {} }) {
  return InstitutionNotificationEvent.create({ organizationId, institutionAccountId, eventType, payload });
}

// ---------------------------------------------------------------------------
// Canonical Institution Claim management
// ---------------------------------------------------------------------------

export async function getDraftClaim(organizationId) {
  return InstitutionClaim.findOne({
    organizationId,
    state: { $in: [CLAIM_STATES.DRAFT, CLAIM_STATES.NEEDS_INFORMATION] },
  }).lean();
}

/** Provider-safe claim DTO — never exposes adminNotes or transition history internals. */
export function projectInstitutionClaim(claim) {
  if (!claim) return null;
  const plain = typeof claim.toObject === 'function' ? claim.toObject() : { ...claim };
  const {
    adminNotes: _adminNotes,
    history: _history,
    __v: _v,
    ...rest
  } = plain;
  return {
    ...rest,
    authorityEvidenceUrls: Array.isArray(plain.authorityEvidenceUrls) ? plain.authorityEvidenceUrls : [],
    authorityEvidenceRefs: Array.isArray(plain.authorityEvidenceRefs) ? plain.authorityEvidenceRefs : [],
    informationRequestReason: plain.informationRequestReason || '',
    rejectedReason: plain.rejectedReason || '',
  };
}

export async function findOrganizationClaim(organizationId) {
  // Prefer the newest non-revoked claim for the org (one active workflow at a time).
  return InstitutionClaim.findOne({
    organizationId,
    state: { $ne: CLAIM_STATES.REVOKED },
  })
    .sort({ updatedAt: -1 })
    .lean();
}

export async function startClaim({
  organizationId,
  representativeAccountId,
  canonicalInstitutionId = null,
  proposedCanonical = null,
  authorityEvidenceRefs = [],
  actor,
}) {
  // One claim workflow per organization: do not spawn duplicates for correction cycles.
  const existing = await InstitutionClaim.findOne({
    organizationId,
    state: {
      $in: [
        CLAIM_STATES.DRAFT,
        CLAIM_STATES.SUBMITTED,
        CLAIM_STATES.UNDER_REVIEW,
        CLAIM_STATES.NEEDS_INFORMATION,
        CLAIM_STATES.APPROVED,
        CLAIM_STATES.REJECTED,
      ],
    },
  })
    .sort({ updatedAt: -1 })
    .lean();
  if (existing) {
    if (existing.state === CLAIM_STATES.REJECTED) {
      throw Object.assign(
        new Error('A rejected claim already exists. Reopen and correct that claim instead of creating a new one.'),
        { code: 'CLAIM_REOPEN_REQUIRED', status: 409, claimId: existing._id }
      );
    }
    if (existing.state === CLAIM_STATES.NEEDS_INFORMATION || existing.state === CLAIM_STATES.DRAFT) {
      throw Object.assign(
        new Error('An open claim already exists. Update and resubmit the existing claim.'),
        { code: 'CLAIM_UPDATE_REQUIRED', status: 409, claimId: existing._id }
      );
    }
    throw Object.assign(new Error('An active claim already exists for this organization'), {
      code: 'CONFLICT',
      status: 409,
      claimId: existing._id,
    });
  }

  // Duplicate detection: search existing canonical records
  let normalizedName = '';
  let countryCode = '';
  let officialDomain = '';

  if (canonicalInstitutionId) {
    if (!mongoose.Types.ObjectId.isValid(String(canonicalInstitutionId))) {
      throw Object.assign(new Error('Invalid canonical institution id'), { code: 'VALIDATION', status: 422 });
    }
    const ci = await CanonicalInstitution.findById(canonicalInstitutionId).lean();
    if (!ci) throw Object.assign(new Error('Canonical institution not found'), { code: 'NOT_FOUND', status: 404 });
    normalizedName = (ci.officialName || '').toLowerCase().trim();
    countryCode = ci.countryCode || '';
    officialDomain = ci.officialDomain || '';

    // Check no other organization already holds an approved claim on this canonical institution
    const approvedElsewhere = await InstitutionClaim.findOne({
      canonicalInstitutionId,
      state: CLAIM_STATES.APPROVED,
      organizationId: { $ne: organizationId },
    }).lean();
    if (approvedElsewhere) {
      throw Object.assign(
        new Error('Another organization already holds an approved claim on this institution'),
        { code: 'CONFLICT', status: 409 }
      );
    }
  } else if (proposedCanonical) {
    normalizedName = (proposedCanonical.officialName || '').toLowerCase().trim();
    countryCode = proposedCanonical.countryCode || '';
    officialDomain = (proposedCanonical.officialDomain || '').toLowerCase().trim();

    // Duplicate detection: check if a canonical record already exists with similar signals
    if (normalizedName && countryCode) {
      const potentialDuplicate = await CanonicalInstitution.findOne({
        officialName: { $regex: new RegExp(`^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        countryCode: countryCode.toUpperCase(),
        status: PUB_STATUSES.PUBLISHED,
      }).lean();
      if (potentialDuplicate) {
        throw Object.assign(
          new Error(`A canonical institution record already exists for "${proposedCanonical.officialName}" in ${countryCode}. Use its ID to claim it.`),
          { code: 'DUPLICATE_CANONICAL', status: 409, existingId: potentialDuplicate._id }
        );
      }
    }
  } else {
    throw Object.assign(new Error('Either canonicalInstitutionId or proposedCanonical is required'), { code: 'VALIDATION', status: 400 });
  }

  const evidence = splitAuthorityEvidence(authorityEvidenceRefs);

  const claim = await InstitutionClaim.create({
    organizationId,
    canonicalInstitutionId: canonicalInstitutionId || null,
    proposedCanonical: proposedCanonical || undefined,
    state: CLAIM_STATES.DRAFT,
    representativeAccountId,
    authorityEvidenceRefs: evidence.objectIds,
    authorityEvidenceUrls: evidence.urls,
    normalizedName,
    countryCode,
    officialDomain,
    history: [{ fromState: '', toState: CLAIM_STATES.DRAFT, changedBy: actor.userId, changedByRealm: 'institution', at: new Date() }],
  });

  await logAudit({ action: 'institution_claim_started', actor, metadata: { organizationId, claimId: claim._id, canonicalInstitutionId } });
  return claim;
}

export async function submitClaim({ claimId, organizationId, actor }) {
  const claim = await InstitutionClaim.findOne({ _id: claimId, organizationId });
  if (!claim) throw Object.assign(new Error('Claim not found'), { code: 'NOT_FOUND', status: 404 });
  if (![CLAIM_STATES.DRAFT, CLAIM_STATES.NEEDS_INFORMATION].includes(claim.state)) {
    throw Object.assign(new Error('Claim is not in a submittable state'), { code: 'INVALID_STATE', status: 409 });
  }

  const fromState = claim.state;
  claim.history.push({ fromState, toState: CLAIM_STATES.SUBMITTED, changedBy: actor.userId, changedByRealm: 'institution', at: new Date() });
  claim.state = CLAIM_STATES.SUBMITTED;
  claim.submittedAt = new Date();
  // Correction cycle complete — clear provider-facing needs-information prompt
  claim.informationRequestReason = '';
  await claim.save();

  await prepareNotification({ organizationId, eventType: INSTITUTION_NOTIFICATION_TYPES.CLAIM_REVIEW_RESULT, payload: { claimId: claim._id, state: CLAIM_STATES.SUBMITTED } });
  await logAudit({ action: 'institution_claim_submitted', actor, metadata: { organizationId, claimId } });

  try {
    const { emitCanonicalClaimNotifications } = await import('./orgVerificationNotificationBridge.js');
    const { CANONICAL_CLAIM_NOTIFICATION_TYPES } = await import('../../../shared/platform/organizationVerificationNotifications.js');
    const competing = claim.canonicalInstitutionId
      ? await InstitutionClaim.findOne({
        canonicalInstitutionId: claim.canonicalInstitutionId,
        state: { $in: [CLAIM_STATES.SUBMITTED, CLAIM_STATES.UNDER_REVIEW, CLAIM_STATES.APPROVED] },
        _id: { $ne: claim._id },
      }).select('_id').lean()
      : null;
    await emitCanonicalClaimNotifications({
      organizationId,
      claimId: claim._id,
      notificationType: competing
        ? CANONICAL_CLAIM_NOTIFICATION_TYPES.CONFLICT
        : CANONICAL_CLAIM_NOTIFICATION_TYPES.SUBMITTED,
      transitionId: `${claim._id}:${CLAIM_STATES.SUBMITTED}:${claim.submittedAt?.getTime?.() || Date.now()}`,
      conflict: Boolean(competing),
    });
  } catch {
    // Notification failure must not roll back the committed claim.
  }

  return claim;
}

/**
 * Update authority evidence / proposal fields on the SAME claim while in
 * draft or needs_information. Does not create a new claim.
 */
export async function updateClaimCorrection({
  claimId,
  organizationId,
  actor,
  authorityEvidenceRefs,
  proposedCanonical,
} = {}) {
  const claim = await InstitutionClaim.findOne({ _id: claimId, organizationId });
  if (!claim) throw Object.assign(new Error('Claim not found'), { code: 'NOT_FOUND', status: 404 });
  if (![CLAIM_STATES.DRAFT, CLAIM_STATES.NEEDS_INFORMATION].includes(claim.state)) {
    throw Object.assign(
      new Error('Claim can only be corrected while draft or needs_information'),
      { code: 'INVALID_STATE', status: 409 }
    );
  }

  if (authorityEvidenceRefs !== undefined) {
    const evidence = splitAuthorityEvidence(authorityEvidenceRefs);
    claim.authorityEvidenceRefs = evidence.objectIds;
    claim.authorityEvidenceUrls = evidence.urls;
  }

  if (proposedCanonical && !claim.canonicalInstitutionId) {
    const next = {
      officialName: String(proposedCanonical.officialName || claim.proposedCanonical?.officialName || '').trim(),
      countryCode: String(proposedCanonical.countryCode || claim.proposedCanonical?.countryCode || '').trim().toUpperCase(),
      city: String(proposedCanonical.city ?? claim.proposedCanonical?.city ?? '').trim(),
      region: String(proposedCanonical.region ?? claim.proposedCanonical?.region ?? '').trim(),
      officialWebsite: String(proposedCanonical.officialWebsite ?? claim.proposedCanonical?.officialWebsite ?? '').trim(),
      officialDomain: String(proposedCanonical.officialDomain ?? claim.proposedCanonical?.officialDomain ?? '').trim().toLowerCase(),
      institutionType: String(proposedCanonical.institutionType ?? claim.proposedCanonical?.institutionType ?? '').trim(),
      isPublic: proposedCanonical.isPublic ?? claim.proposedCanonical?.isPublic ?? null,
    };
    if (!next.officialName || !next.countryCode) {
      throw Object.assign(new Error('proposedCanonical.officialName and countryCode are required'), {
        code: 'VALIDATION',
        status: 422,
      });
    }
    claim.proposedCanonical = next;
    claim.normalizedName = next.officialName.toLowerCase();
    claim.countryCode = next.countryCode;
    claim.officialDomain = next.officialDomain;
  }

  await claim.save();
  await logAudit({
    action: 'institution_claim_corrected',
    actor,
    metadata: { organizationId, claimId, state: claim.state },
  });
  return claim;
}

/**
 * Rejected → draft on the SAME claim so the institution can correct and resubmit.
 * Does not create a duplicate claim.
 */
export async function reopenRejectedClaim({ claimId, organizationId, actor, authorityEvidenceRefs } = {}) {
  const claim = await InstitutionClaim.findOne({ _id: claimId, organizationId });
  if (!claim) throw Object.assign(new Error('Claim not found'), { code: 'NOT_FOUND', status: 404 });
  if (claim.state !== CLAIM_STATES.REJECTED) {
    throw Object.assign(new Error('Only rejected claims can be reopened'), { code: 'INVALID_STATE', status: 409 });
  }
  if (!isValidClaimTransition(claim.state, CLAIM_STATES.DRAFT)) {
    throw Object.assign(new Error('Cannot reopen this claim'), { code: 'INVALID_STATE', status: 409 });
  }

  claim.history.push({
    fromState: claim.state,
    toState: CLAIM_STATES.DRAFT,
    changedBy: actor.userId,
    changedByRealm: 'institution',
    reason: 'reopened_for_correction',
    at: new Date(),
  });
  claim.state = CLAIM_STATES.DRAFT;
  claim.informationRequestReason = '';
  // Keep rejectedReason visible historically on the record until a later decision replaces it;
  // provider UI distinguishes by state.
  if (authorityEvidenceRefs !== undefined) {
    const evidence = splitAuthorityEvidence(authorityEvidenceRefs);
    claim.authorityEvidenceRefs = evidence.objectIds;
    claim.authorityEvidenceUrls = evidence.urls;
  }
  await claim.save();
  await logAudit({
    action: 'institution_claim_reopened',
    actor,
    metadata: { organizationId, claimId },
  });
  return claim;
}

// ---------------------------------------------------------------------------
// Profile management
// ---------------------------------------------------------------------------

export async function getOrCreateProfile(organizationId) {
  let profile = await InstitutionProfile.findOne({ organizationId });
  if (!profile) {
    profile = await InstitutionProfile.create({ organizationId });
  }
  return profile;
}

export async function updateProfile({ organizationId, updates, actor, membership: _membership }) {
  const profile = await getOrCreateProfile(organizationId);

  const allowed = [
    'officialDisplayName', 'legalName', 'aliases', 'institutionType', 'organizationType',
    'countryCode', 'city', 'region', 'officialDomain', 'logoUrl', 'addresses',
    'officialWebsite', 'officialAdmissionsWebsite',
    'officialContactEmail', 'officialPhone', 'institutionDescription',
    'academicLevels', 'studyModes', 'accreditationRefs', 'institutionIdentifiers',
    'representativeName', 'representativeTitle', 'representativeEmail',
  ];

  for (const key of allowed) {
    if (updates[key] === undefined) continue;
    if (key === 'officialPhone') {
      const result = canonicalizeStoredPhone(updates.officialPhone);
      if (!result.ok) {
        throw Object.assign(new Error(result.error), { status: 400 });
      }
      profile.officialPhone = result.value;
      continue;
    }
    profile[key] = updates[key];
  }

  // Recompute completeness
  const sections = {
    legalIdentity: profile.legalName || profile.officialDisplayName,
    officialWebsite: profile.officialWebsite,
    location: profile.addresses?.length > 0,
    contactChannels: profile.officialContactEmail || profile.officialPhone,
    institutionType: profile.institutionType,
    academicProfile: profile.academicLevels?.length > 0,
    accreditation: profile.accreditationRefs?.length > 0,
    verificationEvidence: null, // checked separately from verification
    canonicalClaim: null, // checked separately from claim
  };
  const { score } = computeInstitutionCompleteness(sections);
  profile.completenessScore = score;

  await profile.save();

  await logAudit({
    action: 'institution_profile_updated',
    actor,
    metadata: { organizationId, updatedFields: Object.keys(updates) },
  });

  return profile;
}

// ---------------------------------------------------------------------------
// Program management
// ---------------------------------------------------------------------------

export async function createProgramDraft({
  organizationId,
  canonicalInstitutionId,
  programData,
  actor,
}) {
  const { name, degreeLevel, field, campus, instructionLanguage, studyMode, durationMonths, officialProgramUrl,
    country, admissionRequirementsUrl } = programData;

  if (!name) throw Object.assign(new Error('Program name is required'), { code: 'VALIDATION', status: 400 });

  const { educationSlug } = await import('../../../shared/education/taxonomy.js');
  let slug = educationSlug(name);
  // Ensure uniqueness
  const base = slug;
  let attempt = 0;
  while (await Program.exists({ slug })) {
    attempt++;
    slug = `${base}-${attempt + 1}`;
  }

  const program = await Program.create({
    institutionId: canonicalInstitutionId,
    name: name.trim(),
    slug,
    degreeLevel,
    field,
    campus: campus || '',
    instructionLanguage: instructionLanguage || '',
    studyMode,
    durationMonths,
    officialProgramUrl: officialProgramUrl || '',
    country: country || '',
    admissionRequirementsUrl: admissionRequirementsUrl || '',
    status: PUB_STATUSES.DRAFT,
    verificationStatus: 'unverified',
    freshnessState: 'unknown',
    sources: [{ sourceType: INSTITUTION_SOURCE_TYPE }],
  });

  await logAudit({ action: 'institution_program_created', actor, metadata: { organizationId, canonicalInstitutionId, programId: program._id } });
  return program;
}

export async function updateProgram({
  programId,
  organizationId,
  canonicalInstitutionId,
  updates,
  actor,
  membershipRole,
}) {
  const program = await Program.findById(programId);
  if (!program) throw Object.assign(new Error('Program not found'), { code: 'NOT_FOUND', status: 404 });
  if (program.institutionId.toString() !== canonicalInstitutionId.toString()) {
    throw Object.assign(new Error('Program does not belong to this institution'), { code: 'FORBIDDEN', status: 403 });
  }

  // Track high-impact changes
  const HIGH_IMPACT = ['tuition', 'intakes', 'admissionRequirementsUrl', 'status'];
  if (Array.isArray(updates.intakes)) {
    updates.intakes = updates.intakes.map((intake) => normalizeIntake(intake));
  }
  for (const field of HIGH_IMPACT) {
    if (updates[field] !== undefined && JSON.stringify(updates[field]) !== JSON.stringify(program[field])) {
      const category = field === 'tuition' ? CHANGE_CATEGORIES.TUITION
        : field === 'intakes' ? CHANGE_CATEGORIES.INTAKE
        : field === 'status' ? CHANGE_CATEGORIES.PROGRAM_STATUS
        : CHANGE_CATEGORIES.REQUIREMENT;

      await recordChangeEvent({
        organizationId, canonicalInstitutionId, programId,
        changeCategory: category, field,
        previousValue: program[field], newValue: updates[field],
        changedByAccountId: actor.userId, changedByRole: membershipRole,
      });
    }
  }

  const allowed = [
    'name', 'degreeLevel', 'field', 'campus', 'instructionLanguage', 'studyMode', 'durationMonths',
    'officialProgramUrl', 'country', 'admissionRequirementsUrl', 'intakes', 'tuition',
  ];
  const skippedConflicts = [];
  for (const key of allowed) {
    if (updates[key] === undefined) continue;
    const differs = JSON.stringify(updates[key]) !== JSON.stringify(program[key]);
    if (
      differs
      && HIGH_IMPACT.includes(key)
      && program.status === PUB_STATUSES.PUBLISHED
    ) {
      await detectAndStoreConflict({
        organizationId,
        canonicalInstitutionId,
        programId,
        recordType: 'program',
        fieldScope: key,
        existingValue: program[key],
        existingSourceType: program.sources?.[0]?.sourceType || '',
        proposedValue: updates[key],
        proposedSourceType: INSTITUTION_SOURCE_TYPE,
      });
      skippedConflicts.push(key);
      continue;
    }
    program[key] = updates[key];
  }
  if (skippedConflicts.length) {
    await prepareNotification({
      organizationId,
      eventType: INSTITUTION_NOTIFICATION_TYPES.CONFLICT_REQUIRES_ACTION,
      payload: { programId, fields: skippedConflicts },
    });
    const { notifyInstitutionOrganizationOwners } = await import('./institutionInboxNotificationBridge.js');
    await notifyInstitutionOrganizationOwners({
      organizationId,
      category: 'system',
      type: 'institution_data_quality.conflict_requires_action',
      title: 'Data conflict requires review',
      body: 'A proposed Institution fact was not applied because it conflicts with stronger canonical authority. Review it on Data Quality. Opening that page does not mark data fresh.',
      link: '/institution/data-quality',
      dedupeKey: `institution-dq-conflict:${organizationId}:${programId || 'profile'}:${skippedConflicts.slice().sort().join(',')}`,
    });
  }

  // Validate tuition — Money contract (no guessed FX, no invented currencies)
  if (updates.tuition !== null && updates.tuition !== undefined) {
    const t = updates.tuition;
    if (t.amountMinor !== null && t.amountMinor !== undefined) {
      if (!Number.isInteger(t.amountMinor) || t.amountMinor < 0) {
        throw Object.assign(new Error('tuition.amountMinor must be a non-negative integer (minor units)'), { code: 'VALIDATION', status: 400 });
      }
      if (!t.currency) {
        throw Object.assign(new Error('tuition.currency is required when amountMinor is provided'), { code: 'VALIDATION', status: 400 });
      }
    }
  }

  await program.save();
  await logAudit({ action: 'institution_program_updated', actor, metadata: { organizationId, programId, updatedFields: Object.keys(updates) } });
  return program;
}

export async function submitProgramForReview({ programId, organizationId, canonicalInstitutionId, actor }) {
  const program = await Program.findById(programId);
  if (!program) throw Object.assign(new Error('Program not found'), { code: 'NOT_FOUND', status: 404 });
  if (program.institutionId.toString() !== canonicalInstitutionId.toString()) {
    throw Object.assign(new Error('Program does not belong to this institution'), { code: 'FORBIDDEN', status: 403 });
  }
  if (program.status !== PUB_STATUSES.DRAFT && program.status !== PUB_STATUSES.NEEDS_CHANGES) {
    throw Object.assign(new Error('Program must be in draft or needs_changes state to submit'), { code: 'INVALID_STATE', status: 409 });
  }

  await recordChangeEvent({
    organizationId, canonicalInstitutionId, programId,
    changeCategory: CHANGE_CATEGORIES.PROGRAM_STATUS, field: 'status',
    previousValue: program.status, newValue: PUB_STATUSES.SUBMITTED,
    changedByAccountId: actor.userId, changedByRole: actor.role,
  });

  program.status = PUB_STATUSES.SUBMITTED;
  await program.save();
  await logAudit({ action: 'institution_program_submitted', actor, metadata: { organizationId, programId } });
  return program;
}

// ---------------------------------------------------------------------------
// TestAcceptance management (institution/program scope only)
// ---------------------------------------------------------------------------

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/**
 * Resolve a catalog Test by ObjectId, stableId, or slug.
 * Only published catalog entries are accepted for institution writes.
 */
export async function resolvePublishedCatalogTest(testRef) {
  if (testRef == null || testRef === '') {
    throw Object.assign(new Error('testId is required'), { code: 'VALIDATION', status: 400 });
  }
  const ref = String(testRef).trim();
  let test = null;
  if (OBJECT_ID_RE.test(ref) && mongoose.Types.ObjectId.isValid(ref)) {
    test = await Test.findById(ref).populate('providerId', 'name slug').lean();
  }
  if (!test) {
    const key = ref.toLowerCase();
    test = await Test.findOne({
      $or: [{ stableId: key }, { slug: key }],
    }).populate('providerId', 'name slug').lean();
  }
  if (!test || test.status !== PUB_STATUSES.PUBLISHED) {
    throw Object.assign(
      new Error('Unknown or unpublished test catalog identity'),
      { code: 'VALIDATION', status: 400 }
    );
  }
  return test;
}

function parseOptionalOverallScore(raw) {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    throw Object.assign(new Error('minimumOverallScore must be a number'), { code: 'VALIDATION', status: 400 });
  }
  return n;
}

function assertIntakeBelongsToProgram(program, intake) {
  const label = String(intake || '').trim();
  if (!label) {
    throw Object.assign(new Error('intake is required for program_intake scope'), { code: 'VALIDATION', status: 400 });
  }
  const intakes = Array.isArray(program?.intakes) ? program.intakes : [];
  if (intakes.length === 0) {
    // Program has no structured intakes yet — allow free-form intake label.
    return label;
  }
  const match = intakes.find((entry) => {
    const cycle = String(entry.cycleLabel || '').trim().toLowerCase();
    return cycle && cycle === label.toLowerCase();
  });
  if (!match) {
    throw Object.assign(
      new Error('intake must reference an institution-owned program intake'),
      { code: 'VALIDATION', status: 400 }
    );
  }
  return label;
}

export async function createOrUpdateTestAcceptance({
  organizationId,
  canonicalInstitutionId,
  programId = null,
  testAcceptanceData,
  actor,
}) {
  const data = testAcceptanceData && typeof testAcceptanceData === 'object' ? testAcceptanceData : {};

  // Institution cannot modify country-level acceptance rules
  if (data.acceptanceScope === ACCEPTANCE_SCOPES.COUNTRY) {
    throw Object.assign(
      new Error('Institution cannot modify country-level test acceptance rules'),
      { code: 'FORBIDDEN', status: 403 }
    );
  }

  // Scope must be institution or program
  const validScopes = [ACCEPTANCE_SCOPES.INSTITUTION, ACCEPTANCE_SCOPES.PROGRAM, ACCEPTANCE_SCOPES.PROGRAM_INTAKE];
  if (!validScopes.includes(data.acceptanceScope)) {
    throw Object.assign(new Error('Invalid acceptance scope for institution'), { code: 'VALIDATION', status: 400 });
  }

  if (!isValidAcceptanceStatus(data.acceptanceStatus)) {
    throw Object.assign(new Error('Invalid acceptanceStatus'), { code: 'VALIDATION', status: 400 });
  }

  const catalogTest = await resolvePublishedCatalogTest(data.testId);

  let resolvedProgramId = programId || data.programId || null;
  let program = null;
  if (data.acceptanceScope === ACCEPTANCE_SCOPES.INSTITUTION) {
    resolvedProgramId = null;
  } else {
    if (!resolvedProgramId) {
      throw Object.assign(
        new Error('programId is required for program and program_intake scope'),
        { code: 'VALIDATION', status: 400 }
      );
    }
    program = await assertProgramOwnership(resolvedProgramId, canonicalInstitutionId);
  }

  let intake = String(data.intake || '').trim();
  if (data.acceptanceScope === ACCEPTANCE_SCOPES.PROGRAM_INTAKE) {
    intake = assertIntakeBelongsToProgram(program, intake);
  } else if (data.acceptanceScope === ACCEPTANCE_SCOPES.PROGRAM) {
    intake = '';
  }

  const sections = normalizeSectionMinimums(data.sectionMinimums);
  if (!sections.ok) {
    throw Object.assign(new Error(sections.error), { code: 'VALIDATION', status: 400 });
  }

  const period = validateEffectivePeriod(data.effectiveFrom, data.effectiveUntil);
  if (!period.ok) {
    throw Object.assign(new Error(period.error), { code: 'VALIDATION', status: 400 });
  }

  const validity = validateResultValidityMonths(data.resultValidityMonths);
  if (!validity.ok) {
    throw Object.assign(new Error(validity.error), { code: 'VALIDATION', status: 400 });
  }

  const minimumOverallScore = parseOptionalOverallScore(data.minimumOverallScore);

  // Supersede any existing draft claim for same scope
  const existingQuery = {
    institutionId: canonicalInstitutionId,
    programId: resolvedProgramId || null,
    testId: catalogTest._id,
    acceptanceScope: data.acceptanceScope,
    intake: intake || '',
    status: PUB_STATUSES.DRAFT,
  };
  const existing = await TestAcceptance.findOne(existingQuery);
  if (existing) {
    await recordChangeEvent({
      organizationId, canonicalInstitutionId, programId: resolvedProgramId,
      changeCategory: CHANGE_CATEGORIES.TEST_REQUIREMENT, field: 'testAcceptance',
      previousValue: { acceptanceStatus: existing.acceptanceStatus, minimumOverallScore: existing.minimumOverallScore },
      newValue: { acceptanceStatus: data.acceptanceStatus, minimumOverallScore },
      changedByAccountId: actor.userId, changedByRole: actor.role,
    });
  }

  const ta = await TestAcceptance.create({
    testId: catalogTest._id,
    acceptanceScope: data.acceptanceScope,
    acceptanceStatus: data.acceptanceStatus,
    minimumOverallScore,
    sectionMinimums: sections.value,
    scoreNotes: typeof data.scoreNotes === 'string' ? data.scoreNotes.trim() : '',
    intake,
    effectiveFrom: period.effectiveFrom,
    effectiveUntil: period.effectiveUntil,
    resultValidityMonths: validity.value,
    conditions: typeof data.conditions === 'string' ? data.conditions.trim() : '',
    waiverNotes: typeof data.waiverNotes === 'string' ? data.waiverNotes.trim() : '',
    institutionId: canonicalInstitutionId,
    programId: resolvedProgramId || null,
    status: PUB_STATUSES.DRAFT,
    sources: [{ sourceType: INSTITUTION_SOURCE_TYPE }],
  });

  if (existing) {
    existing.supersededById = ta._id;
    existing.status = PUB_STATUSES.ARCHIVED;
    await existing.save();
  }

  await logAudit({ action: 'institution_test_acceptance_created', actor, metadata: { organizationId, canonicalInstitutionId, programId: resolvedProgramId, testAcceptanceId: ta._id } });
  return ta;
}

export async function publishTestAcceptance({
  organizationId,
  canonicalInstitutionId,
  testAcceptanceId,
  actor,
}) {
  const ta = await TestAcceptance.findById(testAcceptanceId);
  if (!ta) {
    throw Object.assign(new Error('Test Acceptance not found'), { code: 'NOT_FOUND', status: 404 });
  }
  if (String(ta.institutionId) !== String(canonicalInstitutionId)) {
    throw Object.assign(new Error('Test Acceptance does not belong to this institution'), { code: 'FORBIDDEN', status: 403 });
  }
  if (ta.acceptanceScope === ACCEPTANCE_SCOPES.COUNTRY) {
    throw Object.assign(new Error('Institution cannot modify country-level test acceptance rules'), { code: 'FORBIDDEN', status: 403 });
  }
  if (ta.status !== PUB_STATUSES.DRAFT) {
    throw Object.assign(new Error('Only draft Test Acceptance records can be published'), { code: 'VALIDATION', status: 400 });
  }

  const existingPublished = await TestAcceptance.find({
    institutionId: canonicalInstitutionId,
    programId: ta.programId || null,
    testId: ta.testId,
    acceptanceScope: ta.acceptanceScope,
    intake: ta.intake || '',
    status: PUB_STATUSES.PUBLISHED,
  }).lean();

  const { conflict, reason } = detectConflict(existingPublished, {
    testId: String(ta.testId),
    acceptanceScope: ta.acceptanceScope,
    institutionId: String(ta.institutionId || ''),
    programId: ta.programId ? String(ta.programId) : '',
    countryCode: (ta.countryCode || '').toUpperCase(),
    intake: ta.intake || '',
    acceptanceStatus: ta.acceptanceStatus,
  });
  if (conflict) {
    throw Object.assign(new Error(`Conflict detected: ${reason}`), { code: 'CONFLICT', status: 409 });
  }

  for (const peer of existingPublished) {
    if (String(peer._id) === String(ta._id)) continue;
    await TestAcceptance.updateOne(
      { _id: peer._id },
      { $set: { status: PUB_STATUSES.ARCHIVED, supersededById: ta._id } }
    );
  }

  ta.status = PUB_STATUSES.PUBLISHED;
  await ta.save();

  await recordChangeEvent({
    organizationId,
    canonicalInstitutionId,
    programId: ta.programId || null,
    changeCategory: CHANGE_CATEGORIES.TEST_REQUIREMENT,
    field: 'testAcceptance.status',
    previousValue: { status: PUB_STATUSES.DRAFT },
    newValue: { status: PUB_STATUSES.PUBLISHED },
    changedByAccountId: actor.userId,
    changedByRole: actor.role,
  });
  await logAudit({
    action: 'institution_test_acceptance_published',
    actor,
    metadata: { organizationId, canonicalInstitutionId, testAcceptanceId: ta._id },
  });
  return ta;
}

export async function archiveTestAcceptance({
  organizationId,
  canonicalInstitutionId,
  testAcceptanceId,
  actor,
}) {
  const ta = await TestAcceptance.findById(testAcceptanceId);
  if (!ta) {
    throw Object.assign(new Error('Test Acceptance not found'), { code: 'NOT_FOUND', status: 404 });
  }
  if (String(ta.institutionId) !== String(canonicalInstitutionId)) {
    throw Object.assign(new Error('Test Acceptance does not belong to this institution'), { code: 'FORBIDDEN', status: 403 });
  }
  if (ta.acceptanceScope === ACCEPTANCE_SCOPES.COUNTRY) {
    throw Object.assign(new Error('Institution cannot modify country-level test acceptance rules'), { code: 'FORBIDDEN', status: 403 });
  }
  if (ta.status !== PUB_STATUSES.PUBLISHED) {
    throw Object.assign(new Error('Only published Test Acceptance records can be archived'), { code: 'VALIDATION', status: 400 });
  }

  const previous = ta.status;
  ta.status = PUB_STATUSES.ARCHIVED;
  await ta.save();

  await recordChangeEvent({
    organizationId,
    canonicalInstitutionId,
    programId: ta.programId || null,
    changeCategory: CHANGE_CATEGORIES.TEST_REQUIREMENT,
    field: 'testAcceptance.status',
    previousValue: { status: previous },
    newValue: { status: PUB_STATUSES.ARCHIVED },
    changedByAccountId: actor.userId,
    changedByRole: actor.role,
  });
  await logAudit({
    action: 'institution_test_acceptance_archived',
    actor,
    metadata: { organizationId, canonicalInstitutionId, testAcceptanceId: ta._id },
  });
  return ta;
}

// ---------------------------------------------------------------------------
// Scholarship management (institution-owned only)
// ---------------------------------------------------------------------------

export async function assertScholarshipOwnership(scholarshipId, organizationId, canonicalInstitutionId) {
  const scholarship = await CanonicalScholarship.findById(scholarshipId).lean();
  if (!scholarship) throw Object.assign(new Error('Scholarship not found'), { code: 'NOT_FOUND', status: 404 });

  // Institution can only manage scholarships it is legitimately the provider/owner of
  const ownsScholarship =
    (scholarship.institutionId && scholarship.institutionId.toString() === canonicalInstitutionId.toString()) ||
    (scholarship.organizationId && scholarship.organizationId.toString() === organizationId.toString());

  if (!ownsScholarship) {
    throw Object.assign(
      new Error('Institution cannot modify scholarships it does not own or administer'),
      { code: 'FORBIDDEN', status: 403 }
    );
  }
  return scholarship;
}

// ---------------------------------------------------------------------------
// Freshness reconfirmation
// ---------------------------------------------------------------------------

export async function reconfirmFreshness({
  organizationId,
  canonicalInstitutionId,
  programId = null,
  reconfirmationNote,
  sourceUrl,
  actor,
  membershipRole,
}) {
  await recordChangeEvent({
    organizationId, canonicalInstitutionId, programId,
    changeCategory: CHANGE_CATEGORIES.PROVENANCE_RECONFIRMATION,
    field: 'freshnessReconfirmed',
    previousValue: null,
    newValue: { reconfirmedAt: new Date().toISOString(), note: reconfirmationNote, sourceUrl },
    changedByAccountId: actor.userId, changedByRole: membershipRole,
    sourceType: INSTITUTION_SOURCE_TYPE, sourceUrl, reconfirmationNote,
  });

  if (programId) {
    await Program.findByIdAndUpdate(programId, {
      lastVerifiedAt: new Date(),
      freshnessState: 'fresh',
    });
  }

  await logAudit({ action: 'institution_freshness_reconfirmed', actor, metadata: { organizationId, canonicalInstitutionId, programId } });
}

// ---------------------------------------------------------------------------
// Dashboard metrics
// ---------------------------------------------------------------------------

export async function getDashboardMetrics(organizationId, canonicalInstitutionId) {
  const { InstitutionAdmissionApplication } = await import('../models/institution/InstitutionAdmissionApplication.js');
  const { FRESHNESS_STATES } = await import('../../../shared/trust/sourceVerification.js');
  const { ADMISSION_STATES } = await import('../../../shared/institution/institutionPortal.js');
  const mongoose = await import('mongoose');

  const [
    verification, claim, profile, publishedPrograms, draftPrograms, conflicts,
    scholarshipCount, testAcceptanceCount, internalApplications, stalePrograms, reviewDuePrograms,
    intakeCount,
  ] = await Promise.all([
    OrganizationVerification.findOne({ organizationId }).lean(),
    InstitutionClaim.findOne({ organizationId }).lean(),
    InstitutionProfile.findOne({ organizationId }).lean(),
    canonicalInstitutionId ? Program.countDocuments({ institutionId: canonicalInstitutionId, status: PUB_STATUSES.PUBLISHED }) : 0,
    canonicalInstitutionId ? Program.countDocuments({ institutionId: canonicalInstitutionId, status: PUB_STATUSES.DRAFT }) : 0,
    InstitutionDataConflict.countDocuments({ organizationId, state: CONFLICT_STATES.OPEN }),
    canonicalInstitutionId ? CanonicalScholarship.countDocuments({ institutionId: canonicalInstitutionId, organizationId }) : 0,
    canonicalInstitutionId ? TestAcceptance.countDocuments({ institutionId: canonicalInstitutionId, acceptanceScope: { $ne: ACCEPTANCE_SCOPES.COUNTRY } }) : 0,
    InstitutionAdmissionApplication.countDocuments({ organizationId }),
    canonicalInstitutionId ? Program.countDocuments({ institutionId: canonicalInstitutionId, freshnessState: FRESHNESS_STATES.STALE }) : 0,
    canonicalInstitutionId ? Program.countDocuments({ institutionId: canonicalInstitutionId, freshnessState: FRESHNESS_STATES.REVIEW_DUE }) : 0,
    canonicalInstitutionId
      ? Program.aggregate([
        { $match: { institutionId: canonicalInstitutionId } },
        { $project: { n: { $size: { $ifNull: ['$intakes', []] } } } },
        { $group: { _id: null, total: { $sum: '$n' } } },
      ]).then((rows) => rows[0]?.total || 0).catch(() => 0)
      : Promise.resolve(0),
  ]);

  const orgOid = mongoose.Types.ObjectId.isValid(String(organizationId))
    ? new mongoose.Types.ObjectId(String(organizationId))
    : organizationId;
  const distRows = await InstitutionAdmissionApplication.aggregate([
    { $match: { organizationId: orgOid } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]).catch(() => []);
  const applicationStatusDistribution = Object.fromEntries(
    Object.values(ADMISSION_STATES).map((s) => [s, 0])
  );
  for (const row of distRows) {
    if (row._id && applicationStatusDistribution[row._id] !== undefined) {
      applicationStatusDistribution[row._id] = row.count;
    }
  }

  return {
    verificationStatus: verification?.status || 'draft',
    claimState: claim?.state || null,
    profileCompleteness: profile?.completenessScore || 0,
    publishedPrograms,
    draftPrograms,
    openConflicts: conflicts,
    institutionOwnedScholarships: scholarshipCount,
    testAcceptanceRecords: testAcceptanceCount,
    internalApplications,
    applicationStatusDistribution,
    staleFacts: stalePrograms,
    reviewDueFacts: reviewDuePrograms,
    intakeCount,
    externalApplicationTraffic: 'not_tracked',
    launchPlan: INSTITUTION_LAUNCH_BILLING.planLabel,
  };
}

export async function getUsageBilling() {
  return {
    plan: INSTITUTION_LAUNCH_BILLING,
    provider: { state: INSTITUTION_LAUNCH_BILLING.providerState, liveStripeCalled: false },
    wallet: 'not_configured',
  };
}

export async function listOwnedPrograms({ canonicalInstitutionId, q, status, sort = '-createdAt', page = 1, limit = 20 }) {
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const filter = { institutionId: canonicalInstitutionId };
  if (status) filter.status = status;
  const query = boundedInstitutionQuery(q);
  if (query) filter.name = { $regex: escapeRegex(query), $options: 'i' };
  const sortSpec = sort === 'name' ? { name: 1 } : { createdAt: -1 };
  const [programs, total] = await Promise.all([
    Program.find(filter).sort(sortSpec).skip((pageNum - 1) * safeLimit).limit(safeLimit).lean(),
    Program.countDocuments(filter),
  ]);
  return { programs, pagination: { page: pageNum, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } };
}

export async function listTestAcceptance({ canonicalInstitutionId, q, page = 1, limit = 20 }) {
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const filter = {
    institutionId: canonicalInstitutionId,
    acceptanceScope: { $ne: ACCEPTANCE_SCOPES.COUNTRY },
  };
  const query = boundedInstitutionQuery(q);
  if (query) filter.$or = [{ acceptanceStatus: { $regex: escapeRegex(query), $options: 'i' } }];
  const [records, total] = await Promise.all([
    TestAcceptance.find(filter)
      .populate({
        path: 'testId',
        select: 'name shortName slug stableId scoreScale providerId',
        populate: { path: 'providerId', select: 'name slug' },
      })
      .populate('programId', 'name slug intakes')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * safeLimit)
      .limit(safeLimit)
      .select('-adminNotes')
      .lean(),
    TestAcceptance.countDocuments(filter),
  ]);
  return { records, pagination: { page: pageNum, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } };
}

export async function listOwnedScholarships({ organizationId, canonicalInstitutionId, q, page = 1, limit = 20 }) {
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const filter = {
    $or: [
      { organizationId },
      { institutionId: canonicalInstitutionId },
    ],
  };
  const query = boundedInstitutionQuery(q);
  if (query) filter.title = { $regex: escapeRegex(query), $options: 'i' };
  const [scholarships, total] = await Promise.all([
    CanonicalScholarship.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * safeLimit).limit(safeLimit)
      .select('-adminNotes')
      .lean(),
    CanonicalScholarship.countDocuments(filter),
  ]);
  return { scholarships, pagination: { page: pageNum, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } };
}

export async function createOwnedScholarship({
  organizationId,
  canonicalInstitutionId,
  data,
  actor,
}) {
  const { containsForbiddenGuarantee } = await import('../../../shared/education/scholarshipIntelligence.js');
  const { SCHOLARSHIP_TYPES, PROVIDER_TYPES, FUNDING_TYPES } = await import('../../../shared/education/scholarshipIntelligence.js');
  const { educationSlug } = await import('../../../shared/education/taxonomy.js');
  const { isDateOnly } = await import('../../../shared/institution/institutionPortal.js');

  const title = String(data.title || '').trim();
  if (!title) throw Object.assign(new Error('title is required'), { code: 'VALIDATION', status: 400 });
  if (containsForbiddenGuarantee(title) || containsForbiddenGuarantee(data.summary)) {
    throw Object.assign(new Error('Guarantee wording is not allowed'), { code: 'FORBIDDEN_GUARANTEE', status: 422 });
  }
  if (data.scholarshipType && data.scholarshipType !== SCHOLARSHIP_TYPES.INSTITUTIONAL) {
    throw Object.assign(
      new Error('Institution may only manage its own institutional scholarships. External/government awards require independent source authority.'),
      { code: 'EXTERNAL_AUTHORITY', status: 403 }
    );
  }
  if (data.deadlineDate && !isDateOnly(data.deadlineDate)) {
    throw Object.assign(new Error('deadlineDate must be YYYY-MM-DD with no timezone'), { code: 'VALIDATION', status: 422 });
  }
  if (data.funding?.amountMinor != null && !Number.isInteger(data.funding.amountMinor)) {
    throw Object.assign(new Error('funding.amountMinor must be an integer'), { code: 'VALIDATION', status: 400 });
  }
  const criteria = Array.isArray(data.criteria) && data.criteria.length
    ? data.criteria
    : (String(data.eligibility || '').trim()
      ? [{ criteriaType: 'other', value: String(data.eligibility).trim().slice(0, 500), notes: String(data.eligibility).trim().slice(0, 1000) }]
      : []);

  let slug = educationSlug(title);
  const base = slug;
  let attempt = 0;
  while (await CanonicalScholarship.exists({ slug })) {
    attempt += 1;
    slug = `${base}-${attempt + 1}`;
  }

  const scholarship = await CanonicalScholarship.create({
    slug,
    title,
    provider: {
      name: data.provider?.name || '',
      providerType: PROVIDER_TYPES.UNIVERSITY,
    },
    scholarshipType: SCHOLARSHIP_TYPES.INSTITUTIONAL,
    destinationCountries: data.destinationCountries || [],
    degreeLevels: data.degreeLevels || [],
    fields: data.fields || [],
    studyModes: data.studyModes || [],
    funding: data.funding || { type: FUNDING_TYPES.UNKNOWN },
    criteria,
    applicationMethod: data.applicationMethod,
    applicationUrl: data.applicationUrl || '',
    summary: data.summary || '',
    sources: [{ sourceType: INSTITUTION_SOURCE_TYPE, sourceUrl: data.sourceUrl || '' }],
    institutionId: canonicalInstitutionId,
    organizationId,
    applicableProgramIds: data.applicableProgramIds || [],
    nationalityScope: data.nationalityScope || [],
    cycleLabel: data.cycleLabel || '',
    deadlineDate: data.deadlineDate || '',
    status: PUB_STATUSES.DRAFT,
    verificationStatus: 'unverified',
    freshnessState: 'unknown',
  });

  await logAudit({
    action: 'institution_scholarship_created',
    actor,
    metadata: { organizationId, scholarshipId: scholarship._id },
  });
  return scholarship;
}

export async function updateOwnedScholarship({
  scholarshipId,
  organizationId,
  canonicalInstitutionId,
  updates,
  actor,
}) {
  const { containsForbiddenGuarantee } = await import('../../../shared/education/scholarshipIntelligence.js');
  const { isDateOnly } = await import('../../../shared/institution/institutionPortal.js');
  const scholarship = await CanonicalScholarship.findById(scholarshipId);
  if (!scholarship) throw Object.assign(new Error('Scholarship not found'), { code: 'NOT_FOUND', status: 404 });
  await assertScholarshipOwnership(scholarshipId, organizationId, canonicalInstitutionId);

  if (containsForbiddenGuarantee(updates.title) || containsForbiddenGuarantee(updates.summary)) {
    throw Object.assign(new Error('Guarantee wording is not allowed'), { code: 'FORBIDDEN_GUARANTEE', status: 422 });
  }
  if (updates.deadlineDate && !isDateOnly(updates.deadlineDate)) {
    throw Object.assign(new Error('deadlineDate must be YYYY-MM-DD with no timezone'), { code: 'VALIDATION', status: 422 });
  }

  const allowed = [
    'title', 'summary', 'funding', 'criteria', 'applicationUrl', 'applicationMethod',
    'destinationCountries', 'degreeLevels', 'fields', 'studyModes', 'applicableProgramIds',
    'nationalityScope', 'cycleLabel', 'deadlineDate', 'status',
  ];
  for (const key of allowed) {
    if (updates[key] !== undefined) scholarship[key] = updates[key];
  }
  if (updates.sourceUrl) {
    scholarship.sources = [{ sourceType: INSTITUTION_SOURCE_TYPE, sourceUrl: updates.sourceUrl }];
  }
  await scholarship.save();
  await logAudit({
    action: 'institution_scholarship_updated',
    actor,
    metadata: { organizationId, scholarshipId },
  });
  return scholarship;
}

export function normalizeIntake(raw = {}) {
  const open = raw.applicationOpenDate || toDateOnlyUtc(raw.applicationOpenAt) || '';
  const deadline = raw.deadlineDate || toDateOnlyUtc(raw.deadlineAt) || '';
  const start = raw.startDate || '';
  for (const [label, value] of [['applicationOpenDate', open], ['deadlineDate', deadline], ['startDate', start]]) {
    if (value && !isDateOnly(value)) {
      throw Object.assign(new Error(`${label} must be YYYY-MM-DD with no timezone`), { code: 'VALIDATION', status: 422 });
    }
  }
  const mode = raw.applicationMode || APPLICATION_MODES.NOT_CONFIGURED;
  if (!isValidApplicationMode(mode)) {
    throw Object.assign(new Error('Invalid application mode'), { code: 'VALIDATION', status: 400 });
  }
  const status = raw.status || INTAKE_STATUSES.DRAFT;
  if (!isValidIntakeStatus(status)) {
    throw Object.assign(new Error('Invalid intake status'), { code: 'VALIDATION', status: 400 });
  }
  if (raw.fee?.amountMinor != null && !Number.isInteger(raw.fee.amountMinor)) {
    throw Object.assign(new Error('fee.amountMinor must be an integer'), { code: 'VALIDATION', status: 400 });
  }
  return {
    cycleLabel: String(raw.cycleLabel || '').trim(),
    applicationOpenAt: open ? new Date(`${open}T00:00:00.000Z`) : null,
    deadlineAt: deadline ? new Date(`${deadline}T00:00:00.000Z`) : null,
    notes: String(raw.notes || '').trim(),
    applicationOpenDate: open,
    deadlineDate: deadline,
    startDate: start,
    applicationMode: mode,
    applicationUrl: String(raw.applicationUrl || '').trim(),
    capacity: Number.isInteger(raw.capacity) ? raw.capacity : null,
    requirements: String(raw.requirements || '').trim(),
    fee: {
      amountMinor: raw.fee?.amountMinor ?? null,
      currency: String(raw.fee?.currency || '').trim().toUpperCase(),
    },
    status,
    sourceUrl: String(raw.sourceUrl || '').trim(),
  };
}

// ---------------------------------------------------------------------------
// Public institution directory helpers
// ---------------------------------------------------------------------------

export async function searchPublicInstitutions({ name, countryCode, institutionType, page = 1, limit = 20 }) {
  const safeLimit = Math.min(limit, 50);
  const safePage = Math.max(page, 1);
  const skip = (safePage - 1) * safeLimit;

  const query = withFixtureExclusion({ status: PUB_STATUSES.PUBLISHED });
  if (name) query.$text = { $search: name };
  if (countryCode) query.countryCode = countryCode.toUpperCase();
  if (institutionType) query.institutionType = institutionType;

  const [results, total] = await Promise.all([
    CanonicalInstitution.find(query)
      .select('officialName slug countryCode city region institutionType officialWebsite organizationId')
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    CanonicalInstitution.countDocuments(query),
  ]);

  return { results, total, page: safePage, limit: safeLimit };
}

export { resolveActiveMembership as default };
