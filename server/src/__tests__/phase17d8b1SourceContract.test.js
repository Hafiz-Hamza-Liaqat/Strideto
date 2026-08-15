/**
 * Phase 17D-8B1 — GBS Case document infrastructure source contract.
 * Run: node src/__tests__/phase17d8b1SourceContract.test.js
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  GBS_COMMAND_IDS,
  isBusinessServicesPublicMarketplaceEnabled,
} from '../../../shared/gbs/constants.js';
import {
  EMPTY_DOCUMENT_PACK_ID,
  GBS_DOCUMENT_SECURITY_CODES,
  GBS_DOCUMENT_SENSITIVITY,
  productionDocumentPackForTemplate,
  testOnlyLowRiskPack,
} from '../../../shared/gbs/caseDocumentContract.js';
import {
  membershipSatisfiesDomainPermission,
  defaultPermissionsForInvite,
  PROVIDER_DOMAIN_PERMISSIONS,
  permissionRequiresExplicitAssignment,
} from '../../../shared/provider/providerDomainPermissions.js';
import { PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { AGENT_MEMBER_ROLES } from '../../../shared/agent/constants.js';
import { GBS_AUDIT_EVENTS, redactAuditMetadata } from '../../../shared/security/gbsAuditEvents.js';
import { evaluateCaseFilingReadiness } from '../../../shared/gbs/caseDocumentReadiness.js';

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

check(existsSync(path.join(root, 'server/src/models/vault/VaultDocument.js')), 'Vault reused');
check(existsSync(path.join(root, 'server/src/models/gbs/GbsCaseDocumentRequirement.js')), 'requirement model');
check(existsSync(path.join(root, 'server/src/models/gbs/GbsCaseDocumentGrant.js')), 'GBS grant model');
check(!existsSync(path.join(root, 'server/src/services/gbs/gbsBlobStore.js')), 'no second blob store');

const storage = read('server/src/services/vault/vaultStorageService.js');
check(storage.includes("keyNamespace === 'gbs_case'"), 'opaque GBS key namespace');
check(storage.includes('gbs-cases/'), 'gbs-cases prefix');
check(!storage.includes('gbs-cases/${String(userId)}'), 'GBS keys do not embed userId');

const reqModel = read('server/src/models/gbs/GbsCaseDocumentRequirement.js');
check(reqModel.includes('caseId'), 'requirement binds Case');
check(reqModel.includes('requirementKey'), 'requirement key separate from vault');
check(!/passport|cnic|national_identity/.test(reqModel), 'no HSI types on requirement model');

const caseModel = read('server/src/models/gbs/GbsCase.js');
check(caseModel.includes('documentPackId'), 'pack snapshot on Case');
check(!/\bdocumentId\b/.test(caseModel), 'GbsCase does not store vault documentId');
check(!/submitted_to_authority|authorityReference/.test(caseModel), 'no government fields');

const pack = productionDocumentPackForTemplate();
check(pack.packId === EMPTY_DOCUMENT_PACK_ID && pack.requirements.length === 0, 'production pack empty');
check(pack.consentRequired === false, 'production consent not required');
const testPack = testOnlyLowRiskPack();
check(testPack.testOnly === true, 'test pack marked test-only');
check(!/passport|CNIC|proof of address/i.test(JSON.stringify(testPack)), 'test pack is not legal identity');

check(GBS_COMMAND_IDS.CASE_DOCUMENT_COMPLETE_UPLOAD === 'gbs.case_document.complete_upload', 'complete command');
check(GBS_COMMAND_IDS.CASE_DOCUMENT_REVIEW === 'gbs.case_document.review', 'review command');
check(GBS_COMMAND_IDS.CASE_DOCUMENT_WAIVE === 'gbs.case_document.waive', 'waive command');
check(!Object.values(GBS_COMMAND_IDS).includes('gbs.case.submit_to_authority'), 'no submit command');

check(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASE_DOCUMENTS_MANAGE === 'business_services.case_documents.manage', 'document duty');
check(permissionRequiresExplicitAssignment(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASE_DOCUMENTS_MANAGE), 'document duty is explicit-assignment');
check(!permissionRequiresExplicitAssignment(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE), 'cases.manage remains operational');

const ownerDefaults = defaultPermissionsForInvite({
  domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  role: AGENT_MEMBER_ROLES.OWNER,
});
check(ownerDefaults.includes(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE), 'owner still gets cases.manage');
check(!ownerDefaults.includes(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASE_DOCUMENTS_MANAGE), 'owner does not inherit document duty');
const adminDefaults = defaultPermissionsForInvite({
  domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  role: AGENT_MEMBER_ROLES.ADMIN,
});
check(!adminDefaults.includes(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASE_DOCUMENTS_MANAGE), 'admin does not inherit document duty');

const ownerNoDuty = membershipSatisfiesDomainPermission(
  { role: AGENT_MEMBER_ROLES.OWNER, domainAccess: [{ domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES, permissions: ownerDefaults }] },
  PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASE_DOCUMENTS_MANAGE
);
check(ownerNoDuty === false, 'Owner without stored document duty is denied');
const ownerWithDuty = membershipSatisfiesDomainPermission(
  {
    role: AGENT_MEMBER_ROLES.OWNER,
    domainAccess: [{
      domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
      permissions: [...ownerDefaults, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASE_DOCUMENTS_MANAGE, PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW],
    }],
  },
  PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASE_DOCUMENTS_MANAGE
);
check(ownerWithDuty === true, 'Owner with explicit document duty is allowed');

check(GBS_DOCUMENT_SECURITY_CODES.NOT_CONFIGURED === 'case_document_security_not_configured', 'scanner unavailable code');
check(GBS_DOCUMENT_SECURITY_CODES.HSI_NOT_CONFIGURED === 'hsi_documents_not_configured', 'HSI deny code');
check(GBS_DOCUMENT_SENSITIVITY.HSI === 'highly_sensitive_identity', 'HSI class named');

const scan = read('server/src/services/gbs/gbsDocumentScanService.js');
check(scan.includes("mode: 'not_configured'"), 'scanner default not_configured');
check(scan.includes('gbs_test_scanner_forbidden'), 'test scanner forbidden in production');
check(!scan.includes('VirusTotal') && !scan.includes('ClamAV'), 'no vendor scanner');

const svc = read('server/src/services/gbs/gbsCaseDocumentService.js');
check(svc.includes("scanStatus === 'clean'") || svc.includes("scanStatus: 'clean'"), 'provider requires clean');
check(svc.includes('vaultUploadFile'), 'reuses vault upload');
check(svc.includes("keyNamespace: 'gbs_case'"), 'GBS opaque keys');
check(!/verificationStatus:\s*'verified'/.test(svc), 'does not mutate vault identity verification');
check(!/submitted_to_authority|government API|stripe|Mailroom|My Businesses/.test(svc), 'no later products');
check(svc.includes('evaluateCaseFilingReadiness'), 'readiness evaluator used');

const buyerRoutes = read('server/src/routes/gbsBuyer.js');
check(buyerRoutes.includes('document-requirements'), 'customer document routes');
check(buyerRoutes.includes('secureTrustedOrigin'), 'origin on buyer mutations');
check(buyerRoutes.includes('gbsCaseDocumentUploadLimiter'), 'upload limiter');
check(!buyerRoutes.includes("'/vault/"), 'buyer routes do not attach vault router');

const agentRoutes = read('server/src/routes/agent.js');
check(agentRoutes.includes('document-requirements'), 'provider document routes');
check(agentRoutes.includes('gbsCaseDocumentWriteLimiter'), 'document write limiter');
check(agentRoutes.includes('secureTrustedOrigin'), 'origin on agent mutations');
check(!/vaultRouter/.test(agentRoutes), 'agent routes do not mount vault router');

const vaultRoutes = read('server/src/routes/vault.js');
check(!vaultRoutes.includes('gbs') && !vaultRoutes.includes('business-services'), 'student vault not extended for GBS');
check(!vaultRoutes.includes('secureTrustedOrigin'), 'student vault remains origin-less');

check(GBS_AUDIT_EVENTS.GBS_CASE_DOCUMENT_REVIEWED === 'gbs_case_document_reviewed', 'review audit');
check(!Object.values(GBS_AUDIT_EVENTS).includes('gbs_case_filing_consent_granted'), 'no consent events');
check(!Object.values(GBS_AUDIT_EVENTS).includes('gbs_case_submitted_to_authority'), 'no submit audit');

const provision = read('server/src/services/platform/criticalIndexProvision.js');
check(provision.includes('GBS_CASE_DOCUMENT_REQUIREMENT_CRITICAL_INDEXES'), 'requirement indexes');
check(provision.includes('gbs_case_doc_req_public_ref_unique'), 'requirement public ref unique');
check(!provision.includes('syncIndexes'), 'no syncIndexes');

check(isBusinessServicesPublicMarketplaceEnabled({}) === false, 'marketplace default OFF');

const buyerUi = read('client/src/pages/BusinessClient/BusinessClientCaseDetail.jsx');
check(buyerUi.includes('Required documents'), 'customer required documents heading');
check(buyerUi.includes('Secure document upload is not available'), 'truthful unavailable copy');
check(!/Identity verified|Government verified|KYC passed|Submitted to authority|Virus-free|KMS/i.test(buyerUi), 'no misleading customer claims');

const providerUi = read('client/src/pages/Agent/business-services/GbsCaseDetail.jsx');
check(providerUi.includes('Document security scanning is not configured'), 'provider scanner copy');
check(providerUi.includes('explicit case documents duty'), 'duty copy');
check(!/Identity verified|Government verified|KYC passed|Upload documents|submitted-to-authority/i.test(providerUi), 'no misleading provider claims');

const teamUi = read('client/src/pages/Agent/AgentTeam.jsx');
check(teamUi.includes('never granted by owner or admin role alone'), 'team copy for explicit duty');
check(teamUi.includes('grantCaseDocuments'), 'optional explicit duty checkbox');

check(!read('client/src/routes/index.jsx').includes('AdminDocument'), 'no admin document console');
check(!/CaseFilingAuthorization|e-sign|electronic signature/i.test(svc), 'no consent/e-sign implementation');

const emptyReady = evaluateCaseFilingReadiness({
  status: 'in_progress',
  requiredCustomerTasksComplete: true,
  professionalAuthorityAllowed: true,
  consentRequired: false,
  consentSatisfied: false,
  requirements: [],
});
check(emptyReady.ready === true, 'empty pack can be ready');
const consentBlocked = evaluateCaseFilingReadiness({
  status: 'in_progress',
  requiredCustomerTasksComplete: true,
  professionalAuthorityAllowed: true,
  consentRequired: true,
  consentSatisfied: false,
  requirements: [],
});
check(consentBlocked.ready === false && consentBlocked.reasons.includes('filing_consent_pending'), 'consentRequired fails closed');
const nonemptyBlocked = evaluateCaseFilingReadiness({
  status: 'in_progress',
  requiredCustomerTasksComplete: true,
  professionalAuthorityAllowed: true,
  consentRequired: false,
  consentSatisfied: false,
  requirements: [{ required: true, status: 'awaiting_upload', scanStatus: 'not_configured' }],
});
check(nonemptyBlocked.ready === false && nonemptyBlocked.reasons.includes('document_required'), 'unsatisfied requirement fails closed');

const redacted = redactAuditMetadata({
  storageKey: 'gbs-cases/secret',
  signedUrl: 'https://example.invalid/x',
  originalFilename: 'note.pdf',
  displayName: 'Amina Buyer',
  publicCaseRef: 'ok-ref',
  requirementKey: 'test_low_risk_operational_note',
});
check(redacted.storageKey === undefined && redacted.signedUrl === undefined, 'audit drops storage secrets');
check(redacted.originalFilename === undefined && redacted.displayName === undefined, 'audit drops filename/displayName');
check(redacted.publicCaseRef === 'ok-ref' && redacted.requirementKey === 'test_low_risk_operational_note', 'safe audit keys remain');

console.log(`phase17d8b1SourceContract.test.js: ${count} assertions passed`);
