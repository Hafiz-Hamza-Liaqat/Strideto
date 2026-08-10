/**
 * Applicant Skill Claim + Evidence + Verification — acceptance tests.
 *
 * Covers the 25 required behaviors for the skill trust foundation. Pure
 * contract + pure authorization tests: no DB, no network, no provider, no
 * code execution.
 *
 * The thing these tests exist to defend:
 *
 *     CLAIMED != VERIFIED       EVIDENCE SUBMITTED != VERIFIED
 *
 * Run:
 *   node src/__tests__/applicantSkillClaimVerification.test.js
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

const sv = await import(
  pathToFileURL(path.join(repoRoot, 'shared/career/skillVerification.js')).href
);
const svc = await import(
  pathToFileURL(path.join(repoRoot, 'server/src/services/career/SkillVerificationService.js')).href
);
const rbac = await import(
  pathToFileURL(path.join(repoRoot, 'server/src/config/rbac.js')).href
);

const S = sv.SKILL_CLAIM_STATUSES;
const M = sv.VERIFICATION_METHODS;
const T = sv.SKILL_EVIDENCE_TYPES;

let passed = 0;
const check = async (label, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`  ok - ${label}`);
  } catch (err) {
    console.error(`  FAIL - ${label}`);
    console.error(`       ${err.message}`);
    process.exitCode = 1;
  }
};

// --- fixtures --------------------------------------------------------------

const APPLICANT_ID = '507f1f77bcf86cd799439011';
const OTHER_USER_ID = '507f1f77bcf86cd799439012';
const ADMIN_ID = '507f1f77bcf86cd799439013';
const MODERATOR_ID = '507f1f77bcf86cd799439014';
const SUPERADMIN_ID = '507f1f77bcf86cd799439015';
const EVIDENCE_ID = '507f1f77bcf86cd799439021';

const applicant = { id: APPLICANT_ID, role: 'User', realm: 'user' };
const admin = { id: ADMIN_ID, role: 'Admin', realm: 'user' };
const moderator = { id: MODERATOR_ID, role: 'Moderator', realm: 'user' };
const superAdmin = { id: SUPERADMIN_ID, role: 'SuperAdmin', realm: 'user' };
const employer = { id: OTHER_USER_ID, role: 'employer', realm: 'employer' };
const agent = { id: OTHER_USER_ID, role: 'agent', realm: 'agent' };

const claimAt = (status, extra = {}) => ({
  _id: '507f1f77bcf86cd799439031',
  userId: APPLICANT_ID,
  status,
  skillName: 'React',
  ...extra,
});

/**
 * A well-formed approval request — individual tests remove one part at a time.
 *
 * Uses ISSUER_CONFIRMATION because method policy no longer lets a manual
 * review of self-published links conclude `verified`; a fixture built on
 * MANUAL_EVIDENCE_REVIEW would now fail for the wrong reason and mask whatever
 * each test is actually probing.
 */
const approval = {
  toStatus: S.VERIFIED,
  method: M.ISSUER_CONFIRMATION,
  reason: 'Issuer confirmed the credential directly.',
  evidenceRefs: [EVIDENCE_ID],
};

// ===========================================================================
// 1. Applicant can create a skill claim
// ===========================================================================
await check('1. applicant creates a skill claim, which starts as claimed (not verified)', () => {
  const result = svc.validateClaimInput({
    skillName: 'React',
    skillCategory: 'technical',
    claimedLevel: 'advanced',
    yearsOfExperience: 4,
  });
  assert.strictEqual(result.ok, true, 'valid claim input must be accepted');
  assert.strictEqual(result.value.skillName, 'React');
  assert.strictEqual(result.value.normalizedSkillName, 'react');
  assert.strictEqual(result.value.yearsOfExperience, 4);
  // A new claim is `claimed` — the weakest state — and carries no score.
  assert.strictEqual(sv.deriveCurrentTrustState(claimAt(S.CLAIMED)), S.CLAIMED);
  assert.strictEqual(sv.isCurrentlyVerified(claimAt(S.CLAIMED)), false);
  assert.strictEqual(sv.resolveProficiencyScore({ status: S.CLAIMED }), null);
});

// ===========================================================================
// 2. Applicant can attach GitHub evidence
// ===========================================================================
await check('2. GitHub repository evidence accepted and labelled, without conferring trust', () => {
  const r = svc.validateEvidenceInput({
    evidenceType: T.CODE_REPOSITORY,
    url: 'https://github.com/octocat/hello-world',
    description: 'Primary open-source project',
  });
  assert.strictEqual(r.ok, true, 'GitHub evidence must be accepted');
  assert.strictEqual(r.value.provider, sv.EVIDENCE_PROVIDERS.GITHUB);
  assert.strictEqual(r.value.hostname, 'github.com');
  // GitLab and Bitbucket are equally supported
  assert.strictEqual(
    svc.validateEvidenceInput({ evidenceType: T.CODE_REPOSITORY, url: 'https://gitlab.com/a/b' }).value.provider,
    sv.EVIDENCE_PROVIDERS.GITLAB
  );
  assert.strictEqual(
    svc.validateEvidenceInput({ evidenceType: T.CODE_REPOSITORY, url: 'https://bitbucket.org/a/b' }).value.provider,
    sv.EVIDENCE_PROVIDERS.BITBUCKET
  );
  // Attaching a link does NOT make the claim verified
  assert.strictEqual(sv.isCurrentlyVerified(claimAt(S.EVIDENCE_SUBMITTED)), false);
});

// ===========================================================================
// 3. Applicant can attach Figma / design evidence
// ===========================================================================
await check('3. Figma/Behance/Dribbble design evidence accepted', () => {
  const figma = svc.validateEvidenceInput({
    evidenceType: T.DESIGN_PORTFOLIO,
    url: 'https://www.figma.com/file/abc123/Design-System',
  });
  assert.strictEqual(figma.ok, true);
  assert.strictEqual(figma.value.provider, sv.EVIDENCE_PROVIDERS.FIGMA);
  for (const [url, provider] of [
    ['https://www.behance.net/gallery/1', sv.EVIDENCE_PROVIDERS.BEHANCE],
    ['https://dribbble.com/shots/1', sv.EVIDENCE_PROVIDERS.DRIBBBLE],
  ]) {
    const r = svc.validateEvidenceInput({ evidenceType: T.DESIGN_PORTFOLIO, url });
    assert.strictEqual(r.ok, true, `${url} must be accepted`);
    assert.strictEqual(r.value.provider, provider);
  }
});

// ===========================================================================
// 4. Generic portfolio / professional evidence works
// ===========================================================================
await check('4. generic portfolio, credential and professional-profile evidence work for any profession', () => {
  const cases = [
    [T.PORTFOLIO_SITE, 'https://jane-doe-translations.com/work'],
    [T.PROFESSIONAL_PROFILE, 'https://www.linkedin.com/in/jane'],
    [T.CREDENTIAL_CERTIFICATE, 'https://www.credly.com/badges/abc'],
    [T.PUBLICATION, 'https://orcid.org/0000-0002-1825-0097'],
    [T.CASE_STUDY, 'https://agency.example.org/case-studies/rebrand'],
    [T.LIVE_PROJECT, 'https://myapp.example.io'],
    [T.WORK_SAMPLE, 'https://files.example.com/report.pdf'],
    [T.OTHER_EVIDENCE, 'https://example.com/other'],
  ];
  for (const [evidenceType, url] of cases) {
    const r = svc.validateEvidenceInput({ evidenceType, url });
    assert.strictEqual(r.ok, true, `${evidenceType} @ ${url} must be accepted`);
  }
  // Evidence types are profession-neutral, not developer/designer-only
  assert.ok(sv.getSuggestedEvidenceTypes('language').length > 0, 'language skills must have suggestions');
  assert.ok(sv.getSuggestedEvidenceTypes('business').length > 0, 'business skills must have suggestions');
  assert.ok(sv.getSuggestedEvidenceTypes('unknown-category').length > 0, 'unknown category falls back, never empty');
});

// ===========================================================================
// 5. Multiple evidence links are bounded
// ===========================================================================
await check('5. multiple evidence links allowed but bounded, and per-field lengths bounded', () => {
  const max = sv.SKILL_CLAIM_LIMITS.MAX_EVIDENCE_PER_CLAIM;
  assert.ok(max > 1, 'multiple evidence links must be supported');
  const under = svc.validateEvidenceInput(
    { evidenceType: T.CODE_REPOSITORY, url: 'https://github.com/a/b' },
    { existingCount: max - 1 }
  );
  assert.strictEqual(under.ok, true, 'below the limit must be accepted');

  const at = svc.validateEvidenceInput(
    { evidenceType: T.CODE_REPOSITORY, url: 'https://github.com/a/b' },
    { existingCount: max }
  );
  assert.strictEqual(at.ok, false, 'at the limit must be refused');
  assert.strictEqual(at.code, 'EVIDENCE_LIMIT_REACHED');

  // URL and description lengths are bounded too
  const longUrl = `https://example.com/${'a'.repeat(sv.SKILL_CLAIM_LIMITS.MAX_URL_LENGTH)}`;
  assert.strictEqual(sv.validateEvidenceUrl(longUrl).ok, false, 'over-long URL rejected');
  const longDesc = 'a'.repeat(sv.SKILL_CLAIM_LIMITS.MAX_DESCRIPTION_LENGTH + 1);
  assert.strictEqual(sv.validateEvidenceDescription(longDesc).ok, false, 'over-long description rejected');
  // Claims per user are bounded
  assert.ok(sv.SKILL_CLAIM_LIMITS.MAX_CLAIMS_PER_USER > 0);
});

