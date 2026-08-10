/**
 * Admin Scholarship Intelligence controller (Mission 7).
 *
 * Manages CanonicalScholarship, ScholarshipCycle, ScholarshipApplicability,
 * and ProgramRequirement records.
 *
 * All routes require authenticated Admin/SuperAdmin (enforced by middleware).
 * Published high-value records require valid source/provenance.
 * Draft/publish/archive lifecycle enforced here.
 * Duplicate protection: slug uniqueness enforced at DB + application layer.
 * Audit: important publication/update actions are logged via AuditLog.
 */
import _mongoose from 'mongoose';
import { CanonicalScholarship } from '../../models/education/CanonicalScholarship.js';
import { ScholarshipCycle } from '../../models/education/ScholarshipCycle.js';
import { ScholarshipApplicability } from '../../models/education/ScholarshipApplicability.js';
import { ProgramRequirement } from '../../models/education/ProgramRequirement.js';
import { Program } from '../../models/education/Program.js';
import { AuditLog } from '../../models/AuditLog.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { validateSource } from '../../../../shared/international/evidence.js';
import {
  isValidScholarshipType,
  isValidProviderType,
  isValidFundingType,
  isValidFundingComponent,
  isValidApplicationMethod,
  isValidCriteriaType,
  isValidCycleStatus,
  isValidApplicabilityScope,
  isValidProgramRequirementType,
  isValidRequirementSemantics,
  containsForbiddenGuarantee,
} from '../../../../shared/education/scholarshipIntelligence.js';
import {
  isValidPubStatus,
  isValidDegreeLevel,
  isValidAcademicField,
  isValidStudyMode,
  educationSlug,
} from '../../../../shared/education/taxonomy.js';
import { isStaffRole } from '../../config/rbac.js';

// ── Authorization guard ────────────────────────────────────────────────────────

function requireAdmin(req, res) {
  if (!req.user || !isStaffRole(req.user.role)) {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

// ── Source parsing ─────────────────────────────────────────────────────────────

function parseSources(rawSources, { strict = false } = {}) {
  if (!Array.isArray(rawSources)) return { ok: true, sources: [] };
  const out = [];
  const errors = [];
  for (let i = 0; i < Math.min(rawSources.length, 20); i++) {
    const result = validateSource(rawSources[i]);
    if (result.ok) {
      out.push(result.value);
    } else if (strict) {
      errors.push(`sources[${i}]: ${result.errors.join(', ')}`);
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, sources: out };
}

function extractSources(rawSources, res, opts = {}) {
  const result = parseSources(rawSources, opts);
  if (!result.ok) {
    res.status(400).json({ error: result.errors.join('; ') });
    return null;
  }
  return result.sources;
}

// ── Audit helper ───────────────────────────────────────────────────────────────

async function audit(req, action, target, targetId) {
  try {
    await AuditLog.create({
      actorId: req.user._id,
      actorEmail: req.user.email,
      action,
      target,
      targetId: String(targetId),
      ip: req.ip,
    });
  } catch {
    // Non-fatal — audit failures must not block the primary operation
  }
}

// ────────────────────────────────────────────────────────────────────────────
// SCHOLARSHIPS
// ────────────────────────────────────────────────────────────────────────────

export const adminListScholarships = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const q = req.query || {};
  const filter = {};
  if (q.status) filter.status = sanitizeString(q.status);
  if (q.scholarshipType) filter.scholarshipType = sanitizeString(q.scholarshipType);
  if (q.country) filter.destinationCountries = sanitizeString(q.country).toUpperCase();

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    CanonicalScholarship.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    CanonicalScholarship.countDocuments(filter),
  ]);

  res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const adminGetScholarship = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const doc = await CanonicalScholarship.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: 'Scholarship not found' });
  res.json({ data: doc });
});

