/**
 * Admin education catalog controller (Mission 4).
 *
 * All routes require Admin/SuperAdmin authorization (enforced by middleware).
 * Draft/published/archived lifecycle is managed here.
 * Source/evidence handling delegates to Mission 1 primitives.
 */
import { Test } from '../../models/education/Test.js';
import { TestProvider } from '../../models/education/TestProvider.js';
import { TestPrepGuide } from '../../models/education/TestPrepGuide.js';
import { ExternalTestResource } from '../../models/education/ExternalTestResource.js';
import { TestAlert } from '../../models/education/TestAlert.js';
import { CountryEducation } from '../../models/education/CountryEducation.js';
import { CanonicalInstitution } from '../../models/education/CanonicalInstitution.js';
import { Program } from '../../models/education/Program.js';
import { TestAcceptance } from '../../models/education/TestAcceptance.js';
import { InstitutionClaim } from '../../models/institution/InstitutionClaim.js';
import { OrganizationVerification } from '../../models/OrganizationVerification.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sanitizeString } from '../../utils/sanitize.js';
import { validateSource } from '../../../../shared/international/evidence.js';
import {
  isValidTestCategory,
  isValidDeliveryMode,
  isValidPubStatus,
  isValidAlertType,
  isValidAlertImportance,
  isValidResourceType,
  isValidTrustLevel,
  isValidDegreeLevel,
  isValidAcademicField,
  isValidStudyMode,
  isValidInstitutionType,
  isValidHttpUrl,
  educationSlug,
} from '../../../../shared/education/taxonomy.js';
import { normalizeCountryCode } from '../../../../shared/international/country.js';
import { assignLaunchEligibleOnAuthorityPublish } from '../../../../shared/publicDiscovery/fixtureExclusion.js';
import { currentAcceptanceMongoFilter } from '../../../../shared/publicDiscovery/publicTruth.js';
import { scheduleSeoChangeNotification } from '../../services/seo/seoChangeNotificationService.js';

const INSTITUTION_POPULATE = 'officialName slug countryCode city region status institutionType';

function normalizeTuition(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    amountMinor: typeof raw.amountMinor === 'number' ? raw.amountMinor : null,
    currency: sanitizeString(raw.currency || '').toUpperCase(),
    per: sanitizeString(raw.per || ''),
    notes: sanitizeString(raw.notes || ''),
  };
}

function normalizeIntakes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((intake) => ({
    cycleLabel: sanitizeString(intake?.cycleLabel || ''),
    applicationOpenAt: intake?.applicationOpenAt ? new Date(intake.applicationOpenAt) : null,
    deadlineAt: intake?.deadlineAt ? new Date(intake.deadlineAt) : null,
    notes: sanitizeString(intake?.notes || ''),
    applicationOpenDate: sanitizeString(intake?.applicationOpenDate || ''),
    deadlineDate: sanitizeString(intake?.deadlineDate || ''),
    startDate: sanitizeString(intake?.startDate || ''),
    applicationMode: sanitizeString(intake?.applicationMode || 'not_configured'),
    applicationUrl: sanitizeString(intake?.applicationUrl || ''),
    capacity: typeof intake?.capacity === 'number' ? intake.capacity : null,
    requirements: sanitizeString(intake?.requirements || ''),
    fee: {
      amountMinor: typeof intake?.fee?.amountMinor === 'number' ? intake.fee.amountMinor : null,
      currency: sanitizeString(intake?.fee?.currency || '').toUpperCase(),
    },
    status: sanitizeString(intake?.status || 'draft'),
    sourceUrl: sanitizeString(intake?.sourceUrl || ''),
  }));
}

