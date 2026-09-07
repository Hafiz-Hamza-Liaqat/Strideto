import { Institution } from '../models/Institution.js';
import { CanonicalInstitution } from '../models/education/CanonicalInstitution.js';
import { Program } from '../models/education/Program.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sanitizeString } from '../utils/sanitize.js';
import { withFixtureExclusion } from '../../../shared/publicDiscovery/fixtureExclusion.js';
import { SCHOOLS_COLLEGES_INSTITUTION_TYPES } from '../../../shared/education/taxonomy.js';
import { isLegacyInstitutionIndexable } from '../../../shared/seo/legacyInstitutionSeoPolicy.js';
import {
  projectPublicLegacyInstitution,
  projectPublicLegacyInstitutionListItem,
  projectPublicProgram,
} from '../../../shared/publicDiscovery/projectPublicDiscovery.js';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const LEGACY_TYPES = ['school', 'college', 'technical_institute', 'training_center'];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function canonicalType(value) {
  if (!value) return null;
  if (value === 'technical_institute') return 'institute';
  return SCHOOLS_COLLEGES_INSTITUTION_TYPES.includes(value) ? value : '__unsupported__';
}

export function buildCanonicalQuery(query = {}) {
  const filter = {
    status: 'published',
    launchEligible: true,
    countryCode: 'PK',
    institutionType: { $in: [...SCHOOLS_COLLEGES_INSTITUTION_TYPES] },
    sources: { $elemMatch: { sourceUrl: /^https?:\/\//i } },
  };

  if (query.type) {
    const type = canonicalType(sanitizeString(query.type));
    if (type === '__unsupported__') return { ...filter, institutionType: '__unsupported__' };
    if (type) filter.institutionType = type;
  }

  const region = sanitizeString(query.region || query.province || query.state);
  const city = sanitizeString(query.city);
  if (region) filter.region = new RegExp(escapeRegex(region), 'i');
  if (city) filter.city = new RegExp(escapeRegex(city), 'i');

  const search = sanitizeString(query.search).slice(0, 80);
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { officialName: re },
      { officialDomain: re },
      { description: re },
      { city: re },
      { region: re },
    ];
  }
  return withFixtureExclusion(filter);
}

function mapType(type) {
  return type === 'institute' ? 'technical_institute' : type;
}

export function mapCanonical(doc, programCount = 0, programs = []) {
  return {
    _id: doc._id,
    id: String(doc._id),
    name: doc.officialName,
    slug: doc.slug,
    type: mapType(doc.institutionType),
    country: doc.countryCode || '',
    countryCode: doc.countryCode || '',
    province: doc.region || '',
    region: doc.region || '',
    city: doc.city || '',
    district: doc.district || '',
    address: doc.address || '',
    website: doc.officialWebsite || '',
    officialWebsite: doc.officialWebsite || '',
    officialDomain: doc.officialDomain || '',
    description: doc.description || '',
    logoUrl: doc.logoUrl || '',
    phone: doc.phone || '',
    email: doc.email || '',
    accreditations: Array.isArray(doc.accreditations) ? doc.accreditations : [],
    // Temporary UI compatibility alias while the specialized detail view
    // transitions from the legacy singular field name.
    accreditation: Array.isArray(doc.accreditations) ? doc.accreditations : [],
    establishedYear: doc.establishedYear || null,
    programs: programs.map((program) => program.name).filter(Boolean),
    programCount,
    canonicalSource: 'CanonicalInstitution',
    sources: doc.sources || [],
    status: doc.status,
    launchEligible: doc.launchEligible === true,
  };
}

async function listCanonical(query, page, limit) {
  const filter = buildCanonicalQuery(query);
  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    CanonicalInstitution.find(filter).sort({ officialName: 1 }).skip(skip).limit(limit).lean(),
    CanonicalInstitution.countDocuments(filter),
  ]);
  const ids = docs.map((doc) => doc._id);
  const programs = ids.length
    ? await Program.find(withFixtureExclusion({ status: 'published', institutionId: { $in: ids } }))
      .sort({ name: 1 }).lean()
    : [];
  const programsByInstitution = new Map();
  for (const program of programs) {
    const key = String(program.institutionId);
    const list = programsByInstitution.get(key) || [];
    list.push(program);
    programsByInstitution.set(key, list);
  }
  return {
    data: docs.map((doc) => {
      const related = programsByInstitution.get(String(doc._id)) || [];
      return mapCanonical(doc, related.length, related);
    }),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 0,
  };
}

export function legacyQuery(query = {}) {
  const filter = { status: 'active' };
  if (query.type) {
    const requestedType = sanitizeString(query.type);
    if (requestedType === 'institute') filter.type = 'technical_institute';
    else if (LEGACY_TYPES.includes(requestedType)) filter.type = requestedType;
    else filter.type = '__unsupported__';
  }
  if (query.province || query.region) filter.province = new RegExp(escapeRegex(query.province || query.region), 'i');
  if (query.city) filter.city = new RegExp(escapeRegex(query.city), 'i');
  if (query.search) {
    const re = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: re }, { description: re }, { city: re }, { programs: re }, { country: re }];
  }
  return filter;
}

async function listLegacy(query, page, limit) {
  const filter = legacyQuery(query);
  const [docs, total] = await Promise.all([
    Institution.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Institution.countDocuments(filter),
  ]);
  return {
    data: docs.map(projectPublicLegacyInstitutionListItem),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 0,
  };
}

export const listSchoolsAndColleges = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  const requestedType = sanitizeString(req.query.type);
  if (requestedType && !LEGACY_TYPES.includes(requestedType) && canonicalType(requestedType) === '__unsupported__') {
    return res.json({ data: [], total: 0, page, limit, pages: 0 });
  }
  const canonical = await listCanonical(req.query, page, limit);

  // Temporary bridge fallback: legacy data remains readable only when the
  // canonical query has no matching records. It is never merged with a
  // canonical result set, preventing duplicate cards.
  if (canonical.total > 0) return res.json(canonical);
  return res.json(await listLegacy(req.query, page, limit));
});

export const getSchoolOrCollege = asyncHandler(async (req, res) => {
  const slug = sanitizeString(req.params.slug);
  const filter = buildCanonicalQuery({});
  filter.slug = slug;
  const doc = await CanonicalInstitution.findOne(filter).lean();
  if (doc) {
    const programs = await Program.find(withFixtureExclusion({ status: 'published', institutionId: doc._id }))
      .sort({ name: 1 }).lean();
    return res.json({ ...mapCanonical(doc, programs.length, programs), programs: programs.map(projectPublicProgram), seoIndexable: true });
  }

  const legacy = await Institution.findOne({ slug, status: 'active' }).lean();
  if (!legacy) return res.status(404).json({ error: 'Institution not found' });
  return res.json({ ...projectPublicLegacyInstitution(legacy), seoIndexable: isLegacyInstitutionIndexable(legacy) });
});