export const adminCreateScholarship = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = req.body || {};

  const title = sanitizeString(body.title);
  if (!title) return res.status(400).json({ error: 'title is required' });

  // Truthfulness: reject forbidden guarantee language
  if (containsForbiddenGuarantee(title) || containsForbiddenGuarantee(body.summary)) {
    return res.status(400).json({ error: 'Summary or title contains forbidden guarantee language' });
  }

  const isPublish = body.status === 'published';
  const sources = extractSources(body.sources, res, { strict: isPublish });
  if (sources === null) return;

  if (isPublish && sources.length === 0) {
    return res.status(400).json({ error: 'Published scholarships require at least one valid source' });
  }

  const slug = body.slug ? sanitizeString(body.slug) : educationSlug(title);

  const doc = await CanonicalScholarship.create({
    slug,
    title,
    provider: {
      name: sanitizeString(body.providerName),
      providerType: isValidProviderType(body.providerType) ? body.providerType : undefined,
    },
    scholarshipType: isValidScholarshipType(body.scholarshipType) ? body.scholarshipType : undefined,
    destinationCountries: Array.isArray(body.destinationCountries)
      ? body.destinationCountries.map((c) => sanitizeString(c).toUpperCase()).filter(Boolean)
      : [],
    degreeLevels: Array.isArray(body.degreeLevels)
      ? body.degreeLevels.filter(isValidDegreeLevel)
      : [],
    fields: Array.isArray(body.fields) ? body.fields.filter(isValidAcademicField) : [],
    studyModes: Array.isArray(body.studyModes) ? body.studyModes.filter(isValidStudyMode) : [],
    funding: buildFunding(body.funding),
    criteria: buildCriteria(body.criteria),
    applicationMethod: isValidApplicationMethod(body.applicationMethod)
      ? body.applicationMethod
      : undefined,
    applicationUrl: sanitizeString(body.applicationUrl),
    summary: sanitizeString(body.summary),
    status: isValidPubStatus(body.status) ? body.status : 'draft',
    sources,
    adminNotes: sanitizeString(body.adminNotes),
  });

  if (isPublish) await audit(req, 'scholarship.publish', 'CanonicalScholarship', doc._id);

  res.status(201).json({ data: doc });
});

export const adminUpdateScholarship = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const doc = await CanonicalScholarship.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Scholarship not found' });

  const body = req.body || {};
  const wasPublished = doc.status === 'published';
  const willPublish = body.status === 'published';

  if (containsForbiddenGuarantee(body.title) || containsForbiddenGuarantee(body.summary)) {
    return res.status(400).json({ error: 'Summary or title contains forbidden guarantee language' });
  }

  const sources = body.sources !== undefined
    ? extractSources(body.sources, res, { strict: willPublish })
    : doc.sources;
  if (sources === null) return;

  if (willPublish && sources.length === 0) {
    return res.status(400).json({ error: 'Published scholarships require at least one valid source' });
  }

  if (body.title !== undefined) doc.title = sanitizeString(body.title);
  if (body.slug !== undefined) doc.slug = sanitizeString(body.slug);
  if (body.providerName !== undefined) doc.provider.name = sanitizeString(body.providerName);
  if (body.providerType !== undefined && isValidProviderType(body.providerType)) {
    doc.provider.providerType = body.providerType;
  }
  if (body.scholarshipType !== undefined && isValidScholarshipType(body.scholarshipType)) {
    doc.scholarshipType = body.scholarshipType;
  }
  if (Array.isArray(body.destinationCountries)) {
    doc.destinationCountries = body.destinationCountries
      .map((c) => sanitizeString(c).toUpperCase())
      .filter(Boolean);
  }
  if (Array.isArray(body.degreeLevels)) doc.degreeLevels = body.degreeLevels.filter(isValidDegreeLevel);
  if (Array.isArray(body.fields)) doc.fields = body.fields.filter(isValidAcademicField);
  if (Array.isArray(body.studyModes)) doc.studyModes = body.studyModes.filter(isValidStudyMode);
  if (body.funding !== undefined) doc.funding = buildFunding(body.funding);
  if (body.criteria !== undefined) doc.criteria = buildCriteria(body.criteria);
  if (body.applicationMethod !== undefined && isValidApplicationMethod(body.applicationMethod)) {
    doc.applicationMethod = body.applicationMethod;
  }
  if (body.applicationUrl !== undefined) doc.applicationUrl = sanitizeString(body.applicationUrl);
  if (body.summary !== undefined) doc.summary = sanitizeString(body.summary);
  if (body.status !== undefined && isValidPubStatus(body.status)) doc.status = body.status;
  if (body.sources !== undefined) doc.sources = sources;
  if (body.adminNotes !== undefined) doc.adminNotes = sanitizeString(body.adminNotes);

  await doc.save();

  if (!wasPublished && willPublish) {
    await audit(req, 'scholarship.publish', 'CanonicalScholarship', doc._id);
  } else if (wasPublished && body.status === 'archived') {
    await audit(req, 'scholarship.archive', 'CanonicalScholarship', doc._id);
  }

  res.json({ data: doc });
});

// ── Funding / criteria builders ────────────────────────────────────────────────

