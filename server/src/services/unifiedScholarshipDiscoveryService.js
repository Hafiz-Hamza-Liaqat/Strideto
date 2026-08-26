/**
 * Unified /scholarships discovery — CMS + published institutional CanonicalScholarships.
 * Projection adapter only; collections stay separate. No title-string dedupe.
 */
import { Scholarship } from '../models/Scholarship.js';
import { CanonicalScholarship } from '../models/education/CanonicalScholarship.js';
import { CanonicalInstitution } from '../models/education/CanonicalInstitution.js';
import { ScholarshipApplicability } from '../models/education/ScholarshipApplicability.js';
import { ScholarshipCycle } from '../models/education/ScholarshipCycle.js';
import { Program } from '../models/education/Program.js';
import { withFixtureExclusion } from '../../../shared/publicDiscovery/fixtureExclusion.js';
import { freeTextCountryRegex, escapeRegExp } from '../../../shared/international/location.js';
import { coerceCountryCode } from '../../../shared/international/country.js';
import { sanitizeString } from '../utils/sanitize.js';
import {
  getRequestLocale,
  withListLocaleFilter,
} from '../utils/localeQuery.js';
import {
  UNIFIED_SCHOLARSHIP_SOURCE,
  mapCmsLevelFilterToCanonical,
  mergeUnifiedScholarshipCards,
  projectCmsScholarshipDiscoveryCard,
  projectInstitutionCanonicalScholarshipDiscoveryCard,
  CMS_FUNDING_TO_CANONICAL,
} from '../../../shared/publicDiscovery/unifiedScholarshipDiscovery.js';
import { SCHOLARSHIP_TYPES } from '../../../shared/education/scholarshipIntelligence.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function buildCmsQuery(q) {
  const filter = withFixtureExclusion({ status: 'active' });
  if (q.level) filter.level = q.level;
  const countryRe = freeTextCountryRegex(q.country || q.countryCode);
  if (countryRe) filter.country = countryRe;
  if (q.province || q.region) filter.province = new RegExp(sanitizeString(q.province || q.region), 'i');
  if (q.city) filter.city = new RegExp(sanitizeString(q.city), 'i');
  if (q.deadline) {
    const d = new Date(q.deadline);
    if (!Number.isNaN(d.getTime())) filter.deadline = { $gte: d };
  }
  if (q.fundingType) {
    const ft = sanitizeString(q.fundingType);
    // Accept CMS labels or canonical keys mapped back to CMS labels
    const reverse = Object.entries(CMS_FUNDING_TO_CANONICAL).find(([, v]) => v === ft);
    filter.fundingType = reverse ? reverse[0] : ft;
  }
  if (q.institution) {
    const re = new RegExp(escapeRegExp(sanitizeString(q.institution)), 'i');
    filter.university = re;
  }
  if (q.search && q.search.trim()) {
    const re = new RegExp(escapeRegExp(q.search.trim()), 'i');
    filter.$or = [{ title: re }, { provider: re }, { country: re }, { university: re }];
  }
  return filter;
}

function buildCmsSort(sort) {
  if (sort === 'deadline') return { deadline: 1, createdAt: -1 };
  return { createdAt: -1 };
}

function buildCanonicalFilter(q, publicInstitutionIds) {
  const filter = {
    status: 'published',
    scholarshipType: SCHOLARSHIP_TYPES.INSTITUTIONAL,
    institutionId: { $in: publicInstitutionIds },
    'sources.sourceUrl': { $exists: true, $nin: [null, ''] },
  };

  // Study-level filter applied after projection so empty degreeLevels do not
  // silently drop the canonical source (SCH-UNI-10).

  // Country is applied after projection (institution HQ or destinationCountries).

  if (q.field) {
    filter.fields = sanitizeString(q.field).toLowerCase();
  }

  if (q.fundingType) {
    const ft = sanitizeString(q.fundingType);
    const canonical = CMS_FUNDING_TO_CANONICAL[ft] || ft;
    filter['funding.type'] = canonical;
  }

  if (q.deadline) {
    const d = sanitizeString(q.deadline);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      filter.deadlineDate = { $gte: d };
    }
  }

  if (q.search && q.search.trim()) {
    const re = new RegExp(escapeRegExp(q.search.trim()), 'i');
    filter.$and = (filter.$and || []).concat([{
      $or: [
        { title: re },
        { summary: re },
        { 'provider.name': re },
      ],
    }]);
  }

  return filter;
}

async function loadPublicInstitutions(q) {
  const filter = withFixtureExclusion({ status: 'published' });
  if (q.institution) {
    filter.officialName = new RegExp(escapeRegExp(sanitizeString(q.institution)), 'i');
  }
  // Country/region/city are applied on projected cards so scholarships with
  // explicit destinationCountries are not dropped solely by institution HQ.
  if (q.province || q.region) {
    filter.region = new RegExp(escapeRegExp(sanitizeString(q.province || q.region)), 'i');
  }
  if (q.city) {
    filter.city = new RegExp(escapeRegExp(sanitizeString(q.city)), 'i');
  }
  const docs = await CanonicalInstitution.find(filter)
    .select('_id officialName slug countryCode region city status isFixture demoOnly launchEligible')
    .lean();
  return docs;
}

function passesCountryFilter(card, q) {
  const code = coerceCountryCode(q.country || q.countryCode);
  if (!code) return true;
  if (card.countryCode && coerceCountryCode(card.countryCode) === code) return true;
  if (card.country && coerceCountryCode(card.country) === code) return true;
  return false;
}