async function attachAcceptanceSummaries(programs) {
  if (!programs.length) return programs;
  const ids = programs.map((p) => p._id);
  const counts = await TestAcceptance.aggregate([
    { $match: { programId: { $in: ids }, ...currentAcceptanceMongoFilter() } },
    { $group: { _id: '$programId', count: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((row) => [String(row._id), row.count]));
  return programs.map((p) => ({
    ...p,
    acceptedTestsCount: byId.get(String(p._id)) || 0,
    hasAcceptedTests: (byId.get(String(p._id)) || 0) > 0,
  }));
}

/**
 * Read-only trust overlays for catalog list/detail.
 * Catalog create/update must NEVER write InstitutionClaim or OrganizationVerification.
 */
async function attachInstitutionTrustSummaries(institutions) {
  if (!institutions.length) return institutions;
  const ids = institutions.map((i) => i._id);
  const orgIds = institutions.map((i) => i.organizationId).filter(Boolean);

  const [claims, verifications] = await Promise.all([
    InstitutionClaim.find({ canonicalInstitutionId: { $in: ids } })
      .select('canonicalInstitutionId state organizationId')
      .sort({ updatedAt: -1 })
      .lean(),
    orgIds.length
      ? OrganizationVerification.find({ organizationId: { $in: orgIds } })
        .select('organizationId status')
        .lean()
      : Promise.resolve([]),
  ]);

  const claimsByCanonical = new Map();
  for (const claim of claims) {
    const key = String(claim.canonicalInstitutionId);
    if (!claimsByCanonical.has(key)) claimsByCanonical.set(key, []);
    claimsByCanonical.get(key).push(claim);
  }
  const verificationByOrg = new Map(
    verifications.map((v) => [String(v.organizationId), v.status || null])
  );

  return institutions.map((inst) => {
    const relatedClaims = claimsByCanonical.get(String(inst._id)) || [];
    const approved = relatedClaims.find((c) => c.state === 'approved');
    const primary = approved || relatedClaims[0] || null;
    const orgId = inst.organizationId ? String(inst.organizationId) : null;
    return {
      ...inst,
      claimState: primary?.state || null,
      claimCount: relatedClaims.length,
      verificationStatus: orgId ? (verificationByOrg.get(orgId) || null) : null,
    };
  });
}

// ── Source/evidence helper ────────────────────────────────────────────────────

/**
 * Parse and validate source entries.
 *
 * strict=false (draft): drops invalid entries silently (legacy behaviour preserved).
 * strict=true (published/high-value): returns { ok: false, errors } on any
 * invalid entry so the controller can reject the request with a clear error.
 *
 * @param {any[]} rawSources
 * @param {object} [opts]
 * @param {boolean} [opts.strict]
 * @returns {{ ok: true, sources: object[] } | { ok: false, errors: string[] }}
 */
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
    // permissive mode: silently drop invalid entries (preserves draft legacy data)
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, sources: out };
}

/**
 * Extract sources array from a parseSources result, or respond with 400 on error.
 * Convenience wrapper for controller use.
 */
function _extractSources(rawSources, res, { strict = false } = {}) {
  const result = parseSources(rawSources, { strict });
  if (!result.ok) {
    res.status(400).json({ error: result.errors.join('; ') });
    return null;
  }
  return result.sources;
}

// ── Test Providers ────────────────────────────────────────────────────────────

export const adminListProviders = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = {};
  if (q.status) filter.status = sanitizeString(q.status);
  const data = await TestProvider.find(filter).sort({ name: 1 }).lean();
  res.json({ data });
});

export const adminCreateProvider = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const name = sanitizeString(body.name);
  if (!name) return res.status(400).json({ error: 'name is required' });

  const slug = body.slug ? sanitizeString(body.slug) : educationSlug(name);

  const doc = await TestProvider.create({
    name,
    slug,
    organizationType: sanitizeString(body.organizationType),
    officialWebsite: sanitizeString(body.officialWebsite),
    countryCode: normalizeCountryCode(body.countryCode) || '',
    region: sanitizeString(body.region),
    registrationUrl: sanitizeString(body.registrationUrl),
    helpUrl: sanitizeString(body.helpUrl),
    sources: parseSources(body.sources).sources,
    status: body.status === 'archived' ? 'archived' : 'active',
  });

  res.status(201).json(doc);
});

export const adminUpdateProvider = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const update = {};

  if (body.name !== undefined) update.name = sanitizeString(body.name);
  if (body.organizationType !== undefined) update.organizationType = sanitizeString(body.organizationType);
  if (body.officialWebsite !== undefined) update.officialWebsite = sanitizeString(body.officialWebsite);
  if (body.countryCode !== undefined) update.countryCode = normalizeCountryCode(body.countryCode) || '';
  if (body.region !== undefined) update.region = sanitizeString(body.region);
  if (body.registrationUrl !== undefined) update.registrationUrl = sanitizeString(body.registrationUrl);
  if (body.helpUrl !== undefined) update.helpUrl = sanitizeString(body.helpUrl);
  if (body.sources !== undefined) update.sources = parseSources(body.sources).sources;
  if (body.status !== undefined && ['active', 'archived'].includes(body.status)) {
    update.status = body.status;
  }

  const doc = await TestProvider.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) return res.status(404).json({ error: 'Provider not found' });
  res.json(doc);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

export const adminListTests = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = {};
  if (q.status) filter.status = sanitizeString(q.status);
  if (q.category) filter.category = sanitizeString(q.category);

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 20));

  const [data, total] = await Promise.all([
    Test.find(filter)
      .populate('providerId', 'name slug')
      .sort({ displayOrder: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Test.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit });
});

export const adminGetTest = asyncHandler(async (req, res) => {
  const doc = await Test.findById(req.params.id).populate('providerId', 'name slug').lean();
  if (!doc) return res.status(404).json({ error: 'Test not found' });
  res.json(doc);
});