// ===========================================================================
// 6. Unsafe evidence URL rejected
// ===========================================================================
await check('6. unsafe evidence URLs rejected (scheme, private network, credentials, markup)', () => {
  const mustReject = [
    ['javascript:alert(1)', 'UNSUPPORTED_SCHEME'],
    ['JavaScript:alert(1)', 'UNSUPPORTED_SCHEME'],
    ['file:///etc/passwd', 'UNSUPPORTED_SCHEME'],
    ['ftp://example.com/x', 'UNSUPPORTED_SCHEME'],
    ['http://example.com/x', 'UNSUPPORTED_SCHEME'], // plain http is not public proof
    ['https://localhost/x', 'PRIVATE_NETWORK'],
    ['https://127.0.0.1/x', 'PRIVATE_NETWORK'],
    ['https://2130706433/x', 'PRIVATE_NETWORK'], // decimal-encoded loopback
    ['https://0x7f.0.0.1/x', 'PRIVATE_NETWORK'], // hex-encoded loopback
    ['https://[::1]/x', 'PRIVATE_NETWORK'],
    ['https://[::ffff:127.0.0.1]/x', 'PRIVATE_NETWORK'], // IPv4-mapped IPv6
    ['https://10.0.0.5/x', 'PRIVATE_NETWORK'],
    ['https://192.168.1.1/x', 'PRIVATE_NETWORK'],
    ['https://172.16.0.1/x', 'PRIVATE_NETWORK'],
    ['https://169.254.169.254/latest/meta-data', 'PRIVATE_NETWORK'], // cloud metadata
    ['https://100.64.0.1/x', 'PRIVATE_NETWORK'], // CGNAT
    ['https://service.internal/x', 'PRIVATE_NETWORK'],
    ['https://box.local/x', 'PRIVATE_NETWORK'],
    ['https://user:pass@example.com/x', 'EMBEDDED_CREDENTIALS'],
    // no scheme at all — WHATWG URL cannot parse it, so it fails earlier than
    // the scheme check; still rejected, with a specific auditable reason
    ['not-a-url', 'UNPARSEABLE'],
    ['data:text/plain;base64,aGk=', 'UNSUPPORTED_SCHEME'],
  ];
  for (const [url, reasonKey] of mustReject) {
    const r = sv.validateEvidenceUrl(url);
    assert.strictEqual(r.ok, false, `${url} must be rejected`);
    assert.strictEqual(
      r.reason,
      sv.URL_REJECTION_REASONS[reasonKey],
      `${url} expected ${reasonKey}, got ${r.reason}`
    );
  }
  // data: URLs carrying markup are refused before scheme checks even matter
  assert.strictEqual(sv.validateEvidenceUrl('data:text/html,<script>alert(1)</script>').ok, false);
  // raw HTML/script never survives into a description
  assert.strictEqual(sv.validateEvidenceDescription('<script>alert(1)</script>').ok, false);
  assert.strictEqual(sv.validateEvidenceDescription('<img src=x onerror=y>').ok, false);
  // and a lookalike host is never labelled as the real provider
  assert.strictEqual(sv.resolveEvidenceProvider('github.com.evil.tld'), sv.EVIDENCE_PROVIDERS.GENERIC);
  assert.strictEqual(sv.resolveEvidenceProvider('notgithub.com'), sv.EVIDENCE_PROVIDERS.GENERIC);
});

// ===========================================================================
// 7. Applicant cannot self-verify
// ===========================================================================
await check('7. applicant cannot verify their own claim by any route', () => {
  for (const target of [S.VERIFIED, S.EVIDENCE_BACKED]) {
    const d = svc.authorizeClaimTransition({
      claim: claimAt(S.VERIFICATION_PENDING),
      toStatus: target,
      actor: applicant,
      method: M.MANUAL_EVIDENCE_REVIEW,
      reason: 'I am good at this',
      evidenceRefs: [EVIDENCE_ID],
    });
    assert.strictEqual(d.ok, false, `applicant must not reach ${target}`);
    assert.strictEqual(d.code, 'REVIEW_ROLE_REQUIRED');
    assert.strictEqual(d.status, 403);
  }
  // Even a staff member cannot verify their OWN claim — provenance would name
  // the same person as subject and authority.
  const selfAdmin = svc.authorizeClaimTransition({
    claim: claimAt(S.VERIFICATION_PENDING, { userId: ADMIN_ID }),
    toStatus: S.VERIFIED,
    actor: admin,
    ...approval,
  });
  assert.strictEqual(selfAdmin.ok, false, 'admin must not self-verify');
  assert.strictEqual(selfAdmin.code, 'SELF_VERIFICATION_DENIED');

  const selfSuper = svc.authorizeClaimTransition({
    claim: claimAt(S.VERIFICATION_PENDING, { userId: SUPERADMIN_ID }),
    toStatus: S.VERIFIED,
    actor: superAdmin,
    ...approval,
  });
  assert.strictEqual(selfSuper.ok, false, 'even SuperAdmin must not self-verify');
  assert.strictEqual(selfSuper.code, 'SELF_VERIFICATION_DENIED');
});

// ===========================================================================
// 8. Applicant cannot set score
// ===========================================================================
await check('8. applicant cannot set a verification score; score is server-derived', () => {
  for (const field of ['verificationScore', 'score']) {
    const r = svc.validateClaimInput({ skillName: 'React', [field]: 100 });
    assert.strictEqual(r.ok, false, `${field} must be refused`);
    assert.strictEqual(r.code, 'TRUST_FIELD_FORBIDDEN');
    assert.strictEqual(r.status, 403);
    assert.ok(r.fields.includes(field));
  }
  // No score exists unless an assessment measured one. Null, not zero —
  // "nobody measured this" is a different statement from "scored zero".
  assert.strictEqual(sv.resolveProficiencyScore({ status: S.CLAIMED, score: 99 }), null);
  assert.strictEqual(sv.resolveProficiencyScore({ status: S.EVIDENCE_SUBMITTED }), null);
  // Evidence-backed never carries a score, whatever the method
  assert.strictEqual(
    sv.resolveProficiencyScore({ status: S.EVIDENCE_BACKED, method: M.INTERVIEW_ASSESSMENT, assessment: { score: 90 } }),
    null,
    'evidence-backed must never carry a proficiency score'
  );
  // Nor does a verified claim reached by a non-measuring method
  assert.strictEqual(
    sv.resolveProficiencyScore({ status: S.VERIFIED, method: M.ISSUER_CONFIRMATION, assessment: { score: 90 } }),
    null,
    'a credential check measures no proficiency'
  );
  // Only a measuring method, and only the number it actually produced
  assert.strictEqual(
    sv.resolveProficiencyScore({ status: S.VERIFIED, method: M.INTERVIEW_ASSESSMENT, assessment: { score: 72 } }),
    72
  );
  assert.strictEqual(
    sv.resolveProficiencyScore({ status: S.VERIFIED, method: M.INTERVIEW_ASSESSMENT }),
    null,
    'no assessment result means no score'
  );
  // Out-of-range values are discarded rather than clamped into a plausible number
  for (const bad of [-1, 101, NaN, Infinity, '80']) {
    assert.strictEqual(
      sv.resolveProficiencyScore({ status: S.VERIFIED, method: M.INTERVIEW_ASSESSMENT, assessment: { score: bad } }),
      null,
      `score ${String(bad)} must be discarded`
    );
  }
});

// ===========================================================================
// 9. Applicant cannot set verifiedBy
// ===========================================================================
await check('9. applicant cannot set verifiedBy / verifiedAt / trust badge / expiry', () => {
  const forbidden = [
    'verifiedBy', 'verifiedByRole', 'verifiedAt', 'verificationLevel',
    'trustBadge', 'badges', 'status', 'verificationStatus', 'expiresAt',
    'revokedAt', 'revokedBy', 'currentVerificationId', 'verificationMethod',
    'method', 'applicantVisibleRequest', 'evidenceStatus', 'reviewedBy', 'reviewedAt',
  ];
  for (const field of forbidden) {
    const claimRes = svc.validateClaimInput({ skillName: 'React', [field]: 'x' });
    assert.strictEqual(claimRes.ok, false, `claim input must refuse ${field}`);
    assert.strictEqual(claimRes.code, 'TRUST_FIELD_FORBIDDEN');

    const evRes = svc.validateEvidenceInput({
      evidenceType: T.CODE_REPOSITORY,
      url: 'https://github.com/a/b',
      [field]: 'x',
    });
    assert.strictEqual(evRes.ok, false, `evidence input must refuse ${field}`);
    assert.strictEqual(evRes.code, 'TRUST_FIELD_FORBIDDEN');
  }
  // Every trust-controlled field is covered by the shared constant
  for (const field of forbidden) {
    assert.ok(sv.TRUST_CONTROLLED_FIELDS.includes(field), `${field} must be listed as trust-controlled`);
  }
});

// ===========================================================================
// 10. Employer cannot verify / fabricate status
// ===========================================================================
await check('10. employer cannot verify, evidence-back, reject or revoke any claim', () => {
  for (const target of [S.VERIFIED, S.EVIDENCE_BACKED, S.REJECTED, S.NEEDS_INFORMATION, S.REVOKED]) {
    const d = svc.authorizeClaimTransition({
      claim: claimAt(S.VERIFICATION_PENDING),
      toStatus: target,
      actor: employer,
      method: M.MANUAL_EVIDENCE_REVIEW,
      reason: 'We like this candidate',
      evidenceRefs: [EVIDENCE_ID],
    });
    assert.strictEqual(d.ok, false, `employer must not reach ${target}`);
    assert.strictEqual(d.code, 'REALM_NOT_PERMITTED');
    assert.strictEqual(d.status, 403);
  }
  // Agent and Institution realms are equally refused
  for (const actor of [agent, { id: OTHER_USER_ID, role: 'institution', realm: 'institution' }]) {
    const d = svc.authorizeClaimTransition({
      claim: claimAt(S.VERIFICATION_PENDING), toStatus: S.VERIFIED, actor, ...approval,
    });
    assert.strictEqual(d.ok, false, `${actor.realm} must not verify`);
    assert.strictEqual(d.code, 'REALM_NOT_PERMITTED');
  }
});

