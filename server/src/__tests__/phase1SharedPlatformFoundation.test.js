/**
 * Phase 1 — Shared Platform Foundation Convergence verification pack.
 *
 * Run: node src/__tests__/phase1SharedPlatformFoundation.test.js
 */
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const loadShared = (rel) =>
  import(pathToFileURL(path.resolve(root, 'shared', rel)).href);
const loadPlatform = (rel) =>
  import(pathToFileURL(path.resolve(root, 'shared/platform', rel)).href);

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const apiState = await loadPlatform('apiStateContract.js');
const consent = await loadPlatform('consentContract.js');
const lifecycle = await loadPlatform('dataLifecycle.js');
const accountSec = await loadPlatform('accountSecurityContract.js');
const usage = await loadPlatform('usageContract.js');
const notifPolicy = await loadPlatform('notificationPreferencePolicy.js');
const orgNotif = await loadPlatform('organizationVerificationNotifications.js');
const searchPrivacy = await loadPlatform('searchPrivacyPolicy.js');
const money = await loadShared('international/money.js');
const realms = await loadShared('international/realms.js');
const notifPrefs = await loadShared('international/notificationPreferences.js');

// --- API state contract ---
check(apiState.apiStateFromHttpStatus(200) === apiState.API_STATE.SUCCESS, '200 → success');
check(apiState.apiStateFromHttpStatus(401) === apiState.API_STATE.UNAUTHENTICATED, '401 → unauthenticated');
check(apiState.apiStateFromHttpStatus(403) === apiState.API_STATE.FORBIDDEN, '403 → forbidden');
check(apiState.apiStateFromHttpStatus(404) === apiState.API_STATE.NOT_FOUND, '404 → not found');
check(apiState.apiStateFromHttpStatus(409) === apiState.API_STATE.CONFLICT, '409 → conflict');
check(apiState.apiStateFromHttpStatus(422) === apiState.API_STATE.VALIDATION_ERROR, '422 → validation');
check(apiState.apiStateFromHttpStatus(429) === apiState.API_STATE.RATE_LIMITED, '429 → rate limited');
check(apiState.apiStateFromHttpStatus(500) === apiState.API_STATE.SERVER_ERROR, '500 → server error');
check(apiState.isApiErrorState(apiState.API_STATE.FORBIDDEN), 'forbidden is error state');

// --- Consent ---
const consentOk = consent.validateConsentRecord({
  subjectId: 's1',
  counterpartyId: 'e1',
  counterpartyType: 'employer',
  purpose: consent.CONSENT_PURPOSES.EMPLOYER_APPLICATION,
  resourceScope: 'application:fields:name,email',
  grantedAt: new Date().toISOString(),
  provenance: 'student_ui',
  auditIdentity: 'req-1',
});
check(consentOk.ok, 'valid consent record');
check(
  !consent.validateConsentRecord({ purpose: 'bad' }).ok,
  'invalid consent rejected'
);
check(
  consent.isConsentActive(consentOk.value),
  'active consent'
);
check(
  !consent.isConsentActive({ ...consentOk.value, revokedAt: new Date().toISOString() }),
  'revoked consent inactive'
);

// --- Lifecycle ---
check(lifecycle.isValidLifecycleState(lifecycle.LIFECYCLE_STATES.ARCHIVED), 'archived state valid');
check(
  !lifecycle.isHardDeletionEligible({
    retentionClass: lifecycle.RETENTION_CLASSES.AUDIT,
    lifecycleState: lifecycle.LIFECYCLE_STATES.ANONYMIZED,
  }),
  'audit records not hard-deletable'
);

// --- Account security ---
const exportReq = accountSec.validateAccountPrivacyRequest({
  subjectId: 'u1',
  type: accountSec.ACCOUNT_REQUEST_TYPES.EXPORT,
});
check(exportReq.ok, 'export request valid');
check(
  accountSec.IMMUTABLE_POST_DELETION_BOUNDARIES.includes('financial_ledger'),
  'financial boundary immutable'
);

// --- Usage / quota ---
const q = usage.normalizeUsageQuota({ limit: 10, used: 3, period: 'monthly' });
check(q.remaining === 7, 'quota remaining');
check(usage.normalizeUsageQuota({}).unknown, 'unknown quota separated from zero');
check(usage.isQuotaExhausted({ limit: 5, used: 5 }), 'exhausted at limit');
check(usage.isQuotaExhausted({ limit: 5, used: 10 }), 'exhausted when over limit');