export const adminCreateTest = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const name = sanitizeString(body.name);
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!isValidTestCategory(body.category)) {
    return res.status(400).json({ error: 'category is invalid' });
  }

  const slug = body.slug ? sanitizeString(body.slug) : educationSlug(name);
  const status = isValidPubStatus(body.status) ? body.status : 'draft';

  // Published tests are high-value factual records — validate sources strictly.
  const sourcesResult = parseSources(body.sources, { strict: status === 'published' });
  if (!sourcesResult.ok) {
    return res.status(400).json({ error: sourcesResult.errors.join('; ') });
  }

  const deliveryModes = Array.isArray(body.deliveryModes)
    ? body.deliveryModes.filter(isValidDeliveryMode)
    : [];

  const doc = await Test.create({
    stableId: body.stableId ? sanitizeString(body.stableId) : undefined,
    slug,
    name,
    shortName: sanitizeString(body.shortName),
    category: body.category,
    providerId: body.providerId || undefined,
    description: sanitizeString(body.description),
    overview: sanitizeString(body.overview),
    purposes: Array.isArray(body.purposes) ? body.purposes.map(sanitizeString).filter(Boolean) : [],
    countryCodes: Array.isArray(body.countryCodes)
      ? body.countryCodes.map((c) => normalizeCountryCode(c)).filter(Boolean)
      : [],
    deliveryModes,
    sections: Array.isArray(body.sections) ? body.sections.slice(0, 20) : [],
    totalDurationMinutes: body.totalDurationMinutes ? Number(body.totalDurationMinutes) : undefined,
    scoreScale: sanitizeString(body.scoreScale),
    validityMonths: body.validityMonths != null ? Number(body.validityMonths) : null,
    registrationUrl: sanitizeString(body.registrationUrl),
    officialWebsite: sanitizeString(body.officialWebsite),
    status,
    displayOrder: body.displayOrder != null ? Number(body.displayOrder) : 0,
    sources: sourcesResult.sources,
  });

  res.status(201).json(doc);
});

export const adminUpdateTest = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const update = {};

  if (body.name !== undefined) update.name = sanitizeString(body.name);
  if (body.shortName !== undefined) update.shortName = sanitizeString(body.shortName);
  if (body.category !== undefined && isValidTestCategory(body.category)) update.category = body.category;
  if (body.providerId !== undefined) update.providerId = body.providerId || null;
  if (body.description !== undefined) update.description = sanitizeString(body.description);
  if (body.overview !== undefined) update.overview = sanitizeString(body.overview);
  if (body.purposes !== undefined) update.purposes = Array.isArray(body.purposes) ? body.purposes.map(sanitizeString).filter(Boolean) : [];
  if (body.countryCodes !== undefined) {
    update.countryCodes = Array.isArray(body.countryCodes)
      ? body.countryCodes.map((c) => normalizeCountryCode(c)).filter(Boolean)
      : [];
  }
  if (body.deliveryModes !== undefined) {
    update.deliveryModes = Array.isArray(body.deliveryModes) ? body.deliveryModes.filter(isValidDeliveryMode) : [];
  }
  if (body.sections !== undefined) update.sections = Array.isArray(body.sections) ? body.sections.slice(0, 20) : [];
  if (body.totalDurationMinutes !== undefined) update.totalDurationMinutes = Number(body.totalDurationMinutes);
  if (body.scoreScale !== undefined) update.scoreScale = sanitizeString(body.scoreScale);
  if (body.validityMonths !== undefined) update.validityMonths = body.validityMonths != null ? Number(body.validityMonths) : null;
  if (body.registrationUrl !== undefined) update.registrationUrl = sanitizeString(body.registrationUrl);
  if (body.officialWebsite !== undefined) update.officialWebsite = sanitizeString(body.officialWebsite);
  if (body.status !== undefined && isValidPubStatus(body.status)) update.status = body.status;
  if (body.displayOrder !== undefined) update.displayOrder = Number(body.displayOrder);
  if (body.sources !== undefined) update.sources = parseSources(body.sources).sources;

  const doc = await Test.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) return res.status(404).json({ error: 'Test not found' });
  res.json(doc);
});

// ── Prep Guides ───────────────────────────────────────────────────────────────

export const adminListPrepGuides = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = {};
  if (q.testId) filter.testId = sanitizeString(q.testId);
  if (q.status) filter.status = sanitizeString(q.status);
  const data = await TestPrepGuide.find(filter).populate('testId', 'name slug').sort({ updatedAt: -1 }).lean();
  res.json({ data });
});

export const adminCreatePrepGuide = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.testId) return res.status(400).json({ error: 'testId is required' });

  const testExists = await Test.exists({ _id: body.testId });
  if (!testExists) return res.status(400).json({ error: 'Test not found' });

  const doc = await TestPrepGuide.create({
    testId: body.testId,
    title: sanitizeString(body.title),
    overview: sanitizeString(body.overview),
    prepSequence: Array.isArray(body.prepSequence) ? body.prepSequence.slice(0, 20) : [],
    recommendedDurationMinWeeks: body.recommendedDurationMinWeeks ? Number(body.recommendedDurationMinWeeks) : undefined,
    recommendedDurationMaxWeeks: body.recommendedDurationMaxWeeks ? Number(body.recommendedDurationMaxWeeks) : undefined,
    sectionPrep: Array.isArray(body.sectionPrep) ? body.sectionPrep.slice(0, 20) : [],
    testDayGuidance: sanitizeString(body.testDayGuidance),
    registrationGuidance: sanitizeString(body.registrationGuidance),
    copyrightPolicyAcknowledged: body.copyrightPolicyAcknowledged === true,
    status: isValidPubStatus(body.status) ? body.status : 'draft',
    version: body.version ? Number(body.version) : 1,
    sources: parseSources(body.sources).sources,
  });

  res.status(201).json(doc);
});

