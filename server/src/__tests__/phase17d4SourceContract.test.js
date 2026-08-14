/**
 * Phase 17D-4 — Admin GBS moderation + listing publication gate source contract.
 * Run: node src/__tests__/phase17d4SourceContract.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  isBusinessServicesProviderEnabled,
  isBusinessServicesPublicMarketplaceEnabled,
  GBS_PUBLIC_MARKETPLACE_FEATURE_FLAG,
} from '../../../shared/gbs/constants.js';
import {
  evaluateListingPublicationGate,
  LISTING_PUBLICATION_DENY_REASONS,
} from '../../../shared/gbs/listingPublicationGate.js';
import { GBS_AUDIT_EVENTS, isKnownGbsAuditEvent } from '../../../shared/security/gbsAuditEvents.js';
import { ACTION_POLICY, POLICY_ACTIONS } from '../../../shared/capability/permissionPolicy.js';
import { GRANT_STATUSES } from '../../../shared/capability/grantStatus.js';
import { PROVIDER_TRUST_STATUSES } from '../../../shared/gbs/constants.js';
import { BUSINESS_SERVICES_CAPABILITY_IDS } from '../../../shared/gbs/businessServicesCapabilities.js';
import { parseAdminGbsReviewBody, parseEvidenceIndex, parseStaffEvidenceReviewAction } from '../services/gbs/gbsAdminModerationValidation.js';
import { PERMISSIONS, hasPermission } from '../config/rbac.js';

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

check(isBusinessServicesPublicMarketplaceEnabled({}) === false, 'marketplace default OFF');
check(isBusinessServicesProviderEnabled({}) === false, 'provider workspace default OFF');
check(
  isBusinessServicesProviderEnabled({ BUSINESS_SERVICES_ENABLED: '1' }) === true &&
    isBusinessServicesPublicMarketplaceEnabled({ BUSINESS_SERVICES_ENABLED: '1' }) === false,
  'legacy enablement does not turn marketplace on'
);
check(GBS_PUBLIC_MARKETPLACE_FEATURE_FLAG === 'BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED', 'marketplace flag name');

const envExample = read('.env.example');
check(!/BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=1/.test(envExample), 'env example does not enable marketplace');
check(/BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED=0/.test(envExample), 'marketplace documented OFF');

const adminRoutes = read('server/src/routes/admin.js');
check(adminRoutes.includes("adminRouter.use(requireAuth, requireStaff"), 'admin GBS inherits staff auth');
check(adminRoutes.includes('adminWriteLimiter'), 'admin writes are rate limited');
check(adminRoutes.includes("adminRouter.use('/gbs', adminGbsRouter)"), 'GBS router mounted under /admin/gbs');

const gbsRoutes = read('server/src/routes/adminGbs.js');
check(gbsRoutes.includes("'/capabilities/queue'"), 'capability queue route');
check(gbsRoutes.includes("'/listings/queue'"), 'listing queue route');
check(gbsRoutes.includes("requirePermission(PERMISSIONS.VERIFICATION_READ)"), 'reads use verification:read');
check(gbsRoutes.includes("requirePermission(PERMISSIONS.VERIFICATION_APPROVE)"), 'approve uses verification:approve');
check(gbsRoutes.includes("'/capabilities/:id/evidence/:evidenceIndex/accept'"), 'evidence accept route');
check(gbsRoutes.includes("'/capabilities/:id/evidence/:evidenceIndex/needs-information'"), 'evidence needs-information route');
check(gbsRoutes.includes("'/capabilities/:id/evidence/:evidenceIndex/reject'"), 'evidence reject route');
check(gbsRoutes.includes('ctrl.reviewCapabilityEvidence'), 'explicit evidence review handler');
check(!/adminRouter\.(patch|put)\(/.test(gbsRoutes) && !gbsRoutes.includes('app.patch'), 'no mass-assignment PATCH');

const agentRoutes = read('server/src/routes/agent.js');
check(!/capabilities\/:id\/verify|listings\/:id\/approve|evidence\/:evidenceIndex\/accept/.test(agentRoutes), 'provider cannot self-review via Agent routes');
check(!agentRoutes.includes("'/business-services'"), 'no public business-services on agent router');

const indexRoutes = read('server/src/routes/index.js');
check(!/public.*business-services|business-services.*public/.test(indexRoutes), 'no public GBS marketplace mount');

const clientRoutes = read('client/src/routes/index.jsx');
check(clientRoutes.includes("path: 'gbs/capabilities'"), 'admin capability queue UI route');
check(clientRoutes.includes("path: 'gbs/listings'"), 'admin listing queue UI route');
check(!clientRoutes.includes("path: '/business-services'"), 'no public /business-services path');
check(!clientRoutes.includes("pages/Business/"), 'Business Client /business not implemented');

const auth = read('server/src/middleware/auth.js');
check(!/formation-provider|gbs-buyer-cookie|fifth.?auth/i.test(auth), 'no fifth auth realm/cookie');

const listingSvc = read('server/src/services/gbs/serviceListingService.js');
check(listingSvc.includes('adminReviewStatus: GBS_LISTING_ADMIN_REVIEW_STATUSES.PENDING'), 'provider create/submit resets admin review');
check(!/publicationStatus:\s*GBS_LISTING_PUBLICATION_STATUSES\.PUBLIC/.test(listingSvc), 'provider listing service never sets public');

const cas = read('server/src/services/platform/optimisticConcurrency.js');
check(cas.includes("delete $set.publicationStatus"), 'CAS never persists publicationStatus');
check(cas.includes("adminReviewStatus !== 'pending'"), 'non-staff cannot set non-pending adminReviewStatus');

const gateSrc = read('shared/gbs/listingPublicationGate.js');
check(gateSrc.includes('isBusinessServicesPublicMarketplaceEnabled'), 'publication gate uses marketplace flag');
check(!/isBusinessServicesEnabled\(env\)/.test(gateSrc), 'publication gate does not use legacy enablement for public eligibility');

const claim = read('server/src/services/gbs/providerCapabilityClaimService.js');
check(claim.includes("'trustStatus'"), 'provider claim strips trustStatus');
check(claim.includes("'reviewedBy'"), 'provider claim strips reviewedBy');

check(ACTION_POLICY[POLICY_ACTIONS.ADMIN_GBS_LISTING_REVIEW].realm === 'staff', 'listing review is staff realm');
check(ACTION_POLICY[POLICY_ACTIONS.ADMIN_PROVIDER_VERIFICATION].requireStaffRbac === true, 'capability review remains staff RBAC');

for (const ev of [
  'PROVIDER_CAPABILITY_REVIEWED',
  'PROVIDER_CAPABILITY_EVIDENCE_REVIEWED',
  'PROVIDER_CAPABILITY_EVIDENCE_ACCEPTED',
  'PROVIDER_CAPABILITY_EVIDENCE_REJECTED',
  'PROVIDER_CAPABILITY_VERIFIED',
  'PROVIDER_CAPABILITY_NEEDS_INFORMATION',
  'PROVIDER_CAPABILITY_REJECTED',
  'PROVIDER_CAPABILITY_SUSPENDED',
  'GBS_LISTING_REVIEWED',
  'GBS_LISTING_APPROVED',
  'GBS_LISTING_NEEDS_INFORMATION',
  'GBS_LISTING_REJECTED',
  'GBS_LISTING_SUSPENDED',
]) {
  check(isKnownGbsAuditEvent(GBS_AUDIT_EVENTS[ev]), `audit catalog includes ${ev}`);
}

check(!hasPermission('Editor', PERMISSIONS.VERIFICATION_APPROVE), 'Editor cannot approve GBS reviews');
check(!hasPermission('Moderator', PERMISSIONS.VERIFICATION_APPROVE), 'Moderator cannot approve');
check(hasPermission('Admin', PERMISSIONS.VERIFICATION_APPROVE), 'Admin can approve');
check(!hasPermission('Admin', PERMISSIONS.VERIFICATION_REVOKE), 'Admin cannot revoke');
check(hasPermission('SuperAdmin', PERMISSIONS.VERIFICATION_REVOKE), 'SuperAdmin can revoke');

try {
  parseAdminGbsReviewBody({ expectedVersion: 1, subjectType: 'agent', subjectId: 'x', extra: true }, { action: 'approve' });
  check(false, 'unknown fields must be rejected');
} catch (err) {
  check(err.code === 'unknown_fields', 'unknown review body fields rejected');
}
try {
  parseAdminGbsReviewBody({ expectedVersion: 1, subjectType: 'agent', subjectId: 'x', decision: 'accepted' }, { action: 'accept' });
  check(false, 'body decision field must be rejected');
} catch (err) {
  check(err.code === 'unknown_fields', 'evidence decision is not a free-form body field');
}
try {
  parseStaffEvidenceReviewAction('rubber_stamp');
  check(false, 'unknown evidence action must be rejected');
} catch (err) {
  check(err.code === 'unknown_evidence_decision', 'unknown evidence action rejected');
}
check(parseStaffEvidenceReviewAction('accept') === 'accepted', 'accept maps to accepted');
try {
  parseEvidenceIndex('nope');
  check(false, 'non-numeric evidence index must be rejected');
} catch (err) {
  check(err.code === 'invalid_evidence_index', 'invalid evidence index rejected');
}

const evidenceProj = read('shared/gbs/providerEvidence.js');
check(evidenceProj.includes('hasVaultRef: Boolean(evidence.vaultRef)'), 'safe projection never returns vault contents');
check(!/notes: evidence\.notes|officialRegistryUrl: evidence/.test(evidenceProj), 'safe projection omits notes and registry URL bodies');
check(evidenceProj.includes("PENDING: 'pending'") && evidenceProj.includes("ACCEPTED: 'accepted'"), 'evidence decisions include pending and accepted');

const wip = [
  'client/src/components/admin/AdminDataTable.jsx',
  'client/src/components/admin/AdminTableFilters.jsx',
  'client/src/components/common/FormField.jsx',
];
const gbsPages = [
  read('client/src/pages/Admin/AdminGbsCapabilityQueue.jsx'),
  read('client/src/pages/Admin/AdminGbsCapabilityReview.jsx'),
  read('client/src/pages/Admin/AdminGbsListingQueue.jsx'),
  read('client/src/pages/Admin/AdminGbsListingReview.jsx'),
  read('client/src/components/admin/AdminGbsQueueTable.jsx'),
].join('\n');
check(!/import \{ AdminDataTable \}/.test(gbsPages), 'GBS UI does not import AdminDataTable');
check(!/import \{ AdminTableFilters \}/.test(gbsPages), 'GBS UI does not import AdminTableFilters');
check(!gbsPages.includes('common/FormField'), 'GBS UI does not import FormField');
for (const file of wip) {
  check(read(file).length > 0, `protected WIP still present: ${file}`);
}

const outOfScope = [
  'server/src/models/gbs/ServiceRequest',
  'server/src/models/gbs/Quote',
  'server/src/models/gbs/FormationCase',
  'server/src/models/gbs/Mailroom',
];
for (const rel of outOfScope) {
  check(!gbsRoutes.includes(rel) && !adminRoutes.includes(rel), `no ${rel} wiring`);
}

const verified = {
  subjectType: 'agent',
  subjectId: 'agent-A',
  capabilityId: BUSINESS_SERVICES_CAPABILITY_IDS.BUSINESS_FORMATION,
  status: GRANT_STATUSES.ACTIVE,
  trustStatus: PROVIDER_TRUST_STATUSES.VERIFIED,
  scope: {
    countryCodes: ['US'],
    jurisdictionIds: ['j:US-WY'],
    entityTypeIds: ['et:US-WY:LLC'],
  },
};
const listing = {
  ...verified,
  adminReviewStatus: 'approved',
  moderationStatus: 'approved',
  publicationStatus: 'private',
};

check(
  evaluateListingPublicationGate({ env: {}, listing, capability: verified }).reason ===
    LISTING_PUBLICATION_DENY_REASONS.MARKETPLACE_DISABLED,
  'admin not relevant while marketplace OFF → DENY'
);
check(
  evaluateListingPublicationGate({
    env: {},
    listing,
    capability: verified,
  }).allowed === false,
  'approved + marketplace OFF → DENY'
);
check(
  evaluateListingPublicationGate({
    env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' },
    listing,
    capability: { ...verified, trustStatus: PROVIDER_TRUST_STATUSES.CLAIMED },
  }).allowed === false,
  'marketplace ON + invalid capability → DENY'
);
check(
  evaluateListingPublicationGate({
    env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' },
    listing: { ...listing, scope: { ...listing.scope, jurisdictionIds: ['j:US-DE'] }, jurisdictionId: 'j:US-DE' },
    capability: verified,
  }).allowed === false,
  'marketplace ON + scope exceeds capability → DENY'
);
check(
  evaluateListingPublicationGate({
    env: { BUSINESS_SERVICES_PUBLIC_MARKETPLACE_ENABLED: '1' },
    listing,
    capability: verified,
  }).allowed === true,
  'marketplace ON + valid capability/scope + admin approved → ELIGIBLE (not a public route)'
);
check(
  evaluateListingPublicationGate({
    env: { BUSINESS_SERVICES_ENABLED: '1' },
    listing,
    capability: verified,
  }).reason === LISTING_PUBLICATION_DENY_REASONS.MARKETPLACE_DISABLED,
  'legacy BUSINESS_SERVICES_ENABLED cannot expose public listings'
);

console.log(`phase17d4SourceContract.test.js: ${count} assertions passed`);
