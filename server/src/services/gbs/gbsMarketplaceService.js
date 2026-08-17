/**
 * Anonymous public Business Services marketplace reads (Phase 17D-5).
 * Discovery only. Live eligibility. No writes, cache, or publicationStatus authority.
 */
import { GbsServiceListing } from '../../models/gbs/GbsServiceListing.js';
import { ProviderCapability } from '../../models/gbs/ProviderCapability.js';
import { ProviderDomainEnrollment } from '../../models/gbs/ProviderDomainEnrollment.js';
import { AgentProfile } from '../../models/agent/AgentProfile.js';
import { Organization } from '../../models/Organization.js';
import {
  GBS_LISTING_ADMIN_REVIEW_STATUSES,
  GBS_LISTING_MODERATION_STATUSES,
  GBS_MARKETPLACE_BOUNDS,
  GBS_PRICING_MODES,
  PROVIDER_SUBJECT_TYPES,
  isBusinessServicesPublicMarketplaceEnabled,
} from '../../../../shared/gbs/constants.js';
import {
  BUSINESS_SERVICES_CAPABILITIES,
  getBusinessServicesCapability,
  isKnownBusinessServicesCapability,
} from '../../../../shared/gbs/businessServicesCapabilities.js';
import { projectProviderCatalog, resolveJurisdictionProductionReadiness } from '../../../../shared/gbs/providerCatalogProjection.js';
import { evaluatePublicMarketplaceEligibility } from '../../../../shared/gbs/marketplaceEligibility.js';
import { marketplaceListingProjection } from '../../../../shared/gbs/marketplaceProjection.js';
import { PROVIDER_DOMAIN_IDS } from '../../../../shared/provider/providerDomains.js';

const SORT_FIELDS = Object.freeze({
  newest: { createdAt: -1 },
  title: { title: 1 },
});

function notFound() {
  return Object.assign(new Error('not_found'), { status: 404, code: 'not_found' });
}