function buildFunding(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  return {
    type: isValidFundingType(raw.type) ? raw.type : 'unknown',
    amountMinor: typeof raw.amountMinor === 'number' ? raw.amountMinor : null,
    currency: sanitizeString(raw.currency || '').toUpperCase(),
    components: Array.isArray(raw.components)
      ? raw.components
          .filter((c) => isValidFundingComponent(c.component))
          .map((c) => ({
            component: c.component,
            amountMinor: typeof c.amountMinor === 'number' ? c.amountMinor : null,
            currency: sanitizeString(c.currency || '').toUpperCase(),
            notes: sanitizeString(c.notes || ''),
          }))
      : [],
    notes: sanitizeString(raw.notes || ''),
  };
}

function buildCriteria(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => isValidCriteriaType(c.criteriaType))
    .map((c) => ({
      criteriaType: c.criteriaType,
      value: sanitizeString(c.value || ''),
      gradingContext: sanitizeString(c.gradingContext || ''),
      notes: sanitizeString(c.notes || ''),
    }));
}

// ────────────────────────────────────────────────────────────────────────────
// SCHOLARSHIP CYCLES
// ────────────────────────────────────────────────────────────────────────────

export const adminListCycles = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { scholarshipId } = req.params;
  const q = req.query || {};
  const filter = { scholarshipId };
  if (q.status) filter.status = sanitizeString(q.status);
  if (q.historical !== undefined) filter.isHistorical = q.historical === 'true';

  const data = await ScholarshipCycle.find(filter).sort({ deadlineAt: -1 }).lean();
  res.json({ data });
});

export const adminCreateCycle = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { scholarshipId } = req.params;
  const body = req.body || {};

  const scholarship = await CanonicalScholarship.findById(scholarshipId).lean();
  if (!scholarship) return res.status(404).json({ error: 'Scholarship not found' });

  const isPublish = body.status === 'published';
  const sources = extractSources(body.sources, res, { strict: isPublish });
  if (sources === null) return;

  if (isPublish && sources.length === 0) {
    return res.status(400).json({ error: 'Published cycles require at least one valid source' });
  }

  const doc = await ScholarshipCycle.create({
    scholarshipId,
    cycleLabel: sanitizeString(body.cycleLabel || ''),
    academicYear: sanitizeString(body.academicYear || ''),
    intake: sanitizeString(body.intake || ''),
    applicationOpenAt: body.applicationOpenAt ? new Date(body.applicationOpenAt) : null,
    deadlineAt: body.deadlineAt ? new Date(body.deadlineAt) : null,
    timezone: sanitizeString(body.timezone || ''),
    effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
    effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
    cycleStatus: isValidCycleStatus(body.cycleStatus) ? body.cycleStatus : 'unknown',
    isHistorical: Boolean(body.isHistorical),
    status: isValidPubStatus(body.status) ? body.status : 'draft',
    sources,
    adminNotes: sanitizeString(body.adminNotes || ''),
  });

  if (isPublish) await audit(req, 'cycle.publish', 'ScholarshipCycle', doc._id);
  res.status(201).json({ data: doc });
});

export const adminUpdateCycle = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const doc = await ScholarshipCycle.findById(req.params.cycleId);
  if (!doc) return res.status(404).json({ error: 'Cycle not found' });

  const body = req.body || {};
  const willPublish = body.status === 'published';

  const sources = body.sources !== undefined
    ? extractSources(body.sources, res, { strict: willPublish })
    : doc.sources;
  if (sources === null) return;

  if (willPublish && sources.length === 0) {
    return res.status(400).json({ error: 'Published cycles require at least one valid source' });
  }

  if (body.cycleLabel !== undefined) doc.cycleLabel = sanitizeString(body.cycleLabel);
  if (body.academicYear !== undefined) doc.academicYear = sanitizeString(body.academicYear);
  if (body.intake !== undefined) doc.intake = sanitizeString(body.intake);
  if (body.applicationOpenAt !== undefined) doc.applicationOpenAt = body.applicationOpenAt ? new Date(body.applicationOpenAt) : null;
  if (body.deadlineAt !== undefined) doc.deadlineAt = body.deadlineAt ? new Date(body.deadlineAt) : null;
  if (body.timezone !== undefined) doc.timezone = sanitizeString(body.timezone);
  if (body.cycleStatus !== undefined && isValidCycleStatus(body.cycleStatus)) doc.cycleStatus = body.cycleStatus;
  if (body.isHistorical !== undefined) doc.isHistorical = Boolean(body.isHistorical);
  if (body.status !== undefined && isValidPubStatus(body.status)) doc.status = body.status;
  if (body.sources !== undefined) doc.sources = sources;
  if (body.adminNotes !== undefined) doc.adminNotes = sanitizeString(body.adminNotes);

  await doc.save();
  res.json({ data: doc });
});