// ===========================================================================
// 11. AI cannot verify skill
// ===========================================================================
await check('11. AI/Copilot cannot issue verified status under any realm it can present', () => {
  const aiActors = [
    { id: 'copilot', role: 'copilot', realm: 'ai' },
    { id: 'copilot', role: 'assistant', realm: 'service' },
    { id: 'copilot', role: 'Admin', realm: 'ai' },       // AI claiming an admin role
    { id: null, role: 'system', realm: 'system' },        // system realm, non-system transition
  ];
  for (const actor of aiActors) {
    const d = svc.authorizeClaimTransition({
      claim: claimAt(S.VERIFICATION_PENDING), toStatus: S.VERIFIED, actor, ...approval,
    });
    assert.strictEqual(d.ok, false, `${actor.realm}/${actor.role} must not verify`);
    assert.strictEqual(d.code, 'REALM_NOT_PERMITTED');
  }
  // An internal system actor may only apply policy expiry — never verification
  const sysVerify = svc.authorizeClaimTransition({
    claim: claimAt(S.VERIFICATION_PENDING),
    toStatus: S.VERIFIED,
    actor: { id: null, role: 'system', realm: 'system', isSystem: true },
    ...approval,
  });
  assert.strictEqual(sysVerify.ok, false, 'system actor must not verify');
  assert.strictEqual(sysVerify.code, 'REALM_NOT_PERMITTED');
});

// ===========================================================================
// 12. Unauthorized Admin/Moderator cannot verify
// ===========================================================================
await check('12. staff without the specific permission cannot verify or revoke', () => {
  // Moderator may triage but NOT issue a verified skill
  const modVerify = svc.authorizeClaimTransition({
    claim: claimAt(S.VERIFICATION_PENDING), toStatus: S.VERIFIED, actor: moderator, ...approval,
  });
  assert.strictEqual(modVerify.ok, false, 'Moderator must not verify');
  assert.strictEqual(modVerify.code, 'PERMISSION_REQUIRED');

  // Moderator MAY mark evidence-backed and request information
  for (const target of [S.EVIDENCE_BACKED, S.NEEDS_INFORMATION, S.REJECTED]) {
    const d = svc.authorizeClaimTransition({
      claim: claimAt(S.VERIFICATION_PENDING),
      toStatus: target,
      actor: moderator,
      method: M.MANUAL_EVIDENCE_REVIEW,
      reason: 'Evidence reviewed',
      evidenceRefs: [EVIDENCE_ID],
      ...(target === S.NEEDS_INFORMATION
        ? { applicantVisibleRequest: 'Please provide another professional profile.' }
        : {}),
    });
    assert.strictEqual(d.ok, true, `Moderator must be able to set ${target}: ${d.code}`);
  }

  // Admin may verify but NOT revoke (revocation is SuperAdmin-only)
  const adminRevoke = svc.authorizeClaimTransition({
    claim: claimAt(S.VERIFIED), toStatus: S.REVOKED, actor: admin,
    method: M.MANUAL_EVIDENCE_REVIEW, reason: 'Fraudulent evidence',
  });
  assert.strictEqual(adminRevoke.ok, false, 'Admin must not revoke');
  assert.strictEqual(adminRevoke.code, 'PERMISSION_REQUIRED');

  const superRevoke = svc.authorizeClaimTransition({
    claim: claimAt(S.VERIFIED), toStatus: S.REVOKED, actor: superAdmin,
    method: M.MANUAL_EVIDENCE_REVIEW, reason: 'Fraudulent evidence',
  });
  assert.strictEqual(superRevoke.ok, true, `SuperAdmin must be able to revoke: ${superRevoke.code}`);

  // Editor holds no skill-verification authority at all
  const editor = svc.authorizeClaimTransition({
    claim: claimAt(S.VERIFICATION_PENDING), toStatus: S.VERIFIED,
    actor: { id: OTHER_USER_ID, role: 'Editor', realm: 'user' }, ...approval,
  });
  assert.strictEqual(editor.ok, false, 'Editor must not verify');
  assert.strictEqual(editor.code, 'PERMISSION_REQUIRED');

  // RBAC wiring matches
  assert.strictEqual(rbac.hasPermission('Moderator', 'skill_verification:approve'), false);
  assert.strictEqual(rbac.hasPermission('Admin', 'skill_verification:approve'), true);
  assert.strictEqual(rbac.hasPermission('Admin', 'skill_verification:revoke'), false);
  assert.strictEqual(rbac.hasPermission('SuperAdmin', 'skill_verification:revoke'), true);
});

// ===========================================================================
// 13. Authorized verification requires reason / evidence / method
// ===========================================================================
await check('13. authorized verification requires method + reason + evidence reference', () => {
  const base = { claim: claimAt(S.VERIFICATION_PENDING), toStatus: S.VERIFIED, actor: admin };

  const full = svc.authorizeClaimTransition({ ...base, ...approval });
  assert.strictEqual(full.ok, true, `complete request must be accepted: ${full.code}`);

  const noMethod = svc.authorizeClaimTransition({ ...base, reason: approval.reason, evidenceRefs: [EVIDENCE_ID] });
  assert.strictEqual(noMethod.ok, false, 'missing method must be refused');
  assert.strictEqual(noMethod.code, 'METHOD_REQUIRED');
  assert.strictEqual(noMethod.status, 422);

  const noReason = svc.authorizeClaimTransition({ ...base, method: approval.method, evidenceRefs: [EVIDENCE_ID] });
  assert.strictEqual(noReason.ok, false, 'missing reason must be refused');
  assert.strictEqual(noReason.code, 'REASON_REQUIRED');

  const blankReason = svc.authorizeClaimTransition({ ...base, ...approval, reason: '   ' });
  assert.strictEqual(blankReason.ok, false, 'whitespace-only reason must be refused');

  const noEvidence = svc.authorizeClaimTransition({ ...base, method: approval.method, reason: approval.reason, evidenceRefs: [] });
  assert.strictEqual(noEvidence.ok, false, 'missing evidence reference must be refused');
  assert.strictEqual(noEvidence.code, 'EVIDENCE_REFERENCE_REQUIRED');

  // evidence_backed also demands provenance
  const backedNoEvidence = svc.authorizeClaimTransition({
    ...base, toStatus: S.EVIDENCE_BACKED, method: approval.method, reason: approval.reason, evidenceRefs: [],
  });
  assert.strictEqual(backedNoEvidence.ok, false, 'evidence_backed needs an evidence reference');

  // Deferred methods (code sandbox, automated provider checks) are refused
  for (const method of sv.DEFERRED_METHODS) {
    const d = svc.authorizeClaimTransition({ ...base, ...approval, method });
    assert.strictEqual(d.ok, false, `${method} must not be usable yet`);
    assert.strictEqual(d.code, 'METHOD_NOT_ENABLED');
  }
  // Reason is bounded and markup-free
  const longReason = svc.authorizeClaimTransition({ ...base, ...approval, reason: 'a'.repeat(sv.SKILL_CLAIM_LIMITS.MAX_REASON_LENGTH + 1) });
  assert.strictEqual(longReason.ok, false, 'over-long reason refused');
  const markupReason = svc.authorizeClaimTransition({ ...base, ...approval, reason: '<script>x</script>' });
  assert.strictEqual(markupReason.ok, false, 'markup in reason refused');
  // Evidence references are bounded
  const tooMany = svc.authorizeClaimTransition({
    ...base, ...approval,
    evidenceRefs: Array(sv.SKILL_CLAIM_LIMITS.MAX_EVIDENCE_REFS_PER_VERIFICATION + 1).fill(EVIDENCE_ID),
  });
  assert.strictEqual(tooMany.ok, false, 'too many evidence references refused');
});

// ===========================================================================
// 14. Actor identity server-derived
// ===========================================================================
await check('14. actor identity is server-derived; a body cannot supply or spoof it', () => {
  // No actor at all => unauthenticated, never a default identity
  const noActor = svc.authorizeClaimTransition({ claim: claimAt(S.VERIFICATION_PENDING), toStatus: S.VERIFIED, ...approval });
  assert.strictEqual(noActor.ok, false);
  assert.strictEqual(noActor.code, 'ACTOR_REQUIRED');
  assert.strictEqual(noActor.status, 401);

  // An actor without a realm is refused rather than assumed
  const noRealm = svc.authorizeClaimTransition({
    claim: claimAt(S.VERIFICATION_PENDING), toStatus: S.VERIFIED,
    actor: { id: ADMIN_ID, role: 'Admin' }, ...approval,
  });
  assert.strictEqual(noRealm.ok, false);
  assert.strictEqual(noRealm.code, 'ACTOR_REQUIRED');

  // `isSystem` cannot be asserted by a normal caller to reach system transitions
  const fakeSystem = svc.authorizeClaimTransition({
    claim: claimAt(S.VERIFIED, { expiresAt: new Date(Date.now() - 1000) }),
    toStatus: S.EXPIRED,
    actor: { id: APPLICANT_ID, role: 'User', realm: 'user' },
  });
  assert.strictEqual(fakeSystem.ok, false, 'non-system caller must not apply expiry');
  assert.strictEqual(fakeSystem.code, 'SYSTEM_ONLY');

  // The controller derives the actor from req.user/req.employer, never req.body
  const controllerSrc = readFileSync(
    path.join(repoRoot, 'server/src/controllers/career/skillClaimController.js'), 'utf8'
  );
  assert.ok(/function actorFromRequest/.test(controllerSrc), 'controller must derive actor');
  const actorFn = controllerSrc.slice(
    controllerSrc.indexOf('function actorFromRequest'),
    controllerSrc.indexOf('function sendFailure')
  );
  assert.ok(!/req\.body/.test(actorFn), 'actor derivation must never read req.body');
});

