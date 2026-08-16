/**
 * Production US-WY LLC formation requirement pack v1.
 * activationStatus=draft, reviewStatus=draft. Not selectable at runtime.
 * Official sources locked in 17D-8B2B-PRE. Not legal counsel.
 */
import { createHash } from 'node:crypto';
import { CATALOG_REVIEW_STATUSES } from '../catalogConstants.js';
import { catalogFingerprintCanonical } from '../catalogFingerprint.js';
import {
  DELAYED_EFFECTIVE_DATE_MAX_DAYS,
  GBS_REQUIREMENT_PACK_SCHEMA_VERSION,
  PACK_APPLICABLE_FROM_US_WY_LLC_V1,
  REQUIREMENT_FACT_CLASSES,
  REQUIREMENT_PACK_ACTIVATION,
  REQUIREMENT_PACK_IDS,
  REQUIREMENT_VALUE_TYPES,
  REQUIREMENT_WHO_SUPPLIES,
  RA_KIND_VALUES,
  RA_SOURCE_VALUES,
  WY_LLC_NAME_SUFFIXES,
  sourceSnapshotFingerprintPayload,
  validateRequirementPackDefinition,
} from '../requirementPackContract.js';

const RETRIEVED = '2026-08-16';

const SRC = Object.freeze({
  SOS: 'src:US-WY-sos',
  FORMS: 'src:US-WY-forms-index',
  ARTICLES: 'src:US-WY-llc-articles-form',
  FEES: 'src:US-WY-fees',
  HOWTO: 'src:US-WY-howto-create',
  RA: 'src:US-WY-ra',
  NAME: 'src:US-WY-name',
  NAME_TIPS: 'src:US-WY-name-search-tips',
  SEARCH: 'src:US-WY-search',
  STATUTES: 'src:US-WY-statutes-index',
  LLC_ACT: 'src:US-WY-llc-act',
  RA_ACT: 'src:US-WY-ra-act',
  EFFECTIVE: 'src:US-WY-17-16-123',
});

function fact(factKey, extra) {
  return Object.freeze({
    factKey,
    definitionVersion: 1,
    class: extra.class || REQUIREMENT_FACT_CLASSES.FACT,
    whoSupplies: extra.whoSupplies,
    valueType: extra.valueType,
    enumValues: extra.enumValues,
    sourceIds: Object.freeze([...(extra.sourceIds || [])]),
    label: extra.label,
    help: extra.help,
  });
}

function check(checkKey, extra) {
  return Object.freeze({
    checkKey,
    definitionVersion: 1,
    mode: extra.mode,
    waivable: false,
    sourceIds: Object.freeze([...(extra.sourceIds || [])]),
    label: extra.label,
    help: extra.help,
  });
}