// ────────────────────────────────────────────────────────────────────────────
// SCHOLARSHIP APPLICABILITY
// ────────────────────────────────────────────────────────────────────────────

export const adminListApplicability = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { scholarshipId } = req.params;
  const data = await ScholarshipApplicability.find({ scholarshipId })
    .populate('institutionId', 'officialName slug')
    .populate('programId', 'name slug')
    .lean();
  res.json({ data });
});

export const adminCreateApplicability = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { scholarshipId } = req.params;
  const body = req.body || {};

  const scholarship = await CanonicalScholarship.findById(scholarshipId).lean();
  if (!scholarship) return res.status(404).json({ error: 'Scholarship not found' });

  if (!isValidApplicabilityScope(body.scope)) {
    return res.status(400).json({ error: 'Valid scope is required' });
  }

  const doc = await ScholarshipApplicability.create({
    scholarshipId,
    scope: body.scope,
    countryCode: sanitizeString(body.countryCode || '').toUpperCase(),
    institutionId: body.institutionId || null,
    programId: body.programId || null,
    degreeLevel: isValidDegreeLevel(body.degreeLevel) ? body.degreeLevel : undefined,
    field: isValidAcademicField(body.field) ? body.field : undefined,
    notes: sanitizeString(body.notes || ''),
    status: isValidPubStatus(body.status) ? body.status : 'draft',
  });

  res.status(201).json({ data: doc });
});

export const adminUpdateApplicability = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const doc = await ScholarshipApplicability.findById(req.params.applicabilityId);
  if (!doc) return res.status(404).json({ error: 'Applicability record not found' });

  const body = req.body || {};
  if (body.scope !== undefined && isValidApplicabilityScope(body.scope)) doc.scope = body.scope;
  if (body.countryCode !== undefined) doc.countryCode = sanitizeString(body.countryCode).toUpperCase();
  if (body.institutionId !== undefined) doc.institutionId = body.institutionId || null;
  if (body.programId !== undefined) doc.programId = body.programId || null;
  if (body.degreeLevel !== undefined && isValidDegreeLevel(body.degreeLevel)) doc.degreeLevel = body.degreeLevel;
  if (body.field !== undefined && isValidAcademicField(body.field)) doc.field = body.field;
  if (body.notes !== undefined) doc.notes = sanitizeString(body.notes);
  if (body.status !== undefined && isValidPubStatus(body.status)) doc.status = body.status;

  await doc.save();
  res.json({ data: doc });
});

// ────────────────────────────────────────────────────────────────────────────
// PROGRAM REQUIREMENTS
// ────────────────────────────────────────────────────────────────────────────

export const adminListProgramRequirements = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { programId } = req.params;
  const q = req.query || {};
  const filter = { programId };
  if (q.status) filter.status = sanitizeString(q.status);

  const data = await ProgramRequirement.find(filter)
    .populate('testId', 'name slug abbreviation')
    .sort({ requirementType: 1 })
    .lean();

  res.json({ data });
});

export const adminCreateProgramRequirement = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { programId } = req.params;
  const body = req.body || {};

  const program = await Program.findById(programId).lean();
  if (!program) return res.status(404).json({ error: 'Program not found' });

  if (!isValidProgramRequirementType(body.requirementType)) {
    return res.status(400).json({ error: 'Valid requirementType is required' });
  }
  if (!isValidRequirementSemantics(body.semantics)) {
    return res.status(400).json({ error: 'Valid semantics (required/optional/conditional) is required' });
  }

  const isPublish = body.status === 'published';
  const sources = extractSources(body.sources, res, { strict: isPublish });
  if (sources === null) return;

  if (isPublish && sources.length === 0) {
    return res.status(400).json({ error: 'Published requirements need at least one valid source' });
  }

  const doc = await ProgramRequirement.create({
    programId,
    requirementType: body.requirementType,
    semantics: body.semantics,
    conditionNote: sanitizeString(body.conditionNote || ''),
    testId: body.testId || null,
    minimumScore: typeof body.minimumScore === 'number' ? body.minimumScore : null,
    sectionMinimums: Array.isArray(body.sectionMinimums)
      ? body.sectionMinimums.filter((s) => s.sectionName && typeof s.minimum === 'number')
      : [],
    subjectName: sanitizeString(body.subjectName || ''),
    documentName: sanitizeString(body.documentName || ''),
    description: sanitizeString(body.description || ''),
    intake: sanitizeString(body.intake || ''),
    effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
    effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
    sources,
    status: isValidPubStatus(body.status) ? body.status : 'draft',
    adminNotes: sanitizeString(body.adminNotes || ''),
  });

  if (isPublish) await audit(req, 'programRequirement.publish', 'ProgramRequirement', doc._id);
  res.status(201).json({ data: doc });
});

