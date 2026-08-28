import { Internship } from '../models/Internship.js';
import { InternshipApplication } from '../models/InternshipApplication.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listResponse, paginate } from '../utils/apiResponse.js';
import { sanitizeString } from '../utils/sanitize.js';
import { awardBadge } from './badgesController.js';
import { ApplicationMigrationService } from '../services/career/migration/ApplicationMigrationService.js';
import { projectPublicInternship } from '../../../shared/publicDiscovery/projectPublicDiscovery.js';
import { withFixtureExclusion } from '../../../shared/publicDiscovery/fixtureExclusion.js';
import { normalizeCountryCode } from '../../../shared/international/country.js';
import { rankRelatedInternships } from '../../../shared/seo/relatedRanking.js';
import { clusterResourceLinks } from '../../../shared/seo/contentClusters.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function buildQuery(q) {
  const filter = withFixtureExclusion({ status: 'active' });
  const extraAnd = [];
  const countryCode = normalizeCountryCode(q.countryCode);
  if (countryCode) extraAnd.push({ countryCode });
  if (q.region || q.province) {
    const re = new RegExp(sanitizeString(q.region || q.province), 'i');
    extraAnd.push({ $or: [{ region: re }, { province: re }] });
  }
  if (q.city) extraAnd.push({ city: new RegExp(sanitizeString(q.city), 'i') });
  if (q.location) {
    const loc = new RegExp(sanitizeString(q.location), 'i');
    extraAnd.push({ $or: [{ location: loc }, { province: loc }, { region: loc }, { city: loc }] });
  }
  if (q.duration) filter.duration = new RegExp(sanitizeString(q.duration), 'i');
  if (q.organization) filter.organization = new RegExp(sanitizeString(q.organization), 'i');
  if (q.field) extraAnd.push({ $or: [{ field: new RegExp(sanitizeString(q.field), 'i') }, { skillset: new RegExp(sanitizeString(q.field), 'i') }] });
  if (q.specialization) filter.specialization = new RegExp(sanitizeString(q.specialization), 'i');
  if (q.workMode && ['remote', 'hybrid', 'on_site'].includes(q.workMode)) filter.workMode = q.workMode;
  if (q.applyMethod && ['internal', 'external'].includes(q.applyMethod)) {
    if (q.applyMethod === 'internal') extraAnd.push({ $or: [{ applyMethod: 'internal' }, { applyInPlatform: true }] });
    else extraAnd.push({ $or: [{ applyMethod: 'external' }, { applyInPlatform: { $ne: true } }] });
  }
  if (q.isPaid === 'unknown' || q.compensation === 'unknown') extraAnd.push({ compensationUnknown: true });
  else if (q.isPaid !== undefined && q.isPaid !== '') {
    filter.isPaid = q.isPaid === 'true' || q.isPaid === true;
  }
  if (q.skillset && (Array.isArray(q.skillset) ? q.skillset.length : q.skillset)) {
    const skills = Array.isArray(q.skillset) ? q.skillset.map((s) => sanitizeString(s)).filter(Boolean) : [sanitizeString(q.skillset)].filter(Boolean);
    if (skills.length) filter.skillset = { $in: skills.map((s) => new RegExp(s, 'i')) };
  }
  if (q.search && sanitizeString(q.search)) {
    const re = new RegExp(sanitizeString(q.search), 'i');
    extraAnd.push({ $or: [{ title: re }, { organization: re }, { description: re }] });
  }
  if (extraAnd.length) filter.$and = [...(filter.$and || []), ...extraAnd];
  return filter;
}

export const listInternships = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const query = buildQuery(req.query);
  const [data, total] = await Promise.all([
    Internship.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Internship.countDocuments(query),
  ]);
  const pagination = paginate(page, limit, total);
  res.json(listResponse(data.map(projectPublicInternship), pagination, req.query));
});

export const getInternshipByIdOrSlug = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const isId = mongoose.Types.ObjectId.isValid(idOrSlug) && String(new mongoose.Types.ObjectId(idOrSlug)) === idOrSlug;
  const doc = await Internship.findOne(isId ? { _id: idOrSlug, status: 'active' } : { slug: idOrSlug, status: 'active' }).lean();
  if (!doc) return res.status(404).json({ error: 'Internship not found' });
  const relatedCandidates = await Internship.find({
    status: 'active',
    _id: { $ne: doc._id },
  })
    .sort({ createdAt: -1 })
    .limit(24)
    .lean();
  const related = rankRelatedInternships(doc, relatedCandidates, { limit: 4 }).map(projectPublicInternship);
  const slugPath = doc.slug || doc._id;
  const relatedResources = clusterResourceLinks('career', {
    maxItems: 4,
    currentPath: `/internships/${slugPath}`,
  });
  res.json({
    ...projectPublicInternship(doc),
    related,
    relatedResources,
  });
});

export const applyToInternship = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { idOrSlug } = req.params;
  const isId = mongoose.Types.ObjectId.isValid(idOrSlug) && String(new mongoose.Types.ObjectId(idOrSlug)) === idOrSlug;
  const internship = await Internship.findOne(isId ? { _id: idOrSlug, status: 'active' } : { slug: idOrSlug, status: 'active' });
  if (!internship) return res.status(404).json({ error: 'Internship not found' });
  if (!internship.applyInPlatform) {
    return res.status(400).json({ error: 'This internship requires application on the official website.' });
  }
  if (internship.deadline && new Date(internship.deadline) < new Date()) {
    return res.status(400).json({ error: 'Application deadline has passed', code: 'DEADLINE_PASSED' });
  }
  const existing = await InternshipApplication.findOne({ userId, internshipId: internship._id });
  if (existing) return res.status(400).json({ error: 'Already applied to this internship' });
  const app = await InternshipApplication.create({ userId, internshipId: internship._id, status: 'applied' });
  const dualWrite = await ApplicationMigrationService.dualWriteFromLegacyInternshipApplication(app.toObject(), internship);
  const opportunityApplicationId = dualWrite?.application?._id ? String(dualWrite.application._id) : null;
  await awardBadge(userId, 'internship_applied', 'Internship Applied', 'Applied to an internship', { internshipId: internship._id });
  res.status(201).json({
    id: app._id,
    message: 'Application recorded',
    opportunityApplicationId,
    trackerUrl: opportunityApplicationId ? `/applications/${opportunityApplicationId}` : null,
  });
});

export const getMyApplications = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const apps = await InternshipApplication.find({ userId })
    .populate('internshipId', 'title slug organization location duration status deadline')
    .sort({ appliedAt: -1 })
    .limit(50)
    .lean();
  res.json({ data: apps });
});