const sourceRefs = Object.freeze([
  Object.freeze({
    sourceId: SRC.SOS,
    title: 'Business & UCC Center',
    authority: 'Wyoming Secretary of State, Business Division',
    url: 'https://sos.wyo.gov/Business/default.aspx',
    sourceType: 'OFFICIAL_WEB_GUIDANCE',
    retrievedAt: RETRIEVED,
    lastReviewedAt: RETRIEVED,
  }),
  Object.freeze({
    sourceId: SRC.FORMS,
    title: 'Forms & Publications',
    authority: 'Wyoming Secretary of State',
    url: 'https://sos.wyo.gov/Forms/',
    sourceType: 'OFFICIAL_WEB_GUIDANCE',
    retrievedAt: RETRIEVED,
    lastReviewedAt: RETRIEVED,
  }),
  Object.freeze({
    sourceId: SRC.ARTICLES,
    title: 'Limited Liability Company Articles of Organization',
    authority: 'Wyoming Secretary of State, Business Division',
    url: 'https://sos.wyo.gov/Forms/Business/LLC/LLC-ArticlesOrganization.pdf',
    sourceType: 'OFFICIAL_FORM',
    revision: 'Articles June 2021; instructions May 2022; RAConsent December 2021',
    retrievedAt: RETRIEVED,
    lastReviewedAt: RETRIEVED,
  }),
  Object.freeze({
    sourceId: SRC.FEES,
    title: 'Business Division Filing Fee Schedule',
    authority: 'Wyoming Secretary of State, Business Division',
    url: 'https://sos.wyo.gov/Business/docs/BusinessFees.pdf',
    sourceType: 'OFFICIAL_FEE_SCHEDULE',
    revision: 'Revised June 2026',
    effectiveDate: '2026-07-01',
    retrievedAt: RETRIEVED,
    lastReviewedAt: RETRIEVED,
  }),
  Object.freeze({
    sourceId: SRC.HOWTO,
    title: 'How to Create a Wyoming Company',
    authority: 'Wyoming Secretary of State, Business Division',
    url: 'https://sos.wyo.gov/Business/Docs/HowToCreateAWyomingCompany.pdf',
    sourceType: 'OFFICIAL_INSTRUCTION',
    revision: 'Revised June 2026',
    retrievedAt: RETRIEVED,
    lastReviewedAt: RETRIEVED,
  }),
  Object.freeze({
    sourceId: SRC.RA,
    title: 'How to Find (or Become) a Registered Agent',
    authority: 'Wyoming Secretary of State, Business Division',
    url: 'https://sos.wyo.gov/Business/docs/HowToFindOrBecomeARegisteredAgent.pdf',
    sourceType: 'OFFICIAL_INSTRUCTION',
    retrievedAt: RETRIEVED,
    lastReviewedAt: RETRIEVED,
  }),
  Object.freeze({
    sourceId: SRC.NAME,
    title: 'How to Choose a Company Name',
    authority: 'Wyoming Secretary of State, Business Division',
    url: 'https://sos.wyo.gov/Business/Docs/HowToChooseACompanyName.pdf',
    sourceType: 'OFFICIAL_INSTRUCTION',
    retrievedAt: RETRIEVED,
    lastReviewedAt: RETRIEVED,
  }),
  Object.freeze({
    sourceId: SRC.NAME_TIPS,
    title: 'Searching Business Entity Names Helpful Search Tips',
    authority: 'Wyoming Secretary of State',
    url: 'https://sos.wyo.gov/Forms/WyoBiz/Name_Search_Tips.pdf',
    sourceType: 'OFFICIAL_INSTRUCTION',
    retrievedAt: RETRIEVED,
    lastReviewedAt: RETRIEVED,
  }),
  Object.freeze({
    sourceId: SRC.SEARCH,
    title: 'WyoBiz online business services',
    authority: 'Wyoming Secretary of State',
    url: 'https://wyobiz.wyo.gov/',
    sourceType: 'OFFICIAL_WEB_GUIDANCE',
    retrievedAt: RETRIEVED,
    lastReviewedAt: RETRIEVED,
  }),
  Object.freeze({
    sourceId: SRC.STATUTES,
    title: 'Business Statutes index',
    authority: 'Wyoming Secretary of State',
    url: 'https://sos.wyo.gov/Business/BusinessStatute.aspx',
    sourceType: 'OFFICIAL_WEB_GUIDANCE',
    retrievedAt: RETRIEVED,
    lastReviewedAt: RETRIEVED,
  }),
  Object.freeze({
    sourceId: SRC.LLC_ACT,
    title: 'Wyoming Limited Liability Company Act, W.S. 17-29-101 through 17-29-1105',
    authority: 'Wyoming Legislature / SOS reprint',
    url: 'https://sos.wyo.gov/Forms/WyoBiz/wyoming_limited_liability_company_act_and_close_llc_supplement.pdf',
    sourceType: 'OFFICIAL_STATUTE',
    retrievedAt: RETRIEVED,
    lastReviewedAt: RETRIEVED,
  }),
  Object.freeze({
    sourceId: SRC.RA_ACT,
    title: 'Registered Offices and Agents Act, W.S. 17-28-101 et seq.',
    authority: 'Wyoming Legislature / SOS reprint',
    url: 'https://sos.wyo.gov/Forms/WyoBiz/Registered_Offices_and_Agents_Act_Chapter_28.pdf',
    sourceType: 'OFFICIAL_STATUTE',
    retrievedAt: RETRIEVED,
    lastReviewedAt: RETRIEVED,
  }),
  Object.freeze({
    sourceId: SRC.EFFECTIVE,
    title: 'W.S. 17-16-123 Effective time and date of document (via W.S. 17-29-205(c))',
    authority: 'Wyoming Legislature / SOS reprint',
    url: 'https://sos.wyo.gov/Forms/WyoBiz/WBCA.pdf',
    sourceType: 'OFFICIAL_STATUTE',
    retrievedAt: RETRIEVED,
    lastReviewedAt: RETRIEVED,
  }),
]);