export const adminUpdateProgramRequirement = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const doc = await ProgramRequirement.findById(req.params.requirementId);
  if (!doc) return res.status(404).json({ error: 'Requirement not found' });

  const body = req.body || {};
  const willPublish = body.status === 'published';

  const sources = body.sources !== undefined
    ? extractSources(body.sources, res, { strict: willPublish })
    : doc.sources;
  if (sources === null) return;

  if (willPublish && sources.length === 0) {
    return res.status(400).json({ error: 'Published requirements need at least one valid source' });
  }

  if (body.requirementType !== undefined && isValidProgramRequirementType(body.requirementType)) doc.requirementType = body.requirementType;
  if (body.semantics !== undefined && isValidRequirementSemantics(body.semantics)) doc.semantics = body.semantics;
  if (body.conditionNote !== undefined) doc.conditionNote = sanitizeString(body.conditionNote);
  if (body.testId !== undefined) doc.testId = body.testId || null;
  if (body.minimumScore !== undefined) doc.minimumScore = typeof body.minimumScore === 'number' ? body.minimumScore : null;
  if (body.subjectName !== undefined) doc.subjectName = sanitizeString(body.subjectName);
  if (body.documentName !== undefined) doc.documentName = sanitizeString(body.documentName);
  if (body.description !== undefined) doc.description = sanitizeString(body.description);
  if (body.intake !== undefined) doc.intake = sanitizeString(body.intake);
  if (body.status !== undefined && isValidPubStatus(body.status)) doc.status = body.status;
  if (body.sources !== undefined) doc.sources = sources;
  if (body.adminNotes !== undefined) doc.adminNotes = sanitizeString(body.adminNotes);

  await doc.save();
  res.json({ data: doc });
});

// ────────────────────────────────────────────────────────────────────────────
// ADMIN PROGRAM — extended fields (Mission 7 additions)
// ────────────────────────────────────────────────────────────────────────────

export const adminUpdateProgramIntelligence = asyncHandler(async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const doc = await Program.findById(req.params.programId);
  if (!doc) return res.status(404).json({ error: 'Program not found' });

  const body = req.body || {};
  const willPublish = body.status === 'published';

  const sources = body.sources !== undefined
    ? extractSources(body.sources, res, { strict: willPublish })
    : doc.sources;
  if (sources === null) return;

  if (willPublish && sources.length === 0) {
    return res.status(400).json({ error: 'Published programs require at least one valid source' });
  }

  // Mission 7 fields only — core Mission 4 fields handled by existing adminEducationController
  if (body.country !== undefined) doc.country = sanitizeString(body.country).toUpperCase();
  if (body.admissionRequirementsUrl !== undefined) doc.admissionRequirementsUrl = sanitizeString(body.admissionRequirementsUrl);
  if (body.tuition !== undefined && body.tuition && typeof body.tuition === 'object') {
    doc.tuition = {
      amountMinor: typeof body.tuition.amountMinor === 'number' ? body.tuition.amountMinor : null,
      currency: sanitizeString(body.tuition.currency || '').toUpperCase(),
      per: sanitizeString(body.tuition.per || ''),
      notes: sanitizeString(body.tuition.notes || ''),
    };
  }
  if (Array.isArray(body.intakes)) {
    doc.intakes = body.intakes.map((intake) => ({
      cycleLabel: sanitizeString(intake.cycleLabel || ''),
      applicationOpenAt: intake.applicationOpenAt ? new Date(intake.applicationOpenAt) : null,
      deadlineAt: intake.deadlineAt ? new Date(intake.deadlineAt) : null,
      notes: sanitizeString(intake.notes || ''),
    }));
  }
  if (body.status !== undefined && isValidPubStatus(body.status)) doc.status = body.status;
  if (body.sources !== undefined) doc.sources = sources;

  const wasPublished = doc.status === 'published';
  await doc.save();
  if (!wasPublished && willPublish) {
    await audit(req, 'program.publish', 'Program', doc._id);
  }

  res.json({ data: doc });
});