function marketplaceOff() {
  return Object.assign(new Error('not_found'), { status: 404, code: 'not_found' });
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePage(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function parseLimit(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return GBS_MARKETPLACE_BOUNDS.PAGE_DEFAULT;
  return Math.min(GBS_MARKETPLACE_BOUNDS.PAGE_MAX, n);
}

function parseSearch(raw) {
  if (raw == null) return '';
  const q = String(raw).trim().slice(0, GBS_MARKETPLACE_BOUNDS.SEARCH_MAX);
  return q;
}

export function marketplaceEnabled(env = process.env) {
  return isBusinessServicesPublicMarketplaceEnabled(env);
}

function catalogLookups(now = new Date()) {
  const catalog = projectProviderCatalog({ now });
  const jurisdictionById = new Map(catalog.jurisdictions.map((j) => [j.id, j]));
  const entityById = new Map(catalog.entityTypes.map((e) => [e.entityTypeId, e]));
  const fees = catalog.fees.filter((f) => f.eligibleCurrent === true);
  return { catalog, jurisdictionById, entityById, fees };
}

function listingGovernmentFees(listing, lookups) {
  const entitySet = new Set(listing.entityTypeIds || []);
  return lookups.fees.filter((fee) => {
    if (fee.jurisdictionId !== listing.jurisdictionId) return false;
    if (fee.entityTypeId && entitySet.size && !entitySet.has(fee.entityTypeId)) return false;
    return true;
  });
}

async function resolveIdentity(listing) {
  if (listing.subjectType === PROVIDER_SUBJECT_TYPES.ORGANIZATION) {
    const org = await Organization.findById(listing.subjectId).select('displayName countryCode').lean();
    return {
      type: PROVIDER_SUBJECT_TYPES.ORGANIZATION,
      providerKind: 'agency',
      displayName: org?.displayName || 'Agency',
      languages: listing.languages || [],
      countryCode: org?.countryCode || listing.countryCode,
    };
  }
  const profile = await AgentProfile.findOne({ agentAccountId: listing.subjectId })
    .select('professionalName languages countryCode')
    .lean();
  return {
    type: PROVIDER_SUBJECT_TYPES.AGENT,
    providerKind: 'independent',
    displayName: profile?.professionalName || 'Independent provider',
    languages: listing.languages || profile?.languages || [],
    countryCode: profile?.countryCode || listing.countryCode,
  };
}

async function loadEligibilityContext(listings) {
  if (!listings.length) {
    return { capByKey: new Map(), domainByKey: new Map() };
  }
  const orCaps = listings.map((row) => ({
    subjectType: row.subjectType,
    subjectId: String(row.subjectId),
    capabilityId: row.capabilityId,
  }));
  const orDomains = listings.map((row) => ({
    subjectType: row.subjectType,
    subjectId: String(row.subjectId),
    domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  }));
  const [caps, domains] = await Promise.all([
    ProviderCapability.find({ $or: orCaps }).lean(),
    ProviderDomainEnrollment.find({ $or: orDomains }).lean(),
  ]);
  const capByKey = new Map();
  for (const cap of caps) {
    capByKey.set(`${cap.subjectType}:${String(cap.subjectId)}:${cap.capabilityId}`, cap);
  }
  const domainByKey = new Map();
  for (const row of domains) {
    domainByKey.set(`${row.subjectType}:${String(row.subjectId)}`, row);
  }
  return { capByKey, domainByKey };
}

function isEligible(listing, ctx, env, now, readinessResolver = resolveJurisdictionProductionReadiness) {
  const cap = ctx.capByKey.get(`${listing.subjectType}:${String(listing.subjectId)}:${listing.capabilityId}`);
  const domain = ctx.domainByKey.get(`${listing.subjectType}:${String(listing.subjectId)}`);
  return evaluatePublicMarketplaceEligibility({
    env,
    listing,
    capability: cap || null,
    domainEnrollment: domain || null,
    protectedTitleEvidence: cap?.evidenceRefs || null,
    jurisdictionReadiness: readinessResolver(listing.jurisdictionId, { now }),
    now,
  }).allowed;
}

function project(listing, identity, lookups, { includeDescription = true } = {}) {
  const jur = lookups.jurisdictionById.get(listing.jurisdictionId);
  const entityLabels = (listing.entityTypeIds || [])
    .map((id) => lookups.entityById.get(id)?.displayName || lookups.entityById.get(id)?.officialName)
    .filter(Boolean);
  return marketplaceListingProjection(listing, {
    identity,
    capabilityDef: getBusinessServicesCapability(listing.capabilityId),
    jurisdictionName: jur?.name || listing.jurisdictionId,
    entityLabels,
    governmentFees: listingGovernmentFees(listing, lookups),
    includeDescription,
  });
}

async function searchSubjectIds(q) {
  const rx = new RegExp(escapeRegex(q), 'i');
  const [profiles, orgs] = await Promise.all([
    AgentProfile.find({ professionalName: rx }).select('agentAccountId').limit(50).lean(),
    Organization.find({ displayName: rx }).select('_id').limit(50).lean(),
  ]);
  return {
    agentIds: profiles.map((p) => String(p.agentAccountId)),
    orgIds: orgs.map((o) => String(o._id)),
  };
}

function searchCapabilityIds(q) {
  const needle = q.toLowerCase();
  return Object.values(BUSINESS_SERVICES_CAPABILITIES)
    .filter((c) => c.publicName.toLowerCase().includes(needle) || c.capabilityId.includes(needle))
    .map((c) => c.capabilityId);
}

function searchJurisdictionIds(q, lookups) {
  const needle = q.toLowerCase();
  return [...lookups.jurisdictionById.values()]
    .filter((j) => (j.name || '').toLowerCase().includes(needle) || (j.id || '').toLowerCase().includes(needle))
    .map((j) => j.id);
}

function parseListQuery(query = {}, lookups) {
  const errors = [];
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);
  const q = parseSearch(query.q ?? query.search);
  const sort = query.sort === 'title' ? 'title' : 'newest';
  if (query.sort && query.sort !== 'newest' && query.sort !== 'title') {
    errors.push('sort');
  }

  let capabilityId = '';
  if (query.capabilityId) {
    capabilityId = String(query.capabilityId).trim();
    if (!isKnownBusinessServicesCapability(capabilityId)) errors.push('capabilityId');
  }

  let jurisdictionId = '';
  if (query.jurisdictionId) {
    jurisdictionId = String(query.jurisdictionId).trim();
    if (!lookups.jurisdictionById.has(jurisdictionId)) errors.push('jurisdictionId');
  }

  let countryCode = '';
  if (query.countryCode) {
    countryCode = String(query.countryCode).trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) errors.push('countryCode');
  }

  let subjectType = '';
  if (query.subjectType) {
    subjectType = String(query.subjectType).trim();
    if (!Object.values(PROVIDER_SUBJECT_TYPES).includes(subjectType)) errors.push('subjectType');
  }

  let pricingMode = '';
  if (query.pricingMode) {
    pricingMode = String(query.pricingMode).trim();
    if (!Object.values(GBS_PRICING_MODES).includes(pricingMode)) errors.push('pricingMode');
  }

  if (errors.length) {
    throw Object.assign(new Error('invalid_query'), { status: 400, code: 'invalid_query', details: errors });
  }

  return { page, limit, q, sort, capabilityId, jurisdictionId, countryCode, subjectType, pricingMode };
}