export const adminUpdatePrepGuide = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const update = {};

  if (body.title !== undefined) update.title = sanitizeString(body.title);
  if (body.overview !== undefined) update.overview = sanitizeString(body.overview);
  if (body.prepSequence !== undefined) update.prepSequence = Array.isArray(body.prepSequence) ? body.prepSequence.slice(0, 20) : [];
  if (body.recommendedDurationMinWeeks !== undefined) update.recommendedDurationMinWeeks = Number(body.recommendedDurationMinWeeks);
  if (body.recommendedDurationMaxWeeks !== undefined) update.recommendedDurationMaxWeeks = Number(body.recommendedDurationMaxWeeks);
  if (body.sectionPrep !== undefined) update.sectionPrep = Array.isArray(body.sectionPrep) ? body.sectionPrep.slice(0, 20) : [];
  if (body.testDayGuidance !== undefined) update.testDayGuidance = sanitizeString(body.testDayGuidance);
  if (body.registrationGuidance !== undefined) update.registrationGuidance = sanitizeString(body.registrationGuidance);
  if (body.copyrightPolicyAcknowledged !== undefined) update.copyrightPolicyAcknowledged = body.copyrightPolicyAcknowledged === true;
  if (body.status !== undefined && isValidPubStatus(body.status)) update.status = body.status;
  if (body.version !== undefined) update.version = Number(body.version);
  if (body.sources !== undefined) update.sources = parseSources(body.sources).sources;

  const doc = await TestPrepGuide.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) return res.status(404).json({ error: 'Prep guide not found' });
  res.json(doc);
});

// ── External Resources ────────────────────────────────────────────────────────

export const adminListResources = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = {};
  if (q.testId) filter.testId = sanitizeString(q.testId);
  if (q.status) filter.status = sanitizeString(q.status);
  const data = await ExternalTestResource.find(filter).populate('testId', 'name slug').sort({ updatedAt: -1 }).lean();
  res.json({ data });
});

export const adminCreateResource = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.testId) return res.status(400).json({ error: 'testId is required' });
  if (!sanitizeString(body.url) || !isValidHttpUrl(body.url)) {
    return res.status(400).json({ error: 'url must be a valid http(s) URL' });
  }
  if (!isValidResourceType(body.resourceType)) {
    return res.status(400).json({ error: 'resourceType is invalid' });
  }
  if (!isValidTrustLevel(body.trustLevel)) {
    return res.status(400).json({ error: 'trustLevel is invalid' });
  }

  const testExists = await Test.exists({ _id: body.testId });
  if (!testExists) return res.status(400).json({ error: 'Test not found' });

  const doc = await ExternalTestResource.create({
    testId: body.testId,
    provider: sanitizeString(body.provider),
    title: sanitizeString(body.title),
    url: sanitizeString(body.url),
    resourceType: body.resourceType,
    trustLevel: body.trustLevel,
    isFree: body.isFree === true,
    isPaid: body.isPaid === true,
    platformType: sanitizeString(body.platformType),
    description: sanitizeString(body.description),
    sources: parseSources(body.sources).sources,
    status: isValidPubStatus(body.status) ? body.status : 'draft',
  });

  res.status(201).json(doc);
});

export const adminUpdateResource = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const update = {};

  if (body.provider !== undefined) update.provider = sanitizeString(body.provider);
  if (body.title !== undefined) update.title = sanitizeString(body.title);
  if (body.url !== undefined) {
    if (!isValidHttpUrl(body.url)) return res.status(400).json({ error: 'url must be a valid http(s) URL' });
    update.url = sanitizeString(body.url);
  }
  if (body.resourceType !== undefined && isValidResourceType(body.resourceType)) update.resourceType = body.resourceType;
  if (body.trustLevel !== undefined && isValidTrustLevel(body.trustLevel)) update.trustLevel = body.trustLevel;
  if (body.isFree !== undefined) update.isFree = body.isFree === true;
  if (body.isPaid !== undefined) update.isPaid = body.isPaid === true;
  if (body.platformType !== undefined) update.platformType = sanitizeString(body.platformType);
  if (body.description !== undefined) update.description = sanitizeString(body.description);
  if (body.sources !== undefined) update.sources = parseSources(body.sources).sources;
  if (body.status !== undefined && isValidPubStatus(body.status)) update.status = body.status;

  const doc = await ExternalTestResource.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) return res.status(404).json({ error: 'Resource not found' });
  res.json(doc);
});

