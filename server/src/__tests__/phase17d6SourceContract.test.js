/**
 * Phase 17D-6 — Business Client workspace + service request source contract.
 * Run: node src/__tests__/phase17d6SourceContract.test.js
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  isBusinessServicesPublicMarketplaceEnabled,
  GBS_SERVICE_REQUEST_STATUSES,
  GBS_COMMAND_IDS,
} from '../../../shared/gbs/constants.js';
import { USER_CAPABILITY_IDS } from '../../../shared/capability/userCapabilities.js';
import { PROVIDER_DOMAIN_PERMISSIONS } from '../../../shared/provider/providerDomainPermissions.js';
import { GBS_AUDIT_EVENTS } from '../../../shared/security/gbsAuditEvents.js';
import { evaluateReadyForQuoteAuthority } from '../../../shared/gbs/serviceRequestProgression.js';
import { evaluateListingPublicationGate } from '../../../shared/gbs/listingPublicationGate.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_TRUST_STATUSES } from '../../../shared/gbs/constants.js';
import { PROVIDER_DOMAIN_ENROLLMENT_STATUSES, PROVIDER_DOMAIN_IDS } from '../../../shared/provider/providerDomains.js';
import { allowlistedCreateInput } from '../../../shared/gbs/serviceRequest.js';

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

check(existsSync(path.join(root, 'server/src/models/gbs/GbsServiceRequest.js')), 'GbsServiceRequest model exists');
check(!existsSync(path.join(root, 'server/src/models/gbs/Quote.js')), 'no Quote model');
check(!existsSync(path.join(root, 'server/src/models/gbs/FormationCase.js')), 'no FormationCase model');
check(!existsSync(path.join(root, 'server/src/models/gbs/ServiceRequest.js')), 'no ServiceRequest alias model');
check(!existsSync(path.join(root, 'server/src/models/gbs/Mailroom.js')), 'no Mailroom model');
check(!existsSync(path.join(root, 'server/src/models/gbs/ClientBusiness.js')), 'no ClientBusiness model');
check(!existsSync(path.join(root, 'server/src/models/BusinessClientProfile.js')), 'no BusinessClientProfile');

const model = read('server/src/models/gbs/GbsServiceRequest.js');
check(model.includes('publicRequestRef'), 'opaque publicRequestRef');
check(model.includes('providerSubjectType') && model.includes('providerSubjectId'), 'exact provider subject fields');
check(!/quoteId|paymentIntent|formationCase|threadId|messageThread/.test(model), 'no quote/payment/case/thread fields');
check(model.includes("unique: true, sparse: true") || model.includes('creationCommandId'), 'creationCommandId indexed');

const statuses = Object.values(GBS_SERVICE_REQUEST_STATUSES);
check(statuses.includes('submitted') && statuses.includes('provider_reviewing'), 'pre-quote statuses');
check(statuses.includes('ready_for_quote') && statuses.includes('declined') && statuses.includes('cancelled'), 'handoff and terminal');
check(!statuses.includes('accepted') && !statuses.includes('needs_information'), 'no accepted/needs_information');
check(!statuses.includes('quote_sent') && !statuses.includes('paid'), 'no quote/payment statuses');

check(USER_CAPABILITY_IDS.BUSINESS_CLIENT === 'business_client', 'business_client capability id');
check(PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_REQUESTS_MANAGE === 'business_services.requests.manage', 'requests.manage duty');
check(PROVIDER_DOMAIN_PERMISSIONS.EDUCATION_CONSULTATIONS_MANAGE !== PROVIDER_DOMAIN_PERMISSIONS.BUSINESS_REQUESTS_MANAGE, 'education duty is distinct');

check(GBS_AUDIT_EVENTS.GBS_BUSINESS_CLIENT_ACTIVATED === 'gbs_business_client_activated', 'activation audit');
check(GBS_AUDIT_EVENTS.GBS_SERVICE_REQUEST_CREATED === 'gbs_service_request_created', 'create audit');
check(GBS_AUDIT_EVENTS.GBS_SERVICE_REQUEST_READY_FOR_QUOTE === 'gbs_service_request_ready_for_quote', 'ready-for-quote audit');

const auth = read('server/src/middleware/auth.js');
check(!auth.includes("realm === 'business_client'"), 'no fifth auth realm');
check(auth.includes("realm === 'employer'") && auth.includes("realm === 'agent'") && auth.includes("realm === 'institution'"), 'existing realms remain');

const staffGuard = read('server/src/middleware/requireNonStaffUser.js');
check(staffGuard.includes('isStaffRole'), 'staff guard uses isStaffRole');
check(staffGuard.includes("error: 'unavailable'"), 'staff denied without internal detail');

const capMw = read('server/src/middleware/requireUserCapability.js');
check(capMw.includes('businessClientActivateAuth') && capMw.includes('requireNonStaffUser'), 'activation is non-staff User');
check(capMw.includes('businessClientProductAuth') && capMw.includes('requireBusinessClientCapability'), 'request APIs require grant');

const buyerRoutes = read('server/src/routes/gbsBuyer.js');
check(buyerRoutes.includes("'/business/activate'"), 'activate route');
check(buyerRoutes.includes('secureTrustedOrigin'), 'buyer writes are origin-protected');
check(buyerRoutes.includes('gbsBuyerWriteLimiter'), 'buyer write limiter');
check(buyerRoutes.includes("'/business/requests/:requestRef/cancel'"), 'cancel route');
check(buyerRoutes.includes("'/business/quotes'"), 'buyer quote list exists after 17D-7');
check(!buyerRoutes.includes('/payments'), 'no payment buyer routes');

const agentRoutes = read('server/src/routes/agent.js');
check(agentRoutes.includes("'/agent/business-services/requests/:requestRef/review'"), 'explicit review route');
check(agentRoutes.includes('ready-for-quote'), 'ready-for-quote route');
check(agentRoutes.includes("'/agent/business-services/requests/:requestRef/decline'"), 'decline route');
check(!/patch\(.*business-services\/requests/.test(agentRoutes), 'no generic request PATCH');

const rate = read('server/src/middleware/rateLimit.js');
check(rate.includes('gbsBuyerWriteLimiter') && rate.includes('gbsRequestWriteLimiter'), 'buyer and request limiters');

const svc = read('server/src/services/gbs/gbsServiceRequestService.js');
check(svc.includes('evaluatePublicMarketplaceEligibility'), 'create uses live marketplace eligibility');
check(svc.includes('evaluateReadyForQuoteAuthority'), 'ready-for-quote revalidates listing');
check(svc.includes('listing.subjectType') && svc.includes('listing.subjectId'), 'provider subject copied from listing');
check(svc.includes("providerSubjectType: listing.subjectType"), 'exact listing subject stored');
check(!svc.includes('memberships[0]'), 'no memberships[0]');
check(svc.includes('createUserNotificationOnce'), 'notification dedupe');
check(svc.includes('enqueueJob'), 'email queued not sent inline');
check(svc.includes("redactAuditMetadata") && !/logAudit[\s\S]{0,200}customerSummary/.test(svc), 'customerSummary not dumped to audit');
check(svc.includes('mutateGbsServiceRequestRecord'), 'CAS mutator');
check(svc.includes('executeHighValueIdempotentCommand'), 'idempotent create');
check(GBS_COMMAND_IDS.SERVICE_REQUEST_CREATE === 'gbs.service_request.create', 'create command id');

const rejected = allowlistedCreateInput({ listingSlug: 'x', providerId: 'p1', creationCommandId: 'c', customerSummary: 's', actingFor: 'self' });
check(rejected.ok === false, 'create body rejects provider authority');

const envExample = read('.env.example');
check(/BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0/.test(envExample), 'committed marketplace default OFF');
check(isBusinessServicesPublicMarketplaceEnabled({}) === false, 'runtime default marketplace OFF');

const register = read('server/src/controllers/authController.js');
check(!/initializeCustomerUser[\s\S]{0,200}business_client/.test(register), 'registration still does not grant business_client');

const clientRoutes = read('client/src/routes/index.jsx');
check(clientRoutes.includes('ROUTES.BUSINESS'), 'Business Client uses ROUTES.BUSINESS');
check(!clientRoutes.includes("path: '/business'"), 'no literal /business path string');
check(!clientRoutes.includes('ROUTES.BUSINESS_CLIENT'), 'no BUSINESS_CLIENT constant');
check(clientRoutes.includes("pages/BusinessClient/"), 'pages live under BusinessClient');
check(!clientRoutes.includes("pages/Business/"), 'does not use pages/Business/');
check(!/business\/payments/.test(clientRoutes), 'no payment client routes');

const cta = read('client/src/pages/Public/GbsListingRequestCta.jsx');
check(cta.includes('Request Service'), 'Request Service CTA exists');
check(cta.includes('ROUTES.LOGIN'), 'anonymous CTA uses User login');
const detail = read('client/src/pages/Public/BusinessServicesListingDetail.jsx');
check(detail.includes('GbsListingRequestCta'), 'CTA only on listing detail path');
const card = read('client/src/pages/Public/GbsMarketplaceCard.jsx');
check(card.includes('View Details') && !card.includes('Request Service'), 'cards remain View Details');

const buyerUi = read('client/src/pages/BusinessClient/BusinessClientLayout.jsx');
check(buyerUi.includes('Activate Business Services'), 'explicit activation UX');
check(buyerUi.includes('Quotes'), 'Quotes nav is live after 17D-7');
check(!/Payments|Formation Cases|Messages|Documents/.test(buyerUi), 'no later-product nav');

const providerNav = read('client/src/pages/Agent/business-services/GbsWorkspaceLayout.jsx');
check(providerNav.includes("label: 'Requests'"), 'provider Business nav includes Service Requests');
const eduNav = read('client/src/config/agentNavConfig.js');
check(eduNav.includes("label: 'Consultations'"), 'education consultations remain');
check(!eduNav.split('const EDUCATION')[1].split('const BUSINESS')[0].includes('Service Requests'), 'education nav has no Service Requests');

const wy = {
  subjectType: 'agent',
  subjectId: 'subj-1',
  capabilityId: 'business_formation',
  countryCode: 'US',
  jurisdictionId: 'j:US-WY',
  entityTypeIds: ['et:US-WY:LLC'],
  scope: { countryCodes: ['US'], jurisdictionIds: ['j:US-WY'], entityTypeIds: ['et:US-WY:LLC'] },
  moderationStatus: 'approved',
  adminReviewStatus: 'approved',
};
const cap = {
  subjectType: 'agent',
  subjectId: 'subj-1',
  capabilityId: 'business_formation',
  status: GRANT_STATUSES.ACTIVE,
  trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
  scope: wy.scope,
};
const domain = {
  subjectType: 'agent',
  subjectId: 'subj-1',
  domainId: PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES,
  status: PROVIDER_DOMAIN_ENROLLMENT_STATUSES.ACTIVE,
};
const offEnv = {};
const onEnv = { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' };
const pubOff = evaluateListingPublicationGate({ env: offEnv, listing: wy, capability: cap });
check(pubOff.allowed === false, 'publication gate still requires marketplace flag by default');
const ready = evaluateReadyForQuoteAuthority({
  env: offEnv,
  listing: wy,
  capability: cap,
  domainEnrollment: domain,
  storedRequest: { providerSubjectType: 'agent', providerSubjectId: 'subj-1', capabilityId: 'business_formation' },
});
check(ready.allowed === true, 'ready-for-quote does not require marketplace flag');
const suspended = evaluateReadyForQuoteAuthority({
  env: onEnv,
  listing: { ...wy, moderationStatus: 'suspended' },
  capability: cap,
  domainEnrollment: domain,
  storedRequest: { providerSubjectType: 'agent', providerSubjectId: 'subj-1', capabilityId: 'business_formation' },
});
check(suspended.allowed === false, 'suspended listing blocks ready-for-quote');

const leak = read('shared/gbs/serviceRequest.js');
check(leak.includes('customerDisplayName'), 'provider projection has safe customer name');
check(!leak.includes('customerEmail') && !leak.includes('phoneE164'), 'no private contact fields in request projection');

const workerDocs = read('server/src/routes/gbsBuyer.js');
check(!workerDocs.includes('startWorker') && !workerDocs.includes('edurozgaar-staging-worker'), 'buyer routes do not start worker');

const dbCfg = read('server/src/config/db.js');
check(dbCfg.includes("autoIndex: process.env.MONGO_AUTO_INDEX === '1'"), 'autoIndex stays opt-in');
check(!/autoIndex:\s*true/.test(dbCfg), 'db.js does not force autoIndex true');
check(!/MONGO_AUTO_INDEX=1/.test(read('.env.example')), 'committed env example does not enable autoIndex');

const provision = read('server/src/services/platform/criticalIndexProvision.js');
check(provision.includes('provisionCriticalIdempotencyIndexes'), 'critical index provisioner exists');
check(provision.includes('gbs_service_request_creation_command_unique'), 'named command unique index');
check(provision.includes('idempotency_record_command_unique'), 'named idempotency unique index');
check(!/\.syncIndexes\s*\(/.test(provision), 'provisioner never syncIndexes');
check(!provision.includes('dropIndex') && !provision.includes('dropIndexes'), 'provisioner never drops indexes');
check(provision.includes('collection.createIndex') || provision.includes('createIndex(spec.key'), 'create-only indexes');

const boot = read('server/src/index.js');
check(boot.includes('provisionCriticalIdempotencyIndexes'), 'API startup provisions critical indexes');
check(!/\.syncIndexes\s*\(/.test(boot), 'startup does not syncIndexes');

check(model.includes("name: 'gbs_service_request_creation_command_unique'"), 'model names the command unique index');
check(model.includes("name: 'gbs_service_request_public_ref_unique'"), 'model names the public ref unique index');

check(svc.includes('isMongoDuplicateKey') || svc.includes('11000'), '11000 duplicate-key recovery exists');
check(svc.includes('serviceRequestCreateFingerprint') || svc.includes('storedCreateFingerprint'), 'fingerprint reused on recovery');
check(svc.includes('duplicate_command_conflict') || svc.includes('requesterUserId'), 'ownership checked on command collision');
check(svc.includes('recoveredDuplicate') || svc.includes('result.replay'), 'replay suppresses create side effects');

const idemModel = read('server/src/models/platform/IdempotencyRecord.js');
check(idemModel.includes("name: 'idempotency_record_command_unique'"), 'idempotency unique index is named');
check(!idemModel.includes('syncIndexes'), 'idempotency model has no syncIndexes');

console.log(`phase17d6SourceContract.test.js: ${count} assertions passed`);
