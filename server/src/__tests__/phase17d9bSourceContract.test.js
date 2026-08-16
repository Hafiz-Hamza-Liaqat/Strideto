/**
 * Phase 17D-9B — controlled Wyoming rollout gates; pack/legal remain unapproved.
 * Run: node src/__tests__/phase17d9bSourceContract.test.js
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  isGbsExternalFilingAttestationEnabled,
  isGbsFilingAuthorizationEnabled,
  isGbsWyomingFormationEnabled,
} from '../../../shared/gbs/filingAuthorizationContract.js';
import {
  PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1,
  createApprovedSyntheticLegalText,
  isGrantedLegalTextEffectiveForFutureUse,
  productionLegalTextRegistry,
  resolveEligibleLegalText,
} from '../../../shared/gbs/filingAuthorizationLegalText.js';
import { catalogFingerprintCanonical } from '../../../shared/gbs/catalogFingerprint.js';
import {
  LEGAL_TEXT_STATUSES,
  FILING_AUTHORIZATION_PURPOSE,
} from '../../../shared/gbs/filingAuthorizationContract.js';
import { CATALOG_REVIEW_STATUSES } from '../../../shared/gbs/catalogConstants.js';
import {
  REQUIREMENT_PACK_ACTIVATION,
  sourceSnapshotFingerprintPayload,
} from '../../../shared/gbs/requirementPackContract.js';
import { US_WY_LLC_REQUIREMENT_PACK_V1 } from '../../../shared/gbs/requirementPacks/usWyLlcV1.js';
import { isGbsHsiDocumentsEnabled } from '../../../shared/gbs/hsiSecurity.js';
import { isBusinessServicesPublicMarketplaceEnabled } from '../../../shared/gbs/constants.js';

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
check(pack.activationStatus === REQUIREMENT_PACK_ACTIVATION.DRAFT, 'production pack activation still draft');
check(pack.reviewStatus === CATALOG_REVIEW_STATUSES.DRAFT, 'production pack review still draft');
check(!pack.reviewedByRole && !pack.reviewedAt && !pack.approvalRef, 'no fabricated pack reviewer');
check(pack.feeAmountUsd === 100, '$100 ordinary Articles fee unchanged');
check(pack.sourceRefs.some((ref) => ref.sourceId.includes('fees') && ref.revision === 'Revised June 2026'), 'fee schedule revision locked');
check(pack.sourceRefs.some((ref) => ref.url.includes('LLC-ArticlesOrganization.pdf') && /June 2021/.test(ref.revision)), 'Articles form revision locked');
check(pack.documentRequirements.length === 0, 'zero Wyoming documents');
check(pack.hsiRequirementCount === 0, 'zero Wyoming HSI');

const recomputed = createHash('sha256')
  .update(catalogFingerprintCanonical(sourceSnapshotFingerprintPayload(pack)))
  .digest('hex');
check(recomputed === pack.sourceSnapshotHash, 'sourceSnapshotHash deterministic');
check(recomputed === createHash('sha256')
  .update(catalogFingerprintCanonical(sourceSnapshotFingerprintPayload(pack)))
  .digest('hex'), 'hash recomputes identically');

check(PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1.status === LEGAL_TEXT_STATUSES.DRAFT, 'production legal text draft');
check(PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1.paragraphs.length === 0, 'no AI-authored production wording');
check(PRODUCTION_FILING_AUTHORIZATION_LEGAL_TEXT_V1.reviewedBy == null, 'no fake legal reviewer');
check(resolveEligibleLegalText({
  capabilityId: 'business_formation',
  jurisdictionId: 'j:US-WY',
  entityTypeId: 'et:US-WY:LLC',
  purpose: FILING_AUTHORIZATION_PURPOSE.INITIAL_FORMATION,
  registry: productionLegalTextRegistry,
}) === null, 'draft production text cannot grant');

const synthetic = createApprovedSyntheticLegalText();
check(isGrantedLegalTextEffectiveForFutureUse(synthetic, [synthetic]) === true, 'approved synthetic effective for future use');
const withdrawn = { ...synthetic, status: LEGAL_TEXT_STATUSES.WITHDRAWN };
check(isGrantedLegalTextEffectiveForFutureUse(synthetic, [withdrawn]) === false, 'withdrawn text not effective');
const superseded = { ...synthetic, status: LEGAL_TEXT_STATUSES.SUPERSEDED };
check(isGrantedLegalTextEffectiveForFutureUse(synthetic, [superseded]) === false, 'superseded text not effective');
check(isGrantedLegalTextEffectiveForFutureUse(synthetic, []) === false, 'missing registry row not effective');

check(isGbsWyomingFormationEnabled({}) === false, 'wyoming flag default OFF');
check(isGbsFilingAuthorizationEnabled({}) === false, 'filing flag default OFF');
check(isGbsExternalFilingAttestationEnabled({}) === false, 'attestation flag default OFF');
check(isGbsWyomingFormationEnabled({ GBS_WYOMING_FORMATION_ENABLED: '1' }) === true, 'wyoming === 1 only');
check(isGbsWyomingFormationEnabled({ GBS_WYOMING_FORMATION_ENABLED: 'true' }) === false, 'wyoming true is OFF');
check(isBusinessServicesPublicMarketplaceEnabled({}) === false, 'marketplace OFF');
check(isGbsHsiDocumentsEnabled({}) === false, 'HSI OFF');

for (const rel of ['.env.example', '.env.template', '.env.production.example']) {
  const src = read(rel);
  check(/GBS_WYOMING_FORMATION_ENABLED=0/.test(src), `${rel} wyoming OFF`);
  check(/GBS_FILING_AUTHORIZATION_ENABLED=0/.test(src), `${rel} filing OFF`);
  check(/GBS_EXTERNAL_FILING_ATTESTATION_ENABLED=0/.test(src), `${rel} attestation OFF`);
  check(!/GBS_WYOMING_FORMATION_ENABLED=1/.test(src), `${rel} does not enable wyoming`);
  check(!/APPROVE_LEGAL_TEXT|LEGAL_TEXT_STATUS=approved/.test(src), `${rel} cannot approve legal text`);
}

const packService = read('server/src/services/gbs/gbsRequirementPackService.js');
check(packService.includes('runtimeMayAttachRequirementPack'), 'runtime attach gate exists');
check(packService.includes('isGbsWyomingFormationEnabled'), 'attach uses wyoming kill switch');
check(!/syncIndexes|dropIndexes/.test(packService), 'pack service no index destruction');

const authService = read('server/src/services/gbs/gbsFilingAuthorizationService.js');
check(authService.includes('isGbsWyomingFormationEnabled'), 'availability uses wyoming gate');
check(authService.includes('isGrantedLegalTextEffectiveForFutureUse'), 'claim checks legal-text future use');
check(authService.includes('expiresAt: null'), 'v1 grant has no calendar expiry');
check(!/ttl|expiresAt:\s*new Date/.test(authService), 'no invented calendar expiry');
check(!authService.includes('isGbsWyomingFormationEnabled') || authService.includes('revokeCustomerFilingAuthorization'), 'revoke remains');
const revokeFn = authService.slice(authService.indexOf('export async function revokeCustomerFilingAuthorization'));
check(!revokeFn.slice(0, 1800).includes('isGbsFilingAuthorizationEnabled'), 'revoke does not require filing flag');
check(!revokeFn.slice(0, 1800).includes('isGbsWyomingFormationEnabled'), 'revoke does not require wyoming flag');

const ext = read('server/src/services/gbs/gbsExternalFilingService.js');
check(ext.includes('isGbsWyomingFormationEnabled'), 'attestation uses wyoming gate');
check(!/wyobiz\.wyo\.gov\/api|puppeteer|playwright|sos\.wyo\.gov\/Business\/Filing/i.test(ext), 'no government submission client');
check(!ext.includes('government_approved') && !ext.includes('company_formed'), 'no government outcome states');

const routesBuyer = read('server/src/routes/gbsBuyer.js');
const routesAgent = read('server/src/routes/agent.js');
check(!/GBS_WYOMING_FORMATION_ENABLED|enableWyoming|X-Test-Mode/.test(routesBuyer + routesAgent), 'no request-field feature enablement');
check(!/activatePack|approveLegalText|registry=/.test(routesBuyer + routesAgent), 'no HTTP activation backdoor');

const panel = read('client/src/components/gbs/CaseFilingAuthorizationPanel.jsx');
const providerPanel = read('client/src/components/gbs/ProviderFilingAuthorizationPanel.jsx');
check(!/Resubmit|Retry filing|Submit to Wyoming/i.test(panel + providerPanel), 'no resubmit UI');
check(!panel.includes('dangerouslySetInnerHTML') && !providerPanel.includes('dangerouslySetInnerHTML'), 'no unsafe HTML');

const lock = read('docs/STRIDETO_PHASE_17D_8B2C_PRE_CASE_FILING_AUTHORIZATION_DECISIONS.md');
check(lock.includes('LEGAL REVIEW REQUIRED'), 'signing/legal sufficiency still legal review');
check(lock.includes('POLICY REQUIRED'), 'retention still policy required');

console.log(`phase17d9bSourceContract.test.js: ${count} assertions passed`);