const draftBody = {
  packId: REQUIREMENT_PACK_IDS.US_WY_LLC,
  packVersion: 1,
  schemaVersion: GBS_REQUIREMENT_PACK_SCHEMA_VERSION,
  sourceSetId: 'srcset:US-WY-LLC-formation-v1',
  capabilityId: 'business_formation',
  jurisdictionId: 'j:US-WY',
  entityTypeId: 'et:US-WY:LLC',
  authorityId: 'auth:US-WY-SOS',
  activationStatus: REQUIREMENT_PACK_ACTIVATION.DRAFT,
  reviewStatus: CATALOG_REVIEW_STATUSES.DRAFT,
  packApplicableFrom: PACK_APPLICABLE_FROM_US_WY_LLC_V1,
  feeRef: 'fee:US-WY-llc-articles',
  feeAmountUsd: 100,
  delayedEffectiveDateMaxDays: DELAYED_EFFECTIVE_DATE_MAX_DAYS,
  llcNameSuffixes: WY_LLC_NAME_SUFFIXES,
  documentRequirements: [],
  hsiRequirementCount: 0,
  filingMethods: Object.freeze(['wyobiz_online', 'paper_mail']),
  sourceRefs,
  facts: Object.freeze([
    fact('proposed_entity_name', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.CUSTOMER,
      valueType: REQUIREMENT_VALUE_TYPES.STRING,
      sourceIds: [SRC.ARTICLES, SRC.LLC_ACT, SRC.NAME],
      label: 'Proposed company name',
      help: 'Must include a Wyoming LLC ending such as LLC. This is not a reservation and does not guarantee availability.',
    }),
    fact('close_llc_election', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.CUSTOMER,
      valueType: REQUIREMENT_VALUE_TYPES.BOOLEAN,
      sourceIds: [SRC.ARTICLES],
      label: 'Close limited liability company election',
      help: 'This first pack supports ordinary Wyoming LLCs only. Leave this as no.',
    }),
    fact('ra_source', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.CUSTOMER,
      valueType: REQUIREMENT_VALUE_TYPES.ENUM,
      enumValues: RA_SOURCE_VALUES,
      sourceIds: [SRC.RA, SRC.RA_ACT, SRC.ARTICLES],
      label: 'Who will be the registered agent',
      help: 'A Provider cannot be the Wyoming registered agent unless a future registered-agent capability exists.',
    }),
    fact('ra_kind', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.EITHER,
      valueType: REQUIREMENT_VALUE_TYPES.ENUM,
      enumValues: RA_KIND_VALUES,
      sourceIds: [SRC.ARTICLES, SRC.RA_ACT],
      label: 'Registered agent type',
    }),
    fact('ra_name', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.EITHER,
      valueType: REQUIREMENT_VALUE_TYPES.STRING,
      sourceIds: [SRC.ARTICLES, SRC.LLC_ACT],
      label: 'Registered agent name',
    }),
    fact('ra_registered_office_street', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.EITHER,
      valueType: REQUIREMENT_VALUE_TYPES.STRING,
      sourceIds: [SRC.ARTICLES, SRC.RA, SRC.RA_ACT],
      label: 'Registered office street address',
      help: 'Must be a physical Wyoming street address. A PO Box or drop box alone is not enough.',
    }),
    fact('ra_registered_office_city', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.EITHER,
      valueType: REQUIREMENT_VALUE_TYPES.STRING,
      sourceIds: [SRC.ARTICLES, SRC.RA_ACT],
      label: 'Registered office city',
    }),
    fact('ra_registered_office_state', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.EITHER,
      valueType: REQUIREMENT_VALUE_TYPES.STRING,
      sourceIds: [SRC.ARTICLES, SRC.RA_ACT],
      label: 'Registered office state',
      help: 'Must be WY.',
    }),
    fact('ra_registered_office_postal_code', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.EITHER,
      valueType: REQUIREMENT_VALUE_TYPES.STRING,
      sourceIds: [SRC.ARTICLES, SRC.RA_ACT],
      label: 'Registered office postal code',
    }),
    fact('mailing_address', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.CUSTOMER,
      valueType: REQUIREMENT_VALUE_TYPES.ADDRESS,
      sourceIds: [SRC.ARTICLES],
      label: 'Company mailing address',
    }),
    fact('principal_office_address', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.CUSTOMER,
      valueType: REQUIREMENT_VALUE_TYPES.ADDRESS,
      sourceIds: [SRC.ARTICLES, SRC.LLC_ACT],
      label: 'Principal office address',
    }),
    fact('entity_email', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.CUSTOMER,
      valueType: REQUIREMENT_VALUE_TYPES.EMAIL,
      sourceIds: [SRC.ARTICLES, SRC.RA_ACT],
      label: 'Company email for official notices',
      help: 'Used for the Wyoming filing, not copied automatically from your STRIDETO account.',
    }),
    fact('organizer_print_name', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.PROVIDER,
      valueType: REQUIREMENT_VALUE_TYPES.STRING,
      sourceIds: [SRC.ARTICLES, SRC.LLC_ACT],
      label: 'Organizer name for external filing preparation',
      help: 'STRIDETO does not capture the Wyoming statutory filing signature in this step.',
    }),
    fact('filing_contact_name', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.EITHER,
      valueType: REQUIREMENT_VALUE_TYPES.STRING,
      sourceIds: [SRC.ARTICLES],
      label: 'Filing contact name',
    }),
    fact('filing_contact_phone', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.EITHER,
      valueType: REQUIREMENT_VALUE_TYPES.PHONE,
      sourceIds: [SRC.ARTICLES],
      label: 'Filing contact phone',
      help: 'Use international format, for example +13075551212.',
    }),
    fact('ra_email', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.EITHER,
      valueType: REQUIREMENT_VALUE_TYPES.EMAIL,
      sourceIds: [SRC.ARTICLES, SRC.RA_ACT],
      label: 'Registered agent email',
    }),
    fact('ra_phone', {
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.EITHER,
      valueType: REQUIREMENT_VALUE_TYPES.PHONE,
      sourceIds: [SRC.ARTICLES],
      label: 'Registered agent phone',
      help: 'Use international format, for example +13075551212.',
    }),
    fact('ra_po_box_in_addition', {
      class: REQUIREMENT_FACT_CLASSES.OPTIONAL_FACT,
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.EITHER,
      valueType: REQUIREMENT_VALUE_TYPES.STRING,
      sourceIds: [SRC.ARTICLES],
      label: 'Registered agent PO Box in addition to the street address',
    }),
    fact('ra_mailing_address_if_different', {
      class: REQUIREMENT_FACT_CLASSES.OPTIONAL_FACT,
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.EITHER,
      valueType: REQUIREMENT_VALUE_TYPES.ADDRESS,
      sourceIds: [SRC.ARTICLES],
      label: 'Registered agent mailing address if different',
    }),
    fact('delayed_effective_date', {
      class: REQUIREMENT_FACT_CLASSES.OPTIONAL_FACT,
      whoSupplies: REQUIREMENT_WHO_SUPPLIES.EITHER,
      valueType: REQUIREMENT_VALUE_TYPES.DATE,
      sourceIds: [SRC.LLC_ACT, SRC.EFFECTIVE],
      label: 'Delayed effective date (optional)',
      help: 'Optional. Wyoming source rule: not later than the 90th day after filing. STRIDETO does not file.',
    }),
  ]),
  providerChecks: Object.freeze([
    check('name_distinguishability_search_performed', {
      mode: 'manual',
      sourceIds: [SRC.NAME_TIPS, SRC.SEARCH, SRC.NAME],
      label: 'Official name search performed',
      help: 'Confirms a WyoBiz search was performed. It does not guarantee the name is available or reserved.',
    }),
    check('name_suffix_compliant', {
      mode: 'derived',
      sourceIds: [SRC.ARTICLES, SRC.LLC_ACT],
      label: 'Name ending matches Wyoming LLC suffixes',
    }),
    check('restricted_name_words_reviewed', {
      mode: 'manual',
      sourceIds: [SRC.NAME],
      label: 'Restricted-name words reviewed',
      help: 'Provider confirms official restricted-term guidance was reviewed. This is not government approval.',
    }),
    check('ra_eligibility_confirmed', {
      mode: 'manual',
      sourceIds: [SRC.RA, SRC.RA_ACT, SRC.ARTICLES],
      label: 'Registered agent eligibility confirmed',
    }),
    check('ra_written_consent_obtained_and_retained', {
      mode: 'derived',
      sourceIds: [SRC.ARTICLES, SRC.LLC_ACT, SRC.RA],
      label: 'Registered agent written consent obtained and retained',
    }),
    check('organizer_identified_for_external_execution', {
      mode: 'derived',
      sourceIds: [SRC.ARTICLES, SRC.LLC_ACT],
      label: 'Organizer identified for external execution',
    }),
    check('articles_facts_complete_for_external_filing', {
      mode: 'derived',
      sourceIds: [SRC.ARTICLES, SRC.LLC_ACT],
      label: 'Articles facts complete for external filing',
    }),
    check('filing_method_selected', {
      mode: 'manual',
      sourceIds: [SRC.HOWTO, SRC.SEARCH, SRC.ARTICLES],
      label: 'External filing method selected',
      help: 'WyoBiz online or paper mail. STRIDETO does not file.',
    }),
    check('provider_not_claimed_as_wy_ra_without_capability', {
      mode: 'derived',
      sourceIds: [SRC.RA],
      label: 'Provider is not claimed as Wyoming registered agent without capability',
    }),
    check('close_llc_not_elected', {
      mode: 'derived',
      sourceIds: [SRC.ARTICLES],
      label: 'Close LLC not elected',
    }),
  ]),
  consents: Object.freeze([
    Object.freeze({
      consentKey: 'ra_written_consent',
      definitionVersion: 1,
      satisfactionMode: 'provider_attestation',
      artifactStore: 'external_filer_retention',
      waivable: false,
      sourceIds: Object.freeze([SRC.ARTICLES, SRC.LLC_ACT, SRC.RA]),
      label: 'Registered agent written consent',
    }),
  ]),
};

const sourceSnapshotHash = createHash('sha256')
  .update(catalogFingerprintCanonical(sourceSnapshotFingerprintPayload(draftBody)))
  .digest('hex');

export const US_WY_LLC_REQUIREMENT_PACK_V1 = Object.freeze({
  ...draftBody,
  sourceSnapshotHash,
});

const draftErrors = validateRequirementPackDefinition(US_WY_LLC_REQUIREMENT_PACK_V1);
if (draftErrors.length) {
  throw new Error(`us_wy_llc_pack_invalid:${draftErrors.join(',')}`);
}
if (US_WY_LLC_REQUIREMENT_PACK_V1.activationStatus !== REQUIREMENT_PACK_ACTIVATION.DRAFT
  || US_WY_LLC_REQUIREMENT_PACK_V1.reviewStatus !== CATALOG_REVIEW_STATUSES.DRAFT) {
  throw new Error('us_wy_llc_pack_must_remain_draft');
}

export { SRC as US_WY_LLC_SOURCE_IDS };