// --- Money ---
const m = money.makeMoney(100, 'USD');
check(m.amountMinor === 100 && m.currency === 'USD', 'ISO money integer minor units');
check(m.amountMinor !== 0, 'non-zero money distinct');
check(money.parseMoney(null) === null, 'unknown/invalid money != zero');
try {
  money.addMoney(m, money.makeMoney(50, 'EUR'));
  check(false, 'mixed currency should throw');
} catch {
  check(true, 'no implicit FX');
}

// --- Notification preferences ---
const mandatory = notifPolicy.evaluateNotificationDelivery({
  category: 'security',
  channel: notifPrefs.NOTIFICATION_CHANNELS.IN_APP,
  preferences: { promotions: { in_app: false } },
});
check(mandatory.deliver && mandatory.reason === 'mandatory_in_app', 'security mandatory in-app');

const optedOut = notifPolicy.evaluateNotificationDelivery({
  category: notifPrefs.NOTIFICATION_CATEGORIES.PROMOTIONS,
  channel: notifPrefs.NOTIFICATION_CHANNELS.IN_APP,
  preferences: { promotions: { in_app: false } },
});
check(!optedOut.deliver, 'promotions suppressible');

const txCoerce = notifPrefs.validateNotificationPreferences({
  applications: { in_app: false },
});
check(txCoerce.ok && txCoerce.coerced.length > 0, 'transactional category coerced on');

// --- Org verification notifications ---
const meta = orgNotif.sanitizeOrgVerificationNotificationMetadata({
  organizationId: 'o1',
  internalReason: 'secret',
  reviewerNotes: 'private',
});
check(!meta.internalReason && !meta.reviewerNotes, 'no private reason leakage');

check(
  orgNotif.orgVerificationNotificationTypeForTransition('approved') ===
    orgNotif.ORG_VERIFICATION_NOTIFICATION_TYPES.APPROVED,
  'verification transition mapping'
);

// --- Search privacy ---
check(!searchPrivacy.isSearchDomainAllowed('vault'), 'vault denied');
check(!searchPrivacy.isSearchDomainAllowed('budget'), 'budget denied');
check(!searchPrivacy.isSearchDomainAllowed('copilot_conversation'), 'copilot denied');
check(!searchPrivacy.isSearchDomainAllowed('private_message'), 'messages denied');
check(!searchPrivacy.isSearchDomainAllowed('case_private_note'), 'case notes denied');
check(!searchPrivacy.isSearchDomainAllowed('payment_secret'), 'payment secret denied');
check(searchPrivacy.isSearchDomainAllowed('job'), 'job allowed');
check(!searchPrivacy.isSearchDomainAllowed('unknown_domain_xyz'), 'unknown domain fail closed');

let threw = false;
try {
  searchPrivacy.assertSearchIndexAllowed('vault');
} catch {
  threw = true;
}
check(threw, 'assertSearchIndexAllowed throws for vault');

// --- Realms ---
check(realms.isActiveRealm(realms.ACTOR_REALMS.INSTITUTION), 'institution active realm');
check(realms.isActiveRealm(realms.ACTOR_REALMS.AGENT), 'agent active realm');

// --- Client auth contract (static) ---
const clientSrc = path.resolve(root, 'client/src');
const agentCtx = readFileSync(path.join(clientSrc, 'context/AgentAuthContext.jsx'), 'utf8');
const instCtx = readFileSync(path.join(clientSrc, 'context/InstitutionAuthContext.jsx'), 'utf8');
const agentRoute = readFileSync(path.join(clientSrc, 'components/agent/ProtectedAgentRoute.jsx'), 'utf8');
const usePerms = readFileSync(path.join(clientSrc, 'hooks/usePermissions.js'), 'utf8');

check(/isAuthenticated/.test(agentCtx), 'AgentAuthContext exposes isAuthenticated');
check(/refreshToken\(\)/.test(agentCtx), 'Agent bootstrap uses cookie refresh first');
check(/isAuthenticated/.test(instCtx), 'InstitutionAuthContext exposes isAuthenticated');
check(/isAuthenticated/.test(agentRoute), 'ProtectedAgentRoute gates on isAuthenticated');
check(/serverConfirmed/.test(usePerms), 'usePermissions requires server confirmation for SuperAdmin bypass');

// --- Design tokens ---
const semantic = await import(
  pathToFileURL(path.join(clientSrc, 'design-system/semanticTokens.js')).href
);
check(Object.keys(semantic.semanticLightCssVars).length >= 15, 'light semantic tokens');
check(Object.keys(semantic.semanticDarkCssVars).length >= 15, 'dark semantic tokens');
check(semantic.CONTRAST_SAFE_PAIRS.length >= 4, 'contrast-safe pairs defined');

console.log(`Phase 1 shared platform foundation: ${count} checks passed`);
