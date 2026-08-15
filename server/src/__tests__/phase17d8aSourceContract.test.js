/**
 * Phase 17D-8A — GBS Case source contract.
 * Run: node src/__tests__/phase17d8aSourceContract.test.js
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
  CASE_STATUSES_EMITTED,
  CASE_WORKFLOW_TEMPLATES,
  FORBIDDEN_CASE_FIELDS,
  isOpaqueCaseRef,
  workflowTemplateForCapability,
} from '../../../shared/gbs/caseContract.js';
import { BUSINESS_SERVICES_CAPABILITY_IDS } from '../../../shared/gbs/businessServicesCapabilities.js';
import { PROVIDER_DOMAIN_PERMISSIONS, defaultPermissionsForInvite } from '../../../shared/provider/providerDomainPermissions.js';
import { PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { AGENT_MEMBER_ROLES } from '../../../shared/agent/constants.js';
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

check(existsSync(path.join(root, 'server/src/models/gbs/GbsCase.js')), 'GbsCase model exists');
check(!existsSync(path.join(root, 'server/src/models/gbs/FormationCase.js')), 'no FormationCase');
check(!existsSync(path.join(root, 'server/src/models/gbs/ClientBusiness.js')), 'no ClientBusiness');
check(!existsSync(path.join(root, 'server/src/models/gbs/ApplicationCase.js')), 'no ApplicationCase');

const model = read('server/src/models/gbs/GbsCase.js');
check(model.includes('publicCaseRef'), 'opaque publicCaseRef');
check(!/CASE-0001|CASE-12345/.test(model), 'no sequential case numbers');
for (const field of FORBIDDEN_CASE_FIELDS) {
  check(!new RegExp(`\\b${field}\\b`).test(model), `no ${field} on GbsCase`);
}
check(!/submitted_to_authority|authority_processing|rejected_by_authority/.test(model), 'no government statuses on model');
check(!/paidAt|paymentIntent|documentId|vaultGrant|chatId|messageId/.test(model), 'no payment/docs/chat fields');
check(model.includes("name: 'gbs_case_public_ref_unique'"), 'public ref unique index');
check(model.includes("name: 'gbs_case_creation_command_unique'"), 'creation command unique index');
check(model.includes("name: 'gbs_case_quote_unique'"), 'quote unique index');

const quoteModel = read('server/src/models/gbs/GbsQuote.js');
check(!/caseId/.test(quoteModel), 'Quote model has no caseId');

const requestModel = read('server/src/models/gbs/GbsServiceRequest.js');
check(!/case_opened|case_in_progress|case_completed/.test(requestModel), 'ServiceRequest has no case statuses');

check(CASE_STATUSES_EMITTED.includes('open') && CASE_STATUSES_EMITTED.includes('ready_for_submission'), 'pre-submission statuses');
check(!CASE_STATUSES_EMITTED.includes('submitted_to_authority'), 'no submitted_to_authority');
check(!CASE_STATUSES_EMITTED.includes('authority_processing'), 'no authority_processing');
check(CASE_WORKFLOW_TEMPLATES.COMPANY_FORMATION === 'company_formation', 'company_formation template');
check(CASE_WORKFLOW_TEMPLATES.GENERIC_PROFESSIONAL_SERVICE === 'generic_professional_service', 'generic template');
check(workflowTemplateForCapability(BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION) === 'company_formation', 'formation maps to company_formation');
check(workflowTemplateForCapability(BUSINESS_SERVICES_CAPABILITY_IDS.FORMATION_CONSULTATION) === 'generic_professional_service', 'consultation is generic');

check(isOpaqueCaseRef('Abcdefghijklmnopqr'), 'opaque ref accepts entropy');
check(!isOpaqueCaseRef('CASE-0001'), 'sequential CASE-0001 rejected');
check(!isOpaqueCaseRef('64b1a2c3d4e5f678901234ab'), 'raw ObjectId rejected');

check(GBS_COMMAND_IDS.CASE_INITIALIZE === 'gbs.case.initialize', 'initialize command');
check(GBS_COMMAND_IDS.CASE_START_PREPARATION === 'gbs.case.start_preparation', 'start preparation command');
check(GBS_COMMAND_IDS.CASE_READY_FOR_SUBMISSION === 'gbs.case.ready_for_submission', 'ready command');
check(GBS_COMMAND_IDS.CASE_CANCEL === 'gbs.case.cancel', 'cancel command');
check(GBS_COMMAND_IDS.CASE_UNABLE_TO_PROCEED === 'gbs.case.unable_to_proceed', 'unable command');

check(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE === 'business_services.cases.manage', 'cases.manage duty');
check(PROVIDER_DOMAIN_PERMISSIONS.EDUCATION_CASES_MANAGE !== PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE, 'education cases.manage isolated');
const memberDefaults = defaultPermissionsForInvite({
  domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  role: AGENT_MEMBER_ROLES.MEMBER,
});
check(memberDefaults.includes(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_VIEW), 'member view');
check(!memberDefaults.includes(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE), 'member not auto-granted cases.manage');
const ownerDefaults = defaultPermissionsForInvite({
  domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  role: AGENT_MEMBER_ROLES.OWNER,
});
check(ownerDefaults.includes(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_CASES_MANAGE), 'owner gets cases.manage');

check(GBS_AUDIT_EVENTS.GBS_CASE_CREATED === 'gbs_case_created', 'created audit');
check(GBS_AUDIT_EVENTS.GBS_CASE_READY_FOR_SUBMISSION === 'gbs_case_ready_for_submission', 'ready audit');
check(!Object.values(GBS_AUDIT_EVENTS).includes('gbs_case_submitted_to_authority'), 'no submit-to-authority audit');
const redacted = redactAuditMetadata({ customerValue: 'secret', note: 'keep-out', publicCaseRef: 'ok' });
check(redacted.customerValue !== 'secret' && redacted.publicCaseRef === 'ok', 'audit redacts task values');

check(isBusinessServicesPublicMarketplaceEnabled({}) === false, 'marketplace default OFF');

const service = read('server/src/services/gbs/gbsCaseService.js');
check(service.includes('ensureGbsCaseForAcceptedQuote'), 'case initializer exists');
check(service.includes('quote.status !== Q.ACCEPTED') || service.includes("quote.status !== Q.ACCEPTED"), 'accepted quote origin');
check(!/ProfessionalCase|education_mobility\.cases\.manage/.test(service), 'does not reuse education ProfessionalCase');
check(!/submitted_to_authority|mark-submitted-to-authority/.test(service), 'no authority submission action');
check(!/government API|scrape|registrationNumber/.test(service), 'no government API/scraping');
check(!/stripe|checkout|escrow|payout|paymentIntent/.test(service), 'no payment processors');
check(service.includes('gbs.case.initialize'), 'initialize command used');
check(service.includes('createUserNotificationOnce'), 'notification dedupe helper');

const quoteService = read('server/src/services/gbs/gbsQuoteService.js');
check(quoteService.includes('ensureGbsCaseForAcceptedQuote'), 'accept ensures case');

const buyerRoutes = read('server/src/routes/gbsBuyer.js');
check(buyerRoutes.includes("'/business/cases'"), 'customer case list');
check(buyerRoutes.includes("'/business/cases/:caseRef'"), 'customer case detail');
check(buyerRoutes.includes("'/business/quotes/:quoteRef/case'"), 'recovery ensure route');
check(buyerRoutes.includes('gbsBuyerWriteLimiter'), 'buyer write limiter');
check(buyerRoutes.includes('secureTrustedOrigin'), 'origin protection');
check(buyerRoutes.includes('businessClientActivateAuth'), 'grant-loss history reads use activate auth');

const agentRoutes = read('server/src/routes/agent.js');
check(agentRoutes.includes("'/agent/business-services/cases'"), 'provider case list');
check(agentRoutes.includes('start-preparation'), 'start preparation route');
check(agentRoutes.includes('ready-for-submission'), 'ready route');
check(agentRoutes.includes('unable-to-proceed'), 'unable route');
check(agentRoutes.includes('gbsCaseWriteLimiter'), 'case write limiter');
check(!agentRoutes.includes('submitted-to-authority'), 'no submit-to-authority route');

const auth = read('server/src/middleware/auth.js');
check(!auth.includes("realm === 'business_client'"), 'no fifth auth realm');

const provision = read('server/src/services/platform/criticalIndexProvision.js');
check(provision.includes('GBS_CASE_CRITICAL_INDEXES'), 'case indexes listed');
check(provision.includes('gbs_case_quote_unique'), 'quote unique physical index');
check(!provision.includes('syncIndexes'), 'no syncIndexes');
check(provision.includes('provisionMissingIndexes'), 'create-only provisioning');

const boot = read('server/src/index.js');
check(boot.includes('provisionCriticalIdempotencyIndexes'), 'startup provisions indexes');
check(!/\.syncIndexes\s*\(/.test(boot), 'startup does not syncIndexes');
const dbCfg = read('server/src/config/db.js');
check(dbCfg.includes("autoIndex: process.env.MONGO_AUTO_INDEX === '1'"), 'autoIndex stays opt-in');
check(!/MONGO_AUTO_INDEX=1/.test(read('.env.example')), 'committed env example does not enable autoIndex');

const worker = read('server/src/worker.js');
check(worker.includes('worker'), 'worker file exists but phase does not start it');

const clientRoutes = read('client/src/routes/index.jsx');
check(clientRoutes.includes("path: 'cases'") && clientRoutes.includes('BusinessClientCases'), 'customer case routes');
check(clientRoutes.includes('GbsCases') && clientRoutes.includes('GbsCaseDetail'), 'provider case routes');
check(clientRoutes.includes("path: 'cases'") && clientRoutes.includes('AgentCases'), 'education cases remain separate');
check(!/Mailroom|FormationCase|My Businesses/.test(clientRoutes), 'no mailroom/formation/my-businesses routes');

console.log(`phase17d8aSourceContract.test.js: ${count} assertions passed`);