// ── Test Alerts ───────────────────────────────────────────────────────────────

export const adminListAlerts = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = {};
  if (q.testId) filter.testId = sanitizeString(q.testId);
  if (q.publicationStatus) filter.publicationStatus = sanitizeString(q.publicationStatus);
  const data = await TestAlert.find(filter).populate('testId', 'name slug').sort({ effectiveDate: -1 }).lean();
  res.json({ data });
});

export const adminCreateAlert = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.testId) return res.status(400).json({ error: 'testId is required' });
  if (!sanitizeString(body.title)) return res.status(400).json({ error: 'title is required' });
  if (!isValidAlertType(body.alertType)) return res.status(400).json({ error: 'alertType is invalid' });

  const testExists = await Test.exists({ _id: body.testId });
  if (!testExists) return res.status(400).json({ error: 'Test not found' });

  const parseDate = (v) => (v ? new Date(v) : undefined);
  const effectiveDate = parseDate(body.effectiveDate);
  if (body.effectiveDate && effectiveDate && isNaN(effectiveDate.getTime())) {
    return res.status(400).json({ error: 'effectiveDate is invalid' });
  }

  const doc = await TestAlert.create({
    testId: body.testId,
    title: sanitizeString(body.title),
    alertType: body.alertType,
    effectiveDate: effectiveDate,
    startDate: parseDate(body.startDate),
    endDate: parseDate(body.endDate),
    countryCodes: Array.isArray(body.countryCodes)
      ? body.countryCodes.map((c) => normalizeCountryCode(c)).filter(Boolean)
      : [],
    officialSourceUrl: sanitizeString(body.officialSourceUrl),
    sources: parseSources(body.sources).sources,
    publicationStatus: isValidPubStatus(body.publicationStatus) ? body.publicationStatus : 'draft',
    importance: isValidAlertImportance(body.importance) ? body.importance : 'medium',
  });

  res.status(201).json(doc);
});

export const adminUpdateAlert = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const update = {};

  if (body.title !== undefined) update.title = sanitizeString(body.title);
  if (body.alertType !== undefined && isValidAlertType(body.alertType)) update.alertType = body.alertType;
  if (body.effectiveDate !== undefined) update.effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : null;
  if (body.startDate !== undefined) update.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.endDate !== undefined) update.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.countryCodes !== undefined) {
    update.countryCodes = Array.isArray(body.countryCodes)
      ? body.countryCodes.map((c) => normalizeCountryCode(c)).filter(Boolean)
      : [];
  }
  if (body.officialSourceUrl !== undefined) update.officialSourceUrl = sanitizeString(body.officialSourceUrl);
  if (body.sources !== undefined) update.sources = parseSources(body.sources).sources;
  if (body.publicationStatus !== undefined && isValidPubStatus(body.publicationStatus)) update.publicationStatus = body.publicationStatus;
  if (body.importance !== undefined && isValidAlertImportance(body.importance)) update.importance = body.importance;

  const doc = await TestAlert.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) return res.status(404).json({ error: 'Alert not found' });
  res.json(doc);
});

// ── Country Education ─────────────────────────────────────────────────────────

export const adminListCountryEducation = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = {};
  if (q.status) filter.status = sanitizeString(q.status);
  const data = await CountryEducation.find(filter).sort({ countryCode: 1 }).lean();
  res.json({ data });
});

export const adminCreateCountryEducation = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const countryCode = normalizeCountryCode(body.countryCode);
  if (!countryCode) return res.status(400).json({ error: 'countryCode must be a valid ISO 3166-1 alpha-2 code' });

  const slug = body.slug ? sanitizeString(body.slug) : educationSlug(countryCode);

  const doc = await CountryEducation.create({
    countryCode,
    slug,
    educationOverview: sanitizeString(body.educationOverview),
    commonIntakes: Array.isArray(body.commonIntakes) ? body.commonIntakes.map(sanitizeString).filter(Boolean) : [],
    educationAuthorityName: sanitizeString(body.educationAuthorityName),
    educationAuthorityUrl: sanitizeString(body.educationAuthorityUrl),
    generalApplicationResourceUrl: sanitizeString(body.generalApplicationResourceUrl),
    immigrationAuthorityName: sanitizeString(body.immigrationAuthorityName),
    immigrationAuthorityUrl: sanitizeString(body.immigrationAuthorityUrl),
    informationalNotes: sanitizeString(body.informationalNotes),
    sources: parseSources(body.sources).sources,
    status: isValidPubStatus(body.status) ? body.status : 'draft',
  });

  res.status(201).json(doc);
});