function passesLevelFilter(card, q) {
  if (!q.level) return true;
  if (card.sourceType === UNIFIED_SCHOLARSHIP_SOURCE.CMS) {
    return card.level === q.level || card.studyLevel === q.level;
  }
  const mapped = mapCmsLevelFilterToCanonical(q.level);
  if (!mapped.length) return true; // Other — do not invent a canonical exclusion
  const degrees = Array.isArray(card.degreeLevels) ? card.degreeLevels : [];
  if (!degrees.length) return true; // unknown level — do not silently drop source
  return degrees.some((d) => mapped.includes(d));
}

/**
 * List unified discovery cards for GET /scholarships.
 */
export async function listUnifiedScholarships(req) {
  const q = req.query || {};
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(q.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  const sort = q.sort === 'deadline' ? 'deadline' : 'newest';
  const need = skip + limit;

  const locale = getRequestLocale(req);
  // Field is canonical-native; CMS has no field — skip CMS branch when field filter is set
  // so we do not invent matches, while still querying the canonical source correctly.
  const skipCmsForField = Boolean(q.field);
  const cmsQuery = skipCmsForField
    ? { _id: { $exists: false } }
    : withListLocaleFilter(buildCmsQuery(q), locale);

  const publicInstitutions = await loadPublicInstitutions(q);
  const instMap = new Map(publicInstitutions.map((i) => [String(i._id), i]));
  const publicInstIds = publicInstitutions.map((i) => i._id);

  const canonicalFilter = publicInstIds.length
    ? buildCanonicalFilter(q, publicInstIds)
    : { _id: { $exists: false } };

  const [cmsRows, cmsTotal, canRows, canTotal] = await Promise.all([
    skipCmsForField
      ? Promise.resolve([])
      : Scholarship.find(cmsQuery).sort(buildCmsSort(sort)).limit(need).lean(),
    skipCmsForField ? Promise.resolve(0) : Scholarship.countDocuments(cmsQuery),
    CanonicalScholarship.find(canonicalFilter)
      .select('-adminNotes -__v')
      .sort(sort === 'deadline' ? { deadlineDate: 1, createdAt: -1 } : { createdAt: -1 })
      .limit(need)
      .lean(),
    publicInstIds.length ? CanonicalScholarship.countDocuments(canonicalFilter) : Promise.resolve(0),
  ]);

  const scholarshipIds = canRows.map((r) => r._id);
  const programIds = [
    ...new Set(
      canRows.flatMap((r) => (Array.isArray(r.applicableProgramIds) ? r.applicableProgramIds.map(String) : []))
    ),
  ];

  const [applicability, cycles, programs] = await Promise.all([
    scholarshipIds.length
      ? ScholarshipApplicability.find({
        scholarshipId: { $in: scholarshipIds },
        status: 'published',
      })
        .populate('programId', 'name slug degreeLevel field')
        .lean()
      : [],
    scholarshipIds.length
      ? ScholarshipCycle.find({
        scholarshipId: { $in: scholarshipIds },
        status: 'published',
        isHistorical: false,
      })
        .select('-adminNotes')
        .lean()
      : [],
    programIds.length
      ? Program.find({ _id: { $in: programIds }, status: 'published' }).select('name slug').lean()
      : [],
  ]);

  const appBySch = new Map();
  for (const a of applicability) {
    const key = String(a.scholarshipId);
    if (!appBySch.has(key)) appBySch.set(key, []);
    appBySch.get(key).push(a);
  }
  const cyclesBySch = new Map();
  for (const c of cycles) {
    const key = String(c.scholarshipId);
    if (!cyclesBySch.has(key)) cyclesBySch.set(key, []);
    cyclesBySch.get(key).push(c);
  }
  const programById = new Map(programs.map((p) => [String(p._id), p]));

  const cmsCards = cmsRows
    .map(projectCmsScholarshipDiscoveryCard)
    .filter(Boolean)
    .filter((c) => passesCountryFilter(c, q))
    .filter((c) => passesLevelFilter(c, q));

  const canCards = canRows
    .map((s) => {
      const instId = s.institutionId ? String(s.institutionId) : '';
      const institution = instMap.get(instId);
      if (!institution) return null;
      const apps = appBySch.get(String(s._id)) || [];
      const schCycles = cyclesBySch.get(String(s._id)) || [];
      const applicablePrograms = (s.applicableProgramIds || [])
        .map((id) => programById.get(String(id)))
        .filter(Boolean);
      return projectInstitutionCanonicalScholarshipDiscoveryCard(s, institution, {
        applicability: apps,
        applicablePrograms,
        cycles: schCycles,
      });
    })
    .filter(Boolean)
    .filter((c) => passesCountryFilter(c, q))
    .filter((c) => passesLevelFilter(c, q));

  const merged = mergeUnifiedScholarshipCards(cmsCards, canCards, sort);
  const pageItems = merged.slice(skip, skip + limit);

  // Totals: prefer DB counts; country post-filter may slightly over-count when
  // destinationCountries diverge from institution country — acceptable for list UX.
  const total = cmsTotal + canTotal;

  return {
    data: pageItems,
    total,
    page,
    limit,
    sources: {
      [UNIFIED_SCHOLARSHIP_SOURCE.CMS]: cmsTotal,
      [UNIFIED_SCHOLARSHIP_SOURCE.INSTITUTION_CANONICAL]: canTotal,
    },
  };
}
