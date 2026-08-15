/**
 * Public-safe Business Services marketplace DTO (Phase 17D-5).
 * Do not reuse provider/admin publicListingProjection.
 */
import { GBS_PRICING_MODES } from './constants.js';
import { getBusinessServicesCapability } from './businessServicesCapabilities.js';
import { PROTECTED_TITLES } from './protectedTitles.js';

const LEAK_KEYS = Object.freeze([
  'subjectId',
  'reviewedBy',
  'reviewedAt',
  'reviewReason',
  'adminReviewStatus',
  'moderationStatus',
  'publicationStatus',
  'riskFlags',
  'recordVersion',
  'contentRevision',
  'schemaVersion',
  'creationCommandId',
  'evidenceRefs',
  'evidence',
  'vaultRef',
  'email',
  'phone',
  'whatsapp',
  'officialEmail',
  'membership',
  'domainAccess',
  'permissions',
]);

export function marketplaceLeakKeys() {
  return LEAK_KEYS;
}

export function professionalFeeSummary(listing = {}) {
  const mode = listing.pricingMode || GBS_PRICING_MODES.QUOTE_REQUIRED;
  if (mode === GBS_PRICING_MODES.QUOTE_REQUIRED) {
    return { kind: 'quote_required', label: 'Quote required' };
  }
  const lines = Array.isArray(listing.providerFeeLines) ? listing.providerFeeLines : [];
  const first = lines[0];
  if (!first || !Number.isFinite(first.amountMinor) || !first.currency) {
    return { kind: mode, label: 'Professional service fee not listed' };
  }
  if (mode === GBS_PRICING_MODES.RANGE && lines[1]) {
    return {
      kind: 'range',
      label: 'Professional service fee',
      minAmountMinor: first.amountMinor,
      maxAmountMinor: lines[1].amountMinor,
      currency: first.currency,
    };
  }
  return {
    kind: mode,
    label: mode === GBS_PRICING_MODES.STARTING_AT ? 'Professional service fee starting at' : 'Professional service fee',
    amountMinor: first.amountMinor,
    currency: first.currency,
  };
}

export function verificationBadge(listing, capabilityDef, jurisdictionName) {
  const def = capabilityDef || getBusinessServicesCapability(listing?.capabilityId);
  if (!def) return null;
  const title = def.protectedTitleRequired
    ? PROTECTED_TITLES[def.requiredProtectedTitleId]?.publicName || def.publicName
    : def.publicName;
  const place = def.jurisdictionScoped && jurisdictionName ? ` — ${jurisdictionName}` : '';
  return {
    capabilityId: def.capabilityId,
    publicName: def.publicName,
    label: `${title}${place} — Verified`,
  };
}

function publicFeeLine(line = {}) {
  return {
    label: line.label || '',
    amountMinor: line.amountMinor,
    currency: line.currency,
    ownership: 'provider',
  };
}

function publicGovernmentFee(fee = {}, jurisdictionName) {
  const amountListed = fee.eligibleCurrent === true && fee.amount != null && fee.amountModel !== 'not_catalogued';
  return {
    label: fee.label || 'Official/government fee',
    currency: fee.currency || null,
    amount: amountListed ? fee.amount : null,
    amountModel: fee.amountModel || 'not_catalogued',
    ownership: 'government',
    jurisdictionName: jurisdictionName || null,
    listed: amountListed === true,
  };
}

export function marketplaceListingProjection(listing, extras = {}) {
  if (!listing) return null;
  const def = extras.capabilityDef || getBusinessServicesCapability(listing.capabilityId);
  const identity = extras.identity || {
    type: listing.subjectType,
    displayName: listing.subjectType === 'organization' ? 'Agency' : 'Independent provider',
    providerKind: listing.subjectType === 'organization' ? 'agency' : 'independent',
  };
  const jurisdictionName = extras.jurisdictionName || listing.jurisdictionId;
  const entityLabels = Array.isArray(extras.entityLabels) ? extras.entityLabels : [];
  const governmentFees = Array.isArray(extras.governmentFees)
    ? extras.governmentFees.map((fee) => publicGovernmentFee(fee, jurisdictionName))
    : [];

  return {
    id: String(listing._id || listing.id || ''),
    slug: listing.publicSlug || '',
    title: listing.title || '',
    shortDescription: listing.shortDescription || '',
    description: extras.includeDescription === false ? undefined : listing.description || '',
    capability: {
      id: listing.capabilityId,
      publicName: def?.publicName || listing.capabilityId,
    },
    verificationBadge: verificationBadge(listing, def, jurisdictionName),
    subject: {
      type: identity.type,
      displayName: identity.displayName,
      providerKind: identity.providerKind,
    },
    countryCode: listing.countryCode || '',
    jurisdiction: {
      id: listing.jurisdictionId,
      name: jurisdictionName,
      countryCode: listing.countryCode || '',
    },
    entityTypes: entityLabels,
    includedItems: listing.includedItems || [],
    excludedItems: listing.excludedItems || [],
    deliveryMode: listing.deliveryMode || '',
    languages: listing.languages || identity.languages || [],
    pricingMode: listing.pricingMode,
    professionalFees: (listing.providerFeeLines || []).map(publicFeeLine),
    professionalFeeSummary: professionalFeeSummary(listing),
    governmentFees,
    governmentFeeListed: governmentFees.some((f) => f.listed),
    providerTurnaroundEstimate: listing.providerTurnaroundEstimate ?? null,
    turnaroundUnit: listing.turnaroundUnit || null,
    turnaroundIsProviderEstimate: true,
    consultationAvailable: listing.consultationAvailable === true,
    recurringService: listing.recurringService === true,
    createdAt: listing.createdAt || null,
    updatedAt: listing.updatedAt || null,
  };
}

function collectKeys(value, into = []) {
  if (!value || typeof value !== 'object') return into;
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, into);
    return into;
  }
  for (const key of Object.keys(value)) {
    into.push(key);
    collectKeys(value[key], into);
  }
  return into;
}

export function assertMarketplaceProjectionSafe(dto) {
  if (!dto || typeof dto !== 'object') return false;
  const keys = collectKeys(dto);
  for (const key of LEAK_KEYS) {
    if (keys.includes(key)) return false;
  }
  return true;
}