export const adminUpdateCountryEducation = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const update = {};

  if (body.educationOverview !== undefined) update.educationOverview = sanitizeString(body.educationOverview);
  if (body.commonIntakes !== undefined) update.commonIntakes = Array.isArray(body.commonIntakes) ? body.commonIntakes.map(sanitizeString).filter(Boolean) : [];
  if (body.educationAuthorityName !== undefined) update.educationAuthorityName = sanitizeString(body.educationAuthorityName);
  if (body.educationAuthorityUrl !== undefined) update.educationAuthorityUrl = sanitizeString(body.educationAuthorityUrl);
  if (body.generalApplicationResourceUrl !== undefined) update.generalApplicationResourceUrl = sanitizeString(body.generalApplicationResourceUrl);
  if (body.immigrationAuthorityName !== undefined) update.immigrationAuthorityName = sanitizeString(body.immigrationAuthorityName);
  if (body.immigrationAuthorityUrl !== undefined) update.immigrationAuthorityUrl = sanitizeString(body.immigrationAuthorityUrl);
  if (body.informationalNotes !== undefined) update.informationalNotes = sanitizeString(body.informationalNotes);
  if (body.sources !== undefined) update.sources = parseSources(body.sources).sources;
  if (body.status !== undefined && isValidPubStatus(body.status)) update.status = body.status;

  const doc = await CountryEducation.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) return res.status(404).json({ error: 'Country education record not found' });
  res.json(doc);
});

// ── Canonical Institutions ────────────────────────────────────────────────────

export const adminListInstitutions = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = {};
  if (q.status) filter.status = sanitizeString(q.status);
  if (q.country || q.countryCode) {
    filter.countryCode = sanitizeString(q.country || q.countryCode).toUpperCase();
  }
  if (q.institutionType) filter.institutionType = sanitizeString(q.institutionType);

  const region = sanitizeString(q.region || q.state || q.province);
  const city = sanitizeString(q.city);
  if (region) {
    filter.region = new RegExp(region.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  if (city) {
    filter.city = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  if (q.search) {
    const term = sanitizeString(q.search).slice(0, 80);
    if (term) {
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { officialName: re },
        { slug: re },
        { officialDomain: re },
        { city: re },
        { region: re },
      ];
    }
  }

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 20));
  const sortKey = sanitizeString(q.sort) || 'officialName';
  const sortOrder = String(q.order || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  const allowedSort = new Set(['officialName', 'updatedAt', 'createdAt', 'status', 'countryCode', 'city', 'region', 'institutionType']);
  const sort = { [allowedSort.has(sortKey) ? sortKey : 'officialName']: sortOrder };

  const [raw, total] = await Promise.all([
    CanonicalInstitution.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    CanonicalInstitution.countDocuments(filter),
  ]);

  const data = await attachInstitutionTrustSummaries(raw);
  res.json({
    data,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 0,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 0 },
  });
});

export const adminGetInstitution = asyncHandler(async (req, res) => {
  const doc = await CanonicalInstitution.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ error: 'Institution not found' });
  const [enriched] = await attachInstitutionTrustSummaries([doc]);
  res.json({ data: enriched });
});

export const adminCreateInstitution = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const officialName = sanitizeString(body.officialName);
  if (!officialName) return res.status(400).json({ error: 'officialName is required' });
  if (!isValidInstitutionType(body.institutionType)) {
    return res.status(400).json({ error: 'institutionType is invalid' });
  }

  const countryCode = normalizeCountryCode(body.countryCode);
  if (!countryCode) {
    return res.status(400).json({ error: 'countryCode must be a valid ISO 3166-1 alpha-2 code' });
  }

  const status = isValidPubStatus(body.status) ? body.status : 'draft';
  const willPublish = status === 'published';
  const sourcesResult = parseSources(body.sources, { strict: willPublish });
  if (!sourcesResult.ok) return res.status(400).json({ error: sourcesResult.errors.join('; ') });
  if (willPublish && sourcesResult.sources.length === 0) {
    return res.status(400).json({ error: 'Published institutions require at least one valid source' });
  }

  const slug = body.slug ? sanitizeString(body.slug) : educationSlug(officialName);

  // Catalog-only create — does NOT approve InstitutionClaim or OrganizationVerification.
  const doc = await CanonicalInstitution.create({
    officialName,
    slug,
    countryCode,
    city: sanitizeString(body.city),
    region: sanitizeString(body.region),
    officialWebsite: sanitizeString(body.officialWebsite),
    officialDomain: sanitizeString(body.officialDomain).toLowerCase(),
    institutionType: body.institutionType,
    isPublic: body.isPublic != null ? Boolean(body.isPublic) : null,
    organizationId: body.organizationId || undefined,
    sources: sourcesResult.sources,
    status,
    launchEligible: willPublish
      ? assignLaunchEligibleOnAuthorityPublish({ isFixture: false })
      : undefined,
  });

  scheduleSeoChangeNotification({
    entityType: 'canonical-institution',
    next: doc,
    action: 'save',
  });

  res.status(201).json(doc);
});

