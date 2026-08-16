/**
 * Phase 17D-9A — filing authorization + external filing source contract.
 * Run: node src/__tests__/phase17d9aSourceContract.test.js
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CONSENT_PURPOSES } from '../../../shared/platform/consentContract.js';
import {
  FILING_AUTHORIZATION_PURPOSE,
  FILING_AUTHORIZATION_STATUSES,
  FORBIDDEN_AUTHORIZATION_CREDENTIAL_KEYS,
  FORBIDDEN_AUTHORIZATION_GOVERNMENT_STATUSES,
  FORBIDDEN_SIGNATURE_KEYS,
  LEGAL_TEXT_IDS,
  LEGAL_TEXT_STATUSES,
  isGbsExternalFilingAttestationEnabled,
  isGbsFilingAuthorizationEnabled,
  isGbsWyomingFormationEnabled,
} from '../../../shared/gbs/filingAuthorizationContract.js';
import {
  PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1,
  createApprovedSyntheticLegalText,
  productionLegalTextRegistry,
  resolveEligibleLegalText,
} from '../../../shared/gbs/filingAuthorizationLegalText.js';
import { US_WY_LLC_REQUIREMENT_PACK_V1 } from '../../../shared/gbs/requirementPacks/usWyLlcV1.js';
import { REQUIREMENT_PACK_ACTIVATION } from '../../../shared/gbs/requirementPackContract.js';
import { CATALOG_REVIEW_STATUSES } from '../../../shared/gbs/catalogConstants.js';
import { FORBIDDEN_GOVERNMENT_OUTCOME_STATUSES } from '../../../shared/gbs/externalFilingContract.js';
import { isBusinessServicesPublicMarketplaceEnabled } from '../../../shared/gbs/constants.js';
import { isGbsHsiDocumentsEnabled } from '../../../shared/gbs/hsiSecurity.js';

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

check(existsSync(path.join(root, 'server/src/models/gbs/GbsCaseFilingAuthorization.js')), 'dedicated authorization model');
check(existsSync(path.join(root, 'server/src/models/gbs/GbsExternalFilingSubmission.js')), 'dedicated submission model');
check(read('server/src/models/platform/ConsentGrant.js').includes("collection: 'consent_grants'"), 'ConsentGrant file still present');
check(!Object.values(CONSENT_PURPOSES).includes(FILING_AUTHORIZATION_PURPOSE.INITIAL_FORMATION), 'ConsentGrant purposes exclude filing');
check(!read('server/src/models/platform/ConsentGrant.js').includes('case_filing_authorization'), 'ConsentGrant unchanged for filing');

const authModel = read('server/src/models/gbs/GbsCaseFilingAuthorization.js');
const subModel = read('server/src/models/gbs/GbsExternalFilingSubmission.js');
check(authModel.includes("autoIndex: false"), 'authorization autoIndex off');
check(subModel.includes("autoIndex: false"), 'submission autoIndex off');
check(authModel.includes("collection: 'gbs_case_filing_authorizations'"), 'authorization collection');
check(!/syncIndexes\(|dropIndexes\(/.test(authModel + subModel), 'no sync/drop indexes on models');
for (const key of FORBIDDEN_AUTHORIZATION_CREDENTIAL_KEYS) {
  check(!authModel.includes(key) && !subModel.includes(key), `no credential field ${key}`);
}
for (const key of FORBIDDEN_SIGNATURE_KEYS) {
  check(!authModel.includes(key) && !subModel.includes(key), `no signature field ${key}`);
}
for (const status of FORBIDDEN_AUTHORIZATION_GOVERNMENT_STATUSES) {
  check(!authModel.includes(`'${status}'`) && !subModel.includes(`'${status}'`), `no government status ${status}`);
}
for (const status of FORBIDDEN_GOVERNMENT_OUTCOME_STATUSES) {
  check(!subModel.includes(`'${status}'`), `submission omits ${status}`);
}

check(US_WY_LLC_REQUIREMENT_PACK_V1.activationStatus === REQUIREMENT_PACK_ACTIVATION.DRAFT, 'WY pack activation draft');
check(US_WY_LLC_REQUIREMENT_PACK_V1.reviewStatus === CATALOG_REVIEW_STATUSES.DRAFT, 'WY pack review draft');
check(PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1.status === LEGAL_TEXT_STATUSES.DRAFT, 'production legal text draft');
check(PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1.paragraphs.length === 0, 'no production legal wording');
check(PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1.legalTextId === LEGAL_TEXT_IDS.PRODUCTION_INITIAL_FORMATION, 'production legal text id');
check(resolveEligibleLegalText({
  capabilityId: 'business_formation',
  jurisdictionId: 'j:US-WY',
  entityTypeId: 'et:US-WY:LLC',
  purpose: FILING_AUTHORIZATION_PURPOSE.INITIAL_FORMATION,
  registry: productionLegalTextRegistry,
}) === null, 'production legal text not selectable');

const synthetic = createApprovedSyntheticLegalText();
check(synthetic.testOnly === true && synthetic.status === LEGAL_TEXT_STATUSES.APPROVED, 'synthetic approved is test-only');
check(synthetic.legalTextId === LEGAL_TEXT_IDS.TEST_ONLY_INITIAL_FORMATION, 'synthetic uses test-only id');
check(resolveEligibleLegalText({
  capabilityId: 'business_formation',
  jurisdictionId: 'j:US-WY',
  entityTypeId: 'et:US-WY:LLC',
  purpose: FILING_AUTHORIZATION_PURPOSE.INITIAL_FORMATION,
  registry: [synthetic],
})?.legalTextId === synthetic.legalTextId, 'DI can select synthetic');

check(isGbsFilingAuthorizationEnabled({}) === false, 'filing flag default OFF');
check(isGbsExternalFilingAttestationEnabled({}) === false, 'attestation flag default OFF');
check(isGbsWyomingFormationEnabled({}) === false, 'wyoming product flag default OFF');
check(isGbsFilingAuthorizationEnabled({ GBS_FILING_AUTHORIZATION_ENABLED: '1' }) === true, 'flag 1 enables only');
check(isGbsWyomingFormationEnabled({ GBS_WYOMING_FORMATION_ENABLED: '1' }) === true, 'wyoming 1 enables only');
check(isGbsWyomingFormationEnabled({ GBS_WYOMING_FORMATION_ENABLED: 'true' }) === false, 'wyoming true does not enable');
check(isBusinessServicesPublicMarketplaceEnabled({}) === false, 'marketplace still OFF');
check(isGbsHsiDocumentsEnabled({}) === false, 'HSI still OFF');

const envExample = read('.env.example');
check(/GBS_WYOMING_FORMATION_ENABLED=0/.test(envExample), 'example wyoming flag OFF');
check(/GBS_FILING_AUTHORIZATION_ENABLED=0/.test(envExample), 'example filing flag OFF');
check(/GBS_EXTERNAL_FILING_ATTESTATION_ENABLED=0/.test(envExample), 'example attestation flag OFF');
check(!/GBS_WYOMING_FORMATION_ENABLED=1/.test(envExample), 'example does not enable wyoming');
check(!/GBS_FILING_AUTHORIZATION_ENABLED=1/.test(envExample), 'example does not enable filing');
check(!/LEGAL_TEXT.*APPROVED|APPROVE_LEGAL_TEXT/.test(envExample), 'no env legal approval');

const routesBuyer = read('server/src/routes/gbsBuyer.js');
const routesAgent = read('server/src/routes/agent.js');
check(routesBuyer.includes('/filing-authorization/grant'), 'customer grant route');
check(routesBuyer.includes('/filing-authorization/revoke'), 'customer revoke route');
check(routesBuyer.includes('secureTrustedOrigin'), 'buyer mutations trusted origin');
check(routesAgent.includes('/external-filing/submit-attestation'), 'provider attest route');
check(routesAgent.includes('/filing-authorization'), 'provider read route');
check(!/registry=|legalTextRegistry|packOverride/.test(routesBuyer + routesAgent), 'no HTTP registry override');

const service = read('server/src/services/gbs/gbsFilingAuthorizationService.js');
check(service.includes('AuditLog.create'), 'fail-closed audit');
check(service.includes('findOneAndUpdate'), 'CAS');
check(service.includes('executeHighValueIdempotentCommand'), 'idempotency');
check(service.includes('claimAuthorizationForSubmission'), 'atomic claim');
check(!service.includes('logAudit('), 'authorization does not use fail-soft logAudit for grant');

const ext = read('server/src/services/gbs/gbsExternalFilingService.js');
check(ext.includes('submitted_externally'), 'attestation status');
check(!/wyobiz\.wyoming|sos\.wyo\.gov|puppeteer|playwright/i.test(ext), 'no portal automation');
check(!ext.includes('government_approved') && !ext.includes('registered'), 'no government outcome');

const provision = read('server/src/services/platform/criticalIndexProvision.js');
check(provision.includes('GBS_FILING_AUTHORIZATION_CRITICAL_INDEXES'), 'auth indexes provisioned');
check(provision.includes('GBS_EXTERNAL_FILING_CRITICAL_INDEXES'), 'submission indexes provisioned');
check(!provision.includes('syncIndexes') && !provision.includes('dropIndexes'), 'provisioner still create-only');

check(Object.values(FILING_AUTHORIZATION_STATUSES).includes('active'), 'active state');
check(Object.values(FILING_AUTHORIZATION_STATUSES).includes('claimed_for_submission'), 'claim state');
check(!Object.values(FILING_AUTHORIZATION_STATUSES).includes('approved'), 'no approved state');
check(!Object.values(FILING_AUTHORIZATION_STATUSES).includes('success'), 'no success state');

const lock = read('docs/STRIDETO_PHASE_17D_8B2C_PRE_CASE_FILING_AUTHORIZATION_DECISIONS.md');
check(/Dedicated `?CaseFilingAuthorization/.test(lock), 'lock selects dedicated model');
check(lock.includes('ConsentGrant reuse: NO') || lock.includes('ConsentGrant reuse: **NO**') || /ConsentGrant reuse:\s*NO/i.test(lock), 'lock rejects ConsentGrant reuse');
check(lock.includes('LEGAL REVIEW REQUIRED'), 'production wording unresolved');
check(lock.includes('DRAFT / NOT ACTIVE'), 'pack remains draft');
check(lock.includes('POLICY REQUIRED'), 'open policy gates recorded');

console.log(`phase17d9aSourceContract.test.js: ${count} assertions passed`);
