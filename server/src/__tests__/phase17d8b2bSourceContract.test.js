/**
 * Phase 17D-8B2B — US-WY LLC draft requirement pack source contract.
 * Run: node src/__tests__/phase17d8b2bSourceContract.test.js
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  GBS_COMMAND_IDS,
  isBusinessServicesPublicMarketplaceEnabled,
} from '../../../shared/gbs/constants.js';
import { CATALOG_REVIEW_STATUSES } from '../../../shared/gbs/catalogConstants.js';
import {
  FORBIDDEN_GOVERNMENT_STATUSES,
  FORBIDDEN_IDENTITY_KEYS,
  GBS_REQUIREMENT_PACK_SCHEMA_VERSION,
  OPTIONAL_WY_LLC_FACT_KEYS,
  PACK_APPLICABLE_FROM_US_WY_LLC_V1,
  REQUIRED_WY_LLC_FACT_KEYS,
  REQUIREMENT_PACK_ACTIVATION,
  REQUIREMENT_PACK_IDS,
  WY_LLC_NAME_SUFFIXES,
  WY_LLC_PROVIDER_CHECK_KEYS,
  createReviewedActiveClone,
  llcNameHasLockedSuffix,
  resolveRequirementPack,
  validateRequirementPackDefinition,
} from '../../../shared/gbs/requirementPackContract.js';
import { productionRequirementPackRegistry, registryWithPacks } from '../../../shared/gbs/requirementPackRegistry.js';
import { US_WY_LLC_REQUIREMENT_PACK_V1 } from '../../../shared/gbs/requirementPacks/usWyLlcV1.js';
import { productionDocumentPackForTemplate } from '../../../shared/gbs/caseDocumentContract.js';
import { isGbsHsiDocumentsEnabled } from '../../../shared/gbs/hsiSecurity.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../shared/security/gbsAuditEvents.js';

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

const pack = US_WY_LLC_REQUIREMENT_PACK_V1;
check(pack.packId === REQUIREMENT_PACK_IDS.US_WY_LLC, 'packId exact');
check(pack.packVersion === 1, 'packVersion 1');
check(pack.schemaVersion === GBS_REQUIREMENT_PACK_SCHEMA_VERSION, 'schema 17d-8b2b.0');
check(pack.sourceSetId === 'srcset:US-WY-LLC-formation-v1', 'source set exact');
check(pack.capabilityId === 'business_formation', 'capability');
check(pack.jurisdictionId === 'j:US-WY', 'jurisdiction');
check(pack.entityTypeId === 'et:US-WY:LLC', 'entity type');
check(pack.authorityId === 'auth:US-WY-SOS', 'authority');
check(pack.activationStatus === REQUIREMENT_PACK_ACTIVATION.DRAFT, 'activation draft');
check(pack.reviewStatus === CATALOG_REVIEW_STATUSES.DRAFT, 'review draft');
check(!pack.reviewedByRole && !pack.reviewedAt && !pack.approvalRef, 'no fabricated reviewer');
check(pack.packApplicableFrom === PACK_APPLICABLE_FROM_US_WY_LLC_V1, 'packApplicableFrom 2026-08-16');
check(pack.feeRef === 'fee:US-WY-llc-articles' && pack.feeAmountUsd === 100, '$100 feeRef only');
check(pack.documentRequirements.length === 0, 'zero document requirements');
check(pack.hsiRequirementCount === 0, 'zero HSI');
check(validateRequirementPackDefinition(pack).length === 0, 'draft pack validates');

const packJson = JSON.stringify(pack);
for (const key of FORBIDDEN_IDENTITY_KEYS) {
  check(!packJson.toLowerCase().includes(key.replace(/_/g, '')), `no identity ${key}`);
}
check(!/signature_image|passport|cnic|ssn/i.test(packJson), 'no identity/signature artifacts');
check(!/CaseFilingAuthorization|e-signature|articles pdf/i.test(packJson), 'no B2C/signature product');

const official = pack.sourceRefs.every((ref) => /wyo\.gov|wyobiz\.wyo\.gov/.test(ref.url));
check(official, 'official Wyoming sources only');
check(pack.sourceRefs.every((ref) => ref.retrievedAt && ref.sourceId && ref.url), 'source provenance complete');

const factKeys = pack.facts.map((row) => row.factKey);
for (const key of REQUIRED_WY_LLC_FACT_KEYS) check(factKeys.includes(key), `required fact ${key}`);
for (const key of OPTIONAL_WY_LLC_FACT_KEYS) check(factKeys.includes(key), `optional fact ${key}`);
check(!factKeys.includes('purpose') && !factKeys.includes('naics') && !factKeys.includes('member_name'), 'no extra identity/ownership fields');
const checkKeys = pack.providerChecks.map((row) => row.checkKey);
for (const key of WY_LLC_PROVIDER_CHECK_KEYS) check(checkKeys.includes(key), `check ${key}`);
const consent = pack.consents.find((row) => row.consentKey === 'ra_written_consent');
check(consent.waivable === false && consent.satisfactionMode === 'provider_attestation', 'RA consent non-waivable attestation');
check(consent.artifactStore === 'external_filer_retention', 'external filer retention');

check(llcNameHasLockedSuffix('Peak Range LLC'), 'valid suffix');
check(!llcNameHasLockedSuffix('Peak Range'), 'missing suffix');
check(WY_LLC_NAME_SUFFIXES.includes('L.L.C.'), 'locked suffix set');

const none = resolveRequirementPack({
  capabilityId: 'business_formation',
  jurisdictionId: 'j:US-WY',
  entityTypeId: 'et:US-WY:LLC',
  registry: productionRequirementPackRegistry,
});
check(none === null, 'draft production pack never selected');

const clone = createReviewedActiveClone(pack);
check(validateRequirementPackDefinition(clone).length === 0, 'active clone validates');
check(clone.reviewedByRole === 'catalog_steward' && !clone.approvalRef, 'synthetic role not a fake human name');
const activeReg = registryWithPacks([clone]);
const selected = resolveRequirementPack({
  capabilityId: 'business_formation',
  jurisdictionId: 'j:US-WY',
  entityTypeId: 'et:US-WY:LLC',
  registry: activeReg,
});
check(selected?.packId === pack.packId, 'active clone selected for WY LLC formation');
check(resolveRequirementPack({
  capabilityId: 'business_formation',
  jurisdictionId: 'j:US-DE',
  entityTypeId: 'et:US-WY:LLC',
  registry: activeReg,
}) === null, 'DE not selected');
check(resolveRequirementPack({
  capabilityId: 'business_formation',
  jurisdictionId: 'j:PK',
  entityTypeId: 'et:US-WY:LLC',
  registry: activeReg,
}) === null, 'PK not selected');
check(resolveRequirementPack({
  capabilityId: 'business_formation',
  jurisdictionId: 'j:GB',
  entityTypeId: 'et:US-WY:LLC',
  registry: activeReg,
}) === null, 'GB not selected');
check(resolveRequirementPack({
  capabilityId: 'business_formation',
  jurisdictionId: 'j:US-WY',
  entityTypeId: 'et:US-WY:CORP',
  registry: activeReg,
}) === null, 'wrong entity not selected');
check(resolveRequirementPack({
  capabilityId: 'registered_agent',
  jurisdictionId: 'j:US-WY',
  entityTypeId: 'et:US-WY:LLC',
  registry: activeReg,
}) === null, 'wrong capability not selected');

const emptyDocs = productionDocumentPackForTemplate();
check(emptyDocs.requirements.length === 0, 'document pack remains empty');
check(isGbsHsiDocumentsEnabled({}) === false, 'HSI default OFF');
check(isBusinessServicesPublicMarketplaceEnabled({}) === false, 'marketplace default OFF');

check(GBS_COMMAND_IDS.CASE_REQUIREMENT_FACT_UPDATE === 'gbs.case_requirement_fact.update', 'fact command');
check(GBS_COMMAND_IDS.CASE_REQUIREMENT_PROVIDER_CHECK_UPDATE === 'gbs.case_requirement_provider_check.update', 'check command');
check(GBS_COMMAND_IDS.CASE_RA_CONSENT_ATTEST === 'gbs.case_ra_consent.attest', 'RA attest command');
check(GBS_COMMAND_IDS.CASE_REQUIREMENT_PACK_UPGRADE === 'gbs.case_requirement_pack.upgrade', 'dormant upgrade command');
check(!Object.values(GBS_COMMAND_IDS).includes('gbs.case.submit_to_authority'), 'no submit command');

check(GBS_AUDIT_EVENTS.GBS_CASE_REQUIREMENT_PACK_ATTACHED === 'gbs_case_requirement_pack_attached', 'attach audit');
check(GBS_AUDIT_EVENTS.GBS_CASE_RA_CONSENT_ATTESTED === 'gbs_case_ra_consent_attested', 'RA audit');
const redacted = redactAuditMetadata({
  factKey: 'entity_email',
  entityEmail: 'secret@example.com',
  publicCaseRef: 'ok',
});
check(redacted.entityEmail !== 'secret@example.com' && redacted.publicCaseRef === 'ok', 'audit redacts email values');

const model = read('server/src/models/gbs/GbsCase.js');
check(model.includes('requirementPackSnapshot'), 'snapshot on Case');
check(!/submitted_to_authority|authorityReference|governmentStatus/.test(model), 'no government fields');
check(!/\bdocumentId\b/.test(model), 'no vault documentId on Case');

const service = read('server/src/services/gbs/gbsRequirementPackService.js');
check(service.includes('productionRequirementPackRegistry'), 'production registry default');
check(!/process\.env\.\w*PACK/.test(service), 'no env pack activation');
check(service.includes('client_pack_selection_rejected') || read('shared/gbs/requirementPack.js').includes('client_pack_selection_rejected'), 'client pack selection rejected');
check(service.includes('logRequiredPackAudit'), 'RA audit fail-closed');
check(!/submitted_to_authority|mark-submitted/.test(service), 'no government submission');

const buyerRoutes = read('server/src/routes/gbsBuyer.js');
const agentRoutes = read('server/src/routes/agent.js');
check(buyerRoutes.includes('requirement-facts'), 'customer fact route');
check(agentRoutes.includes('requirement-facts') && agentRoutes.includes('requirement-checks') && agentRoutes.includes('ra-consent/attest'), 'provider pack routes');
check(!agentRoutes.includes('submitted-to-authority'), 'no submit-to-authority');
check(buyerRoutes.includes('secureTrustedOrigin') && agentRoutes.includes('secureTrustedOrigin'), 'origin on mutations');
check(!/activateRequirementPack|reviewStatus=reviewed/.test(buyerRoutes + agentRoutes), 'no activation route');

const uiCustomer = read('client/src/components/gbs/CaseRequirementPackPanel.jsx');
const uiProvider = read('client/src/components/gbs/ProviderRequirementPackPanel.jsx');
check(uiCustomer.includes('Formation requirements'), 'customer formation section');
check(uiCustomer.includes('Required for STRIDETO pre-submission preparation'), 'truthful customer copy');
check(!/Guaranteed Wyoming LLC|Submit to Wyoming/i.test(uiCustomer), 'no guaranteed/submit copy');
check(!/type="file"|signature widget|signature image/i.test(uiCustomer), 'no upload/signature widget');
check(uiProvider.includes('Confirm that the registered agent\'s written consent has been obtained'), 'RA consent truthful copy');
check(uiProvider.includes('open={raOpen}'), 'RA confirmation is deliberate');
check(!/Submit to Wyoming|Mark filed|Authority reference/i.test(uiProvider), 'no government actions');

check(existsSync(path.join(root, 'shared/gbs/requirementPacks/usWyLlcV1.js')), 'source-controlled pack file');
check(read('shared/gbs/requirementPacks/usWyLlcV1.js').includes("activationStatus: REQUIREMENT_PACK_ACTIVATION.DRAFT"), 'committed pack stays draft');

for (const status of FORBIDDEN_GOVERNMENT_STATUSES) {
  check(!new RegExp(`status: '${status}'`).test(model + service), `no ${status} status`);
}

console.log(`phase17d8b2bSourceContract.test.js: ${count} assertions passed`);
