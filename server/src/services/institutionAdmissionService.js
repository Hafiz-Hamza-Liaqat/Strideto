/**
 * Internal Institution admission applications (Phase 6).
 * Student submits a consented projection. Institution owns authoritative states.
 * No Vault browsing. No self-admit. No foreign-application mutation.
 */
import { InstitutionAdmissionApplication } from '../models/institution/InstitutionAdmissionApplication.js';
import { Program } from '../models/education/Program.js';
import { User } from '../models/User.js';
import { logAudit } from './auditService.js';
import { createUserNotificationOnce } from './notificationService.js';
import { notifyInstitutionOrganizationOwners } from './institutionInboxNotificationBridge.js';
import {
  ADMISSION_STATES,
  APPLICATION_MODES,
  APPLICATION_SNAPSHOT_FIELDS,
  CLAIM_STATES,
  CONSENT_SCOPES,
  INSTITUTION_ROLES,
  STUDENT_WITHDRAWABLE,
  boundedInstitutionQuery,
  escapeRegex,
  isValidInstitutionAdmissionTransition,
} from '../../../shared/institution/institutionPortal.js';
import { ORGANIZATION_CAPABILITY_IDS } from '../../../shared/capability/organizationCapabilities.js';

function domainError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

// ---------------------------------------------------------------------------
// Organic admission trust — strict: approved verification + approved claim
// + not suspended/revoked. No override bypass permitted for organic decisions.
// ---------------------------------------------------------------------------
async function assertOrganicAdmissionTrust(organizationId) {
  const { OrganizationVerification } = await import('../models/OrganizationVerification.js');
  const { isSuspendedOrRevoked } = await import('../../../shared/international/verification.js');
  const ver = await OrganizationVerification.findOne({ organizationId }, { status: 1 }).lean();
  if (!ver || isSuspendedOrRevoked(ver.status)) {
    throw domainError(403, 'BLOCKED', 'Organization is suspended or revoked');
  }
  if (ver.status !== 'approved') {
    throw domainError(403, 'VERIFICATION_REQUIRED', 'Organization verification must be approved for institution admissions decisions');
  }
  const { InstitutionClaim } = await import('../models/institution/InstitutionClaim.js');
  const claim = await InstitutionClaim.findOne({ organizationId, state: CLAIM_STATES.APPROVED }).lean();
  if (!claim) {
    throw domainError(403, 'CLAIM_REQUIRED', 'Approved canonical institution claim required for institution admissions decisions');
  }
}

// ---------------------------------------------------------------------------
// QA admission trust — active qa_test override + INSTITUTION_PORTAL capability
// + not suspended/revoked. Claim approval is NOT required for the QA path.
// ---------------------------------------------------------------------------
async function assertQaAdmissionTrust(organizationId) {
  const { OrganizationVerification } = await import('../models/OrganizationVerification.js');
  const { isSuspendedOrRevoked } = await import('../../../shared/international/verification.js');
  const ver = await OrganizationVerification.findOne({ organizationId }, { status: 1 }).lean();
  if (isSuspendedOrRevoked(ver?.status)) {
    throw domainError(403, 'BLOCKED', 'Organization is suspended or revoked');
  }
  const { getOverrideService } = await import('./capability/overrideRuntime.js');
  const override = await getOverrideService().getActiveOverride(String(organizationId));
  if (
    !override ||
    override.overrideType !== 'qa_test' ||
    !Array.isArray(override.capabilities) ||
    !override.capabilities.includes(ORGANIZATION_CAPABILITY_IDS.INSTITUTION_PORTAL)
  ) {
    throw domainError(403, 'QA_OVERRIDE_REQUIRED', 'Active qa_test INSTITUTION_PORTAL override required for QA application transitions');
  }
}

function safeSnapshot(input = {}) {
  const out = {};
  for (const key of APPLICATION_SNAPSHOT_FIELDS) {
    out[key] = typeof input[key] === 'string' ? input[key].trim().slice(0, 500) : '';
  }
  return out;
}