// ===========================================================================
// 15. Transition history append-only / audited
// ===========================================================================
await check('15. every transition is audited and history is append-only', () => {
  const historySrc = readFileSync(
    path.join(repoRoot, 'server/src/models/career/SkillVerificationHistory.js'), 'utf8'
  );
  for (const hook of ['findOneAndUpdate', 'updateOne', 'updateMany', 'findOneAndReplace', 'replaceOne']) {
    assert.ok(new RegExp(`pre\\('${hook}'`).test(historySrc), `history must block ${hook}`);
  }
  for (const hook of ['deleteOne', 'deleteMany', 'findOneAndDelete']) {
    assert.ok(new RegExp(`pre\\('${hook}'`).test(historySrc), `history must block ${hook}`);
  }
  assert.ok(/immutable: true/.test(historySrc), 'occurredAt must be immutable');
  assert.ok(/actorClass/.test(historySrc) && /required: true/.test(historySrc), 'actor class recorded');

  // The service appends history on every mutating path
  const serviceSrc = readFileSync(
    path.join(repoRoot, 'server/src/services/career/SkillVerificationService.js'), 'utf8'
  );
  const appendCalls = (serviceSrc.match(/await appendHistory\(/g) ?? []).length;
  assert.ok(appendCalls >= 5, `expected history append on every mutating path, found ${appendCalls}`);
  // Verification records carry full provenance and are never edited
  const verificationSrc = readFileSync(
    path.join(repoRoot, 'server/src/models/career/SkillVerification.js'), 'utf8'
  );
  for (const field of ['method', 'reason', 'actorId', 'actorRole']) {
    assert.ok(new RegExp(`${field}:[^,]*required: true`, 's').test(verificationSrc) ||
      new RegExp(`${field}: \\{[^}]*required: true`, 's').test(verificationSrc),
    `SkillVerification.${field} must be required`);
  }
});

// ===========================================================================
// 16. Rejected / expired / revoked states work
// ===========================================================================
await check('16. rejected, expired and revoked states behave correctly, revoked is terminal', () => {
  assert.strictEqual(sv.isValidClaimTransition(S.VERIFICATION_PENDING, S.REJECTED), true);
  assert.strictEqual(sv.isValidClaimTransition(S.VERIFIED, S.EXPIRED), true);
  assert.strictEqual(sv.isValidClaimTransition(S.VERIFIED, S.REVOKED), true);
  // Rejected claims may be re-attempted with new evidence
  assert.strictEqual(sv.isValidClaimTransition(S.REJECTED, S.EVIDENCE_SUBMITTED), true);
  assert.strictEqual(sv.isValidClaimTransition(S.EXPIRED, S.VERIFICATION_PENDING), true);
  // Revoked is terminal — nothing revives it, for anyone
  for (const to of Object.values(S)) {
    assert.strictEqual(sv.isValidClaimTransition(S.REVOKED, to), false, `revoked must not go to ${to}`);
  }
  const revive = svc.authorizeClaimTransition({
    claim: claimAt(S.REVOKED), toStatus: S.VERIFIED, actor: superAdmin, ...approval,
  });
  assert.strictEqual(revive.ok, false, 'even SuperAdmin cannot un-revoke');
  assert.strictEqual(revive.code, 'INVALID_TRANSITION');
  assert.strictEqual(revive.status, 409);
  // Illegal shortcuts are refused
  assert.strictEqual(sv.isValidClaimTransition(S.CLAIMED, S.VERIFIED), false, 'claimed must not jump to verified');
  assert.strictEqual(sv.isValidClaimTransition(S.EVIDENCE_SUBMITTED, S.VERIFIED), false);
  const jump = svc.authorizeClaimTransition({ claim: claimAt(S.CLAIMED), toStatus: S.VERIFIED, actor: admin, ...approval });
  assert.strictEqual(jump.ok, false, 'claimed → verified must be refused');
  assert.strictEqual(jump.code, 'INVALID_TRANSITION');
});

// ===========================================================================
// 17. Expired / revoked skill loses current verified badge
// ===========================================================================
await check('17. expired or revoked verification immediately stops reading as verified', () => {
  const past = new Date(Date.now() - 86_400_000);
  const future = new Date(Date.now() + 86_400_000);

  const live = claimAt(S.VERIFIED, { expiresAt: future, verificationScore: 80 });
  assert.strictEqual(sv.isCurrentlyVerified(live), true);
  assert.strictEqual(sv.deriveCurrentTrustState(live), S.VERIFIED);

  // Expiry applies at READ time, even if no worker has rewritten the record
  const expired = claimAt(S.VERIFIED, { expiresAt: past, verificationScore: 80 });
  assert.strictEqual(sv.isCurrentlyVerified(expired), false, 'expired must not read as verified');
  assert.strictEqual(sv.deriveCurrentTrustState(expired), S.EXPIRED);

  const revoked = claimAt(S.VERIFIED, { revokedAt: past, verificationScore: 80 });
  assert.strictEqual(sv.isCurrentlyVerified(revoked), false, 'revoked must not read as verified');
  assert.strictEqual(sv.deriveCurrentTrustState(revoked), S.REVOKED);

  // Projections must agree — no stale badge leaks to an employer or the public
  const empExpired = sv.projectClaimForEmployer(expired, []);
  assert.strictEqual(empExpired.isCurrentlyVerified, false);
  assert.strictEqual(empExpired.trustState, S.EXPIRED);
  assert.strictEqual(empExpired.proficiencyScore, null, 'expired claim must not carry a score');
  assert.strictEqual(empExpired.proficiencyEvidenced, false);
  assert.strictEqual(empExpired.verifiedAt, null);

  const pubRevoked = sv.projectClaimForPublic(revoked);
  assert.strictEqual(pubRevoked.isCurrentlyVerified, false);
  assert.strictEqual(pubRevoked.trustState, S.REVOKED);

  // A lapsed or withdrawn grant surrenders its measured score too
  const assessed = { method: M.INTERVIEW_ASSESSMENT, assessment: { score: 88 } };
  assert.strictEqual(sv.resolveProficiencyScore({ status: S.VERIFIED, expiresAt: past, ...assessed }), null);
  assert.strictEqual(sv.resolveProficiencyScore({ status: S.VERIFIED, revokedAt: past, ...assessed }), null);
  // An expired evidence-backed claim also decays
  assert.strictEqual(sv.deriveCurrentTrustState(claimAt(S.EVIDENCE_BACKED, { expiresAt: past })), S.EXPIRED);
});

// ===========================================================================
// 18. Evidence-backed remains distinct from verified
// ===========================================================================
await check('18. evidence-backed is distinct from verified, and no state shares a badge', () => {
  assert.notStrictEqual(S.EVIDENCE_BACKED, S.VERIFIED);
  assert.strictEqual(sv.isCurrentlyVerified(claimAt(S.EVIDENCE_BACKED)), false);
  assert.strictEqual(sv.projectClaimForEmployer(claimAt(S.EVIDENCE_BACKED), []).isCurrentlyVerified, false);

  // Exactly one state is `verified: true` in the display contract
  const verifiedStates = Object.entries(sv.TRUST_STATE_DISPLAY).filter(([, d]) => d.verified);
  assert.strictEqual(verifiedStates.length, 1, 'only one state may read as verified');
  assert.strictEqual(verifiedStates[0][0], S.VERIFIED);

  // Every state has a distinct label — no generic checkmark for all states
  const labels = Object.values(sv.TRUST_STATE_DISPLAY).map((d) => d.label);
  assert.strictEqual(new Set(labels).size, labels.length, 'every trust state needs a distinct label');
  assert.strictEqual(Object.keys(sv.TRUST_STATE_DISPLAY).length, Object.keys(S).length, 'every status has display');
  // Each state carries an explanatory description
  for (const [status, d] of Object.entries(sv.TRUST_STATE_DISPLAY)) {
    assert.ok(d.description && d.description.length > 10, `${status} needs a meaningful description`);
  }
});

// ===========================================================================
// 19. Cross-user skill / evidence access denied
// ===========================================================================
await check('19. cross-user claim and evidence access is denied', () => {
  const otherClaim = claimAt(S.CLAIMED, { userId: OTHER_USER_ID });
  const d = svc.authorizeClaimTransition({ claim: otherClaim, toStatus: S.EVIDENCE_SUBMITTED, actor: applicant });
  assert.strictEqual(d.ok, false, 'must not act on another user claim');
  assert.strictEqual(d.code, 'NOT_CLAIM_OWNER');
  assert.strictEqual(d.status, 403);

  const submit = svc.authorizeClaimTransition({
    claim: claimAt(S.EVIDENCE_SUBMITTED, { userId: OTHER_USER_ID }),
    toStatus: S.VERIFICATION_PENDING, actor: applicant,
  });
  assert.strictEqual(submit.ok, false, 'must not submit another user claim for review');

  // Owner-scoped reads: the service filters on userId, so a guessed id 404s
  const serviceSrc = readFileSync(
    path.join(repoRoot, 'server/src/services/career/SkillVerificationService.js'), 'utf8'
  );
  assert.ok(/findOne\(\{ _id: claimId, userId \}\)/.test(serviceSrc),
    'applicant claim reads must be scoped by userId, not by id alone');
  assert.ok(/SkillEvidence\.countDocuments\(\{ claimId: claim\._id, userId \}\)/.test(serviceSrc),
    'evidence reads must be scoped by userId');
  // Employer reads are scoped to their own applicants
  assert.ok(/assertEmployerMayViewApplicant/.test(serviceSrc), 'employer access must be application-scoped');
});

// ===========================================================================
// 20. Public / Employer projection exposes only safe evidence metadata
// ===========================================================================
await check('20. employer and public projections expose only safe metadata', () => {
  const claim = {
    _id: 'abc', userId: APPLICANT_ID, status: S.VERIFIED, skillName: 'React',
    skillCategory: 'technical', claimedLevel: 'advanced', verificationScore: 84,
    verifiedAt: new Date(), verificationMethod: M.MANUAL_EVIDENCE_REVIEW,
    verifiedBy: ADMIN_ID, verifiedByRole: 'Admin', currentVerificationId: 'v1',
  };
  const evidence = [{
    _id: 'e1', claimId: 'abc', userId: APPLICANT_ID, evidenceType: T.CODE_REPOSITORY,
    url: 'https://github.com/a/b', hostname: 'github.com', provider: 'github',
    description: 'Main project', status: 'accepted',
    reviewedBy: ADMIN_ID, reviewedAt: new Date(),
  }];

  const emp = sv.projectClaimForEmployer(claim, evidence);
  const empKeys = Object.keys(emp);
  for (const leaked of ['verifiedBy', 'verifiedByRole', 'currentVerificationId', 'userId', 'reason', 'correlationId']) {
    assert.ok(!empKeys.includes(leaked), `employer projection must not expose ${leaked}`);
  }
  const evKeys = Object.keys(emp.evidence[0]);
  for (const leaked of ['reviewedBy', 'reviewedAt', 'userId', 'claimId', '_id', 'id', 'status']) {
    assert.ok(!evKeys.includes(leaked), `employer evidence must not expose ${leaked}`);
  }
  assert.strictEqual(emp.evidence[0].provider, 'github');

  // Public is strictly narrower than employer — no URLs, no hosts, no counts
  const pub = sv.projectClaimForPublic(claim);
  const pubKeys = Object.keys(pub);
  for (const leaked of ['evidence', 'evidenceCount', 'url', 'hostname', 'verifiedAt', 'verificationMethod', 'verificationScore']) {
    assert.ok(!pubKeys.includes(leaked), `public projection must not expose ${leaked}`);
  }
  assert.ok(pubKeys.length < empKeys.length, 'public projection must be narrower than employer');
});

// ===========================================================================
// 21. Application skill snapshot cannot be caller-forged
// ===========================================================================
await check('21. application skill snapshot is server-built and cannot be forged', () => {
  const now = new Date();
  const past = new Date(Date.now() - 86_400_000);
  const claims = [
    { skillName: 'React', skillCategory: 'technical', claimedLevel: 'advanced', status: S.VERIFIED, verificationMethod: M.INTERVIEW_ASSESSMENT, proficiencyScore: 84, evidenceCount: 2 },
    { skillName: 'Figma', skillCategory: 'design', claimedLevel: 'expert', status: S.CLAIMED, evidenceCount: 0 },
    { skillName: 'Node', skillCategory: 'technical', status: S.VERIFIED, verificationMethod: M.INTERVIEW_ASSESSMENT, proficiencyScore: 90, expiresAt: past, evidenceCount: 1 },
  ];
  const snap = sv.buildSkillSnapshot(claims, now);
  assert.ok(snap.capturedAt, 'snapshot records when it was captured');
  assert.strictEqual(snap.skills.length, 3);
  assert.strictEqual(snap.skills[0].isCurrentlyVerified, true);
  assert.strictEqual(snap.skills[1].isCurrentlyVerified, false, 'a claimed skill is never snapshot as verified');
  assert.strictEqual(snap.skills[1].proficiencyScore, null);
  // An already-expired verification is snapshot as expired, not verified
  assert.strictEqual(snap.skills[2].trustState, S.EXPIRED);
  assert.strictEqual(snap.skills[2].isCurrentlyVerified, false);
  assert.strictEqual(snap.skills[2].proficiencyScore, null,
    'an expired grant surrenders its measured score too');

  // The snapshot ignores any trust values a caller tries to inject
  const forged = sv.buildSkillSnapshot(
    [{
      skillName: 'Rust', status: S.CLAIMED, isCurrentlyVerified: true,
      proficiencyScore: 100, proficiencyEvidenced: true, trustState: S.VERIFIED,
      verificationMethod: M.INTERVIEW_ASSESSMENT,
    }],
    now
  );
  assert.strictEqual(forged.skills[0].isCurrentlyVerified, false, 'forged verified flag must be ignored');
  assert.strictEqual(forged.skills[0].proficiencyScore, null, 'forged score must be ignored');
  assert.strictEqual(forged.skills[0].proficiencyEvidenced, false, 'forged evidenced flag must be ignored');
  assert.strictEqual(forged.skills[0].trustState, S.CLAIMED, 'trust state is recomputed, not copied');

  // The apply path builds it from userId alone — no body input
  const applySrc = readFileSync(path.join(repoRoot, 'server/src/controllers/applicationsController.js'), 'utf8');
  assert.ok(/buildApplicationSkillSnapshot\(\{ userId \}\)/.test(applySrc),
    'snapshot must be built from the session userId only');
  assert.ok(!/skillSnapshot: req\.body/.test(applySrc), 'snapshot must never come from the request body');
});

// ===========================================================================
// 22. Employer filters use server-derived verification state
// ===========================================================================
await check('22. employer filters recompute trust server-side and never hide the unverified by default', () => {
  const past = new Date(Date.now() - 86_400_000);
  const verified = claimAt(S.VERIFIED);
  const backed = claimAt(S.EVIDENCE_BACKED);
  const claimed = claimAt(S.CLAIMED);
  const expired = claimAt(S.VERIFIED, { expiresAt: past });

  // Default filter includes everyone — absence of verification is not disqualifying
  for (const c of [verified, backed, claimed, expired]) {
    assert.strictEqual(sv.matchesTrustFilter(c, sv.EMPLOYER_TRUST_FILTERS.ANY), true);
  }
  assert.strictEqual(sv.matchesTrustFilter(verified, sv.EMPLOYER_TRUST_FILTERS.VERIFIED), true);
  assert.strictEqual(sv.matchesTrustFilter(backed, sv.EMPLOYER_TRUST_FILTERS.VERIFIED), false);
  assert.strictEqual(sv.matchesTrustFilter(claimed, sv.EMPLOYER_TRUST_FILTERS.VERIFIED), false);
  // An expired verification does not satisfy a verified filter
  assert.strictEqual(sv.matchesTrustFilter(expired, sv.EMPLOYER_TRUST_FILTERS.VERIFIED), false);
  // evidence-backed filter includes verified (strictly stronger)
  assert.strictEqual(sv.matchesTrustFilter(verified, sv.EMPLOYER_TRUST_FILTERS.EVIDENCE_BACKED), true);
  assert.strictEqual(sv.matchesTrustFilter(backed, sv.EMPLOYER_TRUST_FILTERS.EVIDENCE_BACKED), true);
  assert.strictEqual(sv.matchesTrustFilter(claimed, sv.EMPLOYER_TRUST_FILTERS.EVIDENCE_BACKED), false);

  // A forged trustState on the record is ignored — state is recomputed
  const forged = { ...claimed, trustState: S.VERIFIED, isCurrentlyVerified: true };
  assert.strictEqual(sv.matchesTrustFilter(forged, sv.EMPLOYER_TRUST_FILTERS.VERIFIED), false);
  // Unknown filter values fall back to inclusive, never to exclusion
  assert.strictEqual(sv.matchesTrustFilter(claimed, 'not-a-filter'), true);
  assert.strictEqual(sv.isValidEmployerTrustFilter('not-a-filter'), false);

  // A job only excludes unverified applicants when it explicitly opted in
  assert.strictEqual(sv.requiresVerifiedSkill({ verifiedSkillRequirements: ['react'] }, 'React'), false,
    'requirement without accepted policy must not gate');
  assert.strictEqual(sv.requiresVerifiedSkill({ verifiedSkillRequirements: ['react'], verifiedSkillPolicyAccepted: true }, 'React'), true);
  assert.strictEqual(sv.requiresVerifiedSkill({}, 'React'), false);
  assert.strictEqual(sv.requiresVerifiedSkill(null, 'React'), false);
});

// ===========================================================================
// 23. No external evidence fetch / API call
// ===========================================================================
await check('23. no external evidence fetch or provider API call exists', () => {
  assert.strictEqual(sv.EXTERNAL_EVIDENCE_FETCH_ENABLED, false, 'external fetch must be declared off');

  const sources = [
    'server/src/services/career/SkillVerificationService.js',
    'server/src/controllers/career/skillClaimController.js',
    'shared/career/skillVerification.js',
    'server/src/models/career/SkillEvidence.js',
  ];
  const banned = [
    /\bfetch\s*\(/, /\baxios\b/, /node-fetch/, /\bgot\s*\(/,
    /require\(['"]https?['"]\)/, /from ['"]node:https?['"]/, /from ['"]https?['"]/,
    /XMLHttpRequest/, /\.request\s*\(/,
  ];
  for (const rel of sources) {
    const src = readFileSync(path.join(repoRoot, rel), 'utf8');
    for (const pattern of banned) {
      assert.ok(!pattern.test(src), `${rel} must not contain ${pattern} (no external calls)`);
    }
  }
  // No GitHub/Figma API integration
  for (const rel of sources) {
    const src = readFileSync(path.join(repoRoot, rel), 'utf8');
    assert.ok(!/api\.github\.com|api\.figma\.com|oauth/i.test(src), `${rel} must not integrate a provider API`);
  }
});

// ===========================================================================
// 24. No developer sandbox / code execution
// ===========================================================================
await check('24. no code sandbox or code execution path exists', () => {
  const sources = [
    'server/src/services/career/SkillVerificationService.js',
    'server/src/controllers/career/skillClaimController.js',
    'shared/career/skillVerification.js',
  ];
  const banned = [/\beval\s*\(/, /new Function\s*\(/, /child_process/, /\bexecSync\b/, /\bspawn\s*\(/, /\bvm\b\./, /require\(['"]vm['"]\)/];
  for (const rel of sources) {
    const src = readFileSync(path.join(repoRoot, rel), 'utf8');
    for (const pattern of banned) {
      assert.ok(!pattern.test(src), `${rel} must not contain ${pattern} (no code execution)`);
    }
  }
  // Assessment-based methods are declared but explicitly not enabled
  assert.ok(sv.DEFERRED_METHODS.includes(M.PRACTICAL_ASSESSMENT), 'practical assessment must be deferred');
  assert.strictEqual(sv.isEnabledVerificationMethod(M.PRACTICAL_ASSESSMENT), false);
  assert.strictEqual(sv.isEnabledVerificationMethod(M.AUTOMATED_PROVIDER_CHECK), false);
  assert.strictEqual(sv.isEnabledVerificationMethod(M.MANUAL_EVIDENCE_REVIEW), true);
});

// ===========================================================================
// 25. Responsive Student and Employer skill/evidence UI
// ===========================================================================
await check('25. Student and Employer skill UI exist and are responsive/accessible', () => {
  const uiFiles = [
    'client/src/components/skills/SkillClaimManager.jsx',
    'client/src/components/skills/SkillTrustBadge.jsx',
    'client/src/components/skills/ApplicantSkillPanel.jsx',
  ];
  for (const rel of uiFiles) {
    const src = readFileSync(path.join(repoRoot, rel), 'utf8');
    assert.ok(src.length > 200, `${rel} must be a real component`);
    // Responsive: no fixed pixel widths that would overflow a 320px viewport
    assert.ok(!/width:\s*['"]?\d{3,}px/.test(src), `${rel} must not hard-code a wide fixed width`);
    // Accessible: forms/controls carry names
    assert.ok(/aria-|htmlFor|role=/.test(src), `${rel} must carry accessibility attributes`);
  }
  // The badge component must render distinct states, not one generic check
  const badge = readFileSync(path.join(repoRoot, 'client/src/components/skills/SkillTrustBadge.jsx'), 'utf8');
  assert.ok(/getTrustStateDisplay|TRUST_STATE_DISPLAY/.test(badge),
    'badge must derive its label from the shared display contract');
  assert.ok(!/✓|check(mark)?/i.test(badge.replace(/verified/gi, '')) || /trustState/.test(badge),
    'badge must vary by trust state');
});

// ===========================================================================
// 26. Employer reads only reach applicants who applied to that employer's jobs
// ===========================================================================
await check('26. employer skill access is scoped to their own applications', () => {
  const serviceSrc = readFileSync(
    path.join(repoRoot, 'server/src/services/career/SkillVerificationService.js'), 'utf8'
  );
  const guard = serviceSrc.slice(
    serviceSrc.indexOf('export async function assertEmployerMayViewApplicant'),
    serviceSrc.indexOf('export async function listClaimsForEmployer')
  );
  assert.ok(guard.length > 100, 'the employer access guard must exist');
  // The employer's own jobs, then an application from this user onto one of them
  assert.ok(/Job\.find\(\{\s*employerId\s*\}\)\.distinct\('_id'\)/.test(guard),
    'guard must resolve the employer\'s own jobs');
  assert.ok(/Application\.exists\(\{[\s\S]*userId: applicantUserId[\s\S]*jobId: \{ \$in: employerJobIds \}/.test(guard),
    'guard must require an application from this applicant onto one of those jobs');
  // An employer with no jobs can reach nobody
  assert.ok(/if \(!employerJobIds\.length\) return fail\('APPLICANT_NOT_FOUND', 404/.test(guard),
    'an employer with no jobs must reach no applicant');
  // 404 not 403, so employer ids cannot be used to probe which users exist
  assert.ok(!/403/.test(guard), 'failures must be 404, never 403 (no existence oracle)');

  // The route enforces the employer realm, and the controller calls the guard
  // BEFORE reading any skills.
  const routeSrc = readFileSync(path.join(repoRoot, 'server/src/routes/skillClaims.js'), 'utf8');
  assert.ok(/employer\/applicants\/:applicantId\/skills[\s\S]{0,120}requireEmployerAuth/.test(routeSrc),
    'employer skill route must require an employer token');
  const ctrlSrc = readFileSync(
    path.join(repoRoot, 'server/src/controllers/career/skillClaimController.js'), 'utf8'
  );
  const handler = ctrlSrc.slice(ctrlSrc.indexOf('export const getApplicantSkillsForEmployer'));
  assert.ok(
    handler.indexOf('assertEmployerMayViewApplicant') < handler.indexOf('listClaimsForEmployer'),
    'the scope check must run before any skill data is read'
  );
  assert.ok(/employerId: req\.employer\.employerId/.test(handler),
    'employer identity must come from the session, not the request');

  // There is no employer-realm route that writes trust state
  const employerRoutes = routeSrc.split('\n').filter((l) => /employer/i.test(l));
  assert.ok(!employerRoutes.some((l) => /\.post\(|\.patch\(|\.put\(|\.delete\(/.test(l)),
    'the employer surface must be read-only');
});

// ===========================================================================
// 27. A later profile edit does not rewrite a stored application snapshot
// ===========================================================================
await check('27. application snapshot is immutable against later profile changes', () => {
  const now = new Date();
  const claims = [
    { skillName: 'React', skillCategory: 'technical', status: S.VERIFIED, verificationScore: 84, evidenceCount: 2 },
  ];
  const snap = sv.buildSkillSnapshot(claims, now);
  const frozen = JSON.parse(JSON.stringify(snap));

  // The applicant then edits everything: renames the skill, loses verification,
  // adds evidence. The already-captured snapshot must not move.
  claims[0].skillName = 'Renamed';
  claims[0].status = S.REVOKED;
  claims[0].revokedAt = now;
  claims[0].evidenceCount = 9;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(snap)), frozen,
    'a stored snapshot must not track later claim edits');

  // Rebuilding now yields the new truth — proving the two are genuinely distinct
  const rebuilt = sv.buildSkillSnapshot(claims, now);
  assert.strictEqual(rebuilt.skills[0].trustState, S.REVOKED);
  assert.notStrictEqual(rebuilt.skills[0].trustState, frozen.skills[0].trustState);

  // Nothing outside application creation writes the stored snapshot
  const svcSrc = readFileSync(
    path.join(repoRoot, 'server/src/services/career/SkillVerificationService.js'), 'utf8'
  );
  assert.ok(!/skillSnapshot/.test(svcSrc),
    'the verification service must never rewrite a stored application snapshot');
  const appCtrl = readFileSync(path.join(repoRoot, 'server/src/controllers/applicationsController.js'), 'utf8');
  // Written once, inside Application.create — and nowhere updated afterwards
  const createStart = appCtrl.indexOf('Application.create(');
  const createBlock = appCtrl.slice(createStart, appCtrl.indexOf('});', createStart) + 3);
  assert.ok(/^\s*skillSnapshot,$/m.test(createBlock),
    'skillSnapshot must be set on the created application');
  assert.ok(!/skillSnapshot/.test(appCtrl.replace(createBlock, '').replace(/const skillSnapshot = [^;]+;/, '')),
    'skillSnapshot must not be reassigned outside application creation');
  assert.ok(!/\$set[^}]*skillSnapshot|updateOne[\s\S]{0,200}skillSnapshot/.test(appCtrl),
    'no update path may rewrite a stored snapshot');

  // The employer projection of the snapshot is read-only and carries no
  // internal fields
  const cardSrc = readFileSync(
    path.join(repoRoot, 'server/src/services/career/EmployerCandidateCardService.js'), 'utf8'
  );
  const proj = cardSrc.slice(cardSrc.indexOf('applicationSkillSnapshot:'), cardSrc.indexOf('jobType:'));
  for (const leaked of ['verificationScore', 'verifiedBy', 'currentVerificationId', 'userId']) {
    assert.ok(!proj.includes(leaked), `application snapshot projection must not expose ${leaked}`);
  }
});

// ===========================================================================
// 28. The reviewer queue is readable only with permission, and grants none
// ===========================================================================
await check('28. reviewer queue is permission-gated and confers no authority', () => {
  // Read permission mirrors the server matrix
  assert.strictEqual(rbac.hasPermission('Moderator', 'skill_verification:read'), true);
  assert.strictEqual(rbac.hasPermission('Admin', 'skill_verification:read'), true);
  assert.strictEqual(rbac.hasPermission('Editor', 'skill_verification:read'), false);
  assert.strictEqual(rbac.hasPermission('User', 'skill_verification:read'), false);

  const svcSrc = readFileSync(
    path.join(repoRoot, 'server/src/services/career/SkillVerificationService.js'), 'utf8'
  );
  const queue = svcSrc.slice(
    svcSrc.indexOf('export async function listClaimsForReview'),
    svcSrc.indexOf('/** Public projection')
  );
  assert.ok(/hasPermission\(actor\.role, 'skill_verification:read'\)/.test(queue),
    'the queue must require the read permission');
  assert.ok(/isStaffRole\(actor\?\.role\)/.test(queue), 'the queue must require a staff role');
  assert.ok(/realm === USER_REALM/.test(queue), 'the queue must refuse non-user realms');
  // Reading the queue must not mutate anything
  assert.ok(!/\.save\(\)|\.create\(|updateMany|updateOne/.test(queue),
    'the queue read must not write');

  // Holding read does NOT let a Moderator approve — that still needs approve
  const claim = claimAt(S.VERIFICATION_PENDING);
  const denied = svc.authorizeClaimTransition({
    claim, toStatus: S.VERIFIED, actor: moderator,
    method: M.MANUAL_EVIDENCE_REVIEW, reason: 'looks right', evidenceRefs: [EVIDENCE_ID],
  });
  assert.strictEqual(denied.ok, false, 'read access must not imply approval authority');
  assert.strictEqual(denied.code, 'PERMISSION_REQUIRED');
});

// ===========================================================================
// 29. The Student and Employer surfaces are actually mounted
// ===========================================================================
await check('29. skill UI is wired into the Student, Employer and Admin surfaces', () => {
  const studentPage = readFileSync(
    path.join(repoRoot, 'client/src/pages/TalentProfile/TalentProfileEditor.jsx'), 'utf8'
  );
  assert.ok(/SkillClaimManager/.test(studentPage), 'Student profile must mount the claim manager');

  const employerPage = readFileSync(
    path.join(repoRoot, 'client/src/pages/Employer/EmployerCandidateDetail.jsx'), 'utf8'
  );
  assert.ok(/ApplicantSkillPanel/.test(employerPage), 'Employer candidate view must mount the skill panel');
  assert.ok(/applicationSkillSnapshot/.test(employerPage),
    'Employer must be able to see the application-time snapshot alongside current state');

  const adminPage = readFileSync(
    path.join(repoRoot, 'client/src/pages/Admin/AdminTrustCenter.jsx'), 'utf8'
  );
  assert.ok(/SkillVerificationReviewPanel/.test(adminPage),
    'manual review must be reachable from the existing Trust Center, not a new admin system');

  // The employer read must travel on the Employer-realm client, or it 401s
  const panel = readFileSync(
    path.join(repoRoot, 'client/src/components/skills/ApplicantSkillPanel.jsx'), 'utf8'
  );
  assert.ok(/employerApi\.applicantSkills/.test(panel),
    'employer skill read must use the employer-realm axios instance');
  const userApi = readFileSync(path.join(repoRoot, 'client/src/services/skillClaimsApi.js'), 'utf8');
  assert.ok(!/employer\/applicants/.test(userApi.replace(/\/\*[\s\S]*?\*\//g, '')),
    'the User-realm client must not call the employer route');
});

// ===========================================================================
// 30. No client surface can set trust state
// ===========================================================================
await check('30. no client surface offers a control that mints trust', () => {
  const clientFiles = [
    'client/src/components/skills/SkillClaimManager.jsx',
    'client/src/components/skills/ApplicantSkillPanel.jsx',
    'client/src/components/skills/SkillTrustBadge.jsx',
    'client/src/services/skillClaimsApi.js',
  ];
  // The applicant/employer surfaces must not even name the trust-bearing fields
  for (const rel of clientFiles) {
    const src = readFileSync(path.join(repoRoot, rel), 'utf8');
    for (const field of ['verifiedBy', 'verificationScore:', 'trustBadge', 'verificationStatus']) {
      assert.ok(!src.includes(field), `${rel} must not write ${field}`);
    }
  }

  /*
   * The reviewer panel sends an outcome, a method, a reason, the cited
   * evidence and — only for a rubric-scored assessment — that assessment's
   * result. It never sends an identity or a trust field: the server derives
   * the actor and computes everything else.
   */
  const review = readFileSync(
    path.join(repoRoot, 'client/src/components/skills/SkillVerificationReviewPanel.jsx'), 'utf8'
  );
  const payload = review.slice(review.indexOf('recordDecision('), review.indexOf('await onDone()'));
  for (const forbidden of ['verifiedBy', 'actorId', 'verifiedAt', 'trustBadge', 'verificationStatus', 'trustState']) {
    assert.ok(!payload.includes(forbidden), `review payload must not carry ${forbidden}`);
  }
  for (const required of ['toStatus', 'method', 'reason', 'evidenceRefs']) {
    assert.ok(payload.includes(required), `review payload must carry ${required}`);
  }
  // A score is only ever sent nested inside `assessment`, never as a bare
  // top-level field — and only when the method actually measures one.
  assert.ok(!/^\s*score[:,]/m.test(payload), 'a score must not be a top-level payload field');
  assert.ok(/supportsProficiency && String\(score\)/.test(payload),
    'a score must only be sent for a method whose policy measures proficiency');
  assert.ok(/assessment: needsRubric/.test(payload),
    'assessment provenance must only be sent when the method requires a rubric');

  // Every trust-bearing field is refused server-side whoever sends it
  for (const field of sv.TRUST_CONTROLLED_FIELDS) {
    const r = svc.validateClaimInput({ skillName: 'React', [field]: 'x' });
    assert.strictEqual(r.ok, false, `${field} must be refused on claim input`);
    assert.strictEqual(r.code, 'TRUST_FIELD_FORBIDDEN');
  }
});

// ===========================================================================
// 31-39. Verification method policy
//
// The invariant: submitted social / portfolio / project evidence ALONE must
// never be sufficient to issue `verified`.
// ===========================================================================

/** The self-published evidence types this invariant is really about. */
const SOCIAL_EVIDENCE = [
  ['GitHub repository', T.CODE_REPOSITORY],
  ['Figma / design portfolio', T.DESIGN_PORTFOLIO],
  ['portfolio site', T.PORTFOLIO_SITE],
  ['deployed project', T.LIVE_PROJECT],
  ['LinkedIn / professional profile', T.PROFESSIONAL_PROFILE],
  ['generic work sample', T.WORK_SAMPLE],
];

await check('31. GitHub evidence alone cannot reach verified, by any method', () => {
  // The method a URL review would actually use tops out at evidence-backed
  const authz = svc.authorizeClaimTransition({
    claim: claimAt(S.VERIFICATION_PENDING),
    toStatus: S.VERIFIED,
    actor: superAdmin,
    method: M.MANUAL_EVIDENCE_REVIEW,
    reason: 'Repository looks strong and the commit history is real.',
    evidenceRefs: [EVIDENCE_ID],
  });
  assert.strictEqual(authz.ok, false, 'manual review of a repo must not verify');
  assert.strictEqual(authz.code, 'METHOD_CANNOT_VERIFY');
  assert.strictEqual(authz.status, 422);

  // And no verified-capable method accepts a repository as its anchor
  const sufficiency = sv.evaluateVerificationSufficiency({
    toStatus: S.VERIFIED,
    method: M.DOCUMENT_REVIEW,
    evidenceTypes: [T.CODE_REPOSITORY],
  });
  assert.strictEqual(sufficiency.ok, false, 'a repo is not a credential document');
  assert.strictEqual(sufficiency.code, sv.SUFFICIENCY_CODES.SELF_ATTESTED_EVIDENCE_INSUFFICIENT);
});

await check('32. Figma / design portfolio evidence alone cannot reach verified', () => {
  const authz = svc.authorizeClaimTransition({
    claim: claimAt(S.VERIFICATION_PENDING),
    toStatus: S.VERIFIED,
    actor: superAdmin,
    method: M.MANUAL_EVIDENCE_REVIEW,
    reason: 'Figma file shows a complete design system.',
    evidenceRefs: [EVIDENCE_ID],
  });
  assert.strictEqual(authz.ok, false);
  assert.strictEqual(authz.code, 'METHOD_CANNOT_VERIFY');

  const sufficiency = sv.evaluateVerificationSufficiency({
    toStatus: S.VERIFIED, method: M.ISSUER_CONFIRMATION,
    evidenceTypes: [T.DESIGN_PORTFOLIO], corroborationRef: 'design-lead@example.test',
  });
  assert.strictEqual(sufficiency.ok, false, 'a design file is not issuer-anchored');
  assert.strictEqual(sufficiency.code, sv.SUFFICIENCY_CODES.SELF_ATTESTED_EVIDENCE_INSUFFICIENT);
});

await check('33. portfolio / project / profile evidence alone cannot reach verified', () => {
  for (const [label, type] of SOCIAL_EVIDENCE) {
    assert.strictEqual(sv.isSelfAttestedEvidenceType(type), true, `${label} must be self-attested`);
    for (const method of [M.DOCUMENT_REVIEW, M.ISSUER_CONFIRMATION]) {
      const r = sv.evaluateVerificationSufficiency({
        toStatus: S.VERIFIED, method, evidenceTypes: [type], corroborationRef: 'issuer@example.test',
      });
      assert.strictEqual(r.ok, false, `${label} must not satisfy ${method}`);
      assert.strictEqual(r.code, sv.SUFFICIENCY_CODES.SELF_ATTESTED_EVIDENCE_INSUFFICIENT);
    }
    // Even all of them together are still only self-published links
    const combined = sv.evaluateVerificationSufficiency({
      toStatus: S.VERIFIED, method: M.DOCUMENT_REVIEW,
      evidenceTypes: SOCIAL_EVIDENCE.map(([, t]) => t),
    });
    assert.strictEqual(combined.ok, false, 'quantity of self-published links is not corroboration');
  }
});

await check('34. the same social evidence DOES support evidence_backed', () => {
  for (const [label, type] of SOCIAL_EVIDENCE) {
    const r = sv.evaluateVerificationSufficiency({
      toStatus: S.EVIDENCE_BACKED, method: M.MANUAL_EVIDENCE_REVIEW, evidenceTypes: [type],
    });
    assert.strictEqual(r.ok, true, `${label} must support evidence_backed: ${r.code}`);
  }
  // And the full authorization path agrees, for a reviewer holding review only
  const d = svc.authorizeClaimTransition({
    claim: claimAt(S.VERIFICATION_PENDING),
    toStatus: S.EVIDENCE_BACKED,
    actor: moderator,
    method: M.MANUAL_EVIDENCE_REVIEW,
    reason: 'Opened the repository and the portfolio; both are real and relevant.',
    evidenceRefs: [EVIDENCE_ID],
  });
  assert.strictEqual(d.ok, true, `evidence_backed must remain reachable: ${d.code}`);
  // needs_information and rejected are likewise unaffected by the policy
  for (const target of [S.NEEDS_INFORMATION, S.REJECTED]) {
    const r = sv.evaluateVerificationSufficiency({
      toStatus: target, method: M.MANUAL_EVIDENCE_REVIEW, evidenceTypes: [T.CODE_REPOSITORY],
    });
    assert.strictEqual(r.ok, true, `${target} must not be blocked by verification policy`);
  }
});

await check('35. a method policy does not permit to verify cannot issue verified', () => {
  // Policy is the single source of truth, and manual review caps below verified
  assert.strictEqual(sv.methodMayIssueVerified(M.MANUAL_EVIDENCE_REVIEW), false);
  assert.strictEqual(
    sv.VERIFICATION_METHOD_POLICY[M.MANUAL_EVIDENCE_REVIEW].maxOutcome, S.EVIDENCE_BACKED
  );
  assert.ok(!sv.VERIFIED_CAPABLE_METHODS.includes(M.MANUAL_EVIDENCE_REVIEW));

  // Deferred methods cannot verify either, however they are addressed
  for (const method of sv.DEFERRED_METHODS) {
    assert.strictEqual(sv.methodMayIssueVerified(method), false, `${method} must not verify`);
    const r = sv.evaluateVerificationSufficiency({ toStatus: S.VERIFIED, method });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, sv.SUFFICIENCY_CODES.METHOD_NOT_ENABLED);
  }
  // An unknown method fails closed rather than defaulting to permitted
  for (const method of ['', null, undefined, 'vibes', 'ai_review']) {
    assert.strictEqual(sv.methodMayIssueVerified(method), false, `${String(method)} must not verify`);
  }
  // Every method that CAN verify demands corroboration of some kind
  for (const method of sv.VERIFIED_CAPABLE_METHODS) {
    const policy = sv.getVerificationMethodPolicy(method);
    assert.ok(
      policy.requiresIssuerAnchoredEvidence || policy.requiresRubric || policy.requiresCorroboration,
      `${method} may verify, so it must require corroboration of some kind`
    );
  }
});

await check('36. an approved method issues verified with evidence, reason and provenance', () => {
  // Credential route: issuer-anchored evidence + the issuer actually contacted
  const credential = sv.evaluateVerificationSufficiency({
    toStatus: S.VERIFIED,
    method: M.ISSUER_CONFIRMATION,
    evidenceTypes: [T.CREDENTIAL_CERTIFICATE],
    corroborationRef: 'registrar@issuer.example',
  });
  assert.strictEqual(credential.ok, true, `credential route must verify: ${credential.code}`);

  // ...but not without the issuer contact on record
  const noContact = sv.evaluateVerificationSufficiency({
    toStatus: S.VERIFIED, method: M.ISSUER_CONFIRMATION, evidenceTypes: [T.CREDENTIAL_CERTIFICATE],
  });
  assert.strictEqual(noContact.ok, false);
  assert.strictEqual(noContact.code, sv.SUFFICIENCY_CODES.CORROBORATION_REQUIRED);

  // Assessment route: a rubric AND its version, over any evidence
  const assessed = sv.evaluateVerificationSufficiency({
    toStatus: S.VERIFIED, method: M.INTERVIEW_ASSESSMENT,
    evidenceTypes: [T.CODE_REPOSITORY],
    assessment: { rubricId: 'frontend-v3', rubricVersion: 3 },
  });
  assert.strictEqual(assessed.ok, true, `assessment route must verify: ${assessed.code}`);

  const noRubric = sv.evaluateVerificationSufficiency({
    toStatus: S.VERIFIED, method: M.INTERVIEW_ASSESSMENT, evidenceTypes: [T.CODE_REPOSITORY],
  });
  assert.strictEqual(noRubric.ok, false, 'an assessment with no rubric is an opinion');
  assert.strictEqual(noRubric.code, sv.SUFFICIENCY_CODES.RUBRIC_REQUIRED);
  // A rubric id with no version is not a versioned rubric
  assert.strictEqual(sv.isValidRubricReference({ rubricId: 'frontend-v3' }), false);
  assert.strictEqual(sv.isValidRubricReference({ rubricId: '', rubricVersion: 3 }), false);
  assert.strictEqual(sv.isValidRubricReference({ rubricId: 'frontend-v3', rubricVersion: 3 }), true);

  // Reference route: a named referee
  const reference = sv.evaluateVerificationSufficiency({
    toStatus: S.VERIFIED, method: M.EMPLOYER_REFERENCE,
    evidenceTypes: [T.PROFESSIONAL_PROFILE], corroborationRef: 'Head of Engineering, Acme',
  });
  assert.strictEqual(reference.ok, true, `reference route must verify: ${reference.code}`);

  // The full authorization path still demands permission, reason and evidence
  const authorized = svc.authorizeClaimTransition({
    claim: claimAt(S.VERIFICATION_PENDING), toStatus: S.VERIFIED, actor: admin, ...approval,
  });
  assert.strictEqual(authorized.ok, true, `authorized verification must pass: ${authorized.code}`);
});

await check('37. no fabricated score or proficiency level anywhere', () => {
  // The old evidence-count-weighted score is gone, not merely unused
  assert.strictEqual(sv.computeVerificationScore, undefined,
    'the inferred confidence score must not exist');

  // A score cannot ride along with a method that measured nothing
  const smuggled = sv.evaluateVerificationSufficiency({
    toStatus: S.VERIFIED, method: M.ISSUER_CONFIRMATION,
    evidenceTypes: [T.CREDENTIAL_CERTIFICATE], corroborationRef: 'registrar@issuer.example',
    assessment: { score: 95 },
  });
  assert.strictEqual(smuggled.ok, false, 'a credential check cannot carry a proficiency score');
  assert.strictEqual(smuggled.code, sv.SUFFICIENCY_CODES.PROFICIENCY_NOT_SUPPORTED);

  // Applicants cannot supply proficiency or the records that would justify it
  for (const field of ['proficiencyScore', 'proficiencyEvidenced', 'assessment', 'rubricId', 'rubricVersion', 'corroborationRef']) {
    assert.ok(sv.TRUST_CONTROLLED_FIELDS.includes(field), `${field} must be trust-controlled`);
    const r = svc.validateClaimInput({ skillName: 'React', [field]: 'x' });
    assert.strictEqual(r.ok, false, `${field} must be refused on claim input`);
    assert.strictEqual(r.code, 'TRUST_FIELD_FORBIDDEN');
  }

  // An evidence-backed claim exposes no score and no substantiated level
  const backed = sv.projectClaimForEmployer(
    claimAt(S.EVIDENCE_BACKED, { verificationMethod: M.MANUAL_EVIDENCE_REVIEW, claimedLevel: 'expert', proficiencyScore: 90 }),
    []
  );
  assert.strictEqual(backed.proficiencyScore, null, 'evidence-backed must expose no score');
  assert.strictEqual(backed.proficiencyEvidenced, false);

  // Even a stored score is withheld unless the method actually measured it
  const credentialVerified = sv.projectClaimForEmployer(
    claimAt(S.VERIFIED, { verificationMethod: M.ISSUER_CONFIRMATION, proficiencyScore: 90 }), []
  );
  assert.strictEqual(credentialVerified.proficiencyScore, null,
    'a credential check exposes no proficiency, even with a stored value');

  const assessmentVerified = sv.projectClaimForEmployer(
    claimAt(S.VERIFIED, { verificationMethod: M.INTERVIEW_ASSESSMENT, proficiencyScore: 74 }), []
  );
  assert.strictEqual(assessmentVerified.proficiencyScore, 74, 'a measured score is shown');
  assert.strictEqual(assessmentVerified.proficiencyEvidenced, true);

  // The public projection exposes neither a score nor a claimed level at all
  const pub = sv.projectClaimForPublic(claimAt(S.VERIFIED, { verificationMethod: M.INTERVIEW_ASSESSMENT, proficiencyScore: 74, claimedLevel: 'expert' }));
  for (const leaked of ['proficiencyScore', 'proficiencyEvidenced', 'claimedLevel']) {
    assert.ok(!Object.keys(pub).includes(leaked), `public projection must not expose ${leaked}`);
  }
});

await check('38. employer projection distinguishes evidence-backed from the verifieds', () => {
  const backed = sv.projectClaimForEmployer(
    claimAt(S.EVIDENCE_BACKED, { verificationMethod: M.MANUAL_EVIDENCE_REVIEW }), []
  );
  const credential = sv.projectClaimForEmployer(
    claimAt(S.VERIFIED, { verificationMethod: M.ISSUER_CONFIRMATION }), []
  );
  const assessed = sv.projectClaimForEmployer(
    claimAt(S.VERIFIED, { verificationMethod: M.INTERVIEW_ASSESSMENT }), []
  );
  const referenced = sv.projectClaimForEmployer(
    claimAt(S.VERIFIED, { verificationMethod: M.EMPLOYER_REFERENCE }), []
  );

  assert.strictEqual(backed.isCurrentlyVerified, false, 'evidence-backed is not verified');
  assert.strictEqual(backed.trustLabel, 'Evidence-backed');
  for (const projection of [credential, assessed, referenced]) {
    assert.strictEqual(projection.isCurrentlyVerified, true);
  }

  //     Evidence-backed != Skill verified != Assessment verified
  const labels = [backed.trustLabel, credential.trustLabel, assessed.trustLabel, referenced.trustLabel];
  assert.strictEqual(new Set(labels).size, labels.length, `labels must all differ: ${labels.join(' / ')}`);
  assert.strictEqual(assessed.trustLabel, 'Assessment verified');
  assert.strictEqual(credential.trustLabel, 'Credential verified');
  assert.strictEqual(referenced.trustLabel, 'Reference verified');

  // The method reaches the employer, so the distinction is not label-deep
  assert.strictEqual(backed.verificationMethod, M.MANUAL_EVIDENCE_REVIEW);
  assert.strictEqual(assessed.verificationMethod, M.INTERVIEW_ASSESSMENT);

  // The trust filter still treats evidence-backed as short of verified
  assert.strictEqual(
    sv.matchesTrustFilter(claimAt(S.EVIDENCE_BACKED), sv.EMPLOYER_TRUST_FILTERS.VERIFIED), false
  );
});

await check('39. the application snapshot preserves the distinction', () => {
  const now = new Date();
  const snap = sv.buildSkillSnapshot([
    { skillName: 'React', status: S.EVIDENCE_BACKED, verificationMethod: M.MANUAL_EVIDENCE_REVIEW, claimedLevel: 'expert', proficiencyScore: 95, evidenceCount: 3 },
    { skillName: 'Figma', status: S.VERIFIED, verificationMethod: M.INTERVIEW_ASSESSMENT, proficiencyScore: 74, evidenceCount: 1 },
    { skillName: 'PMP', status: S.VERIFIED, verificationMethod: M.ISSUER_CONFIRMATION, proficiencyScore: 99, evidenceCount: 1 },
  ], now);

  const [backed, assessed, credential] = snap.skills;
  assert.strictEqual(backed.isCurrentlyVerified, false, 'evidence-backed must freeze as not verified');
  assert.strictEqual(backed.verificationMethod, M.MANUAL_EVIDENCE_REVIEW,
    'the method must survive the freeze, or the distinction is lost');
  assert.strictEqual(backed.proficiencyScore, null, 'evidence-backed carries no score into history');
  assert.strictEqual(backed.proficiencyEvidenced, false);

  assert.strictEqual(assessed.isCurrentlyVerified, true);
  assert.strictEqual(assessed.proficiencyScore, 74, 'a measured score is preserved');
  assert.strictEqual(assessed.proficiencyEvidenced, true);

  assert.strictEqual(credential.isCurrentlyVerified, true);
  assert.strictEqual(credential.proficiencyScore, null,
    'a credential check freezes with no proficiency, even with a stored value');

  // The frozen record renders with the same three-way distinction
  const labels = snap.skills.map((s) => sv.getTrustStateDisplay(s.trustState, s.verificationMethod).label);
  assert.deepStrictEqual(labels, ['Evidence-backed', 'Assessment verified', 'Credential verified']);

  // And the employer-facing snapshot projection keeps the method + score rule
  const cardSrc = readFileSync(
    path.join(repoRoot, 'server/src/services/career/EmployerCandidateCardService.js'), 'utf8'
  );
  const proj = cardSrc.slice(cardSrc.indexOf('applicationSkillSnapshot:'), cardSrc.indexOf('jobType:'));
  assert.ok(/verificationMethod/.test(proj), 'snapshot projection must carry the method');
  assert.ok(/proficiencyEvidenced \? \(s\.proficiencyScore \?\? null\) : null/.test(proj),
    'snapshot projection must withhold an unevidenced score');
});

// ===========================================================================
// Summary
// ===========================================================================
console.log(`\n${passed}/39 skill claim + evidence + verification checks passed`);
if (process.exitCode) {
  console.error('FAILURES PRESENT');
} else {
  console.log('All applicant skill claim/evidence/verification acceptance checks passed.');
}