export async function getPublicMarketplaceEnabled() {
  return { enabled: marketplaceEnabled() };
}

export async function listPublicMarketplaceListings(query = {}, env = process.env, readinessResolver = resolveJurisdictionProductionReadiness) {
  if (!marketplaceEnabled(env)) throw marketplaceOff();
  const now = new Date();
  const lookups = catalogLookups(now);
  const parsed = parseListQuery(query, lookups);

  const filter = {
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
    publicSlug: { $exists: true, $nin: [null, ''] },
  };
  if (parsed.capabilityId) filter.capabilityId = parsed.capabilityId;
  if (parsed.jurisdictionId) filter.jurisdictionId = parsed.jurisdictionId;
  if (parsed.countryCode) filter.countryCode = parsed.countryCode;
  if (parsed.subjectType) filter.subjectType = parsed.subjectType;
  if (parsed.pricingMode) filter.pricingMode = parsed.pricingMode;

  if (parsed.q) {
    const rx = new RegExp(escapeRegex(parsed.q), 'i');
    const { agentIds, orgIds } = await searchSubjectIds(parsed.q);
    const or = [{ title: rx }];
    const capIds = searchCapabilityIds(parsed.q);
    if (capIds.length) or.push({ capabilityId: { $in: capIds } });
    const jurIds = searchJurisdictionIds(parsed.q, lookups);
    if (jurIds.length) or.push({ jurisdictionId: { $in: jurIds } });
    if (agentIds.length) or.push({ subjectType: PROVIDER_SUBJECT_TYPES.AGENT, subjectId: { $in: agentIds } });
    if (orgIds.length) or.push({ subjectType: PROVIDER_SUBJECT_TYPES.ORGANIZATION, subjectId: { $in: orgIds } });
    filter.$or = or;
  }

  const candidates = await GbsServiceListing.find(filter)
    .sort(SORT_FIELDS[parsed.sort])
    .limit(GBS_MARKETPLACE_BOUNDS.CANDIDATE_WINDOW)
    .lean();

  const ctx = await loadEligibilityContext(candidates);
  const eligible = candidates.filter((row) => isEligible(row, ctx, env, now, readinessResolver));
  const total = eligible.length;
  const start = (parsed.page - 1) * parsed.limit;
  const pageRows = eligible.slice(start, start + parsed.limit);
  const identities = await Promise.all(pageRows.map(resolveIdentity));
  const items = pageRows.map((row, i) => project(row, identities[i], lookups, { includeDescription: false }));

  return {
    items,
    total,
    page: parsed.page,
    limit: parsed.limit,
    pages: Math.max(1, Math.ceil(total / parsed.limit) || 1),
    sort: parsed.sort,
    filters: {
      capabilities: Object.values(BUSINESS_SERVICES_CAPABILITIES).map((c) => ({
        id: c.capabilityId,
        publicName: c.publicName,
      })),
      jurisdictions: lookups.catalog.jurisdictions
        .filter((j) => j.currentReviewed || j.launchCoverage)
        .map((j) => ({ id: j.id, name: j.name, countryCode: j.countryCode })),
    },
  };
}

export async function getPublicMarketplaceListing(slug, env = process.env, readinessResolver = resolveJurisdictionProductionReadiness) {
  if (!marketplaceEnabled(env)) throw marketplaceOff();
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) throw notFound();

  const listing = await GbsServiceListing.findOne({ publicSlug: normalized }).lean();
  if (!listing) throw notFound();

  const now = new Date();
  const ctx = await loadEligibilityContext([listing]);
  if (!isEligible(listing, ctx, env, now, readinessResolver)) throw notFound();

  const lookups = catalogLookups(now);
  const identity = await resolveIdentity(listing);
  return project(listing, identity, lookups, { includeDescription: true });
}

export async function listEligibleMarketplaceSitemapPaths(env = process.env, now = new Date(), readinessResolver = resolveJurisdictionProductionReadiness) {
  if (!marketplaceEnabled(env)) return [];
  const candidates = await GbsServiceListing.find({
    moderationStatus: GBS_LISTING_MODERATION_STATUSES.APPROVED,
    adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.APPROVED,
    publicSlug: { $exists: true, $nin: [null, ''] },
  })
    .limit(500)
    .lean();
  const ctx = await loadEligibilityContext(candidates);
  const paths = ['/business-services'];
  for (const row of candidates) {
    if (!isEligible(row, ctx, env, now, readinessResolver)) continue;
    if (row.publicSlug) paths.push(`/business-services/${row.publicSlug}`);
  }
  return paths;
}