export const adminUpdateInstitution = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const existing = await CanonicalInstitution.findById(req.params.id).lean();
  if (!existing) return res.status(404).json({ error: 'Institution not found' });
  const update = {};

  if (body.officialName !== undefined) update.officialName = sanitizeString(body.officialName);
  if (body.countryCode !== undefined) {
    const code = normalizeCountryCode(body.countryCode);
    if (!code) return res.status(400).json({ error: 'countryCode must be a valid ISO 3166-1 alpha-2 code' });
    update.countryCode = code;
  }
  if (body.city !== undefined) update.city = sanitizeString(body.city);
  if (body.region !== undefined) update.region = sanitizeString(body.region);
  if (body.officialWebsite !== undefined) update.officialWebsite = sanitizeString(body.officialWebsite);
  if (body.officialDomain !== undefined) update.officialDomain = sanitizeString(body.officialDomain).toLowerCase();
  if (body.institutionType !== undefined && isValidInstitutionType(body.institutionType)) update.institutionType = body.institutionType;
  if (body.isPublic !== undefined) update.isPublic = body.isPublic != null ? Boolean(body.isPublic) : null;

  const willPublish = body.status === 'published';
  if (body.sources !== undefined) {
    const sourcesResult = parseSources(body.sources, { strict: willPublish });
    if (!sourcesResult.ok) return res.status(400).json({ error: sourcesResult.errors.join('; ') });
    update.sources = sourcesResult.sources;
  }
  if (body.status !== undefined && isValidPubStatus(body.status)) {
    if (willPublish) {
      const nextSources = update.sources !== undefined ? update.sources : (existing.sources || []);
      if (!nextSources.length) {
        return res.status(400).json({ error: 'Published institutions require at least one valid source' });
      }
      update.launchEligible = assignLaunchEligibleOnAuthorityPublish(existing);
    }
    if (body.status === 'archived' || body.status === 'discontinued') {
      update.launchEligible = false;
    }
    update.status = body.status;
  }

  // Catalog-only update — does NOT approve InstitutionClaim or OrganizationVerification.
  const doc = await CanonicalInstitution.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) return res.status(404).json({ error: 'Institution not found' });
  scheduleSeoChangeNotification({
    entityType: 'canonical-institution',
    previous: existing,
    next: doc,
    action: 'save',
  });
  res.json(doc);
});

// ── Programs ──────────────────────────────────────────────────────────────────

export const adminListPrograms = asyncHandler(async (req, res) => {
  const q = req.query || {};
  const filter = {};
  if (q.institutionId) filter.institutionId = sanitizeString(q.institutionId);
  if (q.status) filter.status = sanitizeString(q.status);
  if (q.degreeLevel) filter.degreeLevel = sanitizeString(q.degreeLevel);
  if (q.field) filter.field = sanitizeString(q.field);
  if (q.studyMode) filter.studyMode = sanitizeString(q.studyMode);
  if (q.country) filter.country = sanitizeString(q.country).toUpperCase();

  const region = sanitizeString(q.region || q.state || q.province);
  const city = sanitizeString(q.city);
  if (region || city) {
    const instFilter = {};
    if (region) instFilter.region = new RegExp(region.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (city) instFilter.city = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const institutions = await CanonicalInstitution.find(instFilter).select('_id').lean();
    const ids = institutions.map((i) => String(i._id));
    if (filter.institutionId) {
      const wanted = String(filter.institutionId);
      filter.institutionId = ids.includes(wanted) ? wanted : { $in: [] };
    } else {
      filter.institutionId = { $in: institutions.map((i) => i._id) };
    }
  }

  if (q.search) {
    const term = sanitizeString(q.search).slice(0, 80);
    if (term) {
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { slug: re }, { campus: re }];
    }
  }

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 20));
  const sortKey = sanitizeString(q.sort) || 'updatedAt';
  const sortOrder = String(q.order || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  const allowedSort = new Set(['name', 'updatedAt', 'createdAt', 'status', 'country', 'degreeLevel', 'field']);
  const sort = { [allowedSort.has(sortKey) ? sortKey : 'updatedAt']: sortOrder };

  const [raw, total] = await Promise.all([
    Program.find(filter)
      .populate('institutionId', INSTITUTION_POPULATE)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Program.countDocuments(filter),
  ]);

  const data = await attachAcceptanceSummaries(raw);
  res.json({
    data,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 0,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 0 },
  });
});

export const adminGetProgram = asyncHandler(async (req, res) => {
  const doc = await Program.findById(req.params.id)
    .populate('institutionId', INSTITUTION_POPULATE)
    .lean();
  if (!doc) return res.status(404).json({ error: 'Program not found' });
  const [enriched] = await attachAcceptanceSummaries([doc]);
  res.json({ data: enriched });
});

