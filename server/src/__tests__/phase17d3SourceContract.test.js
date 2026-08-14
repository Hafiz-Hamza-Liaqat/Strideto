/**
 * Phase 17D-3 — source-contract: Agent-private GBS provider workspace.
 * Run: node src/__tests__/phase17d3SourceContract.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isBusinessServicesEnabled } from '../../../shared/gbs/constants.js';
import { GBS_AUDIT_EVENTS } from '../../../shared/security/gbsAuditEvents.js';

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

check(isBusinessServicesEnabled({}) === false, 'Business Services default OFF');
check(isBusinessServicesEnabled({ BUSINESS_SERVICES_ENABLED: '1' }) === true, 'explicit 1 enables');

const agentRoutes = read('server/src/routes/agent.js');
check(agentRoutes.includes("requireBusinessServicesEnabled"), 'GBS writes/reads require feature flag');
check(agentRoutes.includes("'/agent/business-services/enabled'"), 'enabled probe exists');
check(
  /business-services\/enabled', requireAuth, requireAgentAuth, gbsProvider.getEnabled/.test(agentRoutes),
  'enabled probe is Agent-auth but not feature-gated so UI can hide nav'
);
check(agentRoutes.includes('gbsCapabilityWriteLimiter'), 'capability write limiter');
check(agentRoutes.includes('gbsListingWriteLimiter'), 'listing write limiter');
check(agentRoutes.includes('gbsProviderReadLimiter'), 'provider read limiter');
check(!agentRoutes.includes("'/business-services'"), 'no public business-services mount on agent router');
check(!/approveListing|publishListing|verifyCapability/.test(agentRoutes), 'no provider approve/publish/verify routes');

const indexRoutes = read('server/src/routes/index.js');
check(!/business-services/.test(indexRoutes) || !/public.*business-services/.test(indexRoutes), 'index does not add a public GBS marketplace');

const auth = read('server/src/middleware/auth.js');
check(!/formation-provider|registered-agent-cookie|universal.?auth.?token/i.test(auth), 'no fifth auth realm/cookie');
check(auth.includes('requireAgentAuth'), 'Agent realm reused');
check(/if \(!req\.agent\)/.test(auth), 'requireAgentAuth rejects missing Agent principal');

const controller = read('server/src/controllers/gbsProviderController.js');
check(!/trustStatus:\s*['"]verified['"]/.test(controller), 'controller does not accept client verified');
check(controller.includes('assertAuthorizedProviderSubject'), 'every subject op re-validates');

const claim = read('server/src/services/gbs/providerCapabilityClaimService.js');
check(claim.includes('FORBIDDEN_CLAIM_FIELDS'), 'forbidden trust fields stripped');
check(claim.includes("trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED"), 'claim starts CLAIMED not VERIFIED');

const listing = read('server/src/services/gbs/serviceListingService.js');
check(listing.includes('authorizeGbsProviderAction'), 'listing create/update/submit uses GBS authority');
check(listing.includes('GBS_LISTING_PUBLICATION_STATUSES.PRIVATE'), 'publication stays private');
check(listing.includes('creationCommandId'), 'domain create command id');
check(listing.includes('mutateGbsServiceListingRecord'), 'listing CAS');

const summary = read('server/src/services/gbs/providerWorkspaceSummaryService.js');
check(!/service requests|quotes awaiting|mail received|revenue|payouts/i.test(summary), 'no fake request/quote/case/revenue counters');
check(summary.includes('subjectType, subjectId: sid'), 'counters scoped to exact subject');

const subject = read('server/src/services/gbs/providerSubjectContext.js');
check(!/memberships\[0\]/.test(subject), 'does not collapse memberships to [0]');
check(subject.includes('ORGANIZATION_TYPES.AGENCY'), 'agency subject requires agency org type');
check(subject.includes('active: true'), 'inactive membership excluded');
check(subject.includes('PROVIDER_SUBJECT_CONTEXT_DENIED'), 'denied subject is audited');

const requiredEvents = [
  'PROVIDER_SUBJECT_CONTEXT_DENIED',
  'PROVIDER_CAPABILITY_CLAIM_CREATED',
  'PROVIDER_CAPABILITY_SCOPE_UPDATED',
  'PROVIDER_CAPABILITY_EVIDENCE_SUBMITTED',
  'GBS_LISTING_DRAFT_CREATED',
  'GBS_LISTING_UPDATED',
  'GBS_LISTING_MATERIAL_CHANGE',
  'GBS_LISTING_SUBMITTED_REVIEW',
  'GBS_LISTING_ARCHIVED',
  'GBS_LISTING_SCOPE_DENIED',
  'GBS_LISTING_RISK_FLAGGED',
  'GBS_LISTING_IDEMPOTENCY_REPLAY',
  'GBS_LISTING_IDEMPOTENCY_CONFLICT',
];
for (const ev of requiredEvents) {
  check(Boolean(GBS_AUDIT_EVENTS[ev]), `audit catalog includes ${ev}`);
}

const storedUrl = read('shared/gbs/storedReferenceUrl.js');
check(storedUrl.includes('Never fetch') || storedUrl.includes('store-only') || storedUrl.includes('Store-only'), 'URL store-only');
check(!/fetch\(/.test(storedUrl), 'no fetch of provider URLs');

const clientRoutes = read('client/src/routes/index.jsx');
check(clientRoutes.includes("path: 'business-services'"), 'Agent portal has business-services routes');
check(!/path: '\/business-services'|path: \"\/business-services\"/.test(clientRoutes), 'no public /business-services route');
check(!/path: '\/business'|ROUTES\.BUSINESS_CLIENT/.test(clientRoutes), 'no Business Client /business workspace');
check(clientRoutes.includes('GbsWorkspaceLayout'), 'GBS uses Agent nested layout');
check(clientRoutes.includes('ProtectedAgentRoute'), 'GBS remains inside ProtectedAgentRoute');

const nav = read('client/src/config/agentNavConfig.js');
check(nav.includes("label: 'Business Services'"), 'one Business Services nav entry');
check(nav.includes('gbsEnabled'), 'nav is feature-gated');
check(!/Requests|Quotes|Mailroom|Payouts/.test(nav.split('Business Services')[1]?.slice(0, 200) || ''), 'no fake GBS modules in nav');

const layout = read('client/src/pages/Agent/business-services/GbsWorkspaceLayout.jsx');
check(layout.includes('Overview') && layout.includes('Capabilities') && layout.includes('Jurisdictions') && layout.includes('Service Listings'), 'subnav IA');
check(!/Requests|Quotes|Formation Case|Mailroom|Payouts/.test(layout), 'no fake provider modules');
check(layout.includes('SearchableSelect'), 'subject switcher uses SearchableSelect');

const overview = read('client/src/pages/Agent/business-services/GbsOverview.jsx');
check(overview.includes('getOverview') && overview.includes('gbsProviderApi'), 'overview uses server counters');
check(!/3 new requests|quotes awaiting/i.test(overview), 'no fake dashboard copy');

console.log(`phase17d3SourceContract.test.js: ${count} assertions passed`);
