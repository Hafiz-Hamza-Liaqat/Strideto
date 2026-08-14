/**
 * Private GBS Service Listing contract (Phase 17D-3).
 * Drafts are private. Approved ≠ public. Public publication remains OFF.
 */
import {
  GBS_DELIVERY_MODES,
  GBS_LISTING_MODERATION_STATUSES,
  GBS_LISTING_PUBLICATION_STATUSES,
  GBS_PROVIDER_BOUNDS,
  GBS_SCHEMA_VERSION,
  GBS_TURNAROUND_UNITS,
  isValidProviderSubjectType,
} from './constants.js';
import { isKnownBusinessServicesCapability } from './businessServicesCapabilities.js';
import { normalizeIdList, normalizeProviderScope } from './providerCapability.js';
import { validateProviderPricing } from './providerPricing.js';

const MOD_SET = new Set(Object.values(GBS_LISTING_MODERATION_STATUSES));
const PUB_SET = new Set(Object.values(GBS_LISTING_PUBLICATION_STATUSES));
const DELIVERY_SET = new Set(Object.values(GBS_DELIVERY_MODES));
const TURNAROUND_SET = new Set(Object.values(GBS_TURNAROUND_UNITS));

export const GBS_LISTING_MATERIAL_FIELDS = Object.freeze([
  'capabilityId',
  'countryCode',
  'jurisdictionId',
  'entityTypeIds',
  'title',
  'shortDescription',
  'description',
  'includedItems',
  'excludedItems',
  'pricingMode',
  'providerFeeLines',
  'protectedTitleIds',
]);

export function isValidListingModerationStatus(value) {
  return MOD_SET.has(value);
}

export function isValidListingPublicationStatus(value) {
  return PUB_SET.has(value);
}

function boundStringList(value, max, itemMax = 160) {
  return normalizeIdList(value)
    .map((s) => s.slice(0, itemMax))
    .slice(0, max);
}

/**
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function validateServiceListingRecord(input = {}) {
  const errors = [];
  if (!isValidProviderSubjectType(input.subjectType)) {
    errors.push('subjectType must be agent or organization');
  }
  const subjectId = input.subjectId != null ? String(input.subjectId).trim() : '';
  if (!subjectId) errors.push('subjectId is required');

  const capabilityId = input.capabilityId != null ? String(input.capabilityId).trim() : '';
  if (!capabilityId) errors.push('capabilityId is required');
  else if (!isKnownBusinessServicesCapability(capabilityId)) errors.push('capabilityId is unknown');

  const countryCode = typeof input.countryCode === 'string' ? input.countryCode.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(countryCode)) errors.push('countryCode must be ISO 3166-1 alpha-2');

  const jurisdictionId = typeof input.jurisdictionId === 'string' ? input.jurisdictionId.trim() : '';
  if (!jurisdictionId) errors.push('jurisdictionId is required');

  const entityTypeIds = boundStringList(input.entityTypeIds, GBS_PROVIDER_BOUNDS.ENTITY_TYPE_IDS_MAX);
  const languages = boundStringList(input.languages, GBS_PROVIDER_BOUNDS.LANGUAGES_MAX, 8);
  const includedItems = boundStringList(input.includedItems, GBS_PROVIDER_BOUNDS.INCLUDED_ITEMS_MAX);
  const excludedItems = boundStringList(input.excludedItems, GBS_PROVIDER_BOUNDS.EXCLUDED_ITEMS_MAX);

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) errors.push('title is required');
  if (title.length > GBS_PROVIDER_BOUNDS.TITLE_MAX) errors.push('title too long');

  const shortDescription = typeof input.shortDescription === 'string' ? input.shortDescription.trim() : '';
  if (shortDescription.length > GBS_PROVIDER_BOUNDS.SHORT_DESCRIPTION_MAX) {
    errors.push('shortDescription too long');
  }
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length > GBS_PROVIDER_BOUNDS.DESCRIPTION_MAX) errors.push('description too long');

  const deliveryMode = input.deliveryMode || GBS_DELIVERY_MODES.REMOTE;
  if (!DELIVERY_SET.has(deliveryMode)) errors.push('deliveryMode is invalid');

  const pricing = validateProviderPricing(input);
  if (!pricing.ok) errors.push(...pricing.errors);

  const moderationStatus = input.moderationStatus || GBS_LISTING_MODERATION_STATUSES.DRAFT;
  if (!isValidListingModerationStatus(moderationStatus)) errors.push('moderationStatus is invalid');

  const publicationStatus = input.publicationStatus || GBS_LISTING_PUBLICATION_STATUSES.PRIVATE;
  if (!isValidListingPublicationStatus(publicationStatus)) errors.push('publicationStatus is invalid');
  if (publicationStatus === GBS_LISTING_PUBLICATION_STATUSES.PUBLIC) {
    errors.push('public publication is not enabled');
  }

  let turnaroundUnit = input.turnaroundUnit || null;
  if (turnaroundUnit && !TURNAROUND_SET.has(turnaroundUnit)) errors.push('turnaroundUnit is invalid');
  const turnaround = input.providerTurnaroundEstimate;
  if (turnaround != null && turnaround !== '') {
    const n = Number(turnaround);
    if (!Number.isInteger(n) || n < 1 || n > 3650) errors.push('providerTurnaroundEstimate must be a positive integer');
  }

  const creationCommandId =
    typeof input.creationCommandId === 'string' ? input.creationCommandId.trim() : '';

  if (errors.length) return { ok: false, errors };

  const scope = normalizeProviderScope({
    serviceCategoryIds: input.serviceCategoryIds || [],
    countryCodes: [countryCode],
    jurisdictionIds: [jurisdictionId],
    entityTypeIds,
    protectedTitleIds:
      input.protectedTitleIds ||
      (capabilityId === 'registered_agent'
        ? ['registered_agent']
        : capabilityId === 'registered_office'
          ? ['registered_office_provider']
          : []),
    flags: {
      registered_agent: capabilityId === 'registered_agent',
      registered_office: capabilityId === 'registered_office',
    },
  });

  return {
    ok: true,
    value: {
      subjectType: input.subjectType,
      subjectId,
      capabilityId,
      countryCode,
      jurisdictionId,
      entityTypeIds,
      title,
      shortDescription,
      description,
      includedItems,
      excludedItems,
      deliveryMode,
      languages,
      pricingMode: pricing.value.pricingMode,
      providerFeeLines: pricing.value.providerFeeLines,
      providerTurnaroundEstimate: turnaround == null || turnaround === '' ? null : Number(turnaround),
      turnaroundUnit,
      turnaroundIsProviderEstimate: true,
      consultationAvailable: input.consultationAvailable === true,
      recurringService: input.recurringService === true,
      moderationStatus,
      publicationStatus: GBS_LISTING_PUBLICATION_STATUSES.PRIVATE,
      scope,
      contentRevision: Number.isInteger(input.contentRevision) ? input.contentRevision : 1,
      schemaVersion: input.schemaVersion || GBS_SCHEMA_VERSION,
      recordVersion: Number.isInteger(input.recordVersion) ? input.recordVersion : 0,
      creationCommandId: creationCommandId || null,
      riskFlags: Array.isArray(input.riskFlags) ? input.riskFlags.slice(0, 20) : [],
    },
  };
}

export function listingMaterialFingerprint(record = {}) {
  const picked = {};
  for (const key of GBS_LISTING_MATERIAL_FIELDS) picked[key] = record[key];
  return JSON.stringify(picked);
}

export function isMaterialListingChange(before = {}, after = {}) {
  return listingMaterialFingerprint(before) !== listingMaterialFingerprint(after);
}