export const adminCreateProgram = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.institutionId) return res.status(400).json({ error: 'institutionId is required' });
  if (!sanitizeString(body.name)) return res.status(400).json({ error: 'name is required' });
  if (body.degreeLevel && !isValidDegreeLevel(body.degreeLevel)) {
    return res.status(400).json({ error: 'degreeLevel is invalid' });
  }
  if (body.field && !isValidAcademicField(body.field)) {
    return res.status(400).json({ error: 'field is invalid' });
  }
  if (body.studyMode && !isValidStudyMode(body.studyMode)) {
    return res.status(400).json({ error: 'studyMode is invalid' });
  }

  const institution = await CanonicalInstitution.findById(body.institutionId).lean();
  if (!institution) return res.status(400).json({ error: 'Institution not found' });

  const status = isValidPubStatus(body.status) ? body.status : 'draft';
  const willPublish = status === 'published';
  const sourcesResult = parseSources(body.sources, { strict: willPublish });
  if (!sourcesResult.ok) return res.status(400).json({ error: sourcesResult.errors.join('; ') });
  if (willPublish && sourcesResult.sources.length === 0) {
    return res.status(400).json({ error: 'Published programs require at least one valid source' });
  }

  const country = normalizeCountryCode(body.country)
    || normalizeCountryCode(institution.countryCode)
    || '';
  const slug = body.slug ? sanitizeString(body.slug) : educationSlug(`${body.name} ${body.institutionId}`);

  const doc = await Program.create({
    institutionId: body.institutionId,
    name: sanitizeString(body.name),
    slug,
    degreeLevel: body.degreeLevel || undefined,
    field: body.field || undefined,
    campus: sanitizeString(body.campus),
    instructionLanguage: sanitizeString(body.instructionLanguage),
    studyMode: body.studyMode || undefined,
    durationMonths: body.durationMonths != null && body.durationMonths !== ''
      ? Number(body.durationMonths)
      : undefined,
    officialProgramUrl: sanitizeString(body.officialProgramUrl),
    country,
    admissionRequirementsUrl: sanitizeString(body.admissionRequirementsUrl),
    tuition: body.tuition !== undefined ? normalizeTuition(body.tuition) : null,
    intakes: Array.isArray(body.intakes) ? normalizeIntakes(body.intakes) : [],
    status,
    launchEligible: willPublish
      ? assignLaunchEligibleOnAuthorityPublish({ isFixture: false })
      : undefined,
    sources: sourcesResult.sources,
  });

  scheduleSeoChangeNotification({
    entityType: 'program',
    next: doc,
    action: 'save',
  });

  res.status(201).json(doc);
});

export const adminUpdateProgram = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const existing = await Program.findById(req.params.id).lean();
  if (!existing) return res.status(404).json({ error: 'Program not found' });
  const update = {};

  if (body.name !== undefined) update.name = sanitizeString(body.name);
  if (body.degreeLevel !== undefined && isValidDegreeLevel(body.degreeLevel)) update.degreeLevel = body.degreeLevel;
  if (body.field !== undefined && isValidAcademicField(body.field)) update.field = body.field;
  if (body.campus !== undefined) update.campus = sanitizeString(body.campus);
  if (body.instructionLanguage !== undefined) update.instructionLanguage = sanitizeString(body.instructionLanguage);
  if (body.studyMode !== undefined && isValidStudyMode(body.studyMode)) update.studyMode = body.studyMode;
  if (body.durationMonths !== undefined) {
    update.durationMonths = body.durationMonths === '' || body.durationMonths == null
      ? undefined
      : Number(body.durationMonths);
  }
  if (body.officialProgramUrl !== undefined) update.officialProgramUrl = sanitizeString(body.officialProgramUrl);
  if (body.country !== undefined) {
    update.country = normalizeCountryCode(body.country) || sanitizeString(body.country).toUpperCase();
  }
  if (body.admissionRequirementsUrl !== undefined) {
    update.admissionRequirementsUrl = sanitizeString(body.admissionRequirementsUrl);
  }
  if (body.tuition !== undefined) update.tuition = normalizeTuition(body.tuition);
  if (Array.isArray(body.intakes)) update.intakes = normalizeIntakes(body.intakes);

  const willPublish = body.status === 'published';
  if (body.sources !== undefined) {
    const sourcesResult = parseSources(body.sources, { strict: willPublish });
    if (!sourcesResult.ok) return res.status(400).json({ error: sourcesResult.errors.join('; ') });
    update.sources = sourcesResult.sources;
  }
  if (body.status !== undefined && isValidPubStatus(body.status)) {
    if (willPublish) {
      const nextSources = update.sources !== undefined ? update.sources : (existing.sources || []);
      if (!nextSources.length) {
        return res.status(400).json({ error: 'Published programs require at least one valid source' });
      }
      update.launchEligible = assignLaunchEligibleOnAuthorityPublish(existing);
    }
    if (body.status === 'archived' || body.status === 'discontinued') {
      update.launchEligible = false;
    }
    update.status = body.status;
  }

  const doc = await Program.findByIdAndUpdate(req.params.id, update, { new: true })
    .populate('institutionId', INSTITUTION_POPULATE);
  if (!doc) return res.status(404).json({ error: 'Program not found' });
  scheduleSeoChangeNotification({
    entityType: 'program',
    previous: existing,
    next: doc,
    action: 'save',
  });
  res.json(doc);
});