function publicInstitutionView(doc) {
  if (!doc) return null;
  return {
    _id: doc._id,
    organizationId: doc.organizationId,
    canonicalInstitutionId: doc.canonicalInstitutionId,
    programId: doc.programId,
    intakeCycleLabel: doc.intakeCycleLabel,
    status: doc.status,
    consentScope: doc.consentScope,
    consentedAt: doc.consentedAt,
    snapshot: doc.snapshot,
    missingInformation: doc.missingInformation,
    informationRequestNote: doc.informationRequestNote,
    studentResponse: doc.studentResponse,
    submittedAt: doc.submittedAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

function studentView(doc) {
  const view = publicInstitutionView(doc);
  if (!view) return null;
  return {
    ...view,
    studentUserId: doc.studentUserId,
  };
}

function intakeAllowsInternal(program, intakeCycleLabel) {
  const intakes = program.intakes || [];
  const match = intakeCycleLabel
    ? intakes.find((i) => i.cycleLabel === intakeCycleLabel)
    : intakes[0];
  const mode = match?.applicationMode || APPLICATION_MODES.NOT_CONFIGURED;
  return mode === APPLICATION_MODES.INTERNAL || mode === APPLICATION_MODES.BOTH;
}

export async function submitStudentApplication({
  studentUserId,
  programId,
  intakeCycleLabel = '',
  snapshot,
  consentAccepted,
}) {
  if (!consentAccepted) {
    throw domainError(422, 'CONSENT_REQUIRED', 'Explicit consent is required to submit an admission application');
  }
  if (!programId) throw domainError(400, 'VALIDATION', 'programId is required');

  const program = await Program.findById(programId).lean();
  if (!program) throw domainError(404, 'NOT_FOUND', 'Program not found');
  if (!intakeAllowsInternal(program, intakeCycleLabel)) {
    throw domainError(409, 'EXTERNAL_ONLY', 'This Program intake does not accept internal Strideto applications');
  }

  const user = await User.findById(studentUserId).select('email name displayName').lean();
  const body = safeSnapshot(snapshot);
  if (!body.displayName) body.displayName = user?.displayName || user?.name || '';
  if (!body.email) body.email = user?.email || '';
  if (!body.displayName || !body.email) {
    throw domainError(422, 'INCOMPLETE_SNAPSHOT', 'Display name and email are required in the application snapshot');
  }

  // Program.institutionId is CanonicalInstitution. Organization is resolved via approved claim.
  const existing = await InstitutionAdmissionApplication.findOne({
    programId,
    studentUserId,
    intakeCycleLabel: intakeCycleLabel || '',
  });
  if (existing) throw domainError(409, 'DUPLICATE_APPLICATION', 'An application already exists for this Program intake');

  const { InstitutionClaim } = await import('../models/institution/InstitutionClaim.js');
  const { CLAIM_STATES } = await import('../../../shared/institution/institutionPortal.js');
  let qaBypass = false;
  let claim = await InstitutionClaim.findOne({
    canonicalInstitutionId: program.institutionId,
    state: CLAIM_STATES.APPROVED,
  }).lean();

  if (!claim) {
    // QA bypass: an unapproved claim + active qa_test super-admin override on the linked org
    // allows the admission workflow for cross-role QA testing without mutating claim state.
    const anyClaim = await InstitutionClaim.findOne({
      canonicalInstitutionId: program.institutionId,
    }).lean();
    if (anyClaim) {
      const { getOverrideService } = await import('./capability/overrideRuntime.js');
      const override = await getOverrideService().getActiveOverride(String(anyClaim.organizationId));
      if (
        override?.overrideType === 'qa_test' &&
        Array.isArray(override.capabilities) &&
        override.capabilities.includes(ORGANIZATION_CAPABILITY_IDS.INSTITUTION_PORTAL)
      ) {
        const { OrganizationVerification } = await import('../models/OrganizationVerification.js');
        const { isSuspendedOrRevoked } = await import('../../../shared/international/verification.js');
        const ver = await OrganizationVerification.findOne(
          { organizationId: anyClaim.organizationId },
          { status: 1 }
        ).lean();
        if (!isSuspendedOrRevoked(ver?.status)) {
          claim = anyClaim; // use for org routing only; claim.state remains unchanged
          qaBypass = true;
        }
      }
    }
    if (!claim) throw domainError(409, 'CLAIM_REQUIRED', 'This Program is not linked to a claimed Institution');
  }

  const doc = await InstitutionAdmissionApplication.create({
    organizationId: claim.organizationId,
    canonicalInstitutionId: program.institutionId,
    programId,
    intakeCycleLabel: intakeCycleLabel || '',
    studentUserId,
    status: ADMISSION_STATES.RECEIVED,
    consentScope: CONSENT_SCOPES.ADMISSION_APPLICATION,
    consentedAt: new Date(),
    snapshot: body,
    source: qaBypass ? 'qa_test' : 'organic',
    history: [{ fromState: '', toState: ADMISSION_STATES.RECEIVED, changedBy: studentUserId, changedByRealm: 'user', at: new Date() }],
  });

  await logAudit({
    action: 'institution_admission_submitted',
    actor: { userId: studentUserId, role: 'user', realm: 'user' },
    metadata: { applicationId: doc._id, organizationId: claim.organizationId, programId },
  });

  await notifyInstitutionOrganizationOwners({
    organizationId: claim.organizationId,
    roles: [INSTITUTION_ROLES.OWNER, INSTITUTION_ROLES.ADMIN, INSTITUTION_ROLES.EDITOR],
    category: 'admission',
    type: 'institution_admission.received',
    title: 'New internal admission application',
    body: 'A Student submitted an internal admission application.',
    link: '/institution/applications',
    dedupeKey: `institution-admission:${doc._id}:received`,
  });

  const { recordHandoffConsent, CONSENT_PURPOSES } = await import('./consentGrantService.js');
  await recordHandoffConsent({
    subjectId: studentUserId,
    counterpartyId: claim.organizationId,
    counterpartyType: 'institution',
    purpose: CONSENT_PURPOSES.INSTITUTION_ADMISSION,
    resourceScope: `institution_admission:${doc._id}`,
    grantedAt: doc.consentedAt,
    provenance: 'student_institution_apply',
    auditIdentity: `institution_admission:${doc._id}`,
  });

  return studentView(doc.toObject());
}

export async function listStudentApplications({ studentUserId, page = 1, limit = 20 }) {
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const filter = { studentUserId };
  const [items, total] = await Promise.all([
    InstitutionAdmissionApplication.find(filter).sort({ submittedAt: -1 }).skip((pageNum - 1) * safeLimit).limit(safeLimit).lean(),
    InstitutionAdmissionApplication.countDocuments(filter),
  ]);
  return {
    applications: items.map(studentView),
    pagination: { page: pageNum, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
  };
}

export async function withdrawStudentApplication({ studentUserId, applicationId }) {
  const doc = await InstitutionAdmissionApplication.findOne({ _id: applicationId, studentUserId });
  if (!doc) throw domainError(404, 'NOT_FOUND', 'Application not found');
  if (!STUDENT_WITHDRAWABLE.has(doc.status)) {
    throw domainError(409, 'INVALID_STATE', 'This application cannot be withdrawn in its current state');
  }
  const from = doc.status;
  doc.history.push({ fromState: from, toState: ADMISSION_STATES.WITHDRAWN, changedBy: studentUserId, changedByRealm: 'user', at: new Date() });
  doc.status = ADMISSION_STATES.WITHDRAWN;
  doc.version += 1;
  await doc.save();
  await notifyInstitutionOrganizationOwners({
    organizationId: doc.organizationId,
    roles: [INSTITUTION_ROLES.OWNER, INSTITUTION_ROLES.ADMIN, INSTITUTION_ROLES.EDITOR],
    category: 'admission',
    type: 'institution_admission.withdrawn',
    title: 'Admission application withdrawn',
    body: 'A Student withdrew an internal admission application.',
    link: '/institution/applications',
    dedupeKey: `institution-admission:${doc._id}:withdrawn:${doc.version}`,
  });
  const { revokeHandoffConsent, CONSENT_PURPOSES } = await import('./consentGrantService.js');
  await revokeHandoffConsent({
    subjectId: studentUserId,
    purpose: CONSENT_PURPOSES.INSTITUTION_ADMISSION,
    resourceScope: `institution_admission:${doc._id}`,
    counterpartyId: doc.organizationId,
  });
  return studentView(doc.toObject());
}

export async function studentRespond({ studentUserId, applicationId, response }) {
  const doc = await InstitutionAdmissionApplication.findOne({ _id: applicationId, studentUserId });
  if (!doc) throw domainError(404, 'NOT_FOUND', 'Application not found');
  if (doc.status !== ADMISSION_STATES.NEEDS_INFORMATION) {
    throw domainError(409, 'INVALID_STATE', 'Additional information was not requested');
  }
  doc.studentResponse = String(response || '').trim().slice(0, 4000);
  if (!doc.studentResponse) throw domainError(422, 'VALIDATION', 'A response is required');
  const from = doc.status;
  doc.history.push({ fromState: from, toState: ADMISSION_STATES.UNDER_REVIEW, changedBy: studentUserId, changedByRealm: 'user', note: 'student_response', at: new Date() });
  doc.status = ADMISSION_STATES.UNDER_REVIEW;
  doc.version += 1;
  await doc.save();
  await notifyInstitutionOrganizationOwners({
    organizationId: doc.organizationId,
    roles: [INSTITUTION_ROLES.OWNER, INSTITUTION_ROLES.ADMIN, INSTITUTION_ROLES.EDITOR],
    category: 'admission',
    type: 'institution_admission.student_response',
    title: 'Student responded to information request',
    body: 'A Student provided additional admission information.',
    link: `/institution/applications/${doc._id}`,
    dedupeKey: `institution-admission:${doc._id}:response:${doc.version}`,
  });
  return studentView(doc.toObject());
}

export async function listInstitutionApplications({
  organizationId,
  q,
  status,
  programId,
  sort = '-submittedAt',
  page = 1,
  limit = 20,
}) {
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const filter = { organizationId };
  if (status) filter.status = status;
  if (programId) filter.programId = programId;
  const query = boundedInstitutionQuery(q);
  if (query) {
    const re = new RegExp(escapeRegex(query), 'i');
    filter.$or = [
      { 'snapshot.displayName': re },
      { 'snapshot.email': re },
      { intakeCycleLabel: re },
    ];
  }
  const sortSpec = sort === 'submittedAt' ? { submittedAt: 1 } : { submittedAt: -1 };
  const [items, total] = await Promise.all([
    InstitutionAdmissionApplication.find(filter).sort(sortSpec).skip((pageNum - 1) * safeLimit).limit(safeLimit).lean(),
    InstitutionAdmissionApplication.countDocuments(filter),
  ]);
  return {
    applications: items.map(publicInstitutionView),
    pagination: { page: pageNum, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
  };
}

export async function getInstitutionApplication({ organizationId, applicationId }) {
  const doc = await InstitutionAdmissionApplication.findOne({ _id: applicationId, organizationId }).lean();
  if (!doc) throw domainError(404, 'NOT_FOUND', 'Application not found');
  return publicInstitutionView(doc);
}

export async function transitionApplication({
  organizationId,
  applicationId,
  toState,
  note = '',
  missingInformation = [],
  actorAccountId,
  expectedVersion,
}) {
  const doc = await InstitutionAdmissionApplication.findOne({ _id: applicationId, organizationId });
  if (!doc) throw domainError(404, 'NOT_FOUND', 'Application not found');
  if (expectedVersion !== undefined && Number(expectedVersion) !== doc.version) {
    throw domainError(409, 'VERSION_CONFLICT', 'Application was updated by another reviewer');
  }

  // Authority gate — must run before any mutation.
  // Organic: approved verification + approved canonical claim + not suspended/revoked.
  // QA:      active qa_test override + INSTITUTION_PORTAL capability + not suspended/revoked.
  const appSource = doc.source || 'organic';
  if (appSource === 'qa_test') {
    await assertQaAdmissionTrust(organizationId);
  } else {
    await assertOrganicAdmissionTrust(organizationId);
  }

  if (!isValidInstitutionAdmissionTransition(doc.status, toState)) {
    throw domainError(409, 'INVALID_STATE', `Cannot transition from ${doc.status} to ${toState}`);
  }
  const from = doc.status;
  doc.history.push({
    fromState: from,
    toState,
    changedBy: actorAccountId,
    changedByRealm: 'institution',
    note: String(note || '').slice(0, 1000),
    at: new Date(),
  });
  doc.status = toState;
  if (toState === ADMISSION_STATES.NEEDS_INFORMATION) {
    doc.missingInformation = Array.isArray(missingInformation)
      ? missingInformation.map((s) => String(s).slice(0, 200)).slice(0, 20)
      : [];
    doc.informationRequestNote = String(note || '').slice(0, 1000);
  }
  doc.version += 1;
  await doc.save();

  await logAudit({
    action: 'institution_admission_transitioned',
    actor: { userId: actorAccountId, role: 'institution', realm: 'institution' },
    metadata: { applicationId, organizationId, from, toState },
  });

  await createUserNotificationOnce({
    recipientType: 'user',
    userId: doc.studentUserId,
    category: 'admission',
    type: `institution_admission.${toState}`,
    title: 'Admission application update',
    body: `Your Institution application status is now ${toState.replaceAll('_', ' ')}.`,
    link: '/applications/institution',
    dedupeKey: `institution-admission-student:${doc._id}:${toState}:${doc.version}`,
    metadata: { applicationId: String(doc._id), status: toState },
  });

  return publicInstitutionView(doc.toObject());
}

export async function denyVaultBrowse() {
  return Object.assign(new Error('Institution membership does not grant Student Vault access'), {
    status: 403,
    code: 'VAULT_DENIED',
  });
}
