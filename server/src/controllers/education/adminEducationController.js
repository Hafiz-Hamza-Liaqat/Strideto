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

// ── Source/evidence helper ────────────────────────────────────────────────────

function parseSources(rawSources) {
  if (!Array.isArray(rawSources)) return [];
  const out = [];
  for (const s of rawSources.slice(0, 20)) {
    const result = validateSource(s);
    if (result.ok) out.push(result.value);
  }
  return out;
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
    sources: parseSources(body.sources),
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
  if (body.sources !== undefined) update.sources = parseSources(body.sources);
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
    status: isValidPubStatus(body.status) ? body.status : 'draft',
    displayOrder: body.displayOrder != null ? Number(body.displayOrder) : 0,
    sources: parseSources(body.sources),
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
  if (body.sources !== undefined) update.sources = parseSources(body.sources);

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
    sources: parseSources(body.sources),
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
  if (body.sources !== undefined) update.sources = parseSources(body.sources);

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
    sources: parseSources(body.sources),
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
  if (body.sources !== undefined) update.sources = parseSources(body.sources);
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
    sources: parseSources(body.sources),
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
  if (body.sources !== undefined) update.sources = parseSources(body.sources);
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
    sources: parseSources(body.sources),
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
  if (body.sources !== undefined) update.sources = parseSources(body.sources);
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
  if (q.country) filter.countryCode = sanitizeString(q.country).toUpperCase();
  if (q.institutionType) filter.institutionType = sanitizeString(q.institutionType);

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 20));

  const [data, total] = await Promise.all([
    CanonicalInstitution.find(filter).sort({ officialName: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    CanonicalInstitution.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit });
});

export const adminCreateInstitution = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const officialName = sanitizeString(body.officialName);
  if (!officialName) return res.status(400).json({ error: 'officialName is required' });
  if (!isValidInstitutionType(body.institutionType)) {
    return res.status(400).json({ error: 'institutionType is invalid' });
  }

  const slug = body.slug ? sanitizeString(body.slug) : educationSlug(officialName);
  const countryCode = normalizeCountryCode(body.countryCode) || '';

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
    sources: parseSources(body.sources),
    status: isValidPubStatus(body.status) ? body.status : 'draft',
  });

  res.status(201).json(doc);
});

export const adminUpdateInstitution = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const update = {};

  if (body.officialName !== undefined) update.officialName = sanitizeString(body.officialName);
  if (body.countryCode !== undefined) update.countryCode = normalizeCountryCode(body.countryCode) || '';
  if (body.city !== undefined) update.city = sanitizeString(body.city);
  if (body.region !== undefined) update.region = sanitizeString(body.region);
  if (body.officialWebsite !== undefined) update.officialWebsite = sanitizeString(body.officialWebsite);
  if (body.officialDomain !== undefined) update.officialDomain = sanitizeString(body.officialDomain).toLowerCase();
  if (body.institutionType !== undefined && isValidInstitutionType(body.institutionType)) update.institutionType = body.institutionType;
  if (body.isPublic !== undefined) update.isPublic = body.isPublic != null ? Boolean(body.isPublic) : null;
  if (body.sources !== undefined) update.sources = parseSources(body.sources);
  if (body.status !== undefined && isValidPubStatus(body.status)) update.status = body.status;

  const doc = await CanonicalInstitution.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) return res.status(404).json({ error: 'Institution not found' });
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

  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 20));

  const [data, total] = await Promise.all([
    Program.find(filter).populate('institutionId', 'officialName slug').sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Program.countDocuments(filter),
  ]);

  res.json({ data, total, page, limit });
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

  const instExists = await CanonicalInstitution.exists({ _id: body.institutionId });
  if (!instExists) return res.status(400).json({ error: 'Institution not found' });

  const slug = body.slug ? sanitizeString(body.slug) : educationSlug(`${body.name} ${body.institutionId}`);

  const doc = await Program.create({
    institutionId: body.institutionId,
    name: sanitizeString(body.name),
    slug,
    degreeLevel: body.degreeLevel || undefined,
    field: body.field || undefined,
    campus: sanitizeString(body.campus),
    studyMode: body.studyMode || undefined,
    durationMonths: body.durationMonths ? Number(body.durationMonths) : undefined,
    officialProgramUrl: sanitizeString(body.officialProgramUrl),
    status: isValidPubStatus(body.status) ? body.status : 'draft',
    sources: parseSources(body.sources),
  });

  res.status(201).json(doc);
});

export const adminUpdateProgram = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const update = {};

  if (body.name !== undefined) update.name = sanitizeString(body.name);
  if (body.degreeLevel !== undefined && isValidDegreeLevel(body.degreeLevel)) update.degreeLevel = body.degreeLevel;
  if (body.field !== undefined && isValidAcademicField(body.field)) update.field = body.field;
  if (body.campus !== undefined) update.campus = sanitizeString(body.campus);
  if (body.studyMode !== undefined && isValidStudyMode(body.studyMode)) update.studyMode = body.studyMode;
  if (body.durationMonths !== undefined) update.durationMonths = Number(body.durationMonths);
  if (body.officialProgramUrl !== undefined) update.officialProgramUrl = sanitizeString(body.officialProgramUrl);
  if (body.status !== undefined && isValidPubStatus(body.status)) update.status = body.status;
  if (body.sources !== undefined) update.sources = parseSources(body.sources);

  const doc = await Program.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!doc) return res.status(404).json({ error: 'Program not found' });
  res.json(doc);
});
