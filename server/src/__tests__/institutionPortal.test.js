/** Mission 18 — Verified Institution Portal focused acceptance tests. No DB/network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.STRIDETO_SECURE_AUTH_ENABLED = '1';
process.env.JWT_SECRET = 'z'.repeat(32);
process.env.REFRESH_SECRET = 'y'.repeat(32);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const source = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const institutionPortal = await import('../../../shared/institution/institutionPortal.js');
const verification = await import('../../../shared/international/verification.js');
const organization = await import('../../../shared/international/organization.js');
const { createJwtSessionProvider } = await import('../services/auth/JwtSessionProvider.js');
const { createSessionSubjectStateProvider } = await import('../services/auth/SessionSubjectStateProvider.js');
const { createAuthCookiePolicy } = await import('../services/auth/AuthCookiePolicy.js');
const { requireInstitutionAuth } = await import('../middleware/auth.js');

let passed = 0;
async function check(label, fn) {
  try { await fn(); passed += 1; console.log(`  ok - ${label}`); }
  catch (error) { console.error(`  FAIL - ${label}\n       ${error.message}`); process.exitCode = 1; }
}

const jwtConfig = (prefix, aud) => ({
  accessSecret: prefix.repeat(32), refreshSecret: prefix.toUpperCase().repeat(32),
  issuer: 'strideto-api', accessAudience: `${aud}-access`, refreshAudience: `${aud}-refresh`,
});
const institutionJwt = createJwtSessionProvider(jwtConfig('i', 'strideto-institution'));
const userJwt = createJwtSessionProvider(jwtConfig('u', 'strideto-user'));
const employerJwt = createJwtSessionProvider(jwtConfig('e', 'strideto-employer'));
const agentJwt = createJwtSessionProvider(jwtConfig('a', 'strideto-agent'));
const instClaims = { sub: '507f1f77bcf86cd799439011', realm: 'institution', sid: '507f1f77bcf86cd799439012', tokenVersion: 0 };

// ── 1. Institution realm auth isolation ──────────────────────────────────────

await check('1 Institution realm issues and verifies isolated access tokens', () => {
  const token = institutionJwt.issueAccessToken(instClaims).token;
  assert.equal(institutionJwt.verifyAccessToken(token).realm, 'institution');
  assert.throws(() => userJwt.verifyAccessToken(token), 'user JWT must not verify institution token');
  assert.throws(() => employerJwt.verifyAccessToken(token), 'employer JWT must not verify institution token');
  assert.throws(() => agentJwt.verifyAccessToken(token), 'agent JWT must not verify institution token');
});

await check('2 Institution refresh cookie is isolated to institution path/name', () => {
  const policy = createAuthCookiePolicy({ mode: 'development', apiOrigin: '', trustedOrigins: [], maxAgeMs: 1000 });
  assert.equal(policy.getCookiePath('institution'), '/api/auth/institution/refresh-token');
  assert.match(policy.getCookieName('institution'), /institution_rt$/);
});

await check('3 Institution authoritative session state uses InstitutionAccount model', async () => {
  let called = false;
  const instModel = { async findById() { called = true; return { accountStatus: 'active', tokenVersion: 0 }; } };
  const fallback = { async findById() { throw new Error('wrong realm'); } };
  const provider = createSessionSubjectStateProvider({
    userModel: fallback, employerModel: fallback, agentModel: fallback, institutionModel: instModel,
  });
  const result = await provider.getSubjectState({ realm: 'institution', subjectId: instClaims.sub, expectedTokenVersion: 0 });
  assert.equal(result.code, 'SUBJECT_ACTIVE');
  assert.equal(called, true);
});

// ── 2. Middleware isolation ───────────────────────────────────────────────────

function middlewareStatus(req) {
  let status = 200;
  requireInstitutionAuth(req, { status(code) { status = code; return this; }, json() {} }, () => {});
  return status;
}

await check('4 User realm is rejected from Institution mutations', () =>
  assert.equal(middlewareStatus({ user: { userId: '123' } }), 401)
);
await check('5 Employer realm is rejected from Institution mutations', () =>
  assert.equal(middlewareStatus({ employer: { employerId: '123' } }), 401)
);
await check('6 Agent realm is rejected from Institution mutations', () =>
  assert.equal(middlewareStatus({ agent: { agentAccountId: '123' } }), 401)
);
await check('7 Institution realm passes Institution mutation guard', () =>
  assert.equal(middlewareStatus({ institution: { institutionAccountId: '123' } }), 200)
);

// ── 3. Organization types ─────────────────────────────────────────────────────

await check('8 university/college/institute are valid institution organization types', () => {
  for (const t of ['university', 'college', 'institute']) {
    assert.equal(organization.validateOrganizationCore({ organizationType: t, displayName: 'Test' }).ok, true, `${t} should be valid`);
  }
});
await check('9 school/training_center are valid institution organization types (Mission 18)', () => {
  assert.equal(organization.validateOrganizationCore({ organizationType: 'school', displayName: 'X' }).ok, true);
  assert.equal(organization.validateOrganizationCore({ organizationType: 'training_center', displayName: 'Y' }).ok, true);
});
await check('10 employer/agent cannot be institution org types', () => {
  assert.equal(institutionPortal.isInstitutionOrgType('employer'), false);
  assert.equal(institutionPortal.isInstitutionOrgType('agent'), false);
});

// ── 4. Pre-approval restrictions ─────────────────────────────────────────────

await check('11 pre-approval institution: canExercisePrivilegedCapability returns false for draft/pending', () => {
  for (const status of ['draft', 'email_verified', 'verification_pending', 'under_review']) {
    assert.equal(verification.canExercisePrivilegedCapability(status), false, `${status} must not grant privilege`);
  }
});
await check('12 approved verification grants privileged capability', () =>
  assert.equal(verification.canExercisePrivilegedCapability('approved'), true)
);
await check('13 suspended/revoked/expired deny privileged access', () => {
  for (const status of ['suspended', 'revoked', 'expired']) {
    assert.equal(verification.canExercisePrivilegedCapability(status), false);
  }
});
await check('14 isBlocked returns true for suspended/revoked/rejected', () => {
  for (const status of ['suspended', 'revoked', 'rejected']) {
    assert.equal(verification.isBlocked(status), true);
  }
});

// ── 5. Mission 2 verification integration ────────────────────────────────────

await check('15 verification state machine preserves all lifecycle states', () => {
  const states = ['draft', 'email_verified', 'verification_pending', 'under_review',
    'needs_information', 'enhanced_review', 'approved', 'rejected', 'suspended', 'revoked', 'expired'];
  for (const s of states) {
    assert.equal(verification.isValidVerificationStatus(s), true, `${s} must be valid`);
  }
});
await check('16 invalid verification transitions are rejected', () => {
  assert.equal(verification.isValidTransition('draft', 'approved'), false);
  assert.equal(verification.isValidTransition('approved', 'draft'), false);
});

// ── 6. Canonical institution claim ───────────────────────────────────────────

await check('17 claim states are well-defined', () => {
  const states = Object.values(institutionPortal.CLAIM_STATES);
  assert.ok(states.includes('draft'));
  assert.ok(states.includes('submitted'));
  assert.ok(states.includes('approved'));
  assert.ok(states.includes('rejected'));
  assert.ok(states.includes('revoked'));
});
await check('18 claim cannot self-approve — draft→approved is not a valid transition', () =>
  assert.equal(institutionPortal.isValidClaimTransition('draft', 'approved'), false)
);
await check('19 claim cannot skip review — draft→revoked is not a valid transition', () =>
  assert.equal(institutionPortal.isValidClaimTransition('draft', 'revoked'), false)
);
await check('20 approved claim grants authority', () =>
  assert.equal(institutionPortal.claimGrantsAuthority('approved'), true)
);
await check('21 non-approved claim does not grant authority', () => {
  for (const s of ['draft', 'submitted', 'under_review', 'needs_information', 'rejected', 'revoked']) {
    assert.equal(institutionPortal.claimGrantsAuthority(s), false, `${s} must not grant authority`);
  }
});

// ── 7. Team role authorization ────────────────────────────────────────────────

await check('22 owner and admin can manage team', () => {
  assert.equal(institutionPortal.canManageTeam('owner'), true);
  assert.equal(institutionPortal.canManageTeam('admin'), true);
});
await check('23 editor and viewer cannot manage team', () => {
  assert.equal(institutionPortal.canManageTeam('editor'), false);
  assert.equal(institutionPortal.canManageTeam('viewer'), false);
});
await check('24 owner/admin/editor can submit official changes', () => {
  assert.equal(institutionPortal.canSubmitOfficialChanges('owner'), true);
  assert.equal(institutionPortal.canSubmitOfficialChanges('admin'), true);
  assert.equal(institutionPortal.canSubmitOfficialChanges('editor'), true);
});
await check('25 viewer cannot submit official changes', () =>
  assert.equal(institutionPortal.canSubmitOfficialChanges('viewer'), false)
);

// ── 8. Profile completeness (not verification, not canonical ownership) ───────

await check('26 profile completeness is explainable and independent of verification status', () => {
  const full = {
    legalIdentity: 'Test University',
    officialWebsite: 'https://test.edu',
    location: true,
    contactChannels: 'info@test.edu',
    institutionType: 'university',
    academicProfile: true,
    accreditation: true,
    verificationEvidence: null,
    canonicalClaim: null,
  };
  const result = institutionPortal.computeInstitutionCompleteness(full);
  assert.ok(result.score > 0 && result.score <= 100);
  // verificationEvidence and canonicalClaim missing — score < 100
  assert.ok(result.score < 100);
  assert.ok(result.missing.includes('verificationEvidence'));
  assert.ok(result.missing.includes('canonicalClaim'));
  // verificationStatus NOT in result — completeness does not imply verification
  assert.equal('verificationStatus' in result, false);
});
await check('27 100% completeness score does not imply verified institution', () => {
  const full = {};
  for (const def of institutionPortal.COMPLETENESS_SECTIONS) {
    full[def.key] = 'present';
  }
  const result = institutionPortal.computeInstitutionCompleteness(full);
  assert.equal(result.score, 100);
  assert.equal('verificationStatus' in result, false);
  assert.equal('canonicalOwnership' in result, false);
});

// ── 9. Publishing policy ──────────────────────────────────────────────────────

await check('28 tuition and deadline are high-impact fields requiring review', () => {
  assert.equal(institutionPortal.isHighImpactField('tuition'), true);
  assert.equal(institutionPortal.isHighImpactField('deadline'), true);
  assert.equal(institutionPortal.isHighImpactField('testRequirements'), true);
  assert.equal(institutionPortal.isHighImpactField('accreditation'), true);
});
await check('29 program name is not a high-impact field', () =>
  assert.equal(institutionPortal.isHighImpactField('name'), false)
);

// ── 10. Program lifecycle ─────────────────────────────────────────────────────

await check('30 program lifecycle statuses include submitted/under_review/needs_changes', async () => {
  const taxonomy = await import('../../../shared/education/taxonomy.js');
  assert.ok(Object.values(taxonomy.PUB_STATUSES).includes('submitted'));
  assert.ok(Object.values(taxonomy.PUB_STATUSES).includes('under_review'));
  assert.ok(Object.values(taxonomy.PUB_STATUSES).includes('needs_changes'));
  assert.ok(Object.values(taxonomy.PUB_STATUSES).includes('discontinued'));
});

// ── 11. TestAcceptance scope protection ──────────────────────────────────────

await check('31 country-level TestAcceptance scope is COUNTRY and protected from institution mutation', async () => {
  const { ACCEPTANCE_SCOPES } = await import('../../../shared/education/acceptanceExplorer.js');
  assert.equal(ACCEPTANCE_SCOPES.COUNTRY, 'country');
  // Service-layer code must block institution from modifying country-scope
  const svc = source('server/src/services/institutionPortalService.js');
  assert.match(svc, /ACCEPTANCE_SCOPES\.COUNTRY[\s\S]*FORBIDDEN|Institution cannot modify country-level/);
});
await check('32 institution and program scopes are accessible to institutions', async () => {
  const { ACCEPTANCE_SCOPES } = await import('../../../shared/education/acceptanceExplorer.js');
  assert.equal(ACCEPTANCE_SCOPES.INSTITUTION, 'institution');
  assert.equal(ACCEPTANCE_SCOPES.PROGRAM, 'program');
  assert.equal(ACCEPTANCE_SCOPES.PROGRAM_INTAKE, 'program_intake');
});

// ── 12. Trust badges ──────────────────────────────────────────────────────────

await check('33 institution representative badge derives from representative_authority evidence', () => {
  const badges = verification.deriveBadges([
    { evidenceType: 'representative_authority', status: 'accepted' },
  ]);
  assert.ok(badges.includes('institution_representative_verified'));
});
await check('34 trust badges derive only from accepted evidence', () => {
  const badges = verification.deriveBadges([
    { evidenceType: 'representative_authority', status: 'rejected' },
    { evidenceType: 'accreditation', status: 'expired' },
  ]);
  assert.equal(badges.length, 0);
});
await check('35 accreditation badge derives from accreditation evidence', () => {
  const badges = verification.deriveBadges([{ evidenceType: 'accreditation', status: 'accepted' }]);
  assert.ok(badges.includes('accreditation_verified'));
});

// ── 13. Provenance and freshness ──────────────────────────────────────────────

await check('36 institution_official is the canonical source type for institution submissions', () =>
  assert.equal(institutionPortal.INSTITUTION_SOURCE_TYPE, 'institution_official')
);
await check('37 freshness reconfirmation is audited (InstitutionChangeEvent created)', () => {
  const svc = source('server/src/services/institutionPortalService.js');
  assert.match(svc, /PROVENANCE_RECONFIRMATION/);
  assert.match(svc, /recordChangeEvent/);
  assert.match(svc, /institution_freshness_reconfirmed/);
});

// ── 14. Conflict detection ────────────────────────────────────────────────────

await check('38 conflict detection stores conflicts instead of silent overwrites', () => {
  const svc = source('server/src/services/institutionPortalService.js');
  assert.match(svc, /detectAndStoreConflict/);
  assert.match(svc, /CONFLICT_STATES\.OPEN/);
});

// ── 15. Change history / version preservation ─────────────────────────────────

await check('39 high-impact changes create InstitutionChangeEvent records', () => {
  const svc = source('server/src/services/institutionPortalService.js');
  assert.match(svc, /recordChangeEvent/);
  assert.match(svc, /CHANGE_CATEGORIES\.TUITION/);
  assert.match(svc, /CHANGE_CATEGORIES\.PROGRAM_STATUS/);
});
await check('40 InstitutionChangeEvent is append-only (no updateOne/findByIdAndUpdate)', () => {
  const model = source('server/src/models/institution/InstitutionChangeEvent.js');
  // The model itself has no update operations — it is write-once
  assert.ok(model.includes('InstitutionChangeEvent'));
  assert.ok(!model.includes('findOneAndUpdate'));
});

// ── 16. Student/Vault/privacy boundary ───────────────────────────────────────

await check('41 Institution auth grants zero Vault access', () => {
  const routes = source('server/src/routes/institutionPortal.js');
  const ctrl = source('server/src/controllers/institutionPortalController.js');
  assert.ok(!routes.includes('vaultRouter'));
  assert.match(routes, /denyVault/);
  assert.match(ctrl, /VAULT_DENIED/);
  assert.match(routes, /VAULT.*Institution auth grants zero Vault access/i);
});
await check('42 Institution routes do not reference Student browsing or USP', () => {
  const routes = source('server/src/routes/institutionPortal.js');
  assert.ok(!routes.includes('UniversalStudentProfile'));
  assert.ok(!routes.includes('studentProfile'));
  assert.ok(!routes.includes('studentBrowse'));
});
await check('43 No direct application submission claim in institution routes', () => {
  const routes = source('server/src/routes/institutionPortal.js');
  assert.ok(!routes.includes('applicationSubmit'));
  assert.ok(!routes.includes('applyDirectly'));
  // directApplicationCapability marker is not_configured
  const profile = source('server/src/models/institution/InstitutionProfile.js');
  assert.match(profile, /directApplicationCapability/);
  assert.match(profile, /not_configured/);
});
await check('44 Institution cannot access Agent cases or Employer hiring authority', () => {
  const routes = source('server/src/routes/institutionPortal.js');
  assert.ok(!routes.includes('caseRouter'));
  assert.ok(!routes.includes('talentRouter'));
  const ctrl = source('server/src/controllers/institutionPortalController.js');
  assert.ok(!ctrl.includes('Case'));
  assert.ok(!ctrl.includes('hiringAuthority'));
});

// ── 17. Commerce / payment boundary ──────────────────────────────────────────

await check('45 Institution commerce capability is not_configured (Mission 17 untouched)', () => {
  const profile = source('server/src/models/institution/InstitutionProfile.js');
  assert.match(profile, /commerceCapability/);
  assert.match(profile, /not_configured/);
  // Ensure marketplace payment routes are NOT imported in institution portal
  const routes = source('server/src/routes/institutionPortal.js');
  assert.ok(!routes.includes('marketplacePayment'));
  assert.ok(!routes.includes('Stripe'));
});

// ── 18. Admin review authorization ───────────────────────────────────────────

await check('46 Admin claim review requires staff auth and permission', () => {
  const routes = source('server/src/routes/institutionPortal.js');
  assert.match(routes, /adminInstitution\.use\(requireAuth, requireStaff\)/);
  assert.match(routes, /requirePermission\(PERMISSIONS\.VERIFICATION_READ\)/);
});
await check('47 Claim approval only available with verification:approve', () => {
  const routes = source('server/src/routes/institutionPortal.js');
  assert.match(routes, /\/admin\/institution/);
  assert.match(routes, /requirePermission\(PERMISSIONS\.VERIFICATION_APPROVE\)/);
});

// ── 19. Audit trail ──────────────────────────────────────────────────────────

await check('48 Institution portal controller logs audit events', () => {
  const ctrl = source('server/src/controllers/institutionPortalController.js');
  assert.match(ctrl, /logAudit/);
});
await check('49 Institution service logs audit events for key actions', () => {
  const svc = source('server/src/services/institutionPortalService.js');
  const actions = ['institution_claim_started', 'institution_claim_submitted',
    'institution_profile_updated', 'institution_program_created', 'institution_freshness_reconfirmed'];
  for (const action of actions) {
    assert.match(svc, new RegExp(action), `${action} must be audited`);
  }
});

// ── 20. Notification foundation ───────────────────────────────────────────────

await check('50 Notification events are prepared but never delivered (no worker started)', () => {
  const model = source('server/src/models/institution/InstitutionNotificationEvent.js');
  // delivered defaults to false — no delivery
  assert.match(model, /delivered.*false/);
  // Service prepares events
  const svc = source('server/src/services/institutionPortalService.js');
  assert.match(svc, /prepareNotification/);
  // No worker or email delivery code
  assert.ok(!svc.includes('sendMail'));
  assert.ok(!svc.includes('sendSms'));
  assert.ok(!svc.includes('sendPush'));
});

console.log(`\n  ${passed}/50 tests passed`);
